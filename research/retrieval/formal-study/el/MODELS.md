# EL OpenAI model verification

Verification date: 2026-10-21 (UTC).

Official sources:

- Pricing: https://developers.openai.com/api/docs/pricing
- GPT-5 mini: https://developers.openai.com/api/docs/models/gpt-5-mini
- GPT-5.2: https://developers.openai.com/api/docs/models/gpt-5.2
- GPT-5.2 guide (parameter compatibility): https://developers.openai.com/api/docs/guides/latest-model/gpt-5.2
- Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- Chat Completions: https://developers.openai.com/api/docs/api-reference/chat

Prices are USD per 1 million tokens.

| Official model ID | Default snapshot | Input | Cached input | Output |
| --- | --- | --- | --- | --- |
| `gpt-5-mini` | `gpt-5-mini-2025-08-07` | 0.25 | 0.025 | 2.00 |
| `gpt-5.2` | `gpt-5.2-2025-12-11` | 1.75 | 0.175 | 14.00 |

EL configs pin the dated snapshots so the billed ID is immutable. Alias rows are also in the catalog at the same official rates.

## Reasoning billing

OpenAI bills GPT-5 family reasoning tokens as output tokens. They appear in `usage.completion_tokens` / `completion_tokens_details.reasoning_tokens`. The catalog sets `reasoning_billed_as: "output"` so estimated USD does not add a second reasoning line on top of output.

## Compatibility

- Chat Completions + Structured Outputs (`json_schema`, strict) are supported.
- `gpt-5-mini` (and other GPT-5 models older than 5.2) reject `temperature` / `top_p` / `logprobs`. EL omits `temperature` and sets `reasoning_effort: "low"` (`none` is not supported on gpt-5-mini).
- `gpt-5.2` allows `temperature` only when reasoning effort is `none`. EL omits `temperature` and sets `reasoning_effort: "none"` (the documented GPT-5.2 default) to keep latency and cost down on a $1 post-call budget.
- Empty selection is valid JSON: `{"selected_theme_ids":[]}`.
- No model substitution. If a pinned snapshot is retired, stop and report rather than silently switching IDs.

## Budget fit

Ten quotes × one request budget (`max_requests: 10`) plus two 1-quote smokes (`max_requests: 1` each). Prompt size is one quote plus 20 Theme definitions. `gpt-5-mini` is far under $1 at these rates. `gpt-5.2` output is $14 / 1M tokens; with `reasoning_effort: none` a 10-quote pilot is expected to stay under $1, but the USD stop is post-call and one expensive reasoning response could exceed it.
