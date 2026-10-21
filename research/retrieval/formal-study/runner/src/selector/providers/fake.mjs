import { ProviderHttpError } from "../../safety.mjs";

export function createFakeSelector({ respond, failTimes = 0 } = {}) {
  let calls = 0;
  return {
    provider_id: "fake",
    async prepare() {
      return null;
    },
    async complete({ model, prompt }) {
      calls += 1;
      if (calls <= failTimes) {
        throw new ProviderHttpError("fake HTTP 500", {
          status: 500,
          retryable: true,
          provider: "fake",
        });
      }
      const out = await respond({ prompt, model, call: calls });
      const selected = out.selected_theme_ids ?? [];
      return {
        provider_id: "fake",
        model_id: model ?? "fake-selector",
        request_body: { prompt },
        raw_response: out.raw_response ?? { selected_theme_ids: selected },
        response_text: out.response_text ?? JSON.stringify({ selected_theme_ids: selected }),
        usage: out.usage ?? {
          input_tokens: null,
          output_tokens: null,
          reasoning_tokens: null,
          cached_tokens: null,
        },
        local_runtime: out.local_runtime ?? null,
        http_status: 200,
      };
    },
  };
}
