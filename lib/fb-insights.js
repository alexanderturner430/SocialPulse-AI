/**
 * Facebook Insights Metrics
 * Audience demographics, follower growth, audience overlap, competitor analysis, community sentiment
 */

const fbApi = require("./fb-api");

// 28. Audience Demographics
async function getAudienceDemographics(pageId) {
  const [genderAge, country, city] = await Promise.all([
    fbApi.getPageInsights(pageId || fbApi.getPageId(), ["page_fans_gender_age"]).catch(() => ({ data: [] })),
    fbApi.getPageInsights(pageId || fbApi.getPageId(), ["page_fans_country"]).catch(() => ({ data: [] })),
    fbApi.getPageInsights(pageId || fbApi.getPageId(), ["page_fans_city"]).catch(() => ({ data: [] }))
  ]);
  return {
    genderAge: genderAge.data?.[0]?.values?.[0]?.value || {},
    country: country.data?.[0]?.values?.[0]?.value || {},
    city: city.data?.[0]?.values?.[0]?.value || {}
  };
}

// 29. Follower Growth Tracking
async function trackFollowerGrowth(pageId, days = 30) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const [adds, removes] = await Promise.all([
    fbApi.getPageInsights(pageId || fbApi.getPageId(), ["page_fan_adds"], "day", since).catch(() => ({ data: [] })),
    fbApi.getPageInsights(pageId || fbApi.getPageId(), ["page_fan_removes"], "day", since).catch(() => ({ data: [] }))
  ]);
  const addData = adds.data?.[0]?.values || [];
  const removeData = removes.data?.[0]?.values || [];
  const daily = addData.map((d, i) => ({
    date: d.end_time,
    added: d.value,
    removed: removeData[i]?.value || 0,
    net: d.value - (removeData[i]?.value || 0)
  }));
  const totalAdded = daily.reduce((sum, d) => sum + d.added, 0);
  const totalRemoved = daily.reduce((sum, d) => sum + d.removed, 0);
  return {
    period: { from: new Date(since * 1000).toISOString(), to: new Date().toISOString() },
    totalAdded,
    totalRemoved,
    netGrowth: totalAdded - totalRemoved,
    daily
  };
}

// 30. Audience Overlap Analysis
async function analyzeAudienceOverlap(pageId1, pageId2) {
  const [info1, info2] = await Promise.all([
    fbApi.getPageInfo(pageId1),
    fbApi.getPageInfo(pageId2)
  ]);
  const [demo1, demo2] = await Promise.all([
    getAudienceDemographics(pageId1),
    getAudienceDemographics(pageId2)
  ]);
  const countries1 = Object.keys(demo1.country);
  const countries2 = Object.keys(demo2.country);
  const overlap = countries1.filter(c => countries2.includes(c));
  const similarityScore = overlap.length / Math.max(1, new Set([...countries1, ...countries2]).size);
  return {
    page1: { name: info1.name, followers: info1.followers_count, category: info1.category },
    page2: { name: info2.name, followers: info2.followers_count, category: info2.category },
    audienceOverlap: {
      sharedCountries: overlap,
      overlapScore: +similarityScore.toFixed(4),
      sharedAudienceEstimate: Math.round(similarityScore * Math.min(info1.followers_count || 0, info2.followers_count || 0))
    }
  };
}

// 31. Competitor Analysis
async function analyzeCompetitor(competitorPageId) {
  const [info, posts] = await Promise.all([
    fbApi.getPageInfo(competitorPageId),
    fbApi.getPagePosts(competitorPageId, 25)
  ]);
  const postMetrics = (posts.data || []).map(p => ({
    message: p.message?.slice(0, 100),
    createdTime: p.created_time,
    type: p.type,
    engagement: (p.reactions?.summary?.total_count || 0) +
      (p.comments?.summary?.total_count || 0) +
      (p.shares?.count || 0),
    reactions: p.reactions?.summary?.total_count || 0,
    comments: p.comments?.summary?.total_count || 0,
    shares: p.shares?.count || 0
  }));
  const avgEngagement = postMetrics.length > 0
    ? postMetrics.reduce((sum, p) => sum + p.engagement, 0) / postMetrics.length
    : 0;
  const topPost = postMetrics.reduce((a, b) => a.engagement > b.engagement ? a : b, { engagement: 0 });
  return {
    pageInfo: info,
    metrics: {
      totalPosts: postMetrics.length,
      avgEngagement: +avgEngagement.toFixed(2),
      topPost,
      allPosts: postMetrics.slice(0, 10)
    }
  };
}

// 32. Community Sentiment
async function analyzeCommunitySentiment(pageId, limit = 50) {
  const posts = await fbApi.getPagePosts(pageId, limit);
  const { analyzeSentimentML } = require("./tf-text");
  const sentiments = [];
  for (const post of (posts.data || []).slice(0, 20)) {
    if (post.message) {
      try {
        const sentiment = await analyzeSentimentML(post.message);
        sentiments.push({
          postId: post.id,
          message: post.message.slice(0, 100),
          sentiment: sentiment.sentiment,
          score: sentiment.score,
          createdTime: post.created_time
        });
      } catch (e) { /* skip errors */ }
    }
  }
  const posCount = sentiments.filter(s => s.sentiment === "positive").length;
  const negCount = sentiments.filter(s => s.sentiment === "negative").length;
  const neuCount = sentiments.filter(s => s.sentiment === "neutral").length;
  return {
    totalAnalyzed: sentiments.length,
    distribution: { positive: posCount, negative: negCount, neutral: neuCount },
    overallSentiment: posCount > negCount ? "positive" : negCount > posCount ? "negative" : "neutral",
    posts: sentiments.slice(0, 10)
  };
}

module.exports = {
  getAudienceDemographics,
  trackFollowerGrowth,
  analyzeAudienceOverlap,
  analyzeCompetitor,
  analyzeCommunitySentiment
};
