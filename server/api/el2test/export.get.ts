import { timingSafeEqual } from 'node:crypto'
import { DATASET_VERSION, PROTOCOL_VERSION, RANDOMIZATION_VERSION, type StudyMode } from '../../utils/el2hs/constants'
import { exportRows, toCsv } from '../../utils/el2hs/service'

function tokenMatches(expected: string, provided: string) {
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(provided, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

export default defineEventHandler(async event => {
  const expected = process.env.EL2_HS_EXPORT_TOKEN ?? ''
  const provided = getHeader(event, 'x-el2-hs-export-token') ?? ''
  if (expected.length < 32 || !tokenMatches(expected, provided)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  const query = getQuery(event)
  const format = String(query.format || 'json')
  const mode = query.mode === 'test' || query.mode === 'study' ? (query.mode as StudyMode) : undefined
  const rows = await exportRows(mode)
  setHeader(event, 'cache-control', 'no-store')
  if (format === 'csv') {
    setHeader(event, 'content-type', 'text/csv; charset=utf-8')
    setHeader(event, 'content-disposition', 'attachment; filename="el2-hs-export.csv"')
    return toCsv(rows)
  }
  return {
    dataset_version: DATASET_VERSION,
    protocol_version: PROTOCOL_VERSION,
    randomization_version: RANDOMIZATION_VERSION,
    row_count: rows.length,
    rows
  }
})
