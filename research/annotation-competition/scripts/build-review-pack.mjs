#!/usr/bin/env node
// 把多个 run 的标签合并成一个盲审包。
//   node .../build-review-pack.mjs --run <run-id> --run <run-id> ... --out-name <name>
//        [--seed 20261112] [--judgments <已有判定.json> ...]
// 输出 packs/<name>.public.json（给 review/index.html 用）和 packs/<name>.private.json（来源映射，别打开）。
import fs from "node:fs";
import path from "node:path";
import { loadLibrary } from "../src/library.mjs";
import { AC_ROOT, fromRepo } from "../src/paths.mjs";
import { buildReviewPack, mergeJudgments } from "../src/pool.mjs";
import { many, one, parseArgs, readJson, writeJson } from "../src/util.mjs";

const args = parseArgs(process.argv.slice(2));
const runIds = many(args, "run");
const name = one(args, "out-name");
if (runIds.length === 0 || !name) {
  console.error("usage: build-review-pack.mjs --run <run-id> [--run ...] --out-name <name> [--seed N] [--judgments file ...]");
  process.exit(2);
}
try {
  const runs = runIds.map((id) => readJson(path.join(AC_ROOT, "runs", id, "run.json")));
  const { judgments } = mergeJudgments(many(args, "judgments").map((file) => readJson(fromRepo(file))));
  const { pack, privateMapping } = buildReviewPack({
    runs,
    library: loadLibrary(),
    seed: Number(one(args, "seed", "20261112")),
    judgments,
  });
  const publicFile = path.join(AC_ROOT, "packs", `${name}.public.json`);
  const privateFile = path.join(AC_ROOT, "packs", `${name}.private.json`);
  if (fs.existsSync(publicFile)) throw new Error(`STOP: ${publicFile} already exists; choose a new --out-name.`);
  writeJson(publicFile, pack);
  writeJson(privateFile, privateMapping);
  console.log(`pack ${pack.pack_id}: ${pack.items.length} quotes, ${pack.tags_to_judge} tags to judge (${privateMapping.already_judged} already judged)`);
  console.log(`open research/annotation-competition/review/index.html and load ${path.relative(process.cwd(), publicFile)}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
