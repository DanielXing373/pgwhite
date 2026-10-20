import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LITERARY_TASK_INSTRUCTION,
  QWEN_BUILTIN_QUERY_PROMPT,
  normalizeInstructionMode,
  resolveQwenQueryEncoding,
} from "../runner/src/qwenInstructionModes.mjs";
import { buildQwen3WorkerArgs } from "../runner/src/providers/qwen3.mjs";
import { recallAtK, aggregateRecalls } from "../runner/src/evaluate.mjs";
import {
  representationA,
  representationB,
  representationC,
} from "../../tag-library/src/representations.mjs";

const QUOTE = "他对死亡充满敬畏，却并不感到恐惧。";

test("instruction mode none uses raw quote (no Instruct/Query prefix)", () => {
  const r = resolveQwenQueryEncoding("none", QUOTE);
  assert.equal(r.effective_prompt_prefix, null);
  assert.equal(r.effective_query_instruction, null);
  assert.equal(r.effective_query_preview, QUOTE);
  assert.deepEqual(r.encode_kwargs, {});
  assert.ok(!r.effective_query_preview.startsWith("Instruct:"));
});

test("instruction mode prompt_name=query uses built-in web-search Instruct/Query", () => {
  const r = resolveQwenQueryEncoding("prompt_name=query", QUOTE);
  assert.equal(r.effective_prompt_prefix, QWEN_BUILTIN_QUERY_PROMPT);
  assert.equal(
    r.effective_query_preview,
    `${QWEN_BUILTIN_QUERY_PROMPT}${QUOTE}`,
  );
  assert.deepEqual(r.encode_kwargs, { prompt_name: "query" });
  assert.ok(r.effective_query_preview.startsWith("Instruct: Given a web search query"));
  assert.ok(r.effective_query_preview.includes(`Query:${QUOTE}`) || r.effective_query_preview.endsWith(QUOTE));
});

test("instruction mode task_instruct uses literary task Instruct/Query", () => {
  const r = resolveQwenQueryEncoding("task_instruct", QUOTE);
  const expectedPrefix = `Instruct: ${DEFAULT_LITERARY_TASK_INSTRUCTION}\nQuery:`;
  assert.equal(r.effective_prompt_prefix, expectedPrefix);
  assert.equal(r.effective_query_instruction, DEFAULT_LITERARY_TASK_INSTRUCTION);
  assert.equal(r.effective_query_preview, `${expectedPrefix}${QUOTE}`);
  assert.notEqual(r.effective_query_preview, QUOTE);
  assert.ok(r.effective_query_preview.includes("literary theme concepts"));
});

test("three modes produce distinguishable effective query previews", () => {
  const a = resolveQwenQueryEncoding("none", QUOTE).effective_query_preview;
  const b = resolveQwenQueryEncoding("prompt_name=query", QUOTE).effective_query_preview;
  const c = resolveQwenQueryEncoding("task_instruct", QUOTE).effective_query_preview;
  assert.notEqual(a, b);
  assert.notEqual(b, c);
  assert.notEqual(a, c);
});

test("buildQwen3WorkerArgs emits --instruction-mode for all modes", () => {
  for (const mode of ["none", "prompt_name=query", "task_instruct"]) {
    const { args, instructionMode } = buildQwen3WorkerArgs({
      instruction_mode: mode,
      require_cuda: false,
    });
    assert.equal(instructionMode, normalizeInstructionMode(mode));
    assert.ok(args.includes("--instruction-mode"));
    assert.ok(args.includes(instructionMode));
    if (instructionMode === "task_instruct") {
      assert.ok(args.includes("--query-instruction"));
    } else {
      assert.ok(!args.includes("--query-instruction"));
    }
  }
});

test("representations A/B/C construction matches formal definitions", () => {
  const tag = {
    canonical_zh: "死亡",
    definition: "生命终结、死亡意识，以及围绕死亡的恐惧、接受或反思。",
    aliases: ["过世", "死亡"],
  };
  assert.equal(representationA(tag.canonical_zh), "死亡");
  assert.equal(
    representationB(tag.canonical_zh, tag.definition),
    "死亡：生命终结、死亡意识，以及围绕死亡的恐惧、接受或反思。",
  );
  assert.equal(
    representationC(tag.canonical_zh, tag.definition, tag.aliases),
    "死亡：生命终结、死亡意识，以及围绕死亡的恐惧、接受或反思。｜别名：过世",
  );
});

test("Recall@5/10/20 evaluation is correct on a synthetic ranking", () => {
  const expected = ["t1", "t2"];
  // ranking is positional: slice(0,k) defines Top-K (rank field is metadata)
  const ranked = [];
  for (let i = 1; i <= 20; i++) {
    const tag_id = i === 2 ? "t1" : i === 12 ? "t2" : `other-${i}`;
    ranked.push({ tag_id, rank: i });
  }
  const r5 = recallAtK(expected, ranked, 5);
  const r10 = recallAtK(expected, ranked, 10);
  const r20 = recallAtK(expected, ranked, 20);
  assert.equal(r5.hit_count, 1);
  assert.equal(r5.recall, 0.5);
  assert.equal(r10.hit_count, 1);
  assert.equal(r10.recall, 0.5);
  assert.equal(r20.hit_count, 2);
  assert.equal(r20.recall, 1.0);

  const agg = aggregateRecalls(
    [
      {
        recall_at: {
          5: r5,
          10: r10,
          20: r20,
        },
      },
    ],
    [5, 10, 20],
  );
  assert.equal(agg.evaluated_quotes, 1);
  assert.equal(agg.mean_recall_at_5, 0.5);
  assert.equal(agg.mean_recall_at_10, 0.5);
  assert.equal(agg.mean_recall_at_20, 1.0);
});
