/**
 * Bluesky API Wrapper
 * Core API functions for Bluesky (AT Protocol)
 */

const PUBLIC_API = "https://public.api.bsky.app/xrpc";
const AUTH_API = "https://bsky.social/xrpc";

function getHandle() {
  return process.env.BLUESKY_HANDLE;
}

function getAppPassword() {
  return process.env.BLUESKY_APP_PASSWORD;
}

let sessionToken = null;
let sessionExpires = 0;

async function getSession() {
  if (sessionToken && Date.now() < sessionExpires) return sessionToken;

  const handle = getHandle();
  const password = getAppPassword();

  if (!handle || !password) {
    throw new Error("BLUESKY_HANDLE and BLUESKY_APP_PASSWORD not configured");
  }

  const response = await fetch(`${AUTH_API}/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.message);

  sessionToken = data.accessJwt;
  sessionExpires = Date.now() + (data.expiresIn - 60) * 1000;
  return sessionToken;
}

async function publicRequest(endpoint, params = {}) {
  const url = new URL(`${PUBLIC_API}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const response = await fetch(url.toString(), {
    headers: { "Accept": "application/json" }
  });

  const data = await response.json();
  if (data.error) throw new Error(data.message);
  return data;
}

async function authRequest(endpoint, params = {}, method = "GET") {
  const token = await getSession();

  const url = new URL(`${AUTH_API}${endpoint}`);
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

  if (data.error) throw new Error(data.message);
  return data;
}

async function getProfile(handle) {
  try {
    const data = await publicRequest("/app.bsky.actor.getProfile", {
      actor: handle || getHandle()
    });

    const profile = data;
    return {
      did: profile.did,
      handle: profile.handle,
      displayName: profile.displayName,
      description: profile.description,
      followers: profile.followersCount || 0,
      following: profile.followsCount || 0,
      posts: profile.postsCount || 0,
      avatar: profile.avatar,
      banner: profile.banner
    };
  } catch (error) {
    throw new Error(`Bluesky profile fetch failed: ${error.message}`);
  }
}

async function getPosts(handle, limit = 30) {
  try {
    const data = await publicRequest("/app.bsky.feed.getAuthorFeed", {
      actor: handle || getHandle(),
      limit: Math.min(limit, 100)
    });

    return (data.feed || []).map(post => ({
      uri: post.post?.uri,
      cid: post.post?.cid,
      text: post.post?.record?.text,
      createdAt: post.post?.record?.createdAt,
      likes: post.post?.likeCount || 0,
      reposts: post.post?.repostCount || 0,
      replies: post.post?.replyCount || 0,
      author: {
        handle: post.post?.author?.handle,
        displayName: post.post?.author?.displayName
      }
    }));
  } catch (error) {
    throw new Error(`Bluesky posts fetch failed: ${error.message}`);
  }
}

async function getPostStats(uri) {
  try {
    const data = await publicRequest("/app.bsky.feed.getPostThread", {
      uri,
      depth: 0
    });

    const post = data.thread?.post;
    if (!post) throw new Error("Post not found");

    return {
      uri: post.uri,
      text: post.record?.text,
      createdAt: post.record?.createdAt,
      likes: post.likeCount || 0,
      reposts: post.repostCount || 0,
      replies: post.replyCount || 0,
      quotes: post.quoteCount || 0,
      author: {
        handle: post.author?.handle,
        displayName: post.author?.displayName
      }
    };
  } catch (error) {
    throw new Error(`Bluesky post stats failed: ${error.message}`);
  }
}

async function searchPosts(query, limit = 25) {
  try {
    const data = await publicRequest("/app.bsky.feed.searchPosts", {
      q: query,
      limit: Math.min(limit, 100)
    });

    return (data.posts || []).map(post => ({
      uri: post.uri,
      text: post.record?.text,
      createdAt: post.record?.createdAt,
      likes: post.likeCount || 0,
      reposts: post.repostCount || 0,
      replies: post.replyCount || 0,
      author: {
        handle: post.author?.handle,
        displayName: post.author?.displayName
      }
    }));
  } catch (error) {
    throw new Error(`Bluesky search failed: ${error.message}`);
  }
}

async function searchUsers(query, limit = 10) {
  try {
    const data = await publicRequest("/app.bsky.actor.searchActors", {
      q: query,
      limit: Math.min(limit, 50)
    });

    return (data.actors || []).map(user => ({
      did: user.did,
      handle: user.handle,
      displayName: user.displayName,
      description: user.description,
      followers: user.followersCount || 0,
      following: user.followsCount || 0,
      posts: user.postsCount || 0,
      avatar: user.avatar
    }));
  } catch (error) {
    throw new Error(`Bluesky user search failed: ${error.message}`);
  }
}

async function createPost(text, options = {}) {
  try {
    const record = {
      $type: "app.bsky.feed.post",
      text,
      createdAt: new Date().toISOString()
    };

    if (options.replyTo) {
      record.reply = {
        root: options.replyTo,
        parent: options.replyTo
      };
    }

    if (options.embed) {
      record.embed = options.embed;
    }

    const data = await authRequest("/com.atproto.repo.createRecord", {
      repo: getHandle(),
      collection: "app.bsky.feed.post",
      record
    }, "POST");

    return {
      success: true,
      uri: data.uri,
      cid: data.cid,
      message: "Post created successfully"
    };
  } catch (error) {
    throw new Error(`Bluesky post creation failed: ${error.message}`);
  }
}

async function generatePost(topic, style = "casual") {
  const { askLLM } = require("./llm");
  const prompt = `Generate 5 Bluesky posts for: "${topic}". Style: ${style}. Keep under 300 characters. Format as JSON array.`;
  const response = await askLLM(prompt, "You are a Bluesky content expert. Create engaging posts.");
  return { topic, style, posts: response };
}

async function getFollowers(handle, limit = 50) {
  try {
    const data = await publicRequest("/app.bsky.graph.getFollowers", {
      actor: handle || getHandle(),
      limit: Math.min(limit, 100)
    });

    return (data.followers || []).map(f => ({
      did: f.did,
      handle: f.handle,
      displayName: f.displayName,
      followers: f.followersCount || 0,
      following: f.followsCount || 0,
      posts: f.postsCount || 0
    }));
  } catch (error) {
    throw new Error(`Bluesky followers fetch failed: ${error.message}`);
  }
}

async function getThread(uri, depth = 10) {
  try {
    const data = await publicRequest("/app.bsky.feed.getPostThread", {
      uri,
      depth
    });

    const thread = data.thread;
    return {
      post: {
        uri: thread.post?.uri,
        text: thread.post?.record?.text,
        likes: thread.post?.likeCount || 0,
        reposts: thread.post?.repostCount || 0,
        replies: thread.post?.replyCount || 0,
        author: {
          handle: thread.post?.author?.handle,
          displayName: thread.post?.author?.displayName
        }
      },
      replies: (thread.replies || []).map(r => ({
        text: r.post?.record?.text,
        likes: r.post?.likeCount || 0,
        author: {
          handle: r.post?.author?.handle,
          displayName: r.post?.author?.displayName
        }
      }))
    };
  } catch (error) {
    throw new Error(`Bluesky thread fetch failed: ${error.message}`);
  }
}

async function monitorFirehose(callback, duration = 60000) {
  try {
    const ws = new WebSocket("wss://jetstream1.bsky.network/xrpc/app.bsky.feed.subscribeTimeline");

    const timeout = setTimeout(() => {
      ws.close();
    }, duration);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      callback(data);
    };

    ws.onerror = (error) => {
      console.error("Firehose error:", error);
    };

    return { message: "Firehose monitoring started", duration };
  } catch (error) {
    throw new Error(`Bluesky firehose monitoring failed: ${error.message}`);
  }
}

module.exports = {
  getProfile,
  getPosts,
  getPostStats,
  searchPosts,
  searchUsers,
  createPost,
  generatePost,
  getFollowers,
  getThread,
  monitorFirehose
};
