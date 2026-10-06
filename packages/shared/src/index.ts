/**
 * Shared, framework-agnostic constants used by both the API and the web app.
 * Keep this package free of runtime/business logic (spec §28/§37).
 */

export const APP_NAME = 'CareVoice AI';

export const API_BASE = '/api/v1';

/** Canonical API route paths — the single place the frontend and backend agree on URLs. */
export const API_ROUTES = {
  chat: `${API_BASE}/chat`,
  chatStream: `${API_BASE}/chat/stream`,
  ragIngest: `${API_BASE}/rag/ingest`,
  ragSearch: `${API_BASE}/rag/search`,
  health: `${API_BASE}/health`,
  readiness: `${API_BASE}/readiness`,
} as const;
