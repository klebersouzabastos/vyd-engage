import { http, HttpResponse } from 'msw';

/**
 * Default MSW request handlers. In jsdom the apiClient resolves its base URL to
 * http://localhost:3001 (see src/services/api/client.ts), so handlers target
 * that origin. Override per-test with `server.use(...)`.
 */
const API = 'http://localhost:3001/api/v1';

export const handlers = [
  http.get(`${API}/tags`, () =>
    HttpResponse.json([
      { id: 'tag-1', name: 'VIP', color: '#FF0000', createdAt: new Date().toISOString() },
    ]),
  ),
];
