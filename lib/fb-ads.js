/**
 * Facebook Marketing/Ads API
 * Ad performance, budget optimization, audience targeting, creative analysis, ROI forecasting
 */

const fbApi = require("./fb-api");

// 33. Ad Performance Analysis
async function getAdPerformance(adId) {
  const insights = await fbApi.graphRequest(`/${adId}/insights`, {
    fields: "campaign_name,adset_name,ad_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type"
  });
  const data = insights.data?.[0] || {};
  const actions = {};
  const costPerAction = {};
  if (data.actions) data.actions.forEach(a => { actions[a.action_type] = a.value; });
  if (data.cost_per_action_type) data.cost_per_action_type.forEach(a => { costPerAction[a.action_type] = a.value; });
  return {
    adId,
    campaignName: data.campaign_name,
    adSetName: data.adset_name,
    adName: data.ad_name,
    metrics: {
      impressions: parseInt(data.impressions || 0),
      clicks: parseInt(data.clicks || 0),
      spend: parseFloat(data.spend || 0),
      ctr: parseFloat(data.ctr || 0),
      cpc: parseFloat(data.cpc || 0),
      cpm: parseFloat(data.cpm || 0),
      reach: parseInt(data.reach || 0),
      frequency: parseFloat(data.frequency || 0)
    },
    conversions: actions,
    costPerConversion: costPerAction
  };
}

// 34. Budget Optimization
async function optimizeBudget(adAccountId) {
  const campaigns = await fbApi.graphRequest(`/act_${adAccountId}/campaigns`, {
    fields: "name,daily_budget,lifetime_budget,status,objective"
  });
  const recommendations = [];
  for (const campaign of (campaigns.data || [])) {
    const insights = await fbApi.graphRequest(`/act_${adAccountId}/insights`, {
      fields: "campaign_name,spend,impressions,clicks,actions",
      level: "campaign",
      filters: JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: campaign.id }])
    }).catch(() => ({ data: [] }));
    const data = insights.data?.[0] || {};
    const spend = parseFloat(data.spend || 0);
    const clicks = parseInt(data.clicks || 0);
    const cpc = clicks > 0 ? spend / clicks : 0;
    const conversions = (data.actions || []).find(a => a.action_type === "purchase")?.value || 0;
    const costPerConversion = conversions > 0 ? spend / conversions : 0;
    recommendations.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      currentBudget: campaign.daily_budget || campaign.lifetime_budget,
      objective: campaign.objective,
      performance: { spend, clicks, cpc: +cpc.toFixed(2), conversions: parseInt(conversions), costPerConversion: +costPerConversion.toFixed(2) },
      recommendation: costPerConversion > 50 ? "consider reducing budget" : costPerConversion < 10 ? "consider increasing budget" : "maintain current budget"
    });
  }
  return { accountId: adAccountId, recommendations };
}

// 35. Audience Targeting Suggestions
async function suggestAudienceTargeting(campaignId) {
  const insights = await fbApi.graphRequest(`/${campaignId}/insights`, {
    fields: "impressions,clicks,actions",
    breakdowns: "age,gender"
  });
  const demographics = (insights.data || []).map(d => ({
    age: d.age,
    gender: d.gender,
    impressions: parseInt(d.impressions || 0),
    clicks: parseInt(d.clicks || 0),
    conversions: (d.actions || []).find(a => a.action_type === "purchase")?.value || 0
  }));
  const bestPerformers = demographics
    .filter(d => d.clicks > 0)
    .sort((a, b) => (b.clicks / b.impressions) - (a.clicks / a.impressions))
    .slice(0, 5);
  return {
    campaignId,
    allDemographics: demographics,
    topPerformingDemographics: bestPerformers,
    suggestions: bestPerformers.map(d => `Target age ${d.age} ${d.gender} - CTR: ${(d.clicks / d.impressions * 100).toFixed(2)}%`)
  };
}

// 36. Creative Analysis
async function analyzeCreative(adId) {
  const [adDetails, insights] = await Promise.all([
    fbApi.graphRequest(`/${adId}`, { fields: "name,creative,adset_name,campaign_name,status" }),
    fbApi.graphRequest(`/${adId}/insights`, {
      fields: "impressions,clicks,ctr,cpc,actions,video_30_sec_watched_actions,video_p25_watched_actions"
    }).catch(() => ({ data: [] }))
  ]);
  const data = insights.data?.[0] || {};
  const videoMetrics = {
    video25Pct: (data.video_p25_watched_actions || []).reduce((s, a) => s + parseInt(a.value || 0), 0),
    video30Sec: (data.video_30_sec_watched_actions || []).reduce((s, a) => s + parseInt(a.value || 0), 0)
  };
  return {
    adId,
    name: adDetails.name,
    campaign: adDetails.campaign_name,
    status: adDetails.status,
    creative: adDetails.creative,
    performance: {
      impressions: parseInt(data.impressions || 0),
      clicks: parseInt(data.clicks || 0),
      ctr: parseFloat(data.ctr || 0),
      cpc: parseFloat(data.cpc || 0),
      videoMetrics
    },
    assessment: parseFloat(data.ctr || 0) > 2 ? "high_performing" : parseFloat(data.ctr || 0) > 0.5 ? "average" : "needs_optimization"
  };
}

// 37. ROI Forecast
async function forecastROI(campaignId, projectedBudget) {
  const insights = await fbApi.graphRequest(`/${campaignId}/insights`, {
    fields: "spend,impressions,clicks,actions,cost_per_action_type"
  });
  const data = insights.data?.[0] || {};
  const currentSpend = parseFloat(data.spend || 1);
  const currentConversions = (data.actions || []).find(a => a.action_type === "purchase")?.value || 0;
  const currentCPA = currentConversions > 0 ? currentSpend / currentConversions : currentSpend;
  const currentCTR = parseInt(data.clicks || 0) / parseInt(data.impressions || 1);
  const projectedConversions = projectedBudget / currentCPA;
  const projectedClicks = projectedBudget / (currentSpend / parseInt(data.clicks || 1));
  return {
    campaignId,
    currentMetrics: {
      spend: currentSpend,
      conversions: parseInt(currentConversions),
      cpa: +currentCPA.toFixed(2),
      ctr: +(currentCTR * 100).toFixed(2) + "%"
    },
    projection: {
      budget: projectedBudget,
      estimatedConversions: Math.round(projectedConversions),
      estimatedClicks: Math.round(projectedClicks),
      estimatedCPA: +currentCPA.toFixed(2),
      estimatedCTR: +(currentCTR * 100).toFixed(2) + "%"
    }
  };
}

module.exports = {
  getAdPerformance,
  optimizeBudget,
  suggestAudienceTargeting,
  analyzeCreative,
  forecastROI
};
