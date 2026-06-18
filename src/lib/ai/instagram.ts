export interface InstagramProfileData {
  username: string;
  url: string;
  displayName?: string;
  bio?: string;
  followersHint?: string;
  postsHint?: string;
  fetchNote?: string;
}

export function parseInstagramUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const withProto = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    const host = url.hostname.replace(/^www\./, "");
    if (!["instagram.com", "instagr.am"].includes(host)) return null;

    const parts = url.pathname.split("/").filter(Boolean);
    const username = parts[0]?.replace("@", "");
    if (!username || ["p", "reel", "reels", "stories", "explore"].includes(username)) {
      return null;
    }
    return username.toLowerCase();
  } catch {
    const direct = trimmed.replace(/^@/, "").split(/[/?#]/)[0];
    return direct && /^[a-zA-Z0-9._]{1,30}$/.test(direct) ? direct.toLowerCase() : null;
  }
}

function decodeMeta(content?: string) {
  if (!content) return undefined;
  return content
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function extractMeta(html: string, property: string) {
  const patterns = [
    new RegExp(`property="${property}" content="([^"]*)"`, "i"),
    new RegExp(`name="${property}" content="([^"]*)"`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeMeta(m[1]);
  }
  return undefined;
}

export async function fetchInstagramProfile(
  username: string
): Promise<InstagramProfileData> {
  const url = `https://www.instagram.com/${username}/`;
  const result: InstagramProfileData = { username, url };

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      result.fetchNote = `Instagram sahifasi yuklanmadi (${res.status})`;
      return result;
    }

    const html = await res.text();
    const ogTitle = extractMeta(html, "og:title");
    const ogDescription = extractMeta(html, "og:description");
    const description = extractMeta(html, "description");

    if (ogTitle) {
      const namePart = ogTitle.split("(")[0]?.trim();
      result.displayName = namePart || ogTitle;
    }

    const bio = ogDescription || description;
    if (bio) {
      result.bio = bio;
      const followersMatch = bio.match(/([\d.,]+[KMB]?)\s+Followers/i);
      const postsMatch = bio.match(/([\d.,]+)\s+Posts/i);
      if (followersMatch) result.followersHint = followersMatch[1];
      if (postsMatch) result.postsHint = postsMatch[1];
    } else {
      result.fetchNote =
        "Profil matni olinmadi. Qo'shimcha ma'lumot maydoniga bio yozing.";
    }
  } catch {
    result.fetchNote =
      "Instagram avtomatik o'qilmadi. Qo'shimcha ma'lumot maydonidan yordam bering.";
  }

  return result;
}
