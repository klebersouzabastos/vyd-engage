import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Opções de conexão para BullMQ (Queue/Worker), derivadas do ambiente.
 *
 * Prioriza REDIS_URL (Railway/Upstash expõem só a URL) e cai para
 * REDIS_HOST/REDIS_PORT/REDIS_PASSWORD. Sem isso, os jobs conectavam em
 * localhost:6379 em produção e entravam em loop infinito de ECONNREFUSED
 * (incidente de instabilidade de 29/07/2026).
 *
 * O retryStrategy nunca desiste (workers precisam reconectar sozinhos após
 * um blip do Redis), mas espaça as tentativas até 1 a cada 30s para não
 * inundar CPU/logs quando o Redis está fora.
 */
export function getBullConnection() {
  const retryStrategy = (times: number) => Math.min(times * 1000, 30_000);
  const url = process.env.REDIS_URL;
  if (url) {
    try {
      const u = new URL(url);
      return {
        host: u.hostname,
        port: u.port ? parseInt(u.port, 10) : 6379,
        username: u.username ? decodeURIComponent(u.username) : undefined,
        password: u.password ? decodeURIComponent(u.password) : undefined,
        ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
        retryStrategy,
      };
    } catch {
      logger.error('REDIS_URL inválida — caindo para REDIS_HOST/REDIS_PORT');
    }
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    retryStrategy,
  };
}

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 5) return null; // stop retrying
        return Math.min(times * 200, 2000);
      },
    });

    redis.on('connect', () => logger.info('Redis connected'));
    redis.on('error', (err) => logger.error('Redis error', err));

    redis.connect().catch((err) => {
      logger.warn('Redis connection failed, caching disabled', { error: err.message });
    });
  }
  return redis;
}

/** Set a value with TTL (seconds). Fails silently. */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const r = getRedis();
    if (r.status !== 'ready') return;
    await r.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // cache miss is not critical
  }
}

/** Get a cached value. Returns null on miss or error. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const r = getRedis();
    if (r.status !== 'ready') return null;
    const raw = await r.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Delete one or more cache keys. Fails silently. */
export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    const r = getRedis();
    if (r.status !== 'ready') return;
    if (keys.length > 0) await r.del(...keys);
  } catch {
    // cache miss is not critical
  }
}

/** Delete all keys matching a pattern (e.g. "usage:tenant123:*"). Fails silently. */
export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const r = getRedis();
    if (r.status !== 'ready') return;
    const keys = await r.keys(pattern);
    if (keys.length > 0) await r.del(...keys);
  } catch {
    // cache miss is not critical
  }
}
