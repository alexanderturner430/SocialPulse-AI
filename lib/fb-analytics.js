/**
 * Facebook Post/Page Analytics
 * Post performance, engagement analysis, content optimization, posting times, hashtags
 */

const fbApi = require("./fb-api");

// 23. Analyze Post Performance
async function analyzePost(postId) {
  const [post, insights] = await Promise.all([
    fbApi.getPostDetails(postId),
    fbApi.getPostInsights(postId, [
      "post_impressions", "post_impressions_unique", "post_engaged_users",
      "post_clicks", "post_reactions_by_type_total", "post_comments", "post_shares"
    ]).catch(() => ({ data: [] }))
  ]);
  const metrics = {};
  if (insights.data) {
    insights.data.forEach(m => { metrics[m.name] = m.values?.[0]?.value ?? 0; });
  }
  const totalReactions = metrics.post_reactions_by_type_total || {};
  const engagementRate = metrics.post_impressions_unique > 0
    ? ((metrics.post_engaged_users || 0) / metrics.post_impressions_unique * 100).toFixed(2)
    : 0;
  return {
    id: post.id,
    message: post.message?.slice(0, 200),
    createdTime: post.created_time,
    type: post.type,
    metrics: {
      impressions: metrics.post_impressions || 0,
      reach: metrics.post_impressions_unique || 0,
      engagedUsers: metrics.post_engaged_users || 0,
      clicks: metrics.post_clicks || 0,
      shares: post.shares?.count || metrics.post_shares || 0,
      comments: post.comments?.summary?.total_count || metrics.post_comments || 0,
      reactions: totalReactions,
      engagementRate: engagementRate + "%"
    }
  };
}

// 24. Best Posting Times
async function findBestPostingTimes(pageId, days = 30) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const posts = await fbApi.getPagePosts(pageId, 100);
  const hourlyEngagement = new Array(24).fill(0);
  const dailyEngagement = new Array(7).fill(0);
  const hourlyCount = new Array(24).fill(0);
  const dailyCount = new Array(7).fill(0);
  for (const post of (posts.data || [])) {
    const date = new Date(post.created_time);
    const hour = date.getHours();
    const day = date.getDay();
    const engagement = (post.reactions?.summary?.total_count || 0) +
      (post.comments?.summary?.total_count || 0) +
      (post.shares?.count || 0);
    hourlyEngagement[hour] += engagement;
    dailyEngagement[day] += engagement;
    hourlyCount[hour]++;
    dailyCount[day]++;
  }
  const hourlyAvg = hourlyEngagement.map((total, i) => ({
    hour: i,
    avgEngagement: hourlyCount[i] > 0 ? +(total / hourlyCount[i]).toFixed(2) : 0,
    postCount: hourlyCount[i]
  }));
  const dailyAvg = dailyEngagement.map((total, i) => ({
    day: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i],
    avgEngagement: dailyCount[i] > 0 ? +(total / dailyCount[i]).toFixed(2) : 0,
    postCount: dailyCount[i]
  }));
  const bestHour = hourlyAvg.reduce((a, b) => a.avgEngagement > b.avgEngagement ? a : b);
  const bestDay = dailyAvg.reduce((a, b) => a.avgEngagement > b.avgEngagement ? a : b);
  return {
    bestHour: bestHour.hour,
    bestDay: bestDay.day,
    hourlyBreakdown: hourlyAvg,
    dailyBreakdown: dailyAvg
  };
}

// 25. Analyze Hashtags
async function analyzeHashtags(pageId, limit = 50) {
  const posts = await fbApi.getPagePosts(pageId, limit);
  const hashtagStats = {};
  for (const post of (posts.data || [])) {
    const hashtags = (post.message || "").match(/#[\w\u0590-\u05ff]+/g) || [];
    const engagement = (post.reactions?.summary?.total_count || 0) +
      (post.comments?.summary?.total_count || 0) +
      (post.shares?.count || 0);
    for (const tag of hashtags) {
      const lower = tag.toLowerCase();
      if (!hashtagStats[lower]) hashtagStats[lower] = { count: 0, totalEngagement: 0 };
      hashtagStats[lower].count++;
      hashtagStats[lower].totalEngagement += engagement;
    }
  }
  return Object.entries(hashtagStats)
    .map(([tag, stats]) => ({
      hashtag: tag,
      posts: stats.count,
      avgEngagement: +(stats.totalEngagement / stats.count).toFixed(2),
      totalEngagement: stats.totalEngagement
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 20);
}

// 26. Content Optimization Suggestions
async function optimizeContent(postId) {
  const post = await analyzePost(postId);
  const suggestions = [];
  if (!post.message || post.message.length < 50) suggestions.push("Add more text - posts with 80+ characters get 66% more engagement");
  if (!post.message?.includes("?")) suggestions.push("Ask a question to drive comments");
  if (!post.message?.match(/#[\w]+/)) suggestions.push("Add relevant hashtags");
  if (post.type === "status") suggestions.push("Consider adding an image - visual posts get 2.3x more engagement");
  const hour = new Date(post.createdTime).getHours();
  if (hour < 8 || hour > 20) suggestions.push("Consider posting between 8am-8pm for better reach");
  const engagementRate = parseFloat(post.metrics.engagementRate);
  if (engagementRate < 1) suggestions.push("Engagement rate is below 1% - try more engaging content formats");
  return { postId, currentMetrics: post.metrics, suggestions };
}

// 27. Engagement Breakdown
async function getEngagementBreakdown(postId) {
  const insights = await fbApi.getPostInsights(postId, [
    "post_reactions_by_type_total", "post_clicks", "post_shares", "post_comments"
  ]).catch(() => ({ data: [] }));
  const breakdown = { reactions: {}, clicks: 0, shares: 0, comments: 0 };
  if (insights.data) {
    insights.data.forEach(m => {
      if (m.name === "post_reactions_by_type_total") breakdown.reactions = m.values?.[0]?.value || {};
      if (m.name === "post_clicks") breakdown.clicks = m.values?.[0]?.value || 0;
      if (m.name === "post_shares") breakdown.shares = m.values?.[0]?.value || 0;
      if (m.name === "post_comments") breakdown.comments = m.values?.[0]?.value || 0;
    });
  }
  const totalReactions = Object.values(breakdown.reactions).reduce((a, b) => a + b, 0);
  const totalEngagement = totalReactions + breakdown.clicks + breakdown.shares + breakdown.comments;
  return {
    postId,
    breakdown: {
      reactions: breakdown.reactions,
      totalReactions,
      clicks: breakdown.clicks,
      shares: breakdown.shares,
      comments: breakdown.comments
    },
    totalEngagement,
    percentages: {
      reactions: totalEngagement > 0 ? +(totalReactions / totalEngagement * 100).toFixed(1) : 0,
      clicks: totalEngagement > 0 ? +(breakdown.clicks / totalEngagement * 100).toFixed(1) : 0,
      shares: totalEngagement > 0 ? +(breakdown.shares / totalEngagement * 100).toFixed(1) : 0,
      comments: totalEngagement > 0 ? +(breakdown.comments / totalEngagement * 100).toFixed(1) : 0
    }
  };
}

module.exports = {
  analyzePost,
  findBestPostingTimes,
  analyzeHashtags,
  optimizeContent,
  getEngagementBreakdown
};
