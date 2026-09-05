const FEED_URL = "https://www.youtube.com/feeds/videos.xml";
const TIMEOUT_MS = 10_000;

const PLAYLIST_PREFIXES = { all: "UU", videos: "UULF", shorts: "UUSH" };

function uploadsPlaylistId(channelId, type = "all") {
  const prefix = PLAYLIST_PREFIXES[type];
  if (!prefix) {
    throw Object.assign(new Error("type must be one of: all, videos, shorts."), { status: 400 });
  }
  return `${prefix}${channelId.slice(2)}`;
}

function decodeEntities(text) {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function tag(source, name) {
  const match = source.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return match ? decodeEntities(match[1].trim()) : null;
}

function attribute(source, name, attributeName) {
  const match = source.match(new RegExp(`<${name}\\b[^>]*\\b${attributeName}="([^"]*)"`));
  return match ? decodeEntities(match[1]) : null;
}

function parseFeed(xml) {
  const videos = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, block]) => ({
    id: tag(block, "yt:videoId"),
    title: tag(block, "title"),
    url: block.match(/<link\b(?=[^>]*rel="alternate")[^>]*href="([^"]+)"/)?.[1] ?? null,
    published: tag(block, "published"),
    updated: tag(block, "updated"),
    description: tag(block, "media:description"),
    author: tag((block.match(/<author>[\s\S]*?<\/author>/) ?? [""])[0], "name"),
    views: Number(attribute(block, "media:statistics", "views")) || null,
    thumbnail: attribute(block, "media:thumbnail", "url")
  }));
  return {
    channelId: tag(xml, "yt:channelId"),
    title: tag(xml, "title"),
    author: tag((xml.match(/<author>[\s\S]*?<\/author>/) ?? [""])[0], "name"),
    videos
  };
}

async function fetchFeed(params) {
  const url = `${FEED_URL}?${new URLSearchParams(params)}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": "MCP-youtube-tools/1.0 (local service)" }
  });
  if (!response.ok) throw new Error(`YouTube feed returned ${response.status}.`);
  return parseFeed(await response.text());
}

module.exports = { fetchFeed, uploadsPlaylistId, PLAYLIST_PREFIXES };
