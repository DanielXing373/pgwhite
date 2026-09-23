/**
 * Node test helper: resolve extensionless relative imports to .ts
 * so unit tests can import server/utils without Nuxt-incompatible .ts suffixes.
 */
import { register } from 'node:module'

register('./ts-resolve-loader.mjs', import.meta.url)
