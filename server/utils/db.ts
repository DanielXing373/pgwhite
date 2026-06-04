// =====================================================
// 共享 MySQL 连接（与 quote-count 等 API 共用 runtimeConfig）
// Railway 公网代理 (*.rlwy.net) 通常需要 SSL
// =====================================================
import mysql from 'mysql2/promise'

function shouldUseSsl(host: string): boolean {
  if (process.env.DB_SSL === '1' || process.env.DB_SSL === 'true') return true
  if (process.env.DB_SSL === '0' || process.env.DB_SSL === 'false') return false
  return host.includes('.rlwy.net') || host.includes('railway.app')
}

export async function createDbConnection() {
  const config = useRuntimeConfig()
  const host = String(config.dbHost || '')

  return mysql.createConnection({
    host: config.dbHost,
    port: Number(config.dbPort),
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
    connectTimeout: 20_000,
    ...(shouldUseSsl(host) ? { ssl: { rejectUnauthorized: false } } : {})
  })
}
