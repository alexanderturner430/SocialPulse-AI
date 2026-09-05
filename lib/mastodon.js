/**
 * Mastodon API Wrapper
 * Core API functions for Mastodon
 */

function getInstanceUrl() {
  return process.env.MASTODON_INSTANCE_URL;
}

function getAccessToken() {
  return process.env.MASTODON_ACCESS_TOKEN;
}

async function apiRequest(endpoint, params = {}, method = "GET") {
  const instanceUrl = getInstanceUrl();
  const token = getAccessToken();

  if (!instanceUrl) throw new Error("MASTODON_INSTANCE_URL not configured");

  const url = new URL(`${instanceUrl}/api/v1${endpoint}`);
  if (method === "GET") {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const options = { method, headers };

  if (method === "POST" || method === "PATCH") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    const body = new URLSearchParams(params);
    options.body = body.toString();
  }

  const response = await fetch(url.toString(), options);
  const data = await response.json();

  if (data.error) {
    const err = new Error(data.error || "Mastodon API error");
    err.status = data.code || 500;
    throw err;
  }

  return data;
}

async function getAccount(accountId) {
  try {
    const data = await apiRequest(`/accounts/${accountId}`);
    return {
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      bio: data.note,
      followers: data.followers_count || 0,
      following: data.following_count || 0,
      posts: data.statuses_count || 0,
      avatar: data.avatar,
      header: data.header,
      verified: data.verified || false,
      createdAt: data.created_at
    };
  } catch (error) {
    throw new Error(`Mastodon account fetch failed: ${error.message}`);
  }
}

async function getStatuses(accountId, limit = 20) {
  try {
    const data = await apiRequest(`/accounts/${accountId}/statuses`, {
      limit: Math.min(limit, 40)
    });

    return (data || []).map(status => ({
      id: status.id,
      content: status.content,
      createdAt: status.created_at,
      boosts: status.reblogs_count || 0,
      favourites: status.favourites_count || 0,
      replies: status.replies_count || 0,
      visibility: status.visibility,
      language: status.language,
      account: {
        username: status.account?.username,
        displayName: status.account?.display_name
      }
    }));
  } catch (error) {
    throw new Error(`Mastodon statuses fetch failed: ${error.message}`);
  }
}

async function getStatusAnalytics(statusId) {
  try {
    const data = await apiRequest(`/statuses/${statusId}`);
    return {
      id: data.id,
      content: data.content?.replace(/<[^>]*>/g, "").slice(0, 200),
      createdAt: data.created_at,
      boosts: data.reblogs_count || 0,
      favourites: data.favourites_count || 0,
      replies: data.replies_count || 0,
      visibility: data.visibility,
      language: data.language,
      account: {
        username: data.account?.username,
        displayName: data.account?.display_name
      }
    };
  } catch (error) {
    throw new Error(`Mastodon status analytics failed: ${error.message}`);
  }
}

async function search(query, type = "statuses", limit = 20) {
  try {
    const data = await apiRequest("/v2/search", {
      q: query,
      type,
      limit: Math.min(limit, 40)
    });

    return {
      accounts: (data.accounts || []).map(a => ({
        id: a.id,
        username: a.username,
        displayName: a.display_name,
        followers: a.followers_count || 0,
        bio: a.note?.replace(/<[^>]*>/g, "").slice(0, 200)
      })),
      statuses: (data.statuses || []).map(s => ({
        id: s.id,
        content: s.content?.replace(/<[^>]*>/g, "").slice(0, 200),
        createdAt: s.created_at,
        boosts: s.reblogs_count || 0,
        favourites: s.favourites_count || 0,
        replies: s.replies_count || 0,
        account: {
          username: s.account?.username,
          displayName: s.account?.display_name
        }
      })),
      hashtags: (data.hashtags || []).map(h => ({
        name: h.name,
        url: h.url
      }))
    };
  } catch (error) {
    throw new Error(`Mastodon search failed: ${error.message}`);
  }
}

async function getTimelines(type = "home", limit = 20) {
  try {
    const endpoint = type === "home" ? "/timelines/home"
      : type === "local" ? "/timelines/public?local=true"
      : "/timelines/public";

    const data = await apiRequest(endpoint, {
      limit: Math.min(limit, 40)
    });

    return (data || []).map(status => ({
      id: status.id,
      content: status.content?.replace(/<[^>]*>/g, "").slice(0, 200),
      createdAt: status.created_at,
      boosts: status.reblogs_count || 0,
      favourites: status.favourites_count || 0,
      replies: status.replies_count || 0,
      account: {
        username: status.account?.username,
        displayName: status.account?.display_name
      }
    }));
  } catch (error) {
    throw new Error(`Mastodon timelines fetch failed: ${error.message}`);
  }
}

async function postStatus(text, options = {}) {
  try {
    const params = { status: text };
    if (options.replyTo) params.in_reply_to_id = options.replyTo;
    if (options.visibility) params.visibility = options.visibility;
    if (options.spoilerText) params.spoiler_text = options.spoilerText;
    if (options.language) params.language = options.language;

    const data = await apiRequest("/statuses", params, "POST");

    return {
      success: true,
      statusId: data.id,
      createdAt: data.created_at,
      message: "Status posted successfully"
    };
  } catch (error) {
    throw new Error(`Mastodon post failed: ${error.message}`);
  }
}

async function generateToot(topic, style = "casual") {
  const { askLLM } = require("./llm");
  const prompt = `Generate 5 Mastodon toots for: "${topic}". Style: ${style}. Keep under 500 characters. Format as JSON array.`;
  const response = await askLLM(prompt, "You are a Mastodon content expert. Create engaging toots.");
  return { topic, style, toots: response };
}

async function getFollowers(accountId, limit = 40) {
  try {
    const data = await apiRequest(`/accounts/${accountId}/followers`, {
      limit: Math.min(limit, 80)
    });

    return (data || []).map(f => ({
      id: f.id,
      username: f.username,
      displayName: f.display_name,
      followers: f.followers_count || 0,
      following: f.following_count || 0,
      posts: f.statuses_count || 0,
      bio: f.note?.replace(/<[^>]*>/g, "").slice(0, 100)
    }));
  } catch (error) {
    throw new Error(`Mastodon followers fetch failed: ${error.message}`);
  }
}

async function analyzeHashtag(hashtag, limit = 20) {
  try {
    const data = await apiRequest(`/tagged/${hashtag}`, {
      limit: Math.min(limit, 40)
    });

    const statuses = data || [];
    const totalBoosts = statuses.reduce((sum, s) => sum + (s.reblogs_count || 0), 0);
    const totalFavourites = statuses.reduce((sum, s) => sum + (s.favourites_count || 0), 0);
    const totalReplies = statuses.reduce((sum, s) => sum + (s.replies_count || 0), 0);

    return {
      hashtag,
      postCount: statuses.length,
      metrics: {
        totalBoosts,
        totalFavourites,
        totalReplies,
        avgBoosts: statuses.length > 0 ? Math.round(totalBoosts / statuses.length) : 0,
        avgFavourites: statuses.length > 0 ? Math.round(totalFavourites / statuses.length) : 0,
        avgReplies: statuses.length > 0 ? Math.round(totalReplies / statuses.length) : 0
      },
      recentPosts: statuses.slice(0, 5).map(s => ({
        content: s.content?.replace(/<[^>]*>/g, "").slice(0, 200),
        boosts: s.reblogs_count || 0,
        favourites: s.favourites_count || 0,
        account: s.account?.username
      }))
    };
  } catch (error) {
    throw new Error(`Mastodon hashtag analysis failed: ${error.message}`);
  }
}

async function analyzeMultiInstance(instances) {
  try {
    const results = await Promise.all(
      instances.map(async (instanceUrl) => {
        try {
          const url = new URL(`${instanceUrl}/api/v1/instance`);
          const response = await fetch(url.toString());
          const data = await response.json();
          return {
            instance: instanceUrl,
            title: data.title,
            description: data.description,
            version: data.version,
            users: data.usage?.users || 0,
            statusCount: data.usage?.statuses || 0
          };
        } catch (e) {
          return { instance: instanceUrl, error: e.message };
        }
      })
    );

    const valid = results.filter(r => !r.error);
    const totalUsers = valid.reduce((sum, r) => sum + (r.users || 0), 0);
    const totalStatuses = valid.reduce((sum, r) => sum + (r.statusCount || 0), 0);

    return {
      instances: results,
      summary: {
        totalInstances: instances.length,
        successfulFetches: valid.length,
        totalUsers,
        totalStatuses
      }
    };
  } catch (error) {
    throw new Error(`Mastodon multi-instance analysis failed: ${error.message}`);
  }
}

module.exports = {
  getAccount,
  getStatuses,
  getStatusAnalytics,
  search,
  getTimelines,
  postStatus,
  generateToot,
  getFollowers,
  analyzeHashtag,
  analyzeMultiInstance
};
