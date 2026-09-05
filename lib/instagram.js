/**
 * Instagram Graph API Wrapper
 * Core API functions for Instagram Business/Creator accounts
 */

const GRAPH_URL = "https://graph.facebook.com/v25.0";

function getAccessToken() {
  return process.env.INSTAGRAM_ACCESS_TOKEN;
}

function getBusinessAccountId() {
  return process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
}

async function graphRequest(endpoint, params = {}, method = "GET") {
  const token = getAccessToken();
  if (!token) throw new Error("INSTAGRAM_ACCESS_TOKEN not configured");

  const url = new URL(`${GRAPH_URL}${endpoint}`);
  if (method === "GET") {
    url.searchParams.set("access_token", token);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const options = { method, headers: {} };
  if (method === "POST") {
    options.headers["Content-Type"] = "application/x-www-form-urlencoded";
    const body = new URLSearchParams(params);
    body.set("access_token", token);
    options.body = body.toString();
  }

  const response = await fetch(url.toString(), options);
  const data = await response.json();

  if (data.error) {
    const err = new Error(data.error.message || "Instagram API error");
    err.status = data.error.code || 500;
    throw err;
  }

  return data;
}

async function getProfile() {
  const accountId = getBusinessAccountId();
  if (!accountId) throw new Error("INSTAGRAM_BUSINESS_ACCOUNT_ID not configured");

  const data = await graphRequest(`/${accountId}`, {
    fields: "id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website"
  });

  return {
    id: data.id,
    username: data.username,
    name: data.name,
    bio: data.biography,
    followers: data.followers_count,
    following: data.follows_count,
    posts: data.media_count,
    avatar: data.profile_picture_url,
    website: data.website
  };
}

async function getPosts(limit = 25) {
  const accountId = getBusinessAccountId();
  if (!accountId) throw new Error("INSTAGRAM_BUSINESS_ACCOUNT_ID not configured");

  const data = await graphRequest(`/${accountId}/media`, {
    fields: "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count,insights{impressions,reach,shares,saves}",
    limit: Math.min(limit, 100)
  });

  return (data.data || []).map(post => ({
    id: post.id,
    caption: post.caption,
    type: post.media_type,
    mediaUrl: post.media_url,
    thumbnailUrl: post.thumbnail_url,
    permalink: post.permalink,
    timestamp: post.timestamp,
    likes: post.like_count || 0,
    comments: post.comments_count || 0,
    insights: post.insights || null
  }));
}

async function getPostInsights(mediaId) {
  const data = await graphRequest(`/${mediaId}/insights`, {
    metric: "impressions,reach,profile_visits,likes,comments,shares,saves"
  });

  const metrics = {};
  (data.data || []).forEach(m => {
    metrics[m.name] = m.values?.[0]?.value || 0;
  });

  return {
    mediaId,
    impressions: metrics.impressions || 0,
    reach: metrics.reach || 0,
    profileVisits: metrics.profile_visits || 0,
    likes: metrics.likes || 0,
    comments: metrics.comments || 0,
    shares: metrics.shares || 0,
    saves: metrics.saves || 0,
    engagementRate: metrics.reach > 0
      ? ((metrics.likes + metrics.comments + metrics.shares + metrics.saves) / metrics.reach * 100).toFixed(2)
      : 0
  };
}

async function searchHashtags(query) {
  const accountId = getBusinessAccountId();
  if (!accountId) throw new Error("INSTAGRAM_BUSINESS_ACCOUNT_ID not configured");

  const data = await graphRequest("/ig_hashtag_search", {
    user_id: accountId,
    q: query
  });

  return (data.data || []).map(tag => ({
    id: tag.id,
    name: tag.name
  }));
}

async function getReels(limit = 25) {
  const accountId = getBusinessAccountId();
  if (!accountId) throw new Error("INSTAGRAM_BUSINESS_ACCOUNT_ID not configured");

  const data = await graphRequest(`/${accountId}/media`, {
    fields: "id,caption,media_url,permalink,timestamp,like_count,comments_count,insights{impressions,reach,plays,shares,saves}",
    type: "REEL",
    limit: Math.min(limit, 100)
  });

  return (data.data || []).map(reel => ({
    id: reel.id,
    caption: reel.caption,
    mediaUrl: reel.media_url,
    permalink: reel.permalink,
    timestamp: reel.timestamp,
    likes: reel.like_count || 0,
    comments: reel.comments_count || 0,
    plays: reel.insights?.plays || 0,
    shares: reel.insights?.shares || 0,
    saves: reel.insights?.saves || 0
  }));
}

async function publishPost(imageUrl, caption) {
  const accountId = getBusinessAccountId();
  if (!accountId) throw new Error("INSTAGRAM_BUSINESS_ACCOUNT_ID not configured");

  const container = await graphRequest(`/${accountId}/media`, {
    image_url: imageUrl,
    caption: caption
  }, "POST");

  if (!container.id) throw new Error("Failed to create media container");

  const published = await graphRequest(`/${accountId}/media_publish`, {
    creation_id: container.id
  }, "POST");

  return {
    success: true,
    mediaId: published.id,
    message: "Post published successfully"
  };
}

async function generateCaption(topic, tone = "engaging") {
  const { askLLM } = require("./llm");
  const prompt = `Generate 5 Instagram captions for: "${topic}". Tone: ${tone}. Include relevant emojis and hashtags. Format as JSON array.`;
  const response = await askLLM(prompt, "You are an Instagram content expert. Create engaging captions.");
  return { topic, tone, captions: response };
}

async function getAudienceDemographics() {
  const accountId = getBusinessAccountId();
  if (!accountId) throw new Error("INSTAGRAM_BUSINESS_ACCOUNT_ID not configured");

  const data = await graphRequest(`/${accountId}/insights`, {
    metric: "audience_gender_age,audience_country,audience_city",
    period: "lifetime"
  });

  const demographics = {};
  (data.data || []).forEach(metric => {
    demographics[metric.name] = metric.values?.[0]?.value || {};
  });

  return {
    genderAge: demographics.audience_gender_age || {},
    countries: demographics.audience_country || {},
    cities: demographics.audience_city || {}
  };
}

async function getStoryInsights() {
  const accountId = getBusinessAccountId();
  if (!accountId) throw new Error("INSTAGRAM_BUSINESS_ACCOUNT_ID not configured");

  const data = await graphRequest(`/${accountId}/stories`, {
    fields: "id,timestamp,insights{exits,impressions,replies,reach,taps_forward,taps_back}"
  });

  return (data.data || []).map(story => ({
    id: story.id,
    timestamp: story.timestamp,
    impressions: story.insights?.impressions || 0,
    reach: story.insights?.reach || 0,
    replies: story.insights?.replies || 0,
    exits: story.insights?.exits || 0,
    tapsForward: story.insights?.taps_forward || 0,
    tapsBack: story.insights?.taps_back || 0
  }));
}

async function trackCompetitor(userId) {
  const accountId = getBusinessAccountId();
  if (!accountId) throw new Error("INSTAGRAM_BUSINESS_ACCOUNT_ID not configured");

  const data = await graphRequest(`/${accountId}`, {
    fields: `business_discovery{username,name,followers_count,media_count,biography,website,ig_hires_media{like_count,comments_count}}`,
    username: `@${userId}`
  });

  const discovery = data.business_discovery;
  return {
    username: discovery.username,
    name: discovery.name,
    followers: discovery.followers_count,
    posts: discovery.media_count,
    bio: discovery.biography,
    website: discovery.website,
    recentMedia: (discovery.ig_hires_media?.data || []).slice(0, 5)
  };
}

module.exports = {
  getProfile,
  getPosts,
  getPostInsights,
  searchHashtags,
  getReels,
  publishPost,
  generateCaption,
  getAudienceDemographics,
  getStoryInsights,
  trackCompetitor
};
