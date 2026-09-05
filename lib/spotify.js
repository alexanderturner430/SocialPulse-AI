/**
 * Spotify API Wrapper
 * Core API functions for Spotify
 */

const API_BASE = "https://api.spotify.com/v1";
const AUTH_URL = "https://accounts.spotify.com/api/token";

function getClientId() {
  return process.env.SPOTIFY_CLIENT_ID;
}

function getClientSecret() {
  return process.env.SPOTIFY_CLIENT_SECRET;
}

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const clientId = getClientId();
  const clientSecret = getClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET not configured");
  }

  const response = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`
    },
    body: "grant_type=client_credentials"
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error_description);

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
      "Authorization": `Bearer ${token}`
    }
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After") || 1;
    throw new Error(`Rate limited. Retry after ${retryAfter}s`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  return data;
}

async function getTrack(trackId) {
  try {
    const data = await apiRequest(`/tracks/${trackId}`);
    return {
      id: data.id,
      name: data.name,
      artists: data.artists.map(a => ({ id: a.id, name: a.name })),
      album: {
        id: data.album.id,
        name: data.album.name,
        releaseDate: data.album.release_date,
        images: data.album.images?.map(i => i.url) || []
      },
      duration: data.duration_ms,
      explicit: data.explicit,
      popularity: data.popularity,
      previewUrl: data.preview_url,
      externalUrl: data.external_urls?.spotify
    };
  } catch (error) {
    throw new Error(`Spotify track fetch failed: ${error.message}`);
  }
}

async function getArtist(artistId) {
  try {
    const data = await apiRequest(`/artists/${artistId}`);
    const topTracks = await apiRequest(`/artists/${artistId}/top-tracks`, { market: "US" });

    return {
      id: data.id,
      name: data.name,
      followers: data.followers?.total || 0,
      genres: data.genres || [],
      popularity: data.popularity,
      images: data.images?.map(i => i.url) || [],
      externalUrl: data.external_urls?.spotify,
      topTracks: (topTracks.tracks || []).slice(0, 5).map(t => ({
        name: t.name,
        album: t.album?.name,
        popularity: t.popularity,
        previewUrl: t.preview_url
      }))
    };
  } catch (error) {
    throw new Error(`Spotify artist fetch failed: ${error.message}`);
  }
}

async function getAlbum(albumId) {
  try {
    const data = await apiRequest(`/albums/${albumId}`);
    return {
      id: data.id,
      name: data.name,
      artists: data.artists.map(a => ({ id: a.id, name: a.name })),
      releaseDate: data.release_date,
      totalTracks: data.total_tracks,
      images: data.images?.map(i => i.url) || [],
      label: data.label,
      popularity: data.popularity,
      tracks: (data.tracks?.items || []).map(t => ({
        name: t.name,
        duration: t.duration_ms,
        trackNumber: t.track_number
      })),
      externalUrl: data.external_urls?.spotify
    };
  } catch (error) {
    throw new Error(`Spotify album fetch failed: ${error.message}`);
  }
}

async function search(query, type = "track", limit = 20) {
  try {
    const data = await apiRequest("/search", {
      q: query,
      type,
      limit: Math.min(limit, 50)
    });

    const results = {};

    if (data.tracks) {
      results.tracks = (data.tracks.items || []).map(t => ({
        id: t.id,
        name: t.name,
        artists: t.artists.map(a => a.name).join(", "),
        album: t.album?.name,
        duration: t.duration_ms,
        popularity: t.popularity,
        previewUrl: t.preview_url
      }));
    }

    if (data.artists) {
      results.artists = (data.artists.items || []).map(a => ({
        id: a.id,
        name: a.name,
        followers: a.followers?.total || 0,
        genres: a.genres || [],
        popularity: a.popularity
      }));
    }

    if (data.albums) {
      results.albums = (data.albums.items || []).map(a => ({
        id: a.id,
        name: a.name,
        artists: a.artists.map(a => a.name).join(", "),
        releaseDate: a.release_date,
        totalTracks: a.total_tracks
      }));
    }

    return results;
  } catch (error) {
    throw new Error(`Spotify search failed: ${error.message}`);
  }
}

async function getPlaylists(limit = 20) {
  try {
    const data = await apiRequest("/browse/featured-playlists", {
      limit: Math.min(limit, 50)
    });

    return (data.playlists?.items || []).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      owner: p.owner?.display_name,
      tracks: p.tracks?.total || 0,
      images: p.images?.map(i => i.url) || [],
      externalUrl: p.external_urls?.spotify
    }));
  } catch (error) {
    throw new Error(`Spotify playlists fetch failed: ${error.message}`);
  }
}

async function createPlaylist(name, description = "") {
  try {
    const data = await apiRequest("/me/playlists", {
      name,
      description,
      public: true
    }, "POST");

    return {
      success: true,
      playlistId: data.id,
      name: data.name,
      externalUrl: data.external_urls?.spotify,
      message: "Playlist created successfully"
    };
  } catch (error) {
    throw new Error(`Spotify playlist creation failed: ${error.message}`);
  }
}

async function generatePlaylist(mood, genre = "pop") {
  const { askLLM } = require("./llm");
  const prompt = `Generate a Spotify playlist for mood: "${mood}", genre: ${genre}. Include 10 songs with artist names. Format as JSON array with "name" and "artist" fields.`;
  const response = await askLLM(prompt, "You are a Spotify playlist curator. Create engaging playlists.");
  return { mood, genre, playlist: response };
}

async function getTopItems(type = "artists", limit = 20) {
  try {
    const data = await apiRequest(`/me/top/${type}`, {
      limit: Math.min(limit, 50),
      time_range: "medium_term"
    });

    if (type === "artists") {
      return (data.items || []).map(a => ({
        id: a.id,
        name: a.name,
        followers: a.followers?.total || 0,
        genres: a.genres || [],
        popularity: a.popularity,
        images: a.images?.map(i => i.url) || []
      }));
    }

    return (data.items || []).map(t => ({
      id: t.id,
      name: t.name,
      artists: t.artists.map(a => a.name).join(", "),
      album: t.album?.name,
      duration: t.duration_ms,
      popularity: t.popularity
    }));
  } catch (error) {
    throw new Error(`Spotify top items fetch failed: ${error.message}`);
  }
}

async function getRecommendations(seedTracks = [], seedGenres = [], limit = 20) {
  try {
    const params = { limit: Math.min(limit, 50) };
    if (seedTracks.length > 0) params.seed_tracks = seedTracks.slice(0, 5).join(",");
    if (seedGenres.length > 0) params.seed_genres = seedGenres.slice(0, 5).join(",");

    const data = await apiRequest("/recommendations", params);

    return (data.tracks || []).map(t => ({
      id: t.id,
      name: t.name,
      artists: t.artists.map(a => a.name).join(", "),
      album: t.album?.name,
      duration: t.duration_ms,
      previewUrl: t.preview_url
    }));
  } catch (error) {
    throw new Error(`Spotify recommendations failed: ${error.message}`);
  }
}

async function getAudioAnalysis(trackId) {
  try {
    const data = await apiRequest(`/audio-features/${trackId}`);
    return {
      trackId,
      tempo: data.tempo,
      key: data.key,
      mode: data.mode,
      timeSignature: data.time_signature,
      energy: data.energy,
      danceability: data.danceability,
      valence: data.valence,
      acousticness: data.acousticness,
      instrumentalness: data.instrumentalness,
      liveness: data.liveness,
      speechiness: data.speechiness,
      loudness: data.loudness
    };
  } catch (error) {
    throw new Error(`Spotify audio analysis failed: ${error.message}`);
  }
}

module.exports = {
  getTrack,
  getArtist,
  getAlbum,
  search,
  getPlaylists,
  createPlaylist,
  generatePlaylist,
  getTopItems,
  getRecommendations,
  getAudioAnalysis
};
