// =====================================================
// 共享 MySQL 连接池（与 quote-count / facets / quotes API 共用）
// Railway 公网代理 (*.rlwy.net) 通常需要 SSL
// =====================================================
import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

function shouldUseSsl(host: string): boolean {
  if (process.env.DB_SSL === '1' || process.env.DB_SSL === 'true') return true
  if (process.env.DB_SSL === '0' || process.env.DB_SSL === 'false') return false
  return host.includes('.rlwy.net') || host.includes('railway.app')
}

export function getDbPool(): mysql.Pool {
  if (!pool) {
    const config = useRuntimeConfig()
    const host = String(config.dbHost || '')
    pool = mysql.createPool({
      host: config.dbHost,
      port: Number(config.dbPort),
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 20_000,
      ...(shouldUseSsl(host) ? { ssl: { rejectUnauthorized: false } } : {})
    })
  }
  return pool
}

/** @deprecated 优先使用 getDbPool().query；保留以免旧代码引用 */
export async function createDbConnection() {
  return getDbPool().getConnection()
}
