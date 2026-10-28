import { randomBytes, randomInt } from 'node:crypto'

export function randomHex(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

export function shuffleInPlace<T>(items: T[], randInt: (maxExclusive: number) => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randInt(i + 1)
    const a = items[i]!
    const b = items[j]!
    items[i] = b
    items[j] = a
  }
  return items
}

export function csprngInt(maxExclusive: number): number {
  if (maxExclusive <= 0) throw new Error('maxExclusive must be positive')
  return randomInt(maxExclusive)
}
