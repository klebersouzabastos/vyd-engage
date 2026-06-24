import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  computeSignature,
  buildOutgoingPayload,
  type OutgoingWebhookPayload,
} from '../../services/webhookDispatcher.js';

/**
 * Outgoing webhook HMAC signature + payload shape (API-1.2, req 11/12).
 * computeSignature is the exact helper used inside deliverOnce to build the
 * X-VYD-Signature header; buildOutgoingPayload builds the request body.
 */

describe('computeSignature (X-VYD-Signature)', () => {
  const secret = 'whsec_test_123';
  const body = JSON.stringify({ event: 'lead.created', tenantId: 't1', timestamp: '2026-01-01T00:00:00.000Z', data: { id: 'l1' } });

  it('matches an independently computed HMAC-SHA256 hex digest', () => {
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(computeSignature(secret, body)).toBe(expected);
  });

  it('is deterministic for a fixed payload + secret', () => {
    expect(computeSignature(secret, body)).toBe(computeSignature(secret, body));
  });

  it('produces a 64-char lowercase hex string', () => {
    expect(computeSignature(secret, body)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the secret changes (key-dependent)', () => {
    expect(computeSignature('other-secret', body)).not.toBe(computeSignature(secret, body));
  });

  it('changes when the body changes (content-dependent)', () => {
    expect(computeSignature(secret, body + ' ')).not.toBe(computeSignature(secret, body));
  });
});

describe('buildOutgoingPayload (req 11 shape)', () => {
  it('emits { event, tenantId, timestamp, data } with an ISO timestamp', () => {
    const data = { id: 'lead_1', name: 'Maria' };
    const payload: OutgoingWebhookPayload = buildOutgoingPayload('tenant-1', 'lead.created', data);

    expect(Object.keys(payload).sort()).toEqual(['data', 'event', 'tenantId', 'timestamp']);
    expect(payload.event).toBe('lead.created');
    expect(payload.tenantId).toBe('tenant-1');
    expect(payload.data).toEqual(data);
    // ISO-8601 timestamp that round-trips through Date.
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
  });

  it('round-trips through JSON.stringify and verifies under the signature', () => {
    const secret = 's3cr3t';
    const payload = buildOutgoingPayload('t1', 'deal.won', { id: 'd1', value: '1000' });
    const sent = JSON.stringify(payload);
    const sig = computeSignature(secret, sent);
    // A receiver recomputing the HMAC over the raw body must get the same sig.
    expect(crypto.createHmac('sha256', secret).update(sent).digest('hex')).toBe(sig);
  });
});
