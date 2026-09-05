const store = new Map();
function get(key) {
  const item = store.get(key);
  if (!item) return null;
  if (item.expiresAt && Date.now() > item.expiresAt) { store.delete(key); return null; }
  return item.value;
}
function set(key, value, ttlMs = 60000) {
  store.set(key, { value, expiresAt: ttlMs ? Date.now() + ttlMs : null });
}
function del(key) { store.delete(key); }
function clear() { store.clear(); }
module.exports = { get, set, del, clear };
