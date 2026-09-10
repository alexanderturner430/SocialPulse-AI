const API_BASE = "https://www.googleapis.com/youtube/v3";
const TIMEOUT_MS = 10_000;

function isEnabled() {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

async function callApi(endpoint, params) {
  const query = new URLSearchParams({ ...params, key: process.env.YOUTUBE_API_KEY });
  const response = await fetch(`${API_BASE}/${endpoint}?${query}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.error?.message || `YouTube API returned ${response.status}.`;
    const status = response.status === 403 && /quota/i.test(message) ? 429 : 502;
    throw Object.assign(new Error(message), { status });
  }
  return response.json();
}

function parseIsoDuration(value) {
  const match = String(value).match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const [, days, hours, minutes, seconds] = [...match].map((part) => Number(part) || 0);
  return ((days * 24 + hours) * 60 + minutes) * 60 + seconds;
}

async function searchVideos(query, limit = 10) {
  const data = await callApi("search", {
    part: "snippet",
    q: query,
    type: "video",
    maxResults: Math.min(Math.max(Number(limit) || 10, 1), 25)
  });
  return (data.items ?? []).map((item) => ({
    id: item.id?.videoId ?? null,
    title: item.snippet?.title ?? null,
    channel: item.snippet?.channelTitle ?? null,
    channelId: item.snippet?.channelId ?? null,
    publishedAt: item.snippet?.publishedAt ?? null,
    description: item.snippet?.description ?? null,
    thumbnail: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? null
  }));
}

async function videoDetails(ids) {
  const data = await callApi("videos", { part: "snippet,statistics,contentDetails", id: ids.join(",") });
  return (data.items ?? []).map((item) => ({
    id: item.id,
    title: item.snippet?.title ?? null,
    channel: item.snippet?.channelTitle ?? null,
    viewCount: Number(item.statistics?.viewCount) || null,
    likeCount: Number(item.statistics?.likeCount) || null,
    commentCount: Number(item.statistics?.commentCount) || null,
    durationSeconds: parseIsoDuration(item.contentDetails?.duration)
  }));
}

module.exports = { isEnabled, searchVideos, videoDetails };
