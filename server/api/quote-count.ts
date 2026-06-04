import { getDbPool } from '../utils/db'

export default defineEventHandler(async () => {
  const [rows] = await getDbPool().query('SELECT COUNT(*) AS count FROM quotes')
  return rows
})
