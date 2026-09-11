/**
 * The latest uploads of a YouTube channel, from its public feed.
 *
 * https://www.youtube.com/feeds/videos.xml?channel_id=… lists a channel's
 * fifteen most recent videos with no API key, no quota and no account. That
 * is enough for "this week's live": the site only ever needs the newest few.
 *
 * Kept in memory for an hour. The server is one process, and a feed that
 * changes once a week does not need fetching on every page view. A failure
 * (YouTube slow or unreachable, the markup changed) returns what was last
 * fetched, or nothing, and never breaks the page that asked. Episodes added in
 * the Shows manager still render either way.
 */
export type ChannelVideo = {
  videoId: string;
  title: string;
  publishedAt: string | null;
};

const TTL_MS = 60 * 60 * 1000;
/** After a failure, try again in five minutes rather than on every request. */
const RETRY_MS = 5 * 60 * 1000;

const cache = new Map<string, { at: number; videos: ChannelVideo[] }>();

export async function getChannelVideos(channelId: string): Promise<ChannelVideo[]> {
  const hit = cache.get(channelId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.videos;

  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const videos = parseFeed(await res.text());
    cache.set(channelId, { at: Date.now(), videos });
    return videos;
  } catch (err) {
    console.warn(
      `[youtube] feed for ${channelId} unavailable: ${err instanceof Error ? err.message : String(err)}`,
    );
    const stale = hit?.videos ?? [];
    cache.set(channelId, { at: Date.now() - TTL_MS + RETRY_MS, videos: stale });
    return stale;
  }
}

/** The feed is Atom. Only three fields per entry are needed, so no XML parser. */
function parseFeed(xml: string): ChannelVideo[] {
  return xml
    .split("<entry>")
    .slice(1)
    .map((entry) => {
      const pick = (tag: string) =>
        entry.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1] ?? "";
      return {
        videoId: pick("yt:videoId"),
        title: decodeEntities(pick("title")),
        publishedAt: pick("published") || null,
      };
    })
    // A YouTube id is exactly eleven of these characters. Anything else never
    // reaches an embed URL.
    .filter((v) => /^[A-Za-z0-9_-]{11}$/.test(v.videoId));
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
};

function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos|#39);/g, (m, name: string) => ENTITIES[name] ?? m);
}
