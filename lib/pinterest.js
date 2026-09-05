/**
 * Pinterest API Wrapper
 * Core API functions for Pinterest
 */

const API_BASE = "https://api.pinterest.com/v5";

function getAccessToken() {
  return process.env.PINTEREST_ACCESS_TOKEN;
}

async function apiRequest(endpoint, params = {}, method = "GET") {
  const token = getAccessToken();
  if (!token) throw new Error("PINTEREST_ACCESS_TOKEN not configured");

  const url = new URL(`${API_BASE}${endpoint}`);
  if (method === "GET") {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  const options = { method, headers };

  if (method === "POST" || method === "PATCH") {
    options.body = JSON.stringify(params);
  }

  const response = await fetch(url.toString(), options);
  const data = await response.json();

  if (data.code) {
    const err = new Error(data.message || "Pinterest API error");
    err.status = data.code;
    throw err;
  }

  return data;
}

async function getPin(pinId) {
  try {
    const data = await apiRequest(`/pins/${pinId}`);
    const pin = data;
    return {
      id: pin.id,
      title: pin.title,
      description: pin.description,
      link: pin.link,
      imageUrl: pin.images?.["736x"]?.url || pin.images?.originals?.url,
      board: {
        id: pin.board?.id,
        name: pin.board?.name
      },
      metrics: {
        saves: pin.board?.pin_count || 0,
        comments: pin.comment_count || 0
      },
      createdAt: pin.created_at,
      creator: {
        id: pin.creator?.username,
        name: pin.creator?.full_name
      }
    };
  } catch (error) {
    throw new Error(`Pinterest pin fetch failed: ${error.message}`);
  }
}

async function getBoards(limit = 25) {
  try {
    const data = await apiRequest("/user_account/boards", {
      page_size: Math.min(limit, 100)
    });

    return (data.items || []).map(board => ({
      id: board.id,
      name: board.name,
      description: board.description,
      pins: board.pin_count || 0,
      followers: board.follower_count || 0,
      url: board.url
    }));
  } catch (error) {
    throw new Error(`Pinterest boards fetch failed: ${error.message}`);
  }
}

async function getBoardPins(boardId, limit = 25) {
  try {
    const data = await apiRequest(`/boards/${boardId}/pins`, {
      page_size: Math.min(limit, 100)
    });

    return (data.items || []).map(pin => ({
      id: pin.id,
      title: pin.title,
      description: pin.description,
      imageUrl: pin.images?.["736x"]?.url || pin.images?.originals?.url,
      link: pin.link,
      saves: pin.board?.pin_count || 0,
      comments: pin.comment_count || 0,
      createdAt: pin.created_at
    }));
  } catch (error) {
    throw new Error(`Pinterest board pins fetch failed: ${error.message}`);
  }
}

async function getPinAnalytics(pinId) {
  try {
    const data = await apiRequest(`/pins/${pinId}`, {
      fields: "id,title,description,link,board,created_at,comment_count"
    });

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      comments: data.comment_count || 0,
      board: data.board?.name,
      createdAt: data.created_at,
      link: data.link
    };
  } catch (error) {
    throw new Error(`Pinterest pin analytics failed: ${error.message}`);
  }
}

async function searchPins(query, limit = 25) {
  try {
    const data = await apiRequest("/search/pins", {
      query,
      page_size: Math.min(limit, 100)
    });

    return (data.items || []).map(pin => ({
      id: pin.id,
      title: pin.title,
      description: pin.description?.slice(0, 200),
      imageUrl: pin.images?.["736x"]?.url || pin.images?.originals?.url,
      link: pin.link,
      board: pin.board?.name,
      creator: pin.creator?.full_name,
      comments: pin.comment_count || 0
    }));
  } catch (error) {
    throw new Error(`Pinterest search failed: ${error.message}`);
  }
}

async function getTrends(query) {
  try {
    const data = await apiRequest("/search/pins", {
      query,
      page_size: 50,
      sort: "most_relevant"
    });

    const pins = data.items || [];
    const totalComments = pins.reduce((sum, p) => sum + (p.comment_count || 0), 0);

    return {
      query,
      pinCount: pins.length,
      totalComments,
      avgComments: pins.length > 0 ? Math.round(totalComments / pins.length) : 0,
      topPins: pins.slice(0, 10).map(p => ({
        title: p.title,
        description: p.description?.slice(0, 100),
        imageUrl: p.images?.["736x"]?.url,
        comments: p.comment_count || 0,
        creator: p.creator?.full_name
      }))
    };
  } catch (error) {
    throw new Error(`Pinterest trends fetch failed: ${error.message}`);
  }
}

async function createPin(boardId, title, description, imageUrl, link = null) {
  try {
    const params = {
      board_id: boardId,
      title,
      description,
      media_source: {
        source_type: "image_url",
        url: imageUrl
      }
    };

    if (link) params.link = link;

    const data = await apiRequest("/pins", params, "POST");

    return {
      success: true,
      pinId: data.id,
      message: "Pin created successfully"
    };
  } catch (error) {
    throw new Error(`Pinterest pin creation failed: ${error.message}`);
  }
}

async function generatePin(description, style = "creative") {
  const { askLLM } = require("./llm");
  const prompt = `Generate a Pinterest pin for: "${description}". Style: ${style}. Include title, description, and visual description. Format as JSON with "title", "description", and "visualDescription" fields.`;
  const response = await askLLM(prompt, "You are a Pinterest content expert. Create engaging pins.");
  return { description, style, pin: response };
}

async function getBoardAnalytics(boardId) {
  try {
    const board = await apiRequest(`/boards/${boardId}`, {
      fields: "id,name,description,pin_count,follower_count,url"
    });

    const pins = await getBoardPins(boardId, 50);
    const totalComments = pins.reduce((sum, p) => sum + (p.comments || 0), 0);

    return {
      id: board.id,
      name: board.name,
      description: board.description,
      pins: board.pin_count || 0,
      followers: board.follower_count || 0,
      url: board.url,
      analytics: {
        totalComments,
        avgComments: pins.length > 0 ? Math.round(totalComments / pins.length) : 0,
        recentPins: pins.slice(0, 5).map(p => ({
          title: p.title,
          comments: p.comments
        }))
      }
    };
  } catch (error) {
    throw new Error(`Pinterest board analytics failed: ${error.message}`);
  }
}

async function getAudienceInsights() {
  try {
    const data = await apiRequest("/user_account", {
      fields: "id,username,full_name,profile_description,follower_count,board_count,pin_count"
    });

    return {
      id: data.id,
      username: data.username,
      fullName: data.full_name,
      description: data.profile_description,
      followers: data.follower_count || 0,
      boards: data.board_count || 0,
      pins: data.pin_count || 0
    };
  } catch (error) {
    throw new Error(`Pinterest audience insights failed: ${error.message}`);
  }
}

async function trackCompetitors(boards) {
  try {
    const results = await Promise.all(
      boards.map(id => getBoardAnalytics(id).catch(() => null))
    );

    const valid = results.filter(Boolean);
    const totalPins = valid.reduce((sum, b) => sum + b.pins, 0);
    const totalFollowers = valid.reduce((sum, b) => sum + b.followers, 0);

    return {
      boards: valid.map(b => ({
        name: b.name,
        pins: b.pins,
        followers: b.followers
      })),
      summary: {
        totalBoards: valid.length,
        totalPins,
        totalFollowers,
        avgPins: valid.length > 0 ? Math.round(totalPins / valid.length) : 0,
        avgFollowers: valid.length > 0 ? Math.round(totalFollowers / valid.length) : 0
      }
    };
  } catch (error) {
    throw new Error(`Pinterest competitor tracking failed: ${error.message}`);
  }
}

module.exports = {
  getPin,
  getBoards,
  getBoardPins,
  getPinAnalytics,
  searchPins,
  getTrends,
  createPin,
  generatePin,
  getBoardAnalytics,
  getAudienceInsights,
  trackCompetitors
};
