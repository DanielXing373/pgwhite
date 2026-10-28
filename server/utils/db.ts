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

/** Read at request time so `nuxt build` never bakes credentials into .output. */
export function dbSettings() {
  const config = useRuntimeConfig()
  return {
    host: String(process.env.DB_HOST || config.dbHost || ''),
    port: Number(process.env.DB_PORT || config.dbPort || 3306),
    user: String(process.env.DB_USER || config.dbUser || ''),
    password: String(process.env.DB_PASSWORD || config.dbPassword || ''),
    database: String(process.env.DB_NAME || config.dbName || '')
  }
}

export function getDbPool(): mysql.Pool {
  if (!pool) {
    const db = dbSettings()
    pool = mysql.createPool({
      host: db.host,
      port: db.port,
      user: db.user,
      password: db.password,
      database: db.database,
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 20_000,
      ...(shouldUseSsl(db.host) ? { ssl: { rejectUnauthorized: false } } : {})
    })
  }
  return pool
}

/** @deprecated 优先使用 getDbPool().query；保留以免旧代码引用 */
export async function createDbConnection() {
  return getDbPool().getConnection()
}
