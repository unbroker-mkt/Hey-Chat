// Accept an API host or a base URL that already includes the /api prefix.
export function normalizeApiUrl(value) {
  const base = (value?.trim() || "http://localhost:3001/api").replace(/\/+$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}
