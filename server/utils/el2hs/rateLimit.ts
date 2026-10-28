import { createHmac, randomBytes } from 'node:crypto'
import type { Pool, RowDataPacket } from 'mysql2/promise'

type Env = Record<string, string | undefined>

export type RateLimitConfig = {
  /** New sessions per client (hashed IP) per window. Shared campus/office NAT needs headroom. */
  perClient: number
  /** New sessions across all clients per window; caps distributed floods that would skew balancing. */
  global: number
  windowSeconds: number
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number }

export type RateLimiter = {
  hit(clientIp: string, config: RateLimitConfig): Promise<RateLimitResult>
}

function intFromEnv(raw: string | undefined, fallback: number, min: number, max: number) {
  const n = Number(raw)
  if (!raw || !Number.isInteger(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export function rateLimitConfig(env: Env = process.env): RateLimitConfig {
  return {
    perClient: intFromEnv(env.EL2_HS_RATE_LIMIT_PER_CLIENT, 20, 1, 10_000),
    global: intFromEnv(env.EL2_HS_RATE_LIMIT_GLOBAL, 300, 1, 1_000_000),
    windowSeconds: intFromEnv(env.EL2_HS_RATE_LIMIT_WINDOW_SECONDS, 600, 10, 86_400)
  }
}

function windowStartMs(nowMs: number, windowSeconds: number) {
  const size = windowSeconds * 1000
  return Math.floor(nowMs / size) * size
}

function retryAfter(nowMs: number, windowSeconds: number) {
  return Math.max(1, Math.ceil((windowStartMs(nowMs, windowSeconds) + windowSeconds * 1000 - nowMs) / 1000))
}

function bucketHash(salt: string, clientIp: string) {
  return createHmac('sha256', salt).update(`client:${clientIp}`, 'utf8').digest('hex')
}

/** Per-process counters. Only reliable for local development and single-instance test runs. */
export function createMemoryRateLimiter(now: () => number = () => Date.now()): RateLimiter {
  const salt = randomBytes(32).toString('hex')
  const counts = new Map<string, number>()
  let currentWindow = -1
  return {
    async hit(clientIp, config) {
      const t = now()
      const start = windowStartMs(t, config.windowSeconds)
      if (start !== currentWindow) {
        counts.clear()
        currentWindow = start
      }
      const key = bucketHash(salt, clientIp)
      const clientHits = (counts.get(key) ?? 0) + 1
      counts.set(key, clientHits)
      if (clientHits > config.perClient) {
        return { allowed: false, retryAfterSeconds: retryAfter(t, config.windowSeconds) }
      }
      const globalHits = (counts.get('global') ?? 0) + 1
      counts.set('global', globalHits)
      if (globalHits > config.global) {
        return { allowed: false, retryAfterSeconds: retryAfter(t, config.windowSeconds) }
      }
      return { allowed: true }
    }
  }
}

function utcDay(ms: number) {
  return new Date(ms).toISOString().slice(0, 10)
}

function utcDatetime(ms: number) {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * Shared counters in MySQL so the limit holds across serverless instances.
 * Client IPs are stored only as HMAC(daily random salt, ip); salts older than
 * the current UTC day and counter rows older than a day are deleted on use.
 */
export function createMysqlRateLimiter(pool: Pool, now: () => number = () => Date.now()): RateLimiter {
  async function dailySalt(t: number) {
    const day = utcDay(t)
    await pool.query('INSERT IGNORE INTO el2_hs_rate_salt (salt_day, salt) VALUES (?, ?)', [
      day,
      randomBytes(32).toString('hex')
    ])
    await pool.query('DELETE FROM el2_hs_rate_salt WHERE salt_day < ?', [day])
    const [rows] = await pool.query<RowDataPacket[]>('SELECT salt FROM el2_hs_rate_salt WHERE salt_day = ?', [day])
    const salt = rows[0]?.salt
    if (!salt) throw new Error('rate-limit salt unavailable')
    return String(salt)
  }

  async function increment(bucket: string, windowStart: string) {
    await pool.query(
      `INSERT INTO el2_hs_rate_limit (bucket_hash, window_start, hits) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE hits = hits + 1`,
      [bucket, windowStart]
    )
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT hits FROM el2_hs_rate_limit WHERE bucket_hash = ? AND window_start = ?',
      [bucket, windowStart]
    )
    return Number(rows[0]?.hits ?? 0)
  }

  return {
    async hit(clientIp, config) {
      const t = now()
      const windowStart = utcDatetime(windowStartMs(t, config.windowSeconds))
      await pool.query('DELETE FROM el2_hs_rate_limit WHERE window_start < ?', [utcDatetime(t - 86_400_000)])
      const salt = await dailySalt(t)
      if ((await increment(bucketHash(salt, clientIp), windowStart)) > config.perClient) {
        return { allowed: false, retryAfterSeconds: retryAfter(t, config.windowSeconds) }
      }
      if ((await increment('global', windowStart)) > config.global) {
        return { allowed: false, retryAfterSeconds: retryAfter(t, config.windowSeconds) }
      }
      return { allowed: true }
    }
  }
}
