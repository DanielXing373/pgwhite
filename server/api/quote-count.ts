import { createDbConnection } from '../utils/db'

export default defineEventHandler(async () => {
  const connection = await createDbConnection()
  try {
    const [rows] = await connection.query('SELECT COUNT(*) AS count FROM quotes')
    return rows
  } finally {
    await connection.end().catch(() => {})
  }
})