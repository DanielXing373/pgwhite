import { DIMENSIONS, DIMENSION_ZH } from "./library.mjs";

// v2（2026-11-12）：按第 2 轮 dev58 盲审收紧修辞、描写手法的规则；证据不得用省略号拼接；同一标签只给一次。
export const PROMPT_VERSION = "ac-annotate.zh.v2";

const DIMENSION_RULE = {
  theme:
    "主题：这段文字真正在谈论或表达的抽象主题。只因为出现了某个词、某个场景，不算主题。",
  rhetoric:
    "修辞：作者有意使用、读者能明确指出的修辞格。只是措辞带一点形象色彩的，不算。多数摘抄只有 0–1 个修辞。",
  technique:
    "描写手法：这段文字着力刻画人物、动作、心理或环境时采用的方式。只是提到某个动作、某个场景，不算描写。议论、说理、格言类的摘抄通常没有描写手法，返回空数组。",
};

function tagLine(tag) {
  return `${tag.code} ${tag.label}：${tag.definition}`;
}

/**
 * The system message is identical for every request of an arm, so providers can cache it.
 * With themeScope "top20" the Theme list moves into the user message per quotation.
 */
export function buildSystemPrompt({ library, dimensions, evidence, themeScope }) {
  const lines = [
    "你是中文文学摘抄的标注员。给每段摘抄从固定标签库里选出成立的标签。",
    "",
    "标注维度：",
    ...dimensions.map((dimension) => `- ${DIMENSION_RULE[dimension]}`),
    "",
    "规则：",
    "1. 只能使用标签库里的编号，不能自造标签。",
    "2. 只选文字本身能支撑的标签。勉强相关、需要靠联想才成立的不选。",
    "3. 数量不设上限，也不要凑数。某个维度没有成立的标签就返回空数组，这是正常结果。",
    "4. 每个维度内按重要程度从高到低排列。",
    evidence
      ? "5. 每个标签必须附证据 e：从该段摘抄里原样复制的一小段连续文字（不超过 20 个字），不得改写，不得用省略号拼接两处。找不到这样的证据就不要选这个标签。同一个标签在同一段摘抄里只给一次。"
      : "5. 不需要解释理由。",
    "6. 每段摘抄独立判断，不要受同一批其他摘抄影响。",
    "",
  ];
  for (const dimension of dimensions) {
    if (dimension === "theme" && themeScope !== "full") {
      lines.push("【主题标签】每段摘抄各自附带候选主题，只能从该段的候选里选。", "");
      continue;
    }
    lines.push(`【${DIMENSION_ZH[dimension]}标签】`);
    lines.push(...library.dimensions[dimension].map(tagLine));
    lines.push("");
  }
  const tagShape = evidence ? '{"c":"编号","e":"原文片段"}' : '{"c":"编号"}';
  const shape = dimensions.map((dimension) => `"${dimension}":[${tagShape}]`).join(",");
  lines.push(
    "只输出 JSON，格式：",
    `{"results":[{"n":摘抄序号,${shape}}]}`,
    "results 必须覆盖输入的每一段摘抄，n 与输入序号一致。",
  );
  return lines.join("\n");
}

export function buildUserPrompt({ library, quotes, dimensions, themeScope, candidatesByQuote }) {
  const blocks = quotes.map((quote, index) => {
    const lines = [`[${index + 1}] ${quote.text_zh}`];
    if (dimensions.includes("theme") && themeScope !== "full") {
      const codes = candidatesByQuote?.get(quote.quote_id);
      if (!codes) throw new Error(`STOP: no Theme candidates for ${quote.quote_id}`);
      lines.push("候选主题：");
      lines.push(...codes.map((code) => tagLine(library.byCode.get(code))));
    }
    return lines.join("\n");
  });
  return `请标注以下 ${quotes.length} 段摘抄。\n\n${blocks.join("\n\n")}`;
}

/** Strict JSON schema for providers that enforce one (OpenAI json_schema). */
export function buildResponseSchema({ library, dimensions, evidence }) {
  const properties = { n: { type: "integer" } };
  for (const dimension of dimensions) {
    const tagProps = {
      c: { type: "string", enum: library.dimensions[dimension].map((tag) => tag.code) },
    };
    if (evidence) tagProps.e = { type: "string" };
    properties[dimension] = {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: Object.keys(tagProps),
        properties: tagProps,
      },
    };
  }
  return {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: Object.keys(properties),
          properties,
        },
      },
    },
  };
}

export function assertKnownDimensions(dimensions) {
  for (const dimension of dimensions) {
    if (!DIMENSIONS.includes(dimension)) throw new Error(`unknown dimension ${dimension}`);
  }
}
