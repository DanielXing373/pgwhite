import type { StudyMode } from './constants'

type Env = Record<string, string | undefined>

export type DeployEnv = 'local' | 'preview' | 'production'

/**
 * Vercel sets VERCEL_ENV on every deployment. Anything else built for production
 * (NODE_ENV=production) is treated as production, so an unknown host fails closed.
 */
export function deployEnv(env: Env = process.env): DeployEnv {
  if (env.VERCEL_ENV === 'production') return 'production'
  if (env.VERCEL_ENV === 'preview') return 'preview'
  if (env.VERCEL_ENV === 'development') return 'local'
  return env.NODE_ENV === 'production' ? 'production' : 'local'
}

export type ModeDecision =
  | { allowed: true; store: 'any' | 'memory' }
  | { allowed: false; reason: 'test_mode_disabled' | 'study_mode_disabled' }

/**
 * Server-side gate for creating and using sessions.
 *
 * - local: test and study allowed; test is memory-only unless AC1_HS_LOCAL_TEST_MYSQL=1
 *   (then MySQL with study_mode='test').
 * - preview: test only with AC1_HS_ALLOW_TEST_MODE=1 and memory-only, so a preview
 *   pointed at a shared database cannot write test rows; study only with
 *   AC1_HS_ALLOW_PREVIEW_STUDY=1 (operator asserts the preview DB is not production).
 * - production: study only. Vercel production never allows test mode; a
 *   non-Vercel production build allows it only with AC1_HS_ALLOW_TEST_MODE=1.
 */
export function modePolicy(mode: StudyMode, env: Env = process.env): ModeDecision {
  const where = deployEnv(env)
  const testFlag = env.AC1_HS_ALLOW_TEST_MODE === '1'
  if (mode === 'test') {
    // Local .env files often point at the production database, so local test sessions stay in
    // memory unless the operator opts in.
    if (where === 'local') {
      return { allowed: true, store: env.AC1_HS_LOCAL_TEST_MYSQL === '1' ? 'any' : 'memory' }
    }
    if (where === 'preview') {
      return testFlag ? { allowed: true, store: 'memory' } : { allowed: false, reason: 'test_mode_disabled' }
    }
    if (env.VERCEL_ENV === 'production' || !testFlag) {
      return { allowed: false, reason: 'test_mode_disabled' }
    }
    return { allowed: true, store: 'memory' }
  }
  if (where === 'preview' && env.AC1_HS_ALLOW_PREVIEW_STUDY !== '1') {
    return { allowed: false, reason: 'study_mode_disabled' }
  }
  return { allowed: true, store: 'any' }
}
