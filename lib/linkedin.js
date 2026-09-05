/**
 * LinkedIn API Wrapper
 * Core API functions for LinkedIn
 */

const API_BASE = "https://api.linkedin.com/v2";

function getAccessToken() {
  return process.env.LINKEDIN_ACCESS_TOKEN;
}

function getPersonUrn() {
  return process.env.LINKEDIN_PERSON_URN;
}

async function apiRequest(endpoint, params = {}, method = "GET") {
  const token = getAccessToken();
  if (!token) throw new Error("LINKEDIN_ACCESS_TOKEN not configured");

  const url = new URL(`${API_BASE}${endpoint}`);
  if (method === "GET") {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const headers = {
    "Authorization": `Bearer ${token}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": "202401"
  };

  const options = { method, headers };

  if (method === "POST" || method === "PATCH") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(params);
  }

  const response = await fetch(url.toString(), options);
  const data = await response.json();

  if (data.status && data.status >= 400) {
    const err = new Error(data.message || "LinkedIn API error");
    err.status = data.status;
    throw err;
  }

  return data;
}

async function getProfile() {
  try {
    const personUrn = getPersonUrn();
    if (!personUrn) throw new Error("LINKEDIN_PERSON_URN not configured");

    const data = await apiRequest(`/people/${personUrn}`, {
      projection: "(id,firstName,lastName,headline,summary,followersCount,connectionsCount,profilePicture(displayImage~playableStreams))",
      q: "id"
    });

    return {
      id: data.id,
      firstName: data.firstName,
      lastName: data.lastName,
      headline: data.headline,
      summary: data.summary,
      followers: data.followersCount || 0,
      connections: data.connectionsCount || 0,
      avatar: data.profilePicture?.displayImage?.elements?.[0]?.identifiers?.[0]?.identifier || null
    };
  } catch (error) {
    throw new Error(`LinkedIn profile fetch failed: ${error.message}`);
  }
}

async function getPosts(limit = 20) {
  try {
    const personUrn = getPersonUrn();
    if (!personUrn) throw new Error("LINKEDIN_PERSON_URN not configured");

    const data = await apiRequest("/shares", {
      q: "owners",
      owners: `urn:li:person:${personUrn}`,
      count: Math.min(limit, 100),
      projection: "(id,activity,commentary,created,lastModified,visibility)"
    });

    const posts = data.elements || [];
    return posts.map(p => ({
      id: p.id,
      commentary: p.commentary,
      visibility: p.visibility,
      created: p.created?.time,
      lastModified: p.lastModified?.time,
      activity: p.activity
    }));
  } catch (error) {
    throw new Error(`LinkedIn posts fetch failed: ${error.message}`);
  }
}

async function getPostAnalytics(postId) {
  try {
    const data = await apiRequest(`/organizationalEntityShareStatistics`, {
      q: "organizationalEntity",
      organizationalEntity: postId,
     shares: `(urn:li:share:${postId})`
    });

    const stats = data.elements?.[0] || {};
    return {
      postId,
      impressions: stats.impressionsCount || 0,
      clicks: stats.clickCount || 0,
      likes: stats.likeCount || 0,
      comments: stats.commentCount || 0,
      shares: stats.shareCount || 0,
      engagementRate: stats.impressionsCount > 0
        ? (((stats.likeCount || 0) + (stats.commentCount || 0) + (stats.shareCount || 0)) / stats.impressionsCount * 100).toFixed(2)
        : 0
    };
  } catch (error) {
    throw new Error(`LinkedIn post analytics failed: ${error.message}`);
  }
}

async function searchPosts(query, limit = 20) {
  try {
    const data = await apiRequest("/search", {
      q: "objects",
      query: `(origin:(com.linkedin.feedgen:SearchUniversalCluster),query:("${query}"))`,
      count: Math.min(limit, 50)
    });

    const results = data.elements || [];
    return results.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      author: r.actor?.name || r.author,
      created: r.created?.time,
      engagement: r.engagement || {}
    }));
  } catch (error) {
    throw new Error(`LinkedIn search failed: ${error.message}`);
  }
}

async function getCompanyPage(companyId) {
  try {
    const data = await apiRequest(`/organizations/${companyId}`, {
      projection: "(id,name,description,followersCount,staffCount,websiteUrl,industries,logoDetails)"
    });

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      followers: data.followersCount || 0,
      employees: data.staffCount || 0,
      website: data.websiteUrl,
      industry: data.industries?.[0]?.name || null,
      logo: data.logoDetails?.logo?.image?.com.linkedin.digitalmedia.mediacontainer.HttpImage|| null
    };
  } catch (error) {
    throw new Error(`LinkedIn company fetch failed: ${error.message}`);
  }
}

async function createPost(content, visibility = "PUBLIC") {
  try {
    const personUrn = getPersonUrn();
    if (!personUrn) throw new Error("LINKEDIN_PERSON_URN not configured");

    const data = await apiRequest("/shares", {
      author: `urn:li:person:${personUrn}`,
      commentary: content,
      visibility: {
        code: visibility
      },
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: []
      }
    }, "POST");

    return {
      success: true,
      postId: data.id,
      message: "Post published successfully"
    };
  } catch (error) {
    throw new Error(`LinkedIn post creation failed: ${error.message}`);
  }
}

async function generatePost(topic, style = "professional") {
  const { askLLM } = require("./llm");
  const prompt = `Generate 5 LinkedIn posts for: "${topic}". Style: ${style}. Professional tone, engaging. Format as JSON array.`;
  const response = await askLLM(prompt, "You are a LinkedIn content expert. Create professional posts.");
  return { topic, style, posts: response };
}

async function getEngagementAnalysis(userId) {
  try {
    const posts = await getPosts(20);
    const totalImpressions = posts.reduce((sum, p) => sum + (p.engagement?.impressions || 0), 0);
    const totalLikes = posts.reduce((sum, p) => sum + (p.engagement?.likes || 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + (p.engagement?.comments || 0), 0);
    const totalShares = posts.reduce((sum, p) => sum + (p.engagement?.shares || 0), 0);

    return {
      userId,
      postCount: posts.length,
      metrics: {
        totalImpressions,
        totalLikes,
        totalComments,
        totalShares,
        avgImpressions: posts.length > 0 ? Math.round(totalImpressions / posts.length) : 0,
        avgLikes: posts.length > 0 ? Math.round(totalLikes / posts.length) : 0,
        avgComments: posts.length > 0 ? Math.round(totalComments / posts.length) : 0,
        engagementRate: totalImpressions > 0
          ? ((totalLikes + totalComments + totalShares) / totalImpressions * 100).toFixed(2)
          : 0
      }
    };
  } catch (error) {
    throw new Error(`LinkedIn engagement analysis failed: ${error.message}`);
  }
}

async function getFollowerInsights(companyId) {
  try {
    const company = await getCompanyPage(companyId);
    return {
      companyId,
      name: company.name,
      followers: company.followers,
      employees: company.employees,
      industry: company.industry,
      website: company.website
    };
  } catch (error) {
    throw new Error(`LinkedIn follower insights failed: ${error.message}`);
  }
}

async function trackCompetitor(companyIds) {
  try {
    const results = await Promise.all(
      companyIds.map(id => getCompanyPage(id).catch(() => null))
    );

    const companies = results.filter(Boolean);
    const totalFollowers = companies.reduce((sum, c) => sum + c.followers, 0);

    return {
      companies: companies.map(c => ({
        id: c.id,
        name: c.name,
        followers: c.followers,
        employees: c.employees
      })),
      summary: {
        totalCompanies: companies.length,
        totalFollowers,
        avgFollowers: companies.length > 0 ? Math.round(totalFollowers / companies.length) : 0
      }
    };
  } catch (error) {
    throw new Error(`LinkedIn competitor tracking failed: ${error.message}`);
  }
}

module.exports = {
  getProfile,
  getPosts,
  getPostAnalytics,
  searchPosts,
  getCompanyPage,
  createPost,
  generatePost,
  getEngagementAnalysis,
  getFollowerInsights,
  trackCompetitor
};
