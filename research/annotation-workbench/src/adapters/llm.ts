import type { FixtureQuote, LlmAdapter, LlmFreeConceptsV1 } from '../types.ts'
import {
  buildUserMessage,
  getPromptVersion,
  getSystemMessage,
  type PromptVersion
} from '../pipeline/promptBuilder.ts'
import {
  assertAnnotationPresence,
  validateLlmFreeConcepts
} from '../pipeline/validateFreeConcepts.ts'

/** Resolved JSON Schema for OpenAI structured outputs (no external $ref). */
export const LLM_FREE_CONCEPTS_JSON_SCHEMA = {
  name: 'llm_free_concepts_v1',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['schema_version', 'themes', 'devices', 'annotation_interpretation', 'notes'],
    properties: {
      schema_version: { type: 'string', enum: ['llm-free-concepts.v1'] },
      themes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['label', 'brief_rationale'],
          properties: {
            label: { type: 'string', minLength: 1, maxLength: 40 },
            brief_rationale: { type: 'string', minLength: 1, maxLength: 200 }
          }
        }
      },
      devices: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['label', 'brief_rationale'],
          properties: {
            label: { type: 'string', minLength: 1, maxLength: 40 },
            brief_rationale: { type: 'string', minLength: 1, maxLength: 200 }
          }
        }
      },
      annotation_interpretation: {
        anyOf: [
          { type: 'null' },
          {
            type: 'object',
            additionalProperties: false,
            required: [
              'schema_version',
              'pattern',
              'summary',
              'tag_like_signals',
              'character_like_signals',
              'used_as_evidence_for_concepts'
            ],
            properties: {
              schema_version: {
                type: 'string',
                enum: ['annotation-interpretation.v1']
              },
              pattern: {
                type: 'string',
                enum: ['tag_signal', 'reflective_note', 'mixed', 'unclear']
              },
              summary: { type: 'string' },
              tag_like_signals: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['text', 'guessed_dimension'],
                  properties: {
                    text: { type: 'string' },
                    guessed_dimension: {
                      type: 'string',
                      enum: ['theme', 'device', 'unknown']
                    }
                  }
                }
              },
              character_like_signals: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['text', 'note'],
                  properties: {
                    text: { type: 'string' },
                    note: { type: 'string' }
                  }
                }
              },
              used_as_evidence_for_concepts: { type: 'boolean' }
            }
          }
        ]
      },
      notes: { type: 'string' }
    }
  }
} as const

export type OpenAiAdapterOptions = {
  apiKey: string
  model: string
  baseUrl?: string
  maxRetries?: number
  temperature?: number
}

export type LlmCallAttempt = {
  attempt: number
  ok: boolean
  httpStatus?: number
  error?: string
  validationErrors?: string[]
  latencyMs: number
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

export type LlmCallMeta = {
  provider: 'openai'
  model: string
  attempts: LlmCallAttempt[]
  finalOk: boolean
}

/**
 * Model-agnostic surface with an OpenAI Chat Completions implementation.
 * API key must come from environment — never commit / never write into run artifacts.
 */
export function createOpenAiLlmAdapter(opts: OpenAiAdapterOptions): LlmAdapter & {
  lastCallMeta: LlmCallMeta | null
  proposeConceptsWithMeta: (input: {
    quoteText: string
    bookTitleZh?: string | null
    authorNameZh?: string | null
    chapterTitle?: string | null
    personalAnnotation?: string | null
    promptVersion: string
    quote?: FixtureQuote
  }) => Promise<{ value: LlmFreeConceptsV1; meta: LlmCallMeta }>
} {
  const baseUrl = (opts.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  const maxRetries = opts.maxRetries ?? 2
  let lastCallMeta: LlmCallMeta | null = null

  async function proposeConceptsWithMeta(input: {
    quoteText: string
    bookTitleZh?: string | null
    authorNameZh?: string | null
    chapterTitle?: string | null
    personalAnnotation?: string | null
    promptVersion: string
    quote?: FixtureQuote
  }): Promise<{ value: LlmFreeConceptsV1; meta: LlmCallMeta }> {
    if (
      input.promptVersion !== 'zh-literary-rich-v1' &&
      input.promptVersion !== 'zh-literary-rich-v1.1' &&
      input.promptVersion !== 'zh-literary-atomic-v1.2'
    ) {
      throw new Error(`Unsupported promptVersion: ${input.promptVersion}`)
    }
    const promptVersion = getPromptVersion(input.promptVersion)
    const quote: FixtureQuote =
      input.quote ||
      ({
        quoteId: -1,
        group: 'cold_start',
        bookId: 0,
        bookTitleZh: input.bookTitleZh || '未知',
        authorNameZh: input.authorNameZh || '未知',
        chapterTitle: input.chapterTitle || '未知',
        textZh: input.quoteText,
        lengthBucket: 'medium',
        personalAnnotation: input.personalAnnotation
          ? {
              content: input.personalAnnotation,
              originalContent: input.personalAnnotation,
              source: 'runtime'
            }
          : null
      } as FixtureQuote)

    const system = getSystemMessage(promptVersion)
    const user = buildUserMessage(quote, promptVersion)
    const hasAnn = !!(quote.personalAnnotation?.content || '').trim()
    const attempts: LlmCallAttempt[] = []
    let lastError = 'unknown'

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const t0 = Date.now()
      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${opts.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: opts.model,
            temperature: opts.temperature ?? 0.4,
            response_format: {
              type: 'json_schema',
              json_schema: LLM_FREE_CONCEPTS_JSON_SCHEMA
            },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user }
            ]
          })
        })
        const latencyMs = Date.now() - t0
        const body = (await res.json()) as any
        if (!res.ok) {
          const msg = String(body?.error?.message || `HTTP ${res.status}`)
          // Never include Authorization / api key material in stored errors.
          const safe = msg.replace(/sk-[a-zA-Z0-9_-]+/g, '[redacted]')
          attempts.push({
            attempt,
            ok: false,
            httpStatus: res.status,
            error: safe,
            latencyMs
          })
          lastError = safe
          continue
        }
        const content = body?.choices?.[0]?.message?.content
        const usage = body?.usage
        if (typeof content !== 'string' || !content.trim()) {
          attempts.push({
            attempt,
            ok: false,
            httpStatus: res.status,
            error: 'empty_model_content',
            latencyMs,
            usage
          })
          lastError = 'empty_model_content'
          continue
        }
        let parsed: unknown
        try {
          parsed = JSON.parse(content)
        } catch {
          attempts.push({
            attempt,
            ok: false,
            httpStatus: res.status,
            error: 'json_parse_failed',
            latencyMs,
            usage
          })
          lastError = 'json_parse_failed'
          continue
        }
        const validated = validateLlmFreeConcepts(parsed)
        if (!validated.ok) {
          attempts.push({
            attempt,
            ok: false,
            httpStatus: res.status,
            error: 'schema_validation_failed',
            validationErrors: validated.errors,
            latencyMs,
            usage
          })
          lastError = `schema_validation_failed: ${validated.errors.join('; ')}`
          continue
        }
        const presenceErrors = assertAnnotationPresence(validated.value, hasAnn)
        if (presenceErrors.length) {
          attempts.push({
            attempt,
            ok: false,
            httpStatus: res.status,
            error: 'annotation_presence_failed',
            validationErrors: presenceErrors,
            latencyMs,
            usage
          })
          lastError = presenceErrors.join('; ')
          continue
        }
        attempts.push({
          attempt,
          ok: true,
          httpStatus: res.status,
          latencyMs,
          usage
        })
        const meta: LlmCallMeta = {
          provider: 'openai',
          model: opts.model,
          attempts,
          finalOk: true
        }
        lastCallMeta = meta
        return { value: validated.value, meta }
      } catch (err) {
        const latencyMs = Date.now() - t0
        const msg = err instanceof Error ? err.message : String(err)
        const safe = msg.replace(/sk-[a-zA-Z0-9_-]+/g, '[redacted]')
        attempts.push({ attempt, ok: false, error: safe, latencyMs })
        lastError = safe
      }
    }

    const meta: LlmCallMeta = {
      provider: 'openai',
      model: opts.model,
      attempts,
      finalOk: false
    }
    lastCallMeta = meta
    throw new Error(`LLM free-concept failed after retries: ${lastError}`)
  }

  return {
    id: `openai:${opts.model}`,
    lastCallMeta,
    proposeConceptsWithMeta,
    async proposeConcepts(input) {
      const { value } = await proposeConceptsWithMeta(input)
      return value
    }
  }
}

export function createStubLlmAdapter(id = 'stub-llm'): LlmAdapter {
  return {
    id,
    async proposeConcepts() {
      throw new Error(
        '[annotation-workbench] stub LLM — configure OPENAI_API_KEY for live free-concept runs'
      )
    }
  }
}

/** Build messages for inspection without calling any model. Never includes credentials. */
export function buildPromptMessages(
  q: FixtureQuote,
  promptVersion: PromptVersion | string = 'zh-literary-rich-v1'
): {
  promptVersion: string
  system: string
  user: string
} {
  const v = getPromptVersion(promptVersion)
  return {
    promptVersion: v,
    system: getSystemMessage(v),
    user: buildUserMessage(q, v)
  }
}

export const llmAdapterRegistry: Record<string, () => LlmAdapter> = {
  stub: () => createStubLlmAdapter('stub-llm')
}
