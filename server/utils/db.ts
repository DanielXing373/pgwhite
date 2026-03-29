// =====================================================
// 共享 MySQL 连接（与 quote-count 等 API 共用 runtimeConfig）
// =====================================================
import mysql from 'mysql2/promise'

export async function createDbConnection() {
  const config = useRuntimeConfig()
  return mysql.createConnection({
    host: config.dbHost,
    port: Number(config.dbPort),
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName
  })
}
