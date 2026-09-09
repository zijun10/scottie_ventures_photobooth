import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vercel/blob', () => ({
  put: vi.fn().mockResolvedValue({ url: 'https://blob.example/strips/x.jpg' }),
}));

import { put } from '@vercel/blob';
import { POST } from './route';

describe('POST /api/strips', () => {
  beforeEach(() => vi.mocked(put).mockClear());

  it('stores the JPEG at strips/<id>.jpg and returns the id', async () => {
    const body = new Blob([new Uint8Array(1000)], { type: 'image/jpeg' });
    const res = await POST(new Request('http://localhost/api/strips', { method: 'POST', body }));
    expect(res.status).toBe(200);
    const { id } = await res.json();
    expect(id).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(put).toHaveBeenCalledWith(
      `strips/${id}.jpg`,
      expect.anything(),
      expect.objectContaining({ access: 'public', addRandomSuffix: false, contentType: 'image/jpeg' }),
    );
  });

  it('rejects an empty body with 400', async () => {
    const res = await POST(new Request('http://localhost/api/strips', { method: 'POST' }));
    expect(res.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });

  it('rejects bodies over 4MB with 400', async () => {
    const body = new Blob([new Uint8Array(4 * 1024 * 1024 + 1)]);
    const res = await POST(new Request('http://localhost/api/strips', { method: 'POST', body }));
    expect(res.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });
});
