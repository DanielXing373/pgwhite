import { createHash } from 'node:crypto'
import type { EmbeddingAdapter } from '../types.ts'

function stub(id: EmbeddingAdapter['id']): EmbeddingAdapter {
  return {
    id,
    async embed() {
      throw new Error(
        `[annotation-workbench] embedding adapter "${id}" not enabled — STOP before first live run`
      )
    }
  }
}

/** FlagEmbedding-family / BGE-M3 candidate (not selected as winner). */
export function createBgeM3Adapter(): EmbeddingAdapter {
  return stub('bge-m3')
}

/** Qwen3-Embedding candidate (not selected as winner). */
export function createQwen3EmbeddingAdapter(): EmbeddingAdapter {
  return stub('qwen3-embedding')
}

/**
 * Deterministic mock embeddings for dry-run only.
 * Not a real model — only for fixture/schema/UI plumbing review.
 */
export function createMockEmbeddingAdapter(dim = 32): EmbeddingAdapter {
  return {
    id: 'mock',
    async embed(texts: string[]) {
      return texts.map((t) => mockVector(t, dim))
    }
  }
}

function mockVector(text: string, dim: number): number[] {
  const v = new Array<number>(dim).fill(0)
  const grams: string[] = []
  const chars = [...text]
  for (let i = 0; i < chars.length; i++) {
    grams.push(chars[i]!)
    if (i + 1 < chars.length) grams.push(chars[i]! + chars[i + 1]!)
  }
  grams.push(text)
  for (const g of grams) {
    const h = createHash('sha256').update(g).digest()
    for (let i = 0; i < dim; i++) {
      v[i]! += (h[i % h.length]! / 255) * 2 - 1
    }
  }
  const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1
  return v.map((x) => x / norm)
}

export const embeddingAdapterRegistry: Record<string, () => EmbeddingAdapter> = {
  'bge-m3': createBgeM3Adapter,
  'qwen3-embedding': createQwen3EmbeddingAdapter,
  mock: () => createMockEmbeddingAdapter()
}

/** Cosine similarity — retrieval signal only, not interpretation probability. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    throw new Error('cosineSimilarity: vector length mismatch')
  }
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}
