/**
 * Twitch API Wrapper
 * Core API functions for Twitch Helix API
 */

const API_BASE = "https://api.twitch.tv/helix";

function getClientId() {
  return process.env.TWITCH_CLIENT_ID;
}

function getAccessToken() {
  return process.env.TWITCH_ACCESS_TOKEN;
}

async function apiRequest(endpoint, params = {}) {
  const clientId = getClientId();
  const accessToken = getAccessToken();

  if (!clientId || !accessToken) {
    throw new Error("TWITCH_CLIENT_ID and TWITCH_ACCESS_TOKEN not configured");
  }

  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const response = await fetch(url.toString(), {
    headers: {
      "Client-Id": clientId,
      "Authorization": `Bearer ${accessToken}`
    }
  });

  const data = await response.json();

  if (data.error) {
    const err = new Error(data.message || "Twitch API error");
    err.status = data.status || 500;
    throw err;
  }

  return data.data || data;
}

async function getChannel(userId) {
  try {
    const data = await apiRequest("/channels", { broadcaster_id: userId });
    const channel = data[0];
    if (!channel) throw new Error("Channel not found");

    return {
      id: channel.broadcaster_id,
      name: channel.broadcaster_name,
      login: channel.broadcaster_login,
      title: channel.title,
      game: channel.game_name,
      gameId: channel.game_id,
      language: channel.broadcaster_language,
      tags: channel.tags || [],
      isMature: channel.is_mature || false
    };
  } catch (error) {
    throw new Error(`Twitch channel fetch failed: ${error.message}`);
  }
}

async function getStreams(userId) {
  try {
    const params = {};
    if (userId) params.user_id = userId;

    const data = await apiRequest("/streams", params);
    return data.map(s => ({
      id: s.id,
      userId: s.user_id,
      username: s.user_login,
      displayName: s.user_name,
      title: s.title,
      game: s.game_name,
      gameId: s.game_id,
      language: s.language,
      tags: s.tags || [],
      viewers: s.viewer_count,
      startedAt: s.started_at,
      thumbnail: s.thumbnail_url?.replace("{width}", "440")?.replace("{height}", "248"),
      isLive: s.type === "live"
    }));
  } catch (error) {
    throw new Error(`Twitch streams fetch failed: ${error.message}`);
  }
}

async function getVideos(userId, limit = 10) {
  try {
    const data = await apiRequest("/videos", {
      user_id: userId,
      first: Math.min(limit, 100)
    });

    return data.map(v => ({
      id: v.id,
      title: v.title,
      description: v.description,
      url: v.url,
      thumbnail: v.thumbnail_url,
      viewable: v.viewable,
      views: v.view_count,
      duration: v.duration,
      createdAt: v.created_at,
      publishedAt: v.published_at,
      language: v.language,
      type: v.type
    }));
  } catch (error) {
    throw new Error(`Twitch videos fetch failed: ${error.message}`);
  }
}

async function getClips(broadcasterId, limit = 20) {
  try {
    const data = await apiRequest("/clips", {
      broadcaster_id: broadcasterId,
      first: Math.min(limit, 100)
    });

    return data.map(c => ({
      id: c.id,
      title: c.title,
      url: c.url,
      embedUrl: c.embed_url,
      thumbnail: c.thumbnail_url,
      views: c.view_count,
      duration: c.duration,
      creator: c.creator_name,
      gameId: c.game_id,
      game: c.game_name,
      createdAt: c.created_at
    }));
  } catch (error) {
    throw new Error(`Twitch clips fetch failed: ${error.message}`);
  }
}

async function getViewerAnalytics(userId) {
  try {
    const streams = await getStreams(userId);
    if (streams.length === 0) {
      return { userId, isLive: false, viewers: 0 };
    }

    const stream = streams[0];
    return {
      userId,
      isLive: true,
      title: stream.title,
      game: stream.game,
      viewers: stream.viewers,
      language: stream.language,
      tags: stream.tags,
      startedAt: stream.startedAt,
      uptime: Math.floor((Date.now() - new Date(stream.startedAt).getTime()) / 1000 / 60),
      thumbnail: stream.thumbnail
    };
  } catch (error) {
    throw new Error(`Twitch viewer analytics failed: ${error.message}`);
  }
}

async function searchChannels(query, limit = 10) {
  try {
    const data = await apiRequest("/search/channels", {
      query,
      first: Math.min(limit, 100)
    });

    return data.map(c => ({
      id: c.id,
      name: c.display_name,
      login: c.login,
      title: c.title,
      game: c.game_name,
      language: c.language,
      isLive: c.is_live,
      viewers: c.viewer_count,
      followers: c.follower_count,
      thumbnail: c.thumbnail_url
    }));
  } catch (error) {
    throw new Error(`Twitch channel search failed: ${error.message}`);
  }
}

async function searchGames(query, limit = 10) {
  try {
    const data = await apiRequest("/search/categories", {
      query,
      first: Math.min(limit, 100)
    });

    return data.map(g => ({
      id: g.id,
      name: g.name,
      boxArt: g.box_art_url,
      igdbId: g.igdb_id
    }));
  } catch (error) {
    throw new Error(`Twitch game search failed: ${error.message}`);
  }
}

async function monitorChat(channelId, limit = 100) {
  try {
    const messages = await apiRequest(`/chat/messages`, {
      channel_id: channelId,
      limit
    });

    return {
      channelId,
      messages: messages.map(m => ({
        id: m.id,
        userId: m.user_id,
        username: m.user_login,
        message: m.message,
        timestamp: m.timestamp
      })),
      count: messages.length
    };
  } catch (error) {
    throw new Error(`Twitch chat monitoring failed: ${error.message}`);
  }
}

async function createClip(broadcasterId, hasDelay = false) {
  try {
    const data = await apiRequest("/clips", {
      broadcaster_id: broadcasterId,
      has_delay: hasDelay ? "true" : "false"
    }, "POST");

    return {
      success: true,
      clip: data[0] || null,
      message: "Clip creation initiated"
    };
  } catch (error) {
    throw new Error(`Twitch clip creation failed: ${error.message}`);
  }
}

async function generateTitle(game, style = "engaging") {
  const { askLLM } = require("./llm");
  const prompt = `Generate 5 Twitch stream titles for game: "${game}". Style: ${style}. Keep each under 140 characters. Format as JSON array.`;
  const response = await askLLM(prompt, "You are a Twitch streamer. Create engaging stream titles.");
  return { game, style, titles: response };
}

module.exports = {
  getChannel,
  getStreams,
  getVideos,
  getClips,
  getViewerAnalytics,
  searchChannels,
  searchGames,
  monitorChat,
  createClip,
  generateTitle
};
