/**
 * Reddit API Wrapper
 * Core API functions for Reddit
 */

const API_BASE = "https://oauth.reddit.com";
const UNAUTH_BASE = "https://www.reddit.com";

function getClientId() {
  return process.env.REDDIT_CLIENT_ID;
}

function getClientSecret() {
  return process.env.REDDIT_CLIENT_SECRET;
}

function getUserAgent() {
  return process.env.REDDIT_USER_AGENT || "SocialMediaMCP/1.0";
}

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const clientId = getClientId();
  const clientSecret = getClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET not configured");
  }

  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": getUserAgent()
    },
    body: "grant_type=client_credentials"
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error);

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function apiRequest(endpoint, params = {}) {
  const token = await getAccessToken();

  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const response = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${token}`,
      "User-Agent": getUserAgent()
    }
  });

  const data = await response.json();
  if (data.error) {
    const err = new Error(data.message || "Reddit API error");
    err.status = data.error;
    throw err;
  }

  return data;
}

async function getPost(postId, subreddit) {
  try {
    const endpoint = subreddit
      ? `/r/${subreddit}/comments/${postId}`
      : `/comments/${postId}`;

    const data = await apiRequest(endpoint, { raw_json: 1 });
    const post = data[0]?.data?.children?.[0]?.data;

    if (!post) throw new Error("Post not found");

    return {
      id: post.id,
      title: post.title,
      selftext: post.selftext,
      author: post.author,
      subreddit: post.subreddit,
      score: post.score,
      upvoteRatio: post.upvote_ratio,
      comments: post.num_comments,
      created: new Date(post.created_utc * 1000).toISOString(),
      url: post.url,
      permalink: `https://reddit.com${post.permalink}`,
      isSelf: post.is_self,
      flair: post.link_flair_text || null,
      gilded: post.gilded || 0,
      over18: post.over_18
    };
  } catch (error) {
    throw new Error(`Reddit post fetch failed: ${error.message}`);
  }
}

async function getSubreddit(subreddit) {
  try {
    const data = await apiRequest(`/r/${subreddit}/about`, { raw_json: 1 });
    const sub = data.data;

    return {
      id: sub.id,
      name: sub.display_name,
      title: sub.title,
      description: sub.public_description,
      subscribers: sub.subscribers,
      activeAccounts: sub.accounts_active,
      created: new Date(sub.created_utc * 1000).toISOString(),
      icon: sub.icon_img,
      banner: sub.banner_img,
      rules: sub.rules || [],
      lang: sub.lang,
      over18: sub.over18
    };
  } catch (error) {
    throw new Error(`Reddit subreddit fetch failed: ${error.message}`);
  }
}

async function getPostAnalytics(subreddit, limit = 25) {
  try {
    const data = await apiRequest(`/r/${subreddit}/hot`, {
      limit: Math.min(limit, 100),
      raw_json: 1
    });

    const posts = data.data.children.map(c => c.data);
    const totalScore = posts.reduce((sum, p) => sum + p.score, 0);
    const totalComments = posts.reduce((sum, p) => sum + p.num_comments, 0);
    const totalUpvoteRatio = posts.reduce((sum, p) => sum + p.upvote_ratio, 0);

    return {
      subreddit,
      postCount: posts.length,
      metrics: {
        totalScore,
        totalComments,
        avgScore: posts.length > 0 ? Math.round(totalScore / posts.length) : 0,
        avgComments: posts.length > 0 ? Math.round(totalComments / posts.length) : 0,
        avgUpvoteRatio: posts.length > 0 ? (totalUpvoteRatio / posts.length * 100).toFixed(1) : 0
      },
      topPosts: posts.slice(0, 5).map(p => ({
        title: p.title,
        score: p.score,
        comments: p.num_comments,
        author: p.author,
        permalink: `https://reddit.com${p.permalink}`
      })),
      postTypes: {
        self: posts.filter(p => p.is_self).length,
        link: posts.filter(p => !p.is_self).length
      }
    };
  } catch (error) {
    throw new Error(`Reddit post analytics failed: ${error.message}`);
  }
}

async function searchPosts(query, subreddit, limit = 25) {
  try {
    const endpoint = subreddit ? `/r/${subreddit}/search` : "/search";
    const params = {
      q: query,
      limit: Math.min(limit, 100),
      raw_json: 1,
      sort: "relevance",
      t: "month"
    };
    if (subreddit) params.restrict_sr = "on";

    const data = await apiRequest(endpoint, params);
    const posts = data.data.children.map(c => c.data);

    return posts.map(p => ({
      id: p.id,
      title: p.title,
      selftext: p.selftext?.slice(0, 200),
      author: p.author,
      subreddit: p.subreddit,
      score: p.score,
      comments: p.num_comments,
      created: new Date(p.created_utc * 1000).toISOString(),
      permalink: `https://reddit.com${p.permalink}`
    }));
  } catch (error) {
    throw new Error(`Reddit search failed: ${error.message}`);
  }
}

async function searchSubreddits(query, limit = 10) {
  try {
    const data = await apiRequest("/subreddits/search", {
      q: query,
      limit: Math.min(limit, 25),
      raw_json: 1
    });

    const subs = data.data.children.map(c => c.data);
    return subs.map(s => ({
      id: s.id,
      name: s.display_name,
      title: s.title,
      description: s.public_description?.slice(0, 200),
      subscribers: s.subscribers,
      activeAccounts: s.accounts_active,
      icon: s.icon_img
    }));
  } catch (error) {
    throw new Error(`Reddit subreddit search failed: ${error.message}`);
  }
}

async function trackKeywords(query, subreddit, limit = 50) {
  try {
    const endpoint = subreddit ? `/r/${subreddit}/search` : "/search";
    const params = {
      q: query,
      limit: Math.min(limit, 100),
      raw_json: 1,
      sort: "new",
      t: "day"
    };
    if (subreddit) params.restrict_sr = "on";

    const data = await apiRequest(endpoint, params);
    const posts = data.data.children.map(c => c.data);

    const sentiment = posts.map(p => {
      const text = `${p.title} ${p.selftext}`.toLowerCase();
      const positive = ["good", "great", "love", "awesome", "amazing", "best", "help", "thanks"].some(w => text.includes(w));
      const negative = ["bad", "hate", "terrible", "worst", "problem", "issue", "broken", "fail"].some(w => text.includes(w));
      return positive ? 1 : negative ? -1 : 0;
    });

    const positive = sentiment.filter(s => s > 0).length;
    const negative = sentiment.filter(s => s < 0).length;

    return {
      query,
      subreddit: subreddit || "all",
      mentionCount: posts.length,
      sentiment: {
        positive,
        negative,
        neutral: sentiment.filter(s => s === 0).length,
        score: sentiment.reduce((a, b) => a + b, 0) / (sentiment.length || 1)
      },
      recentMentions: posts.slice(0, 10).map(p => ({
        title: p.title,
        score: p.score,
        comments: p.num_comments,
        subreddit: p.subreddit,
        permalink: `https://reddit.com${p.permalink}`
      }))
    };
  } catch (error) {
    throw new Error(`Reddit keyword tracking failed: ${error.message}`);
  }
}

async function createPost(subreddit, title, body, type = "self") {
  try {
    const params = {
      sr: subreddit,
      title,
      kind: type === "link" ? "link" : "self"
    };

    if (type === "self") {
      params.text = body;
    } else {
      params.url = body;
    }

    const data = await apiRequest("/api/submit", params, "POST");
    return {
      success: true,
      postId: data.id,
      name: data.name,
      message: "Post submitted successfully"
    };
  } catch (error) {
    throw new Error(`Reddit post creation failed: ${error.message}`);
  }
}

async function generatePost(subreddit, topic, style = "discussion") {
  const { askLLM } = require("./llm");
  const prompt = `Generate a Reddit post for r/${subreddit} about: "${topic}". Style: ${style}. Include title and body. Format as JSON with "title" and "body" fields.`;
  const response = await askLLM(prompt, "You are a Reddit user. Create engaging posts.");
  return { subreddit, topic, style, post: response };
}

async function analyzeCommentSentiment(subreddit, limit = 50) {
  try {
    const data = await apiRequest(`/r/${subreddit}/hot`, {
      limit: Math.min(limit, 25),
      raw_json: 1
    });

    const posts = data.data.children.map(c => c.data);
    const topPosts = posts.slice(0, 5);

    const commentData = [];
    for (const post of topPosts) {
      try {
        const commentsData = await apiRequest(`/r/${subreddit}/comments/${post.id}`, {
          limit: 20,
          raw_json: 1
        });

        const comments = commentsData[1]?.data?.children || [];
        comments.forEach(c => {
          if (c.data?.body) {
            commentData.push({
              text: c.data.body,
              score: c.data.score,
              author: c.data.author
            });
          }
        });
      } catch (e) {
        // Skip failed comment fetches
      }
    }

    const sentiments = commentData.map(c => {
      const text = c.text.toLowerCase();
      const positive = ["good", "great", "love", "thanks", "helpful", "agree", "nice"].some(w => text.includes(w));
      const negative = ["bad", "hate", "disagree", "wrong", "stupid", "terrible", "awful"].some(w => text.includes(w));
      return { ...c, sentiment: positive ? 1 : negative ? -1 : 0 };
    });

    const positive = sentiments.filter(s => s.sentiment > 0).length;
    const negative = sentiments.filter(s => s.sentiment < 0).length;

    return {
      subreddit,
      commentCount: sentiments.length,
      sentiment: {
        positive,
        negative,
        neutral: sentiments.filter(s => s.sentiment === 0).length,
        label: positive > negative ? "positive" : negative > positive ? "negative" : "mixed"
      },
      topComments: sentiments
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(c => ({
          text: c.text.slice(0, 200),
          score: c.score,
          author: c.author,
          sentiment: c.sentiment > 0 ? "positive" : c.sentiment < 0 ? "negative" : "neutral"
        }))
    };
  } catch (error) {
    throw new Error(`Reddit comment analysis failed: ${error.message}`);
  }
}

async function analyzeSubredditAudience(subreddit) {
  try {
    const sub = await getSubreddit(subreddit);
    const analytics = await getPostAnalytics(subreddit, 50);

    const topAuthors = {};
    const posts = (await apiRequest(`/r/${subreddit}/hot`, {
      limit: 50,
      raw_json: 1
    })).data.children.map(c => c.data);

    posts.forEach(p => {
      topAuthors[p.author] = (topAuthors[p.author] || 0) + 1;
    });

    const sortedAuthors = Object.entries(topAuthors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      subreddit: sub.name,
      title: sub.title,
      subscribers: sub.subscribers,
      activeAccounts: sub.activeAccounts,
      engagement: {
        avgScore: analytics.metrics.avgScore,
        avgComments: analytics.metrics.avgComments,
        avgUpvoteRatio: analytics.metrics.avgUpvoteRatio
      },
      topAuthors: sortedAuthors.map(([author, posts]) => ({ author, posts })),
      postTypes: analytics.postTypes
    };
  } catch (error) {
    throw new Error(`Reddit audience analysis failed: ${error.message}`);
  }
}

async function trackCompetitors(subreddits) {
  try {
    const results = await Promise.all(
      subreddits.map(s => getSubreddit(s).catch(() => null))
    );

    const subs = results.filter(Boolean);
    const totalSubscribers = subs.reduce((sum, s) => sum + s.subscribers, 0);
    const totalActive = subs.reduce((sum, s) => sum + (s.activeAccounts || 0), 0);

    return {
      subreddits: subs.map(s => ({
        name: s.name,
        subscribers: s.subscribers,
        activeAccounts: s.activeAccounts
      })),
      summary: {
        totalSubreddits: subs.length,
        totalSubscribers,
        totalActiveAccounts: totalActive,
        avgSubscribers: subs.length > 0 ? Math.round(totalSubscribers / subs.length) : 0
      }
    };
  } catch (error) {
    throw new Error(`Reddit competitor tracking failed: ${error.message}`);
  }
}

module.exports = {
  getPost,
  getSubreddit,
  getPostAnalytics,
  searchPosts,
  searchSubreddits,
  trackKeywords,
  createPost,
  generatePost,
  analyzeCommentSentiment,
  analyzeSubredditAudience,
  trackCompetitors
};
