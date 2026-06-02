import Redis from 'ioredis';

let redis = null;
let redisAvailable = false;

// Simple in-memory fallback when Redis isn't running.
const mem = new Map();

export function initCache() {
  const url = process.env.REDIS_URL || null;
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT) || 6379;

  redis = new Redis(url || { host, port }, {
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: () => null, // don't retry on failure
    maxRetriesPerRequest: 0,
  });

  redis.on('connect', () => {
    redisAvailable = true;
    console.log('✅ Redis connected — cache enabled');
  });
  redis.on('error', () => {
    redisAvailable = false;
  });

  redis.connect().catch(() => {
    console.warn('⚠️  Redis not available — using in-memory fallback cache');
  });
}

export async function cacheGet(key) {
  try {
    if (redisAvailable) {
      const val = await redis.get(key);
      return val ? JSON.parse(val) : null;
    }
  } catch { /* fall through */ }

  const entry = mem.get(key);
  if (!entry) return null;
  if (Date.now() > entry.exp) { mem.delete(key); return null; }
  return entry.data;
}

export async function cacheSet(key, value, ttlSeconds = 5) {
  try {
    if (redisAvailable) {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return;
    }
  } catch { /* fall through */ }

  mem.set(key, { data: value, exp: Date.now() + ttlSeconds * 1000 });
}

// Delete all keys matching a simple prefix* pattern.
export async function cacheInvalidatePrefix(prefix) {
  try {
    if (redisAvailable) {
      const keys = await redis.keys(`${prefix}*`);
      if (keys.length > 0) await redis.del(...keys);
      return;
    }
  } catch { /* fall through */ }

  for (const key of mem.keys()) {
    if (key.startsWith(prefix)) mem.delete(key);
  }
}
