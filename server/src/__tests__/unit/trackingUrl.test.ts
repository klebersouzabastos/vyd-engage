import { describe, it, expect } from 'vitest';
import { base64UrlEncode, base64UrlDecode } from '../../services/campaignService.js';

/**
 * base64url codec for the campaign click-tracking ?u= original-URL param
 * (EC epic). Must round-trip exactly and be URL-safe (no +, /, = chars) so the
 * encoded URL survives being placed in a query string.
 */

describe('base64UrlEncode / base64UrlDecode', () => {
  const urls = [
    'https://vyd.com/path?a=1&b=2#frag',
    'https://example.com/búsqueda?q=café+com+açúcar',
    'https://e.com/' + 'x'.repeat(300), // long URL → padding-producing length
    'https://e.com/~!@#$%^&*()_+={}[]|:;"<>,.?/',
    'a', // 1 byte → would normally pad with '=='
  ];

  it.each(urls)('round-trips %s (encode → decode === original)', (url) => {
    expect(base64UrlDecode(base64UrlEncode(url))).toBe(url);
  });

  it('produces URL-safe output (no +, /, or = characters)', () => {
    for (const url of urls) {
      const enc = base64UrlEncode(url);
      expect(enc).not.toMatch(/[+/=]/);
    }
  });

  it('uses the URL-safe alphabet (- and _) where standard base64 has + and /', () => {
    // The UTF-8 of "¿¿¿>>>" base64-encodes to "wr/Cv8K/Pj4+" (both + and /),
    // so the url-safe variant must carry both - and _ and never + / =.
    const enc = base64UrlEncode('¿¿¿>>>');
    expect(enc).toContain('-');
    expect(enc).toContain('_');
    expect(enc).not.toMatch(/[+/=]/);
    expect(base64UrlDecode(enc)).toBe('¿¿¿>>>'); // still round-trips
  });

  it('decoded value survives being used inside a query string', () => {
    const original = 'https://vyd.com/a?x=1&y=2';
    const enc = base64UrlEncode(original);
    // Build then re-parse a tracking URL exactly like rewriteLinksForTracking.
    const tracking = `https://api.vyd.com/api/v1/track/campaign-click/tok?u=${enc}`;
    const u = new URL(tracking).searchParams.get('u')!;
    expect(base64UrlDecode(u)).toBe(original);
  });
});
