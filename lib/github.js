/**
 * GitHub API Wrapper
 * Core API functions for GitHub
 */

const API_BASE = "https://api.github.com";

function getToken() {
  return process.env.GITHUB_TOKEN;
}

async function apiRequest(endpoint, params = {}, method = "GET") {
  const token = getToken();

  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const headers = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const options = { method, headers };

  if (method === "POST" || method === "PATCH") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(params);
  }

  const response = await fetch(url.toString(), options);

  if (response.status === 403) {
    const err = new Error("GitHub API rate limit exceeded");
    err.status = 403;
    throw err;
  }

  const data = await response.json();

  if (data.message) {
    const err = new Error(data.message || "GitHub API error");
    err.status = response.status;
    throw err;
  }

  return data;
}

async function getRepo(owner, repo) {
  try {
    const data = await apiRequest(`/repos/${owner}/${repo}`);
    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      stars: data.stargazers_count,
      forks: data.forks_count,
      watchers: data.watchers_count,
      openIssues: data.open_issues_count,
      language: data.language,
      topics: data.topics || [],
      license: data.license?.name || null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      pushedAt: data.pushed_at,
      homepage: data.homepage,
      visibility: data.visibility,
      defaultBranch: data.default_branch
    };
  } catch (error) {
    throw new Error(`GitHub repo fetch failed: ${error.message}`);
  }
}

async function getIssues(owner, repo, state = "open", limit = 30) {
  try {
    const data = await apiRequest(`/repos/${owner}/${repo}/issues`, {
      state,
      per_page: Math.min(limit, 100),
      sort: "created",
      direction: "desc"
    });

    return (data || []).map(issue => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body?.slice(0, 200),
      state: issue.state,
      author: issue.user?.login,
      labels: issue.labels?.map(l => l.name) || [],
      comments: issue.comments || 0,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      url: issue.html_url
    }));
  } catch (error) {
    throw new Error(`GitHub issues fetch failed: ${error.message}`);
  }
}

async function getPRs(owner, repo, state = "open", limit = 30) {
  try {
    const data = await apiRequest(`/repos/${owner}/${repo}/pulls`, {
      state,
      per_page: Math.min(limit, 100),
      sort: "created",
      direction: "desc"
    });

    return (data || []).map(pr => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body?.slice(0, 200),
      state: pr.state,
      author: pr.user?.login,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      changedFiles: pr.changed_files || 0,
      comments: pr.comments || 0,
      reviewComments: pr.review_comments || 0,
      merged: pr.merged_at !== null,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      url: pr.html_url
    }));
  } catch (error) {
    throw new Error(`GitHub PRs fetch failed: ${error.message}`);
  }
}

async function searchRepos(query, limit = 30) {
  try {
    const data = await apiRequest("/search/repositories", {
      q: query,
      per_page: Math.min(limit, 100),
      sort: "stars",
      order: "desc"
    });

    return (data.items || []).map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description?.slice(0, 200),
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
      url: repo.html_url
    }));
  } catch (error) {
    throw new Error(`GitHub search failed: ${error.message}`);
  }
}

async function getPublicActivity(username, limit = 30) {
  try {
    const data = await apiRequest(`/users/${username}/events/public`, {
      per_page: Math.min(limit, 100)
    });

    return (data || []).map(event => ({
      id: event.id,
      type: event.type,
      repo: event.repo?.name,
      createdAt: event.created_at,
      payload: {
        action: event.payload?.action,
        size: event.payload?.size,
        commits: event.payload?.commits?.length || 0
      }
    }));
  } catch (error) {
    throw new Error(`GitHub activity fetch failed: ${error.message}`);
  }
}

async function createIssue(owner, repo, title, body = "") {
  try {
    const data = await apiRequest(`/repos/${owner}/${repo}/issues`, {
      title,
      body
    }, "POST");

    return {
      success: true,
      issueNumber: data.number,
      issueUrl: data.html_url,
      message: "Issue created successfully"
    };
  } catch (error) {
    throw new Error(`GitHub issue creation failed: ${error.message}`);
  }
}

async function generateIssue(owner, repo, topic, style = "bug report") {
  const { askLLM } = require("./llm");
  const prompt = `Generate a GitHub issue for repo "${owner}/${repo}" about: "${topic}". Style: ${style}. Include title and body. Format as JSON with "title" and "body" fields.`;
  const response = await askLLM(prompt, "You are a GitHub contributor. Create clear issues.");
  return { owner, repo, topic, style, issue: response };
}

async function getContributorStats(owner, repo) {
  try {
    const data = await apiRequest(`/repos/${owner}/${repo}/contributors`, {
      per_page: 30
    });

    const contributors = (data || []).map(c => ({
      username: c.login,
      avatar: c.avatar_url,
      contributions: c.contributions || 0,
      type: c.type
    }));

    const totalContributions = contributors.reduce((sum, c) => sum + c.contributions, 0);

    return {
      owner,
      repo,
      totalContributors: contributors.length,
      totalContributions,
      topContributors: contributors.slice(0, 10),
      contributorDistribution: {
        top1Percent: contributors.slice(0, Math.max(1, Math.ceil(contributors.length * 0.01))).reduce((s, c) => s + c.contributions, 0),
        top10Percent: contributors.slice(0, Math.max(1, Math.ceil(contributors.length * 0.1))).reduce((s, c) => s + c.contributions, 0),
        others: contributors.slice(Math.ceil(contributors.length * 0.1)).reduce((s, c) => s + c.contributions, 0)
      }
    };
  } catch (error) {
    throw new Error(`GitHub contributor stats failed: ${error.message}`);
  }
}

async function getTrending(language = "", since = "daily", limit = 25) {
  try {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const sinceDate = date.toISOString().split("T")[0];

    const query = `created:>${sinceDate}` + (language ? ` language:${language}` : "");
    const data = await apiRequest("/search/repositories", {
      q: query,
      per_page: Math.min(limit, 100),
      sort: "stars",
      order: "desc"
    });

    return (data.items || []).map(repo => ({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description?.slice(0, 200),
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
      url: repo.html_url,
      createdAt: repo.created_at
    }));
  } catch (error) {
    throw new Error(`GitHub trending fetch failed: ${error.message}`);
  }
}

async function analyzeCompetitorRepos(repos) {
  try {
    const results = await Promise.all(
      repos.map(r => {
        const [owner, repo] = r.split("/");
        return getRepo(owner, repo).catch(() => null);
      })
    );

    const valid = results.filter(Boolean);
    const totalStars = valid.reduce((sum, r) => sum + r.stars, 0);
    const totalForks = valid.reduce((sum, r) => sum + r.forks, 0);

    return {
      repos: valid.map(r => ({
        name: r.fullName,
        stars: r.stars,
        forks: r.forks,
        language: r.language,
        openIssues: r.openIssues
      })),
      summary: {
        totalRepos: valid.length,
        totalStars,
        totalForks,
        avgStars: valid.length > 0 ? Math.round(totalStars / valid.length) : 0,
        topRepo: valid.sort((a, b) => b.stars - a.stars)[0]?.fullName || null
      }
    };
  } catch (error) {
    throw new Error(`GitHub competitor analysis failed: ${error.message}`);
  }
}

module.exports = {
  getRepo,
  getIssues,
  getPRs,
  searchRepos,
  getPublicActivity,
  createIssue,
  generateIssue,
  getContributorStats,
  getTrending,
  analyzeCompetitorRepos
};
