import type { ListingPostInput } from "@/lib/posting/types";
import { getPostingChannel, updatePostingChannel } from "@/lib/api-server/posting/channels";

const GRAPH = "https://graph.facebook.com/v19.0";

export type InstagramConfig = {
  enabled: boolean;
  appId: string;
  appSecret: string;
  redirectUri: string;
  accessToken: string;
  accountId: string;
  username?: string;
  accountType?: string;
};

export type InstagramAccount = {
  id: string;
  username?: string;
  name?: string;
  accountType?: string;
  profilePictureUrl?: string;
};

export type InstagramPublishResult = {
  mediaId: string;
  postUrl?: string;
  permalink?: string;
};

export class InstagramError extends Error {
  code: string;
  constructor(message: string, code = "instagram_error") {
    super(message);
    this.code = code;
    this.name = "InstagramError";
  }
}

function envFlag(name: string, fallback = false): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return fallback;
}

export async function loadInstagramConfig(): Promise<InstagramConfig> {
  const channel = await getPostingChannel("INSTAGRAM");
  const settings = channel?.settings ?? {};
  const secrets = channel?.secrets ?? {};

  return {
    enabled:
      channel?.enabled ??
      (envFlag("INSTAGRAM_ENABLED", false) ||
        Boolean(process.env.INSTAGRAM_ACCESS_TOKEN)),
    appId: settings.appId?.trim() || process.env.INSTAGRAM_APP_ID?.trim() || "",
    appSecret:
      secrets.appSecret?.trim() || process.env.INSTAGRAM_APP_SECRET?.trim() || "",
    redirectUri:
      settings.redirectUri?.trim() ||
      process.env.INSTAGRAM_REDIRECT_URI?.trim() ||
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/integrations/instagram/callback`,
    accessToken:
      secrets.accessToken?.trim() || process.env.INSTAGRAM_ACCESS_TOKEN?.trim() || "",
    accountId:
      settings.igUserId?.trim() ||
      settings.accountId?.trim() ||
      process.env.INSTAGRAM_ACCOUNT_ID?.trim() ||
      process.env.INSTAGRAM_USER_ID?.trim() ||
      "",
    username: settings.igUsername?.trim() || settings.accountName?.trim(),
    accountType: settings.accountType?.trim(),
  };
}

export async function isInstagramEnabled(): Promise<boolean> {
  const cfg = await loadInstagramConfig();
  return cfg.enabled;
}

export async function isInstagramConnected(): Promise<boolean> {
  const cfg = await loadInstagramConfig();
  return Boolean(cfg.accessToken && cfg.accountId);
}

export function getInstagramAuthUrl(state?: string): string {
  const appId = process.env.INSTAGRAM_APP_ID?.trim();
  const redirectUri =
    process.env.INSTAGRAM_REDIRECT_URI?.trim() ||
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/integrations/instagram/callback`;

  if (!appId) {
    throw new InstagramError("Instagram App ID sozlanmagan", "app_id_missing");
  }

  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
    "business_management",
  ].join(",");

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: "code",
    ...(state ? { state } : {}),
  });

  return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
}

async function graphGet<T>(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const data = (await res.json()) as T & { error?: { message: string; code?: number; type?: string } };
  if (data.error) {
    throw mapGraphError(data.error);
  }
  return data;
}

async function graphPost<T>(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { method: "POST" });
  const data = (await res.json()) as T & { error?: { message: string; code?: number; type?: string } };
  if (data.error) {
    throw mapGraphError(data.error);
  }
  return data;
}

function mapGraphError(error: { message: string; code?: number; type?: string }): InstagramError {
  const msg = error.message ?? "Instagram API xatosi";
  const lower = msg.toLowerCase();

  if (error.code === 190 || lower.includes("expired") || lower.includes("session has expired")) {
    return new InstagramError("Access token muddati tugagan. Qayta ulang.", "token_expired");
  }
  if (lower.includes("permission") || lower.includes("oauth")) {
    return new InstagramError("Instagram ruxsatlari yetarli emas.", "permission_missing");
  }
  if (lower.includes("media type") || lower.includes("business") || lower.includes("creator")) {
    return new InstagramError(
      "Instagram Business yoki Creator akkaunt kerak.",
      "account_not_business"
    );
  }
  if (lower.includes("limit") || lower.includes("rate")) {
    return new InstagramError("Instagram post limitiga yetildi.", "publish_limit");
  }
  if (lower.includes("url") || lower.includes("image")) {
    return new InstagramError("Instagram uchun rasm public URL bo'lishi kerak.", "image_url_invalid");
  }

  return new InstagramError(msg, "graph_error");
}

export async function handleInstagramCallback(code: string): Promise<{
  accessToken: string;
  accountId: string;
  username?: string;
  accountType?: string;
}> {
  const cfg = await loadInstagramConfig();
  if (!cfg.appId || !cfg.appSecret) {
    throw new InstagramError("App ID yoki App Secret sozlanmagan", "app_config_missing");
  }

  const tokenRes = await fetch(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      redirect_uri: cfg.redirectUri,
      code,
    })}`
  );
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: { message: string; code?: number };
  };
  if (!tokenData.access_token) {
    throw mapGraphError(tokenData.error ?? { message: "Token olinmadi" });
  }

  const longLived = await fetch(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      fb_exchange_token: tokenData.access_token,
    })}`
  );
  const longData = (await longLived.json()) as { access_token?: string; error?: { message: string } };
  const userToken = longData.access_token ?? tokenData.access_token;

  const pages = await graphGet<{ data?: { id: string; access_token: string; name?: string }[] }>(
    "/me/accounts",
    userToken
  );

  let pageToken = userToken;
  let igAccountId = "";
  let pageName = "";

  for (const page of pages.data ?? []) {
    const pageInfo = await graphGet<{
      instagram_business_account?: { id: string };
      name?: string;
    }>(`/${page.id}`, page.access_token, {
      fields: "instagram_business_account,name",
    });
    if (pageInfo.instagram_business_account?.id) {
      igAccountId = pageInfo.instagram_business_account.id;
      pageToken = page.access_token;
      pageName = pageInfo.name ?? page.name ?? "";
      break;
    }
  }

  if (!igAccountId) {
    throw new InstagramError(
      "Instagram Business/Creator akkaunt topilmadi. Facebook Page bilan bog'langan IG akkaunt kerak.",
      "account_not_business"
    );
  }

  const account = await getInstagramAccount(pageToken, igAccountId);

  await updatePostingChannel("INSTAGRAM", {
    enabled: true,
    settings: {
      appId: cfg.appId,
      redirectUri: cfg.redirectUri,
      igUserId: igAccountId,
      accountId: igAccountId,
      igUsername: account.username ?? "",
      accountName: account.username ?? pageName,
      accountType: account.accountType ?? "BUSINESS",
    },
    secrets: {
      accessToken: pageToken,
      appSecret: cfg.appSecret,
    },
  });

  return {
    accessToken: pageToken,
    accountId: igAccountId,
    username: account.username,
    accountType: account.accountType,
  };
}

export async function getInstagramAccount(
  accessToken?: string,
  accountId?: string
): Promise<InstagramAccount> {
  const cfg = await loadInstagramConfig();
  const token = accessToken ?? cfg.accessToken;
  const id = accountId ?? cfg.accountId;

  if (!token || !id) {
    throw new InstagramError("Instagram ulanmagan", "not_connected");
  }

  const data = await graphGet<{
    id: string;
    username?: string;
    name?: string;
    profile_picture_url?: string;
    account_type?: string;
  }>(`/${id}`, token, {
    fields: "id,username,name,profile_picture_url,account_type",
  });

  const accountType = data.account_type ?? "UNKNOWN";
  if (accountType === "PERSONAL") {
    throw new InstagramError(
      "Shaxsiy Instagram akkaunt qo'llab-quvvatlanmaydi. Business/Creator kerak.",
      "account_not_business"
    );
  }

  return {
    id: data.id,
    username: data.username,
    name: data.name,
    accountType,
    profilePictureUrl: data.profile_picture_url,
  };
}

export function assertPublicImageUrl(imageUrl: string) {
  if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
    throw new InstagramError(
      "Instagram uchun rasm public URL bo'lishi kerak.",
      "image_url_invalid"
    );
  }
  if (imageUrl.startsWith("data:") || imageUrl.includes("localhost")) {
    throw new InstagramError(
      "Instagram uchun rasm public URL bo'lishi kerak (localhost yoki base64 qabul qilinmaydi).",
      "image_url_invalid"
    );
  }
}

export async function publishInstagramImage(
  imageUrl: string,
  caption: string,
  config?: Partial<InstagramConfig>
): Promise<InstagramPublishResult> {
  const cfg = { ...(await loadInstagramConfig()), ...config };

  if (!cfg.enabled) {
    throw new InstagramError("Instagram o'chirilgan", "disabled");
  }
  if (!cfg.accessToken || !cfg.accountId) {
    throw new InstagramError("Instagram ulanmagan", "not_connected");
  }

  assertPublicImageUrl(imageUrl);

  const createData = await graphPost<{ id: string }>(
    `/${cfg.accountId}/media`,
    cfg.accessToken,
    {
      image_url: imageUrl,
      caption,
    }
  );

  const publishData = await graphPost<{ id: string }>(
    `/${cfg.accountId}/media_publish`,
    cfg.accessToken,
    { creation_id: createData.id }
  );

  let permalink: string | undefined;
  try {
    const media = await graphGet<{ permalink?: string }>(
      `/${publishData.id}`,
      cfg.accessToken,
      { fields: "permalink" }
    );
    permalink = media.permalink;
  } catch {
    /* optional */
  }

  return {
    mediaId: publishData.id,
    postUrl: permalink,
    permalink,
  };
}

export async function publishInstagramPost(
  listing: ListingPostInput
): Promise<InstagramPublishResult & { caption: string; channelName?: string }> {
  const { generatePostText } = await import("@/lib/posting/copy-generator");
  const caption = generatePostText(listing, "INSTAGRAM");
  const cfg = await loadInstagramConfig();

  const imageUrl = listing.images?.[0];
  if (!imageUrl) {
    throw new InstagramError("Instagram uchun rasm kerak", "image_missing");
  }

  const result = await publishInstagramImage(imageUrl, caption, cfg);
  return {
    ...result,
    caption,
    channelName: cfg.username ? `@${cfg.username}` : cfg.accountId,
  };
}

export async function testInstagramConnection(): Promise<{
  ok: boolean;
  account?: InstagramAccount;
  message: string;
}> {
  try {
    const cfg = await loadInstagramConfig();
    if (!cfg.enabled) {
      return { ok: false, message: "Instagram o'chirilgan" };
    }
    if (!cfg.accessToken || !cfg.accountId) {
      return { ok: false, message: "Instagram ulanmagan — OAuth orqali ulang" };
    }
    const account = await getInstagramAccount(cfg.accessToken, cfg.accountId);
    return {
      ok: true,
      account,
      message: `@${account.username ?? account.id} — ${account.accountType ?? "BUSINESS"} akkaunt ulandi`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof InstagramError ? err.message : "Ulanish xatosi",
    };
  }
}

export async function disconnectInstagram(): Promise<void> {
  await updatePostingChannel("INSTAGRAM", {
    enabled: false,
    secrets: {
      accessToken: "",
      appSecret: "",
    },
    settings: {
      igUserId: "",
      accountId: "",
      igUsername: "",
      accountName: "",
      accountType: "",
    },
  });
}

export async function saveInstagramSettings(data: {
  enabled?: boolean;
  appId?: string;
  appSecret?: string;
  redirectUri?: string;
  accessToken?: string;
  accountId?: string;
  igUsername?: string;
}) {
  const prev = await getPostingChannel("INSTAGRAM");
  const prevSettings = prev?.settings ?? {};
  const prevSecrets = prev?.secrets ?? {};

  await updatePostingChannel("INSTAGRAM", {
    enabled: data.enabled ?? prev?.enabled ?? false,
    settings: {
      ...prevSettings,
      ...(data.appId !== undefined ? { appId: data.appId } : {}),
      ...(data.redirectUri !== undefined ? { redirectUri: data.redirectUri } : {}),
      ...(data.accountId !== undefined ? { igUserId: data.accountId, accountId: data.accountId } : {}),
      ...(data.igUsername !== undefined ? { igUsername: data.igUsername, accountName: data.igUsername } : {}),
    },
    secrets: {
      ...prevSecrets,
      ...(data.appSecret !== undefined ? { appSecret: data.appSecret } : {}),
      ...(data.accessToken !== undefined ? { accessToken: data.accessToken } : {}),
    },
  });
}

export async function getInstagramPublicStatus() {
  const cfg = await loadInstagramConfig();
  let account: InstagramAccount | undefined;
  let connectionError: string | undefined;

  if (cfg.accessToken && cfg.accountId) {
    try {
      account = await getInstagramAccount(cfg.accessToken, cfg.accountId);
    } catch (err) {
      connectionError = err instanceof Error ? err.message : "Ulanish xatosi";
    }
  }

  return {
    enabled: cfg.enabled,
    connected: Boolean(cfg.accessToken && cfg.accountId && !connectionError),
    hasToken: Boolean(cfg.accessToken),
    hasAppId: Boolean(cfg.appId),
    appId: cfg.appId || undefined,
    redirectUri: cfg.redirectUri,
    accountId: cfg.accountId || undefined,
    username: account?.username ?? cfg.username,
    accountType: account?.accountType ?? cfg.accountType,
    accountName: account?.name,
    profilePictureUrl: account?.profilePictureUrl,
    error: connectionError,
  };
}
