import mysql from 'mysql2/promise'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()

  const connection = await mysql.createConnection({
    host: config.dbHost,
    port: Number(config.dbPort),
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName
  })

  const [rows] = await connection.query(
    'SELECT COUNT(*) AS count FROM quotes'
  )

  await connection.end()

  return rows
})