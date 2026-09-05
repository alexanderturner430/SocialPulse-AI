/**
 * Threads API Wrapper
 * Core API functions for Threads (Meta)
 */

const GRAPH_URL = "https://graph.facebook.com/v22.0";

function getAccessToken() {
  return process.env.THREADS_ACCESS_TOKEN;
}

function getUserId() {
  return process.env.THREADS_USER_ID;
}

async function graphRequest(endpoint, params = {}, method = "GET") {
  const token = getAccessToken();
  if (!token) throw new Error("THREADS_ACCESS_TOKEN not configured");

  const url = new URL(`${GRAPH_URL}${endpoint}`);
  if (method === "GET") {
    url.searchParams.set("access_token", token);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const options = { method, headers: {} };
  if (method === "POST") {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify({ ...params, access_token: token });
  }

  const response = await fetch(url.toString(), options);
  const data = await response.json();

  if (data.error) {
    const err = new Error(data.error.message || "Threads API error");
    err.status = data.error.code || 500;
    throw err;
  }

  return data;
}

async function getProfile() {
  try {
    const userId = getUserId();
    if (!userId) throw new Error("THREADS_USER_ID not configured");

    const data = await graphRequest(`/${userId}`, {
      fields: "id,username,name,biography,followers_count,follows_count,media_count,website"
    });

    return {
      id: data.id,
      username: data.username,
      name: data.name,
      bio: data.biography,
      followers: data.followers_count || 0,
      following: data.follows_count || 0,
      posts: data.media_count || 0,
      website: data.website
    };
  } catch (error) {
    throw new Error(`Threads profile fetch failed: ${error.message}`);
  }
}

async function getPosts(limit = 25) {
  try {
    const userId = getUserId();
    if (!userId) throw new Error("THREADS_USER_ID not configured");

    const data = await graphRequest(`/${userId}/threads`, {
      fields: "id,text,timestamp,like_count,comments_count,children{media_url,media_type}",
      limit: Math.min(limit, 100)
    });

    return (data.data || []).map(post => ({
      id: post.id,
      text: post.text,
      timestamp: post.timestamp,
      likes: post.like_count || 0,
      comments: post.comments_count || 0,
      media: post.children?.data || []
    }));
  } catch (error) {
    throw new Error(`Threads posts fetch failed: ${error.message}`);
  }
}

async function getPostInsights(mediaId) {
  try {
    const data = await graphRequest(`/${mediaId}/insights`, {
      metric: "impressions,reach,likes,comments,reposts,shares"
    });

    const metrics = {};
    (data.data || []).forEach(m => {
      metrics[m.name] = m.values?.[0]?.value || 0;
    });

    return {
      mediaId,
      impressions: metrics.impressions || 0,
      reach: metrics.reach || 0,
      likes: metrics.likes || 0,
      comments: metrics.comments || 0,
      reposts: metrics.reposts || 0,
      shares: metrics.shares || 0,
      engagementRate: metrics.reach > 0
        ? ((metrics.likes + metrics.comments + metrics.reposts + metrics.shares) / metrics.reach * 100).toFixed(2)
        : 0
    };
  } catch (error) {
    throw new Error(`Threads post insights failed: ${error.message}`);
  }
}

async function searchPosts(query, limit = 20) {
  try {
    const data = await graphRequest("/ig_hashtag_search", {
      q: query,
      limit: Math.min(limit, 50)
    });

    const hashtags = data.data || [];
    const results = [];

    for (const tag of hashtags.slice(0, 5)) {
      try {
        const tagMedia = await graphRequest(`/${tag.id}/recent_media`, {
          fields: "id,text,timestamp,like_count,comments_count",
          limit: Math.min(limit, 10)
        });
        results.push(...(tagMedia.data || []));
      } catch (e) {
        // Skip failed hashtag fetches
      }
    }

    return results.map(post => ({
      id: post.id,
      text: post.text,
      timestamp: post.timestamp,
      likes: post.like_count || 0,
      comments: post.comments_count || 0
    }));
  } catch (error) {
    throw new Error(`Threads search failed: ${error.message}`);
  }
}

async function getReplies(mediaId, limit = 50) {
  try {
    const data = await graphRequest(`/${mediaId}/replies`, {
      fields: "id,text,timestamp,like_count,text_post_app_define_media_product_type",
      limit: Math.min(limit, 100)
    });

    return (data.data || []).map(reply => ({
      id: reply.id,
      text: reply.text,
      timestamp: reply.timestamp,
      likes: reply.like_count || 0
    }));
  } catch (error) {
    throw new Error(`Threads replies fetch failed: ${error.message}`);
  }
}

async function publishPost(text, mediaUrl = null) {
  try {
    const userId = getUserId();
    if (!userId) throw new Error("THREADS_USER_ID not configured");

    const params = { text };
    if (mediaUrl) {
      params.media_type = "IMAGE_URL";
      params.image_url = mediaUrl;
    }

    const container = await graphRequest(`/${userId}/threads`, params, "POST");

    if (!container.id) throw new Error("Failed to create container");

    const published = await graphRequest(`/${userId}/threads_publish`, {
      creation_id: container.id
    }, "POST");

    return {
      success: true,
      postId: published.id,
      message: "Thread published successfully"
    };
  } catch (error) {
    throw new Error(`Threads publish failed: ${error.message}`);
  }
}

async function generatePost(topic, style = "casual") {
  const { askLLM } = require("./llm");
  const prompt = `Generate 5 Threads posts for: "${topic}". Style: ${style}. Keep concise and engaging. Format as JSON array.`;
  const response = await askLLM(prompt, "You are a Threads content expert. Create engaging posts.");
  return { topic, style, posts: response };
}

async function getAudienceInsights() {
  try {
    const userId = getUserId();
    if (!userId) throw new Error("THREADS_USER_ID not configured");

    const data = await graphRequest(`/${userId}/insights`, {
      metric: "audience_gender_age,audience_country",
      period: "lifetime"
    });

    const insights = {};
    (data.data || []).forEach(metric => {
      insights[metric.name] = metric.values?.[0]?.value || {};
    });

    return {
      genderAge: insights.audience_gender_age || {},
      countries: insights.audience_country || {}
    };
  } catch (error) {
    throw new Error(`Threads audience insights failed: ${error.message}`);
  }
}

async function trackMentions(limit = 50) {
  try {
    const userId = getUserId();
    if (!userId) throw new Error("THREADS_USER_ID not configured");

    const data = await graphRequest(`/${userId}/mentions`, {
      fields: "id,text,timestamp,like_count,comments_count",
      limit: Math.min(limit, 100)
    });

    return (data.data || []).map(mention => ({
      id: mention.id,
      text: mention.text,
      timestamp: mention.timestamp,
      likes: mention.like_count || 0,
      comments: mention.comments_count || 0
    }));
  } catch (error) {
    throw new Error(`Threads mentions tracking failed: ${error.message}`);
  }
}

async function analyzeCompetitor(userId) {
  try {
    const profile = await graphRequest(`/${userId}`, {
      fields: "id,username,name,biography,followers_count,media_count"
    });

    const posts = await graphRequest(`/${userId}/threads`, {
      fields: "id,text,timestamp,like_count,comments_count",
      limit: 10
    });

    const postList = posts.data || [];
    const totalLikes = postList.reduce((sum, p) => sum + (p.like_count || 0), 0);
    const totalComments = postList.reduce((sum, p) => sum + (p.comments_count || 0), 0);

    return {
      profile: {
        id: profile.id,
        username: profile.username,
        name: profile.name,
        bio: profile.biography,
        followers: profile.followers_count || 0,
        posts: profile.media_count || 0
      },
      metrics: {
        avgLikes: postList.length > 0 ? Math.round(totalLikes / postList.length) : 0,
        avgComments: postList.length > 0 ? Math.round(totalComments / postList.length) : 0,
        engagementRate: profile.followers_count > 0
          ? ((totalLikes + totalComments) / profile.followers_count * 100).toFixed(2)
          : 0
      },
      recentPosts: postList.slice(0, 5).map(p => ({
        text: p.text?.slice(0, 200),
        likes: p.like_count || 0,
        comments: p.comments_count || 0
      }))
    };
  } catch (error) {
    throw new Error(`Threads competitor analysis failed: ${error.message}`);
  }
}

module.exports = {
  getProfile,
  getPosts,
  getPostInsights,
  searchPosts,
  getReplies,
  publishPost,
  generatePost,
  getAudienceInsights,
  trackMentions,
  analyzeCompetitor
};
