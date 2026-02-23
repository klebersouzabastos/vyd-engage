import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

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
