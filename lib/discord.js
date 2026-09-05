/**
 * Discord API Wrapper
 * Core API functions for Discord Bot
 */

const API_BASE = "https://discord.com/api/v10";

function getBotToken() {
  return process.env.DISCORD_BOT_TOKEN;
}

async function apiRequest(endpoint, params = {}, method = "GET") {
  const token = getBotToken();
  if (!token) throw new Error("DISCORD_BOT_TOKEN not configured");

  const url = new URL(`${API_BASE}${endpoint}`);
  if (method === "GET") {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const options = {
    method,
    headers: {
      "Authorization": `Bot ${token}`,
      "Content-Type": "application/json"
    }
  };

  if (method === "POST" || method === "PATCH") {
    options.body = JSON.stringify(params);
  }

  const response = await fetch(url.toString(), options);

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After") || 1;
    throw new Error(`Rate limited. Retry after ${retryAfter}s`);
  }

  const data = await response.json();

  if (data.message) {
    const err = new Error(data.message || "Discord API error");
    err.status = data.code || 500;
    throw err;
  }

  return data;
}

async function getServer(guildId) {
  try {
    const guild = await apiRequest(`/guilds/${guildId}`, {
      with_counts: "true"
    });

    return {
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      owner: guild.owner_id,
      members: guild.approximate_member_count || 0,
      online: guild.approximate_presence_count || 0,
      channels: guild.channels || [],
      roles: guild.roles || [],
      createdAt: guild.id ? new Date(Number((BigInt(guild.id) >> 22n) + 1420070400000n)).toISOString() : null
    };
  } catch (error) {
    throw new Error(`Discord server fetch failed: ${error.message}`);
  }
}

async function getChannels(guildId) {
  try {
    const channels = await apiRequest(`/guilds/${guildId}/channels`);
    return channels.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      topic: c.topic || "",
      position: c.position,
      nsfw: c.nsfw || false
    }));
  } catch (error) {
    throw new Error(`Discord channels fetch failed: ${error.message}`);
  }
}

async function getMessageAnalytics(channelId, limit = 100) {
  try {
    const messages = await apiRequest(`/channels/${channelId}/messages`, {
      limit: Math.min(limit, 100)
    });

    const authors = {};
    const hourlyActivity = new Array(24).fill(0);
    const dailyActivity = new Array(7).fill(0);
    let totalLength = 0;

    messages.forEach(msg => {
      const authorId = msg.author?.id;
      if (authorId) {
        authors[authorId] = (authors[authorId] || 0) + 1;
      }

      const date = new Date(msg.timestamp);
      hourlyActivity[date.getHours()]++;
      dailyActivity[date.getDay()]++;

      totalLength += (msg.content || "").length;
    });

    const topAuthors = Object.entries(authors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, count }));

    return {
      channelId,
      messageCount: messages.length,
      uniqueAuthors: Object.keys(authors).length,
      avgMessageLength: messages.length > 0 ? Math.round(totalLength / messages.length) : 0,
      hourlyActivity,
      dailyActivity,
      topAuthors,
      timeRange: {
        oldest: messages[messages.length - 1]?.timestamp,
        newest: messages[0]?.timestamp
      }
    };
  } catch (error) {
    throw new Error(`Discord message analytics failed: ${error.message}`);
  }
}

async function getMembers(guildId, limit = 100) {
  try {
    const data = await apiRequest(`/guilds/${guildId}/members`, {
      limit: Math.min(limit, 1000)
    });

    return data.map(m => ({
      id: m.user?.id,
      username: m.user?.username,
      displayName: m.nick || m.user?.global_name || m.user?.username,
      roles: m.roles || [],
      joinedAt: m.joined_at,
      premium: m.premium_since !== null,
      status: m.presence?.status || "offline"
    }));
  } catch (error) {
    throw new Error(`Discord members fetch failed: ${error.message}`);
  }
}

async function getMemberActivity(guildId, userId) {
  try {
    const member = await apiRequest(`/guilds/${guildId}/members/${userId}`);
    const user = await apiRequest(`/users/${userId}`);

    return {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      roles: member.roles || [],
      joinedAt: member.joined_at,
      premium: member.premium_since !== null,
      muted: member.mute || false,
      deafened: member.deaf || false
    };
  } catch (error) {
    throw new Error(`Discord member activity failed: ${error.message}`);
  }
}

async function sendMessage(channelId, content, options = {}) {
  try {
    const payload = { content };
    if (options.embeds) payload.embeds = options.embeds;
    if (options.replyTo) {
      payload.message_reference = { message_id: options.replyTo };
    }

    const message = await apiRequest(`/channels/${channelId}/messages`, payload, "POST");

    return {
      success: true,
      messageId: message.id,
      channelId: message.channel_id,
      timestamp: message.timestamp
    };
  } catch (error) {
    throw new Error(`Discord message send failed: ${error.message}`);
  }
}

async function generateMessage(channelId, topic, style = "casual") {
  const { askLLM } = require("./llm");
  const prompt = `Generate a Discord message for channel context: "${topic}". Style: ${style}. Keep it concise and engaging. Format as JSON with "message" field.`;
  const response = await askLLM(prompt, "You are a Discord community manager. Create engaging messages.");
  return { channelId, topic, style, message: response };
}

async function analyzeSentiment(channelId, limit = 100) {
  try {
    const messages = await apiRequest(`/channels/${channelId}/messages`, {
      limit: Math.min(limit, 100)
    });

    const sentiments = messages.map(msg => {
      const text = (msg.content || "").toLowerCase();
      const positive = ["love", "great", "awesome", "amazing", "good", "nice", "cool", "thanks", "happy", "fun"].some(w => text.includes(w));
      const negative = ["hate", "bad", "terrible", "awful", "worst", "stupid", "boring", "angry", "sad", "annoyed"].some(w => text.includes(w));
      return positive ? 1 : negative ? -1 : 0;
    });

    const positive = sentiments.filter(s => s > 0).length;
    const negative = sentiments.filter(s => s < 0).length;
    const neutral = sentiments.filter(s => s === 0).length;

    return {
      channelId,
      messageCount: messages.length,
      sentiment: {
        positive,
        negative,
        neutral,
        score: sentiments.reduce((a, b) => a + b, 0) / (sentiments.length || 1),
        label: positive > negative ? "positive" : negative > positive ? "negative" : "neutral"
      }
    };
  } catch (error) {
    throw new Error(`Discord sentiment analysis failed: ${error.message}`);
  }
}

async function trackGrowth(guildId, days = 30) {
  try {
    const guild = await apiRequest(`/guilds/${guildId}`, {
      with_counts: "true"
    });

    return {
      guildId,
      name: guild.name,
      currentMembers: guild.approximate_member_count || 0,
      online: guild.approximate_presence_count || 0,
      boostLevel: guild.premium_tier || 0,
      boosts: guild.premium_subscription_count || 0,
      features: guild.features || []
    };
  } catch (error) {
    throw new Error(`Discord growth tracking failed: ${error.message}`);
  }
}

async function analyzeCompetitorServers(serverIds) {
  try {
    const results = await Promise.all(
      serverIds.map(id => getServer(id).catch(() => null))
    );

    const servers = results.filter(Boolean);
    const totalMembers = servers.reduce((sum, s) => sum + s.members, 0);
    const totalOnline = servers.reduce((sum, s) => sum + s.online, 0);

    return {
      servers: servers.map(s => ({
        id: s.id,
        name: s.name,
        members: s.members,
        online: s.online
      })),
      summary: {
        totalServers: servers.length,
        totalMembers,
        totalOnline,
        avgMembersPerServer: servers.length > 0 ? Math.round(totalMembers / servers.length) : 0,
        avgOnlinePerServer: servers.length > 0 ? Math.round(totalOnline / servers.length) : 0
      }
    };
  } catch (error) {
    throw new Error(`Discord competitor analysis failed: ${error.message}`);
  }
}

module.exports = {
  getServer,
  getChannels,
  getMessageAnalytics,
  getMembers,
  getMemberActivity,
  sendMessage,
  generateMessage,
  analyzeSentiment,
  trackGrowth,
  analyzeCompetitorServers
};
