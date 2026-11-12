# EL model verification

Verification date: 2026-10-21 (UTC); GPT-6 Luna re-verified 2026-10-22.

Official sources:

- Pricing: https://developers.openai.com/api/docs/pricing
- GPT-5 mini: https://developers.openai.com/api/docs/models/gpt-5-mini
- GPT-5.2: https://developers.openai.com/api/docs/models/gpt-5.2
- GPT-5.2 guide (parameter compatibility): https://developers.openai.com/api/docs/guides/latest-model/gpt-5.2
- GPT-6 Luna: https://developers.openai.com/api/docs/models/gpt-6-luna
- GPT-6 family guide: https://developers.openai.com/api/docs/guides/latest-model
- Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- Chat Completions: https://developers.openai.com/api/docs/api-reference/chat

Prices are USD per 1 million tokens.

| Official model ID | Default snapshot | Input | Cached input | Output |
| --- | --- | --- | --- | --- |
| `gpt-5-mini` | `gpt-5-mini-2025-08-07` | 0.25 | 0.025 | 2.00 |
| `gpt-5.2` | `gpt-5.2-2025-12-11` | 1.75 | 0.175 | 14.00 |
| `gpt-6-luna` | `gpt-6-luna` (no dated snapshot listed) | 0.10 | 0.01 | 0.50 |

EL configs pin the dated snapshots so the billed ID is immutable. Alias rows are also in the catalog at the same official rates.

## Reasoning billing

OpenAI bills GPT-5 and GPT-6 family reasoning tokens as output tokens. They appear in `usage.completion_tokens` / `completion_tokens_details.reasoning_tokens`. The catalog sets `reasoning_billed_as: "output"` so estimated USD does not add a second reasoning line on top of output. GPT-6 Luna also lists cache writes at $0.125 / 1M tokens; the runner does not map that line from usage today.

## Compatibility

- Chat Completions + Structured Outputs (`json_schema`, strict) are supported.
- `gpt-5-mini` (and other GPT-5 models older than 5.2) reject `temperature` / `top_p` / `logprobs`. EL omits `temperature` and sets `reasoning_effort: "low"` (`none` is not supported on gpt-5-mini).
- `gpt-5.2` allows `temperature` only when reasoning effort is `none`. EL omits `temperature` and sets `reasoning_effort: "none"` (the documented GPT-5.2 default) to keep latency and cost down on a $1 post-call budget.
- `gpt-6-luna` is the official API ID (display name is not a dated snapshot). Chat Completions and `structured_outputs` are supported. `reasoning_effort` values: `none`, `low`, `medium` (API default), `high`, `xhigh`, `max`. EL omits `temperature` and sets `reasoning_effort: "none"` (Luna supports `none`; Astra / GPT-6.1 Sol do not). Do not use Responses API for this arm. Record `response.model` and `system_fingerprint` because no dated snapshot exists. Prompts over 272K tokens use a 2x long-context rate; EL prompts are far below that.
- Empty selection is valid JSON: `{"selected_theme_ids":[]}`.
- No model substitution. If a pinned snapshot is retired, stop and report rather than silently switching IDs.

## Budget fit

Ten quotes × one request budget (`max_requests: 10`) plus 1-quote smokes (`max_requests: 1` each). Prompt size is one quote plus 20 Theme definitions. `gpt-5-mini` and `gpt-6-luna` are far under $1 at these rates. `gpt-5.2` output is $14 / 1M tokens; with `reasoning_effort: none` a 10-quote pilot is expected to stay under $1, but the USD stop is post-call and one expensive reasoning response could exceed it.

Planning estimate for Luna (cache-miss Standard, ~12k in + 2k out, `reasoning_effort: none`): ~$0.0022 for 10 quotes plus ~$0.0002 for smoke. If `medium` were left as the API default, output tokens would rise and the estimate would not hold.

## DeepSeek (verified 2026-10-21)

Official sources:

- Pricing: https://api-docs.deepseek.com/quick_start/pricing/
- Chat Completions: https://api-docs.deepseek.com/api/create-chat-completion/
- JSON Output: https://api-docs.deepseek.com/guides/json_mode/
- Thinking Mode: https://api-docs.deepseek.com/guides/thinking_mode/

Chat Completions `model` enum is `deepseek-flash` and `deepseek-v4-pro` only. Do not use retired `deepseek-chat` / `deepseek-reasoner`.

| API model ID | Served version (docs) | Peak in (miss / hit) | Peak out |
| --- | --- | --- | --- |
| `deepseek-flash` | DeepSeek-V4.1-Flash-1017 | 0.30 / 0.006 | 1.20 |
| `deepseek-v4-pro` | DeepSeek-V4-Pro-0813 | 1.32 / 0.044 | 3.96 |

Catalog rows use **peak** rates as conservative `catalog_token_estimate` values. They are not provider invoices. Off-peak list prices are half; actual charges may be lower. Record reported token usage. `reasoning_billed_as: output`.

### Compatibility vs OpenAI EL

- DeepSeek Chat Completions supports `json_object` only, not `json_schema`. Theme ID enum is enforced by local `validateSelection`.
- Thinking is on by default. EL sends `thinking: {"type":"disabled"}` and `reasoning_effort: "none"` plus `max_tokens: 512` and `temperature: 0`.
- API IDs are aliases, not dated snapshots. Archive `response.model` and `system_fingerprint` when present.
- Credentials: `DEEPSEEK_API_KEY` in the execution environment only. The runner does not load `.env`. Never log or commit the key.

A thinking-on arm is out of scope. Peak-rate 10-quote planning estimates (cache-miss, ~12k in + 2k out): Flash ~$0.006, Pro ~$0.027, plus ~$0.001–$0.003 for each 1-quote smoke.
