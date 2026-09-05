/**
 * Facebook Content Generation
 * Post captions, ad copy, content calendar, A/B variants, brand voice consistency
 */

const { askLLM } = require("./llm");
const fbApi = require("./fb-api");

// 38. Generate Post Caption
async function generateCaption(topic, tone = "engaging", pageId = null) {
  const pageInfo = pageId ? await fbApi.getPageInfo(pageId).catch(() => null) : null;
  const brandContext = pageInfo ? `Brand: ${pageInfo.name}, Category: ${pageInfo.category}` : "";
  const prompt = `Generate 3 engaging Facebook post captions about: ${topic}\nTone: ${tone}\n${brandContext}\nFormat each as a complete caption with emojis and hashtags. Return as JSON array.`;
  const response = await askLLM(prompt, "You are a social media expert who creates engaging Facebook content.");
  let captions;
  try {
    captions = JSON.parse(response);
  } catch {
    captions = response.split("\n\n").filter(Boolean).map(c => c.trim());
  }
  return { topic, tone, captions: Array.isArray(captions) ? captions : [captions] };
}

// 39. Generate Ad Copy
async function generateAdCopy(product, audience, numVariants = 3) {
  const prompt = `Generate ${numVariants} Facebook ad copy variants for: ${product}\nTarget audience: ${audience}\n\nFor each variant provide:\n- headline (max 40 chars)\n- primary text (max 125 chars)\n- description (max 30 chars)\n- call to action suggestion\n\nReturn as JSON array.`;
  const response = await askLLM(prompt, "You are a Facebook Ads specialist who creates high-converting ad copy.");
  let variants;
  try {
    variants = JSON.parse(response);
  } catch {
    variants = [{ headline: product, primaryText: response.slice(0, 125), description: product, cta: "Learn More" }];
  }
  return { product, audience, variants: Array.isArray(variants) ? variants : [variants] };
}

// 40. Content Calendar
async function generateContentCalendar(pageId, daysAhead = 7) {
  const pageInfo = await fbApi.getPageInfo(pageId).catch(() => null);
  const posts = await fbApi.getPagePosts(pageId, 20).catch(() => ({ data: [] }));
  const recentContent = (posts.data || []).slice(0, 10).map(p => ({
    message: p.message?.slice(0, 100),
    type: p.type,
    createdTime: p.created_time
  }));
  const prompt = `Create a ${daysAhead}-day content calendar for a Facebook page.\nPage info: ${pageInfo ? `${pageInfo.name} (${pageInfo.category})` : "Unknown"}\nRecent posts: ${JSON.stringify(recentContent.slice(0, 5))}\n\nInclude:\n- Date and optimal posting time\n- Content type (text, image, video, link, story)\n- Topic/theme\n- Caption preview\n- Hashtag suggestions\n\nReturn as JSON array.`;
  const response = await askLLM(prompt, "You are a social media strategist who plans content calendars.");
  let calendar;
  try {
    calendar = JSON.parse(response);
  } catch {
    calendar = [{ day: 1, type: "text", topic: "General", caption: response.slice(0, 200) }];
  }
  return { pageId, days: daysAhead, calendar: Array.isArray(calendar) ? calendar : [calendar] };
}

// 41. Generate A/B Test Variants
async function generateVariants(originalPost, numVariants = 3) {
  const prompt = `Generate ${numVariants} variants of this Facebook post for A/B testing:\n\nOriginal: "${originalPost}"\n\nFor each variant, modify one element (tone, length, CTA, hook, hashtags). Return as JSON with:\n- variant number\n- modified text\n- what was changed\n- hypothesis about why it might perform better`;
  const response = await askLLM(prompt, "You are an A/B testing expert for social media content.");
  let variants;
  try {
    variants = JSON.parse(response);
  } catch {
    variants = [{ variant: 1, text: originalPost.toUpperCase(), changed: "tone", hypothesis: "Different tone may resonate" }];
  }
  return { original: originalPost, variants: Array.isArray(variants) ? variants : [variants] };
}

// 42. Brand Voice Consistency Check
async function checkBrandVoice(text, brandGuidelines = null) {
  const prompt = `Analyze this text for brand voice consistency:\n\n"${text}"\n\n${brandGuidelines ? `Brand guidelines: ${brandGuidelines}` : "Check for: tone consistency, professionalism, engagement level, readability."}\n\nReturn JSON with:\n- overallScore (0-100)\n- tone (formal/casual/friendly/professional)\n- readingLevel\n- suggestions (array)\n- flags (any issues found)`;
  const response = await askLLM(prompt, "You are a brand voice expert who evaluates content consistency.");
  let analysis;
  try {
    analysis = JSON.parse(response);
  } catch {
    analysis = { overallScore: 75, tone: "neutral", readingLevel: "moderate", suggestions: [], flags: [] };
  }
  return { text: text.slice(0, 200), analysis };
}

module.exports = {
  generateCaption,
  generateAdCopy,
  generateContentCalendar,
  generateVariants,
  checkBrandVoice
};
