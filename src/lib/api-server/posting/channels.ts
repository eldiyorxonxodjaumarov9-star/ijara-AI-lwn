import type { PostingPlatform } from "@/lib/posting/types";
import { POSTING_PLATFORMS } from "@/lib/posting/types";
import type { PostingChannelConfig } from "@/lib/api-server/posting/adapters";
import { isPostingDbReady } from "@/lib/api-server/posting/db-ready";
import { prisma } from "@/lib/api-server/prisma";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const CHANNELS_FILE = path.join(DATA_DIR, "posting-channels.json");
const CHANNELS_KEY = "arenda:posting-channels";

export async function getPostingChannels(): Promise<PostingChannelConfig[]> {
  if (await isPostingDbReady()) {
    await ensureDefaultChannels();
    const rows = await prisma.postingChannel.findMany();
    return POSTING_PLATFORMS.map((platform) => {
      const row = rows.find((r) => r.platform === platform);
      return {
        platform,
        enabled: row?.enabled ?? platform === "ARENDA_INTERNAL",
        settings: (row?.settings as Record<string, string>) ?? {},
        secrets: (row?.secrets as Record<string, string>) ?? {},
      };
    });
  }
  return readServerChannels();
}

export async function getPostingChannel(
  platform: PostingPlatform
): Promise<PostingChannelConfig | null> {
  const all = await getPostingChannels();
  return all.find((c) => c.platform === platform) ?? null;
}

/** Frontend uchun — secret qiymatlari yashirilgan */
export async function getPostingChannelsPublic() {
  const channels = await getPostingChannels();
  return channels.map((c) => ({
    platform: c.platform,
    enabled: c.enabled,
    settings: c.settings,
    hasBotToken: Boolean(c.secrets.botToken || c.secrets.accessToken),
    hasChannelId: Boolean(c.settings.channelId || c.secrets.channelId),
  }));
}

export async function updatePostingChannel(
  platform: PostingPlatform,
  data: {
    enabled?: boolean;
    settings?: Record<string, string>;
    secrets?: Record<string, string>;
  }
) {
  if (await isPostingDbReady()) {
    await ensureDefaultChannels();
    const existing = await prisma.postingChannel.findUnique({ where: { platform } });
    const prevSecrets = (existing?.secrets as Record<string, string>) ?? {};
    const prevSettings = (existing?.settings as Record<string, string>) ?? {};
    const mergedSecrets = { ...prevSecrets, ...(data.secrets ?? {}) };
    const mergedSettings = { ...prevSettings, ...(data.settings ?? {}) };

    await prisma.postingChannel.upsert({
      where: { platform },
      create: {
        platform,
        enabled: data.enabled ?? false,
        settings: mergedSettings,
        secrets: mergedSecrets,
      },
      update: {
        enabled: data.enabled ?? existing?.enabled ?? false,
        settings: mergedSettings,
        secrets: mergedSecrets,
      },
    });
    return;
  }

  const local = readServerChannels();
  const idx = local.findIndex((c) => c.platform === platform);
  const prev = idx >= 0 ? local[idx] : { platform, enabled: false, settings: {}, secrets: {} };
  const updated: PostingChannelConfig = {
    platform,
    enabled: data.enabled ?? prev.enabled,
    settings: { ...prev.settings, ...(data.settings ?? {}) },
    secrets: { ...prev.secrets, ...(data.secrets ?? {}) },
  };
  if (idx >= 0) local[idx] = updated;
  else local.push(updated);
  writeServerChannels(local);
}

async function ensureDefaultChannels() {
  for (const platform of POSTING_PLATFORMS) {
    await prisma.postingChannel.upsert({
      where: { platform },
      create: {
        platform,
        enabled: platform === "ARENDA_INTERNAL" || platform === "TELEGRAM",
      },
      update: {},
    });
  }
}

function readServerChannels(): PostingChannelConfig[] {
  try {
    if (fs.existsSync(CHANNELS_FILE)) {
      const raw = fs.readFileSync(CHANNELS_FILE, "utf8");
      return JSON.parse(raw) as PostingChannelConfig[];
    }
  } catch {
    /* ignore */
  }
  return defaultChannels();
}

function writeServerChannels(channels: PostingChannelConfig[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CHANNELS_FILE, JSON.stringify(channels, null, 2));
}

function getLocalChannels(): PostingChannelConfig[] {
  if (typeof window === "undefined") {
    return defaultChannels();
  }
  try {
    const raw = window.localStorage.getItem(CHANNELS_KEY);
    if (!raw) return defaultChannels();
    return JSON.parse(raw) as PostingChannelConfig[];
  } catch {
    return defaultChannels();
  }
}

function saveLocalChannels(channels: PostingChannelConfig[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHANNELS_KEY, JSON.stringify(channels));
}

function defaultChannels(): PostingChannelConfig[] {
  return POSTING_PLATFORMS.map((platform) => ({
    platform,
    enabled:
      platform === "ARENDA_INTERNAL" ||
      platform === "TELEGRAM" ||
      platform === "OLX" ||
      platform === "JOYMEE" ||
      platform === "EGASI" ||
      platform === "BESTE",
    settings: {},
    secrets: {},
  }));
}

export function getLocalChannelsClient(): PostingChannelConfig[] {
  return getLocalChannels();
}

export function updateLocalChannelClient(
  platform: PostingPlatform,
  data: Partial<PostingChannelConfig>
) {
  const local = getLocalChannels();
  const idx = local.findIndex((c) => c.platform === platform);
  const prev =
    idx >= 0
      ? local[idx]
      : { platform, enabled: false, settings: {}, secrets: {} };
  const updated = {
    ...prev,
    ...data,
    platform,
    settings: { ...prev.settings, ...(data.settings ?? {}) },
    secrets: { ...prev.secrets, ...(data.secrets ?? {}) },
  };
  if (idx >= 0) local[idx] = updated;
  else local.push(updated);
  saveLocalChannels(local);
}
