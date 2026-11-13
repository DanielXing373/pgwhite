#!/usr/bin/env node
// 用盲审判定给多个 run 计分。
//   node .../score.mjs --run <run-id> [--run ...] --judgments <file> [--judgments ...] [--out <report.md>]
//        [--unjudged pending|acceptable]
// --unjudged pending（默认）：未判的标签不计入任何比例。
// --unjudged acceptable：三档计分，未判 = 可接受，打叉 = 明显错误。只用于评审一次看到全部候选的盲审包。
// 带 --out 时同时写一份同名 .json，含每个组合的全部计数、比例和 95% 区间。
import fs from "node:fs";
import path from "node:path";
import { loadLibrary } from "../src/library.mjs";
import { AC_ROOT, fromRepo } from "../src/paths.mjs";
import { assertSameDataset, mergeJudgments } from "../src/pool.mjs";
import { UNJUDGED_MODES, buildPool, renderMarkdown, scoreRun } from "../src/score.mjs";
import { many, one, parseArgs, readJson, writeJson } from "../src/util.mjs";

const args = parseArgs(process.argv.slice(2));
const runIds = many(args, "run");
const judgmentFiles = many(args, "judgments");
if (runIds.length === 0 || judgmentFiles.length === 0) {
  console.error("usage: score.mjs --run <run-id> [--run ...] --judgments <file> [--judgments ...] [--out report.md]");
  process.exit(2);
}
try {
  const runs = runIds.map((id) => readJson(path.join(AC_ROOT, "runs", id, "run.json")));
  assertSameDataset(runs);
  const { judgments, conflicts } = mergeJudgments(judgmentFiles.map((file) => readJson(fromRepo(file))));
  const poolByQuote = buildPool(runs, loadLibrary());
  const unjudgedAs = one(args, "unjudged", "pending");
  if (!UNJUDGED_MODES.includes(unjudgedAs)) throw new Error(`--unjudged must be one of: ${UNJUDGED_MODES.join(", ")}`);
  const scores = runs.map((run) => scoreRun({ run, judgments, poolByQuote, unjudgedAs }));
  const markdown = renderMarkdown(scores);
  console.log(markdown);
  if (conflicts.length > 0) console.log(`\n注意：判定文件之间有 ${conflicts.length} 处冲突，已按后给出的文件为准。`);
  const out = one(args, "out");
  if (out) {
    fs.writeFileSync(fromRepo(out), `${markdown}\n`, "utf8");
    writeJson(fromRepo(out.replace(/\.md$/, "") + ".json"), {
      unjudged_as: unjudgedAs,
      runs: runIds,
      judgment_files: judgmentFiles,
      scores,
      conflicts,
    });
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
