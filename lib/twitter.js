/**
 * X/Twitter API v2 Wrapper
 * Core API functions for X/Twitter
 */

const API_BASE = "https://api.x.com/2";

function getApiKey() {
  return process.env.TWITTER_API_KEY;
}

function getApiSecret() {
  return process.env.TWITTER_API_SECRET;
}

function getAccessToken() {
  return process.env.TWITTER_ACCESS_TOKEN;
}

function getAccessSecret() {
  return process.env.TWITTER_ACCESS_SECRET;
}

function getBearerToken() {
  return process.env.TWITTER_BEARER_TOKEN;
}

async function apiRequest(endpoint, params = {}, method = "GET") {
  const bearerToken = getBearerToken();
  const accessToken = getAccessToken();

  const token = bearerToken || accessToken;
  if (!token) throw new Error("TWITTER_BEARER_TOKEN or TWITTER_ACCESS_TOKEN not configured");

  const url = new URL(`${API_BASE}${endpoint}`);
  if (method === "GET") {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const options = {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  };

  if (method === "POST") {
    options.body = JSON.stringify(params);
  }

  const response = await fetch(url.toString(), options);
  const data = await response.json();

  if (data.errors) {
    const err = new Error(data.errors[0]?.message || "Twitter API error");
    err.status = data.errors[0]?.code || 500;
    throw err;
  }

  return data.data || data;
}

async function getProfile(username) {
  try {
    const user = await apiRequest(`/users/by/username/${username}`, {
      "user.fields": "created_at,description,public_metrics,verified,profile_image_url,url"
    });

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      bio: user.description,
      followers: user.public_metrics.followers_count,
      following: user.public_metrics.following_count,
      tweets: user.public_metrics.tweet_count,
      likes: user.public_metrics.like_count,
      verified: user.verified,
      avatar: user.profile_image_url,
      url: user.url,
      createdAt: user.created_at
    };
  } catch (error) {
    throw new Error(`Twitter profile fetch failed: ${error.message}`);
  }
}

async function getTweets(userId, limit = 10) {
  try {
    const data = await apiRequest(`/users/${userId}/tweets`, {
      max_results: Math.min(Math.max(limit, 5), 100),
      "tweet.fields": "created_at,public_metrics,media,entities",
      "media.fields": "url,preview_image_url",
      expansions: "attachments.media_keys"
    });

    return (data.data || []).map(tweet => ({
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at,
      likes: tweet.public_metrics?.like_count || 0,
      retweets: tweet.public_metrics?.retweet_count || 0,
      replies: tweet.public_metrics?.reply_count || 0,
      quotes: tweet.public_metrics?.quote_count || 0,
      impressions: tweet.public_metrics?.impression_count || 0,
      entities: tweet.entities || {}
    }));
  } catch (error) {
    throw new Error(`Twitter tweets fetch failed: ${error.message}`);
  }
}

async function getTweetAnalytics(tweetId) {
  try {
    const data = await apiRequest(`/tweets/${tweetId}`, {
      "tweet.fields": "public_metrics,created_at,text,entities"
    });

    const tweet = data.data;
    const metrics = tweet.public_metrics;

    return {
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at,
      likes: metrics.like_count || 0,
      retweets: metrics.retweet_count || 0,
      replies: metrics.reply_count || 0,
      quotes: metrics.quote_count || 0,
      impressions: metrics.impression_count || 0,
      engagement: metrics.impression_count > 0
        ? ((metrics.like_count + metrics.retweet_count + metrics.reply_count + metrics.quote_count) / metrics.impression_count * 100).toFixed(2)
        : 0,
      entities: tweet.entities || {}
    };
  } catch (error) {
    throw new Error(`Twitter tweet analytics failed: ${error.message}`);
  }
}

async function searchTweets(query, limit = 10) {
  try {
    const data = await apiRequest("/tweets/search/recent", {
      query,
      max_results: Math.min(Math.max(limit, 10), 100),
      "tweet.fields": "created_at,public_metrics,author_id,entities",
      "user.fields": "username,name,public_metrics"
    });

    return (data.data || []).map(tweet => ({
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id,
      createdAt: tweet.created_at,
      likes: tweet.public_metrics?.like_count || 0,
      retweets: tweet.public_metrics?.retweet_count || 0,
      replies: tweet.public_metrics?.reply_count || 0,
      impressions: tweet.public_metrics?.impression_count || 0
    }));
  } catch (error) {
    throw new Error(`Twitter search failed: ${error.message}`);
  }
}

async function getTrends(woeid = 1) {
  try {
    const data = await apiRequest(`/trends/by/${woeid}`, {}, "GET");
    return data.data || data;
  } catch (error) {
    throw new Error(`Twitter trends fetch failed: ${error.message}`);
  }
}

async function postTweet(text, replyTo = null) {
  try {
    const payload = { text };
    if (replyTo) payload.reply = { in_reply_to_tweet_id: replyTo };

    const data = await apiRequest("/tweets", payload, "POST");
    return {
      success: true,
      tweetId: data.data.id,
      text: data.data.text,
      message: "Tweet posted successfully"
    };
  } catch (error) {
    throw new Error(`Twitter post failed: ${error.message}`);
  }
}

async function generateTweet(topic, style = "engaging") {
  const { askLLM } = require("./llm");
  const prompt = `Generate 5 tweets for: "${topic}". Style: ${style}. Keep each under 280 characters. Include relevant hashtags. Format as JSON array.`;
  const response = await askLLM(prompt, "You are a Twitter/X content expert. Create viral tweets.");
  return { topic, style, tweets: response };
}

async function analyzeEngagement(userId) {
  try {
    const tweets = await getTweets(userId, 20);
    const totalLikes = tweets.reduce((sum, t) => sum + t.likes, 0);
    const totalRetweets = tweets.reduce((sum, t) => sum + t.retweets, 0);
    const totalReplies = tweets.reduce((sum, t) => sum + t.replies, 0);
    const totalImpressions = tweets.reduce((sum, t) => sum + t.impressions, 0);

    const bestTweet = tweets.reduce((best, t) =>
      (t.likes + t.retweets + t.replies) > (best.likes + best.retweets + best.replies) ? t : best
    , tweets[0]);

    return {
      userId,
      tweetCount: tweets.length,
      metrics: {
        totalLikes,
        totalRetweets,
        totalReplies,
        totalImpressions,
        avgLikes: tweets.length > 0 ? Math.round(totalLikes / tweets.length) : 0,
        avgRetweets: tweets.length > 0 ? Math.round(totalRetweets / tweets.length) : 0,
        avgReplies: tweets.length > 0 ? Math.round(totalReplies / tweets.length) : 0,
        avgImpressions: tweets.length > 0 ? Math.round(totalImpressions / tweets.length) : 0,
        engagementRate: totalImpressions > 0
          ? ((totalLikes + totalRetweets + totalReplies) / totalImpressions * 100).toFixed(2)
          : 0
      },
      bestPerformingTweet: bestTweet ? {
        text: bestTweet.text,
        likes: bestTweet.likes,
        retweets: bestTweet.retweets,
        replies: bestTweet.replies
      } : null
    };
  } catch (error) {
    throw new Error(`Twitter engagement analysis failed: ${error.message}`);
  }
}

async function getFollowerInsights(userId) {
  try {
    const profile = await apiRequest(`/users/${userId}`, {
      "user.fields": "public_metrics,created_at"
    });

    const user = profile.data;
    const metrics = user.public_metrics;

    return {
      userId,
      username: user.username,
      followers: metrics.followers_count,
      following: metrics.following_count,
      tweets: metrics.tweet_count,
      likes: metrics.like_count,
      ratio: metrics.following_count > 0
        ? (metrics.followers_count / metrics.following_count).toFixed(2)
        : metrics.followers_count,
      accountAge: user.created_at,
      growthIndicator: metrics.followers_count > metrics.following_count ? "growing" : "stable"
    };
  } catch (error) {
    throw new Error(`Twitter follower insights failed: ${error.message}`);
  }
}

async function trackMentions(query, limit = 20) {
  try {
    const data = await apiRequest("/tweets/search/recent", {
      query: `${query} -is:retweet`,
      max_results: Math.min(Math.max(limit, 10), 100),
      "tweet.fields": "created_at,public_metrics,author_id,context_annotations"
    });

    const mentions = (data.data || []).map(tweet => ({
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id,
      createdAt: tweet.created_at,
      likes: tweet.public_metrics?.like_count || 0,
      retweets: tweet.public_metrics?.retweet_count || 0,
      sentiment: tweet.context_annotations || []
    }));

    const avgSentiment = mentions.reduce((sum, m) => {
      const positive = m.sentiment.some(s => s.domain?.id === "3");
      const negative = m.sentiment.some(s => s.domain?.id === "4");
      return sum + (positive ? 1 : negative ? -1 : 0);
    }, 0) / (mentions.length || 1);

    return {
      query,
      mentionCount: mentions.length,
      mentions,
      sentiment: avgSentiment > 0.2 ? "positive" : avgSentiment < -0.2 ? "negative" : "neutral",
      totalLikes: mentions.reduce((sum, m) => sum + m.likes, 0),
      totalRetweets: mentions.reduce((sum, m) => sum + m.retweets, 0)
    };
  } catch (error) {
    throw new Error(`Twitter mention tracking failed: ${error.message}`);
  }
}

module.exports = {
  getProfile,
  getTweets,
  getTweetAnalytics,
  searchTweets,
  getTrends,
  postTweet,
  generateTweet,
  analyzeEngagement,
  getFollowerInsights,
  trackMentions
};
