/**
 * TikTok API Wrapper
 * Core API functions for TikTok Open Platform
 */

const API_BASE = "https://open-api.tiktok.com";

function getClientKey() {
  return process.env.TIKTOK_CLIENT_KEY;
}

function getClientSecret() {
  return process.env.TIKTOK_CLIENT_SECRET;
}

function getAccessToken() {
  return process.env.TIKTOK_ACCESS_TOKEN;
}

async function apiRequest(endpoint, params = {}, method = "GET") {
  const token = getAccessToken();
  if (!token) throw new Error("TIKTOK_ACCESS_TOKEN not configured. Generate via OAuth first.");

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

  if (data.error && data.error.code !== 0) {
    const err = new Error(data.error.message || "TikTok API error");
    err.status = data.error.code || 500;
    throw err;
  }

  return data.data || data;
}

async function getProfile(username) {
  try {
    const data = await apiRequest("/v2/user/info/", { username });
    const user = data.user;
    return {
      id: user.open_id,
      username: user.username,
      displayName: user.nickname,
      avatar: user.avatar_larger.url_list[0],
      followers: user.follower_count,
      following: user.following_count,
      likes: user.heart_count,
      videos: user.video_count,
      verified: user.is_verified,
      bio: user.signature
    };
  } catch (error) {
    throw new Error(`TikTok profile fetch failed: ${error.message}`);
  }
}

async function getVideos(userId, limit = 20) {
  try {
    const data = await apiRequest("/v2/video/list/", { open_id: userId, count: Math.min(limit, 20) });
    const videos = data.list || [];
    return videos.map(v => ({
      id: v.id,
      title: v.title,
      description: v.desc,
      cover: v.cover.url_list[0],
      duration: v.duration,
      views: v.stats.play_count,
      likes: v.stats.digg_count,
      comments: v.stats.comment_count,
      shares: v.stats.share_count,
      createdAt: v.create_time
    }));
  } catch (error) {
    throw new Error(`TikTok videos fetch failed: ${error.message}`);
  }
}

async function getVideoAnalytics(videoId) {
  try {
    const data = await apiRequest("/v2/video/detail/", { video_id: videoId });
    const video = data.item;
    return {
      id: video.id,
      title: video.title,
      description: video.desc,
      cover: video.cover.url_list[0],
      duration: video.duration,
      views: video.stats.play_count,
      likes: video.stats.digg_count,
      comments: video.stats.comment_count,
      shares: video.stats.share_count,
      saves: video.stats.collect_count,
      engagement: {
        rate: video.stats.play_count > 0
          ? ((video.stats.digg_count + video.stats.comment_count + video.stats.share_count) / video.stats.play_count * 100).toFixed(2)
          : 0
      },
      createdAt: video.create_time
    };
  } catch (error) {
    throw new Error(`TikTok video analytics failed: ${error.message}`);
  }
}

async function getTrending(region = "US") {
  try {
    const data = await apiRequest("/v2/challenge/list/", { count: 20 });
    const challenges = data.challenges || [];
    return challenges.map(c => ({
      id: c.id,
      name: c.title,
      description: c.desc,
      views: c.view_count,
      videos: c.video_count,
      cover: c.cover.url_list[0]
    }));
  } catch (error) {
    throw new Error(`TikTok trending fetch failed: ${error.message}`);
  }
}

async function searchVideos(query, limit = 20) {
  try {
    const data = await apiRequest("/v2/video/search/", { query, count: Math.min(limit, 20) });
    const videos = data.data?.videos || data.videos || [];
    return videos.map(v => ({
      id: v.id,
      title: v.title,
      description: v.desc,
      cover: v.cover,
      views: v.play_count,
      likes: v.digg_count,
      comments: v.comment_count,
      shares: v.share_count,
      author: {
        username: v.author?.username,
        displayName: v.author?.nickname
      }
    }));
  } catch (error) {
    throw new Error(`TikTok search failed: ${error.message}`);
  }
}

async function postVideo(videoUrl, caption = "", privacyLevel = "PUBLIC_TO_EVERYONE") {
  try {
    const initResponse = await apiRequest("/v2/post/publish/video/init/", {
      post_info: {
        title: caption.slice(0, 150),
        privacy_level: privacyLevel
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: 0
      }
    }, "POST");

    return {
      uploadUrl: initResponse.upload_url,
      publishId: initResponse.publish_id,
      message: "Video upload initialized. Upload video to upload_url, then publish."
    };
  } catch (error) {
    throw new Error(`TikTok video post failed: ${error.message}`);
  }
}

async function generateCaption(topic, style = "engaging") {
  try {
    const { askLLM } = require("./llm");
    const prompt = `Generate 5 TikTok captions for: "${topic}". Style: ${style}. Include relevant emojis and hashtags. Format as JSON array.`;
    const response = await prompt(prompt, "You are a TikTok content expert. Create viral captions.");
    return { topic, style, captions: response };
  } catch (error) {
    throw new Error(`TikTok caption generation failed: ${error.message}`);
  }
}

async function analyzeHashtag(hashtag) {
  try {
    const data = await apiRequest("/v2/challenge/detail/", { challenge_name: hashtag });
    const challenge = data.challenge;
    return {
      id: challenge.id,
      name: challenge.title,
      description: challenge.desc,
      views: challenge.view_count,
      videos: challenge.video_count,
      cover: challenge.cover.url_list[0],
      isCompetition: challenge.is_competition
    };
  } catch (error) {
    throw new Error(`TikTok hashtag analysis failed: ${error.message}`);
  }
}

async function getAudienceInsights(userId) {
  try {
    const data = await apiRequest("/v2/business/insights/user/", { open_id: userId });
    return {
      demographics: data.audience_demographics || {},
      territories: data.territory_summary || [],
      genderDistribution: data.gender_summary || [],
      deviceInfo: data.device_info || {}
    };
  } catch (error) {
    throw new Error(`TikTok audience insights failed: ${error.message}`);
  }
}

async function analyzeCompetitor(userId) {
  try {
    const profile = await getProfile(userId);
    const videos = await getVideos(userId, 10);

    const totalViews = videos.reduce((sum, v) => sum + v.views, 0);
    const totalLikes = videos.reduce((sum, v) => sum + v.likes, 0);
    const totalComments = videos.reduce((sum, v) => sum + v.comments, 0);
    const totalShares = videos.reduce((sum, v) => sum + v.shares, 0);

    return {
      profile,
      metrics: {
        avgViews: videos.length > 0 ? Math.round(totalViews / videos.length) : 0,
        avgLikes: videos.length > 0 ? Math.round(totalLikes / videos.length) : 0,
        avgComments: videos.length > 0 ? Math.round(totalComments / videos.length) : 0,
        avgShares: videos.length > 0 ? Math.round(totalShares / videos.length) : 0,
        engagementRate: totalViews > 0
          ? ((totalLikes + totalComments + totalShares) / totalViews * 100).toFixed(2)
          : 0
      },
      topVideos: videos.slice(0, 5).map(v => ({
        title: v.title,
        views: v.views,
        likes: v.likes,
        engagement: v.views > 0 ? ((v.likes + v.comments + v.shares) / v.views * 100).toFixed(2) : 0
      }))
    };
  } catch (error) {
    throw new Error(`TikTok competitor analysis failed: ${error.message}`);
  }
}

module.exports = {
  getProfile,
  getVideos,
  getVideoAnalytics,
  getTrending,
  searchVideos,
  postVideo,
  generateCaption,
  analyzeHashtag,
  getAudienceInsights,
  analyzeCompetitor
};
