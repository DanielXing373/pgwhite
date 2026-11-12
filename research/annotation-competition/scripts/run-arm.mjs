#!/usr/bin/env node
// 运行一个参赛组合。默认 dry-run：只打印计划和第一条请求，不发请求、不写文件。
//   node research/annotation-competition/scripts/run-arm.mjs --config <file>
//   ... --execution-mode fake --run-id <id>                    # 离线假接口，走通全流程
//   ... --execution-mode paid-api --allow-paid-api --run-id <id> [--limit 3]
import { runArm } from "../src/run.mjs";
import { fromRepo } from "../src/paths.mjs";
import { one, parseArgs, readJson } from "../src/util.mjs";

const args = parseArgs(process.argv.slice(2));
const configPath = one(args, "config");
if (!configPath) {
  console.error("usage: run-arm.mjs --config <file> [--execution-mode dry-run|fake|paid-api] [--allow-paid-api] [--run-id <id>] [--limit N] [--show-prompt]");
  process.exit(2);
}
const limit = one(args, "limit");
try {
  const outcome = await runArm({
    config: readJson(fromRepo(configPath)),
    executionMode: one(args, "execution-mode", "dry-run"),
    allowPaidApi: args["allow-paid-api"] === true,
    runId: one(args, "run-id"),
    limit: limit ? Number(limit) : null,
  });
  console.log(JSON.stringify(outcome.plan, null, 2));
  if (outcome.preview && args["show-prompt"]) {
    console.log("\n===== system =====\n" + outcome.preview.system);
    console.log("\n===== user (first request) =====\n" + outcome.preview.user);
  }
  if (outcome.run) {
    console.log(JSON.stringify(outcome.run.summary, null, 2));
    console.log(`wrote ${outcome.runDir}`);
  } else {
    console.log("dry-run: no request sent, nothing written.");
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
