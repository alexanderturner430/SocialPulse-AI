let BASE = "http://127.0.0.1:9151";

export function setBase(url) {
  BASE = url.replace(/\/$/, "");
}

async function request(path, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout || 8000);
  try {
    const res = await fetch(BASE + path, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

export function getStatus() {
  return request("/x402/status");
}

export function control(action, value) {
  return request("/x402/control", { method: "POST", body: { action, value } });
}

export async function listTools() {
  const { ok, data } = await request("/api/v1/tools");
  return ok && data ? data.tools || [] : [];
}

export async function callTool(name, args) {
  return request(`/api/v1/tools/${encodeURIComponent(name)}/sync`, {
    method: "POST",
    body: args || {},
    timeout: 30000,
  });
}
