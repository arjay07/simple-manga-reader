import { describe, it, expect } from 'vitest';
import { parseJsonBody } from '@/lib/api-response';

describe('parseJsonBody', () => {
  it('parses a valid JSON body', async () => {
    const req = new Request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ hello: 'world' }),
    });
    expect(await parseJsonBody<{ hello: string }>(req)).toEqual({ hello: 'world' });
  });

  it('returns null for a malformed JSON body instead of throwing', async () => {
    const req = new Request('http://localhost/x', { method: 'POST', body: '{not-json' });
    expect(await parseJsonBody(req)).toBeNull();
  });

  it('returns null for an empty body', async () => {
    const req = new Request('http://localhost/x', { method: 'POST' });
    expect(await parseJsonBody(req)).toBeNull();
  });
});
