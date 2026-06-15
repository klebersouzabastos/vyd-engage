import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/server';
import { apiClient } from '../client';

const API = 'http://localhost:3001/api/v1';

describe('apiClient (MSW)', () => {
  it('getTags returns the mocked tags', async () => {
    const tags = await apiClient.getTags();
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe('VIP');
  });

  it('surfaces a 500 as a thrown error', async () => {
    server.use(
      http.get(`${API}/tags`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })),
    );
    await expect(apiClient.getTags()).rejects.toThrow();
  });
});
