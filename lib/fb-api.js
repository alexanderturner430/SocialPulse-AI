/**
 * Facebook Graph API Wrapper
 * Core API functions for Facebook/Meta Graph API
 */

const GRAPH_URL = "https://graph.facebook.com/v19.0";

function getAccessToken() {
  return process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
}

function getPageId() {
  return process.env.FACEBOOK_PAGE_ID;
}

function getAdAccountId() {
  return process.env.FACEBOOK_AD_ACCOUNT_ID;
}

async function graphRequest(endpoint, params = {}, method = "GET") {
  const token = getAccessToken();
  if (!token) throw new Error("FACEBOOK_PAGE_ACCESS_TOKEN not configured");
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
    const err = new Error(data.error.message || "Facebook API error");
    err.status = data.error.code || 500;
    throw err;
  }
  return data;
}

async function getPagePosts(pageId, limit = 25, after = null) {
  const params = { fields: "id,message,created_time,type,permalink_url,shares,reactions.summary(true),comments.summary(true)", limit };
  if (after) params.after = after;
  return graphRequest(`/${pageId || getPageId()}/posts`, params);
}

async function getPostDetails(postId) {
  return graphRequest(`/${postId}`, {
    fields: "id,message,created_time,type,permalink_url,shares,reactions.summary(true),comments.summary(true),full_picture"
  });
}

async function getPostInsights(postId, metrics) {
  const metricList = Array.isArray(metrics) ? metrics.join(",") : metrics;
  return graphRequest(`/${postId}/insights`, { metric: metricList });
}

async function getPageInsights(pageId, metrics, period = "day", since = null, until = null) {
  const params = { metric: Array.isArray(metrics) ? metrics.join(",") : metrics, period };
  if (since) params.since = since;
  if (until) params.until = until;
  return graphRequest(`/${pageId || getPageId()}/insights`, params);
}

async function createPost(pageId, message, options = {}) {
  const params = { message, published: options.published !== false ? "true" : "false" };
  if (options.link) params.link = options.link;
  if (options.scheduledPublishTime) {
    params.scheduled_publish_time = options.scheduledPublishTime;
    params.published = "false";
  }
  return graphRequest(`/${pageId || getPageId()}/feed`, params, "POST");
}

async function searchPages(query, limit = 10) {
  return graphRequest("/pages/search", { q: query, limit, fields: "id,name,fan_count,category" });
}

async function getPageInfo(pageId) {
  return graphRequest(`/${pageId || getPageId()}`, {
    fields: "id,name,about,fan_count,followers_count,category,website,location,emails"
  });
}

module.exports = {
  graphRequest,
  getPagePosts,
  getPostDetails,
  getPostInsights,
  getPageInsights,
  createPost,
  searchPages,
  getPageInfo,
  getAccessToken,
  getPageId,
  getAdAccountId
};
