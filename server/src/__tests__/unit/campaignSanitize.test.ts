import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  sanitizeUrl,
  sanitizeHtml,
  blocksToHtml,
  type Block,
  type MergeTagContext,
} from '../../services/campaignService.js';

/**
 * XSS / HTML-sanitization suite for the campaign email renderer (EC epic, req 11).
 * The renderer (blocksToHtml) escapes user content, allowlists URL schemes and
 * applies a defense-in-depth pass (sanitizeHtml) over the assembled document.
 * These tests assert no attacker markup survives any of the 5 block types.
 */

const ctx: MergeTagContext = { name: 'Maria', company: 'Acme', email: 'm@acme.com' };

describe('escapeHtml', () => {
  it('escapes the HTML-significant characters', () => {
    expect(escapeHtml(`<script>"&'</script>`)).toBe(
      '&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;',
    );
  });

  it('coerces non-strings without throwing', () => {
    expect(escapeHtml(5 as unknown as string)).toBe('5');
  });
});

describe('sanitizeUrl (scheme allowlist)', () => {
  it('keeps http(s), mailto and tel URLs', () => {
    expect(sanitizeUrl('https://vyd.com/x')).toBe('https://vyd.com/x');
    expect(sanitizeUrl('http://vyd.com')).toBe('http://vyd.com');
    expect(sanitizeUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(sanitizeUrl('tel:+551199999')).toBe('tel:+551199999');
  });

  it('blocks javascript:, data:, vbscript: and empty → "#"', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
    expect(sanitizeUrl('data:text/html,<script>1</script>')).toBe('#');
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('#');
    expect(sanitizeUrl('')).toBe('#');
    expect(sanitizeUrl(null)).toBe('#');
    expect(sanitizeUrl(undefined)).toBe('#');
  });

  it('strips control chars used to smuggle a scheme (java\\tscript:)', () => {
    // "java\tscript:" with an embedded tab must NOT pass as a usable scheme.
    expect(sanitizeUrl('java\tscript:alert(1)')).toBe('#');
    expect(sanitizeUrl('  javascript:alert(1)')).toBe('#');
  });
});

describe('sanitizeHtml (defense-in-depth on assembled doc)', () => {
  it('strips <script> blocks entirely (content included)', () => {
    const out = sanitizeHtml('<div>ok</div><script>alert(1)</script>');
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('<div>ok</div>');
  });

  it('strips style/iframe/object/embed/link/meta blocks and self-closing tags', () => {
    const out = sanitizeHtml(
      '<style>body{}</style><iframe src="x"></iframe><object></object><embed/><link rel="x"/><meta http-equiv="x"/>',
    );
    expect(out).not.toMatch(/<(style|iframe|object|embed|link|meta)/i);
  });

  it('removes inline on* event-handler attributes', () => {
    const out = sanitizeHtml(`<img src="x" onerror="alert(1)" /><a onclick='steal()'>x</a>`);
    expect(out).not.toMatch(/onerror/i);
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toContain('alert(1)');
  });

  it('neutralizes javascript:/vbscript:/data: inside href/src attributes', () => {
    const out = sanitizeHtml(`<a href="javascript:alert(1)">x</a><img src='vbscript:x'>`);
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/vbscript:/i);
  });
});

describe('blocksToHtml — block rendering + XSS through user content', () => {
  it('renders all 5 block types to their expected HTML', () => {
    const blocks: Block[] = [
      { id: '1', type: 'text', content: 'Hello world' },
      { id: '2', type: 'image', url: 'https://cdn/x.png', alt: 'logo' },
      { id: '3', type: 'button', label: 'Click', href: 'https://vyd.com/go' },
      { id: '4', type: 'divider' },
      { id: '5', type: 'spacer', height: 40 },
    ];
    const html = blocksToHtml(blocks, ctx);

    // text
    expect(html).toContain('Hello world');
    // image (safe url + escaped alt)
    expect(html).toContain('src="https://cdn/x.png"');
    expect(html).toContain('alt="logo"');
    // button (safe href + label)
    expect(html).toContain('href="https://vyd.com/go"');
    expect(html).toContain('Click');
    // divider
    expect(html).toContain('<hr');
    // spacer (clamped numeric height)
    expect(html).toContain('height:40px');
    // wrapped in a full document
    expect(html.toLowerCase()).toContain('<!doctype html>');
  });

  it('escapes a <script> injected via a text block (no live markup)', () => {
    const blocks: Block[] = [
      { id: '1', type: 'text', content: '<script>alert(1)</script>' },
    ];
    const html = blocksToHtml(blocks, ctx);
    expect(html).not.toMatch(/<script>alert/i);
    expect(html).toContain('&lt;script&gt;');
  });

  it('preserves newlines in text blocks as <br/>', () => {
    const html = blocksToHtml([{ id: '1', type: 'text', content: 'a\nb' }], ctx);
    expect(html).toContain('a<br/>b');
  });

  it('blocks a javascript: button href → "#"', () => {
    const blocks: Block[] = [
      { id: '1', type: 'button', label: 'x', href: 'javascript:alert(1)' },
    ];
    const html = blocksToHtml(blocks, ctx);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).toContain('href="#"');
  });

  it('blocks a javascript: image src → "#"', () => {
    const blocks: Block[] = [
      // url carries an XSS payload; alt carries breakout markup.
      { id: '1', type: 'image', url: 'javascript:alert(1)', alt: '"><script>x</script>' },
    ];
    const html = blocksToHtml(blocks, ctx);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).toContain('src="#"');
    // alt is escaped so the quote cannot break out of the attribute.
    expect(html).not.toMatch(/<script>x/i);
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
  });

  it('clamps an out-of-range / non-numeric spacer height', () => {
    const tooBig = blocksToHtml([{ id: '1', type: 'spacer', height: 9999 }], ctx);
    expect(tooBig).toContain('height:200px'); // clamped to max 200
    const bad = blocksToHtml(
      [{ id: '1', type: 'spacer', height: 'evil' as unknown as number }],
      ctx,
    );
    expect(bad).toContain('height:24px'); // falls back to default 24
  });

  it('treats a non-array body as empty', () => {
    const html = blocksToHtml('not-an-array' as unknown as Block[], ctx);
    expect(html.toLowerCase()).toContain('<!doctype html>');
  });
});
