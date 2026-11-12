import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadDataset, loadThemeCandidates } from "../src/datasets.mjs";
import { loadProviderEnv } from "../src/dotenv.mjs";
import { loadLibrary } from "../src/library.mjs";
import { parseAnnotationResponse } from "../src/parse.mjs";
import { AC_ROOT, FROZEN_RETRIEVAL, fromRepo } from "../src/paths.mjs";
import { buildReviewPack, mergeJudgments } from "../src/pool.mjs";
import { buildResponseSchema, buildSystemPrompt, buildUserPrompt } from "../src/prompt.mjs";
import { fakeProvider } from "../src/providers.mjs";
import { planRequests, runArm } from "../src/run.mjs";
import { buildPool, scoreRun } from "../src/score.mjs";
import { readJson } from "../src/util.mjs";

const library = loadLibrary();
const hasRetrieval = fs.existsSync(fromRepo(FROZEN_RETRIEVAL));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "ac-test-"));

function config(overrides = {}) {
  return {
    arm_id: "test-arm",
    provider: { id: "openai", model_id: "gpt-6-luna", request: {} },
    dataset: { id: "dev58" },
    dimensions: ["theme", "rhetoric", "technique"],
    theme_scope: "full",
    batch_size: 20,
    evidence: true,
    call_mode: "joint",
    execution: { concurrency: 2, max_requests: 3, retry_limit: 0 },
    ...overrides,
  };
}

test("library: 185 themes, 15 rhetoric, 8 technique, cleanup decisions applied", () => {
  assert.equal(library.dimensions.theme.length, 185);
  assert.equal(library.dimensions.rhetoric.length, 15);
  assert.equal(library.dimensions.technique.length, 8);
  const labels = new Set([...library.byCode.values()].map((tag) => tag.label));
  // 白描在 ac1.1 退役：不能被编号命中、不进 prompt，但旧 run 的 ID 仍能查到，其余编号不变。
  assert.ok(!library.byCode.has("D07"));
  assert.equal(library.byId.get("technique-07-白描")?.label, "白描");
  assert.equal(library.byCode.get("D08").id, "technique-08-侧面描写");
  assert.equal(library.byCode.get("D09").id, "technique-09-留白");
  assert.ok(!buildSystemPrompt({ library, dimensions: ["technique"], evidence: true, themeScope: "full" }).includes("白描"));
  for (const gone of ["隐喻", "对比描写", "通篇象征", "头韵", "内涵", "暗示", "意象", "长句描写", "白描"]) {
    assert.ok(!labels.has(gone), `${gone} should be merged or removed`);
  }
  assert.ok(labels.has("语言描写"));
  assert.ok(library.byCode.get("R01").aliases.includes("隐喻"));
  assert.equal(labels.size, library.byCode.size, "labels are unique across dimensions");
  for (const code of library.byCode.keys()) assert.match(code, /^(T\d{3}|R\d{2}|D\d{2})$/);
});

test("library: every frozen Theme ID survives unchanged", () => {
  const raw = readJson(path.join(AC_ROOT, "library", "tag-library.ac1.json"));
  const frozen = readJson(fromRepo(raw.source.path));
  assert.deepEqual(
    library.dimensions.theme.map((tag) => tag.id),
    frozen.themes.filter((theme) => theme.status === "active_candidate").map((theme) => theme.id),
  );
});

test("datasets: dev58 and holdout60 carry text only and do not overlap", () => {
  const dev = loadDataset({ id: "dev58" });
  const holdout = loadDataset({ id: "holdout60", path: "research/annotation-competition/benchmark/holdout-60.v1.json" });
  assert.equal(dev.quotes.length, 58);
  assert.equal(holdout.quotes.length, 60);
  for (const quote of [...dev.quotes, ...holdout.quotes]) {
    assert.deepEqual(Object.keys(quote).sort(), ["quote_id", "text_zh"]);
  }
  const devTexts = new Set(dev.quotes.map((quote) => quote.text_zh));
  assert.ok(holdout.quotes.every((quote) => !devTexts.has(quote.text_zh)));
});

test("prompt: full scope lists every code once; system prompt is identical across batches", () => {
  const dataset = loadDataset({ id: "dev58" });
  const { requests } = planRequests({ config: config(), library, dataset, candidatesByQuote: null });
  assert.equal(requests.length, 3);
  assert.equal(new Set(requests.map((request) => request.system)).size, 1);
  for (const code of library.byCode.keys()) {
    assert.equal(requests[0].system.split(`\n${code} `).length - 1, 1, code);
  }
  assert.doesNotMatch(requests.map((request) => request.system + request.user).join("\n"), /expected_theme|human-gold|batch1-calib|theme-0\d{3}/);
  assert.match(requests[0].user, /^请标注以下 20 段摘抄。/);
});

test("prompt: separate mode sends one request per dimension with only that library", () => {
  const dataset = loadDataset({ id: "dev58" });
  const { requests } = planRequests({ config: config({ call_mode: "separate" }), library, dataset, candidatesByQuote: null });
  assert.equal(requests.length, 9);
  const rhetoric = requests.find((request) => request.dimensions[0] === "rhetoric");
  assert.match(rhetoric.system, /R01 比喻/);
  assert.doesNotMatch(rhetoric.system, /T001|D01/);
});

test("prompt: top20 scope puts candidates beside each quotation, not in the system prompt", { skip: !hasRetrieval }, () => {
  const candidates = loadThemeCandidates(library, { k: 20 });
  const quotes = loadDataset({ id: "dev58" }).quotes.slice(0, 1);
  const system = buildSystemPrompt({ library, dimensions: ["theme"], evidence: false, themeScope: "top20" });
  const user = buildUserPrompt({ library, quotes, dimensions: ["theme"], themeScope: "top20", candidatesByQuote: candidates });
  assert.doesNotMatch(system, /T001 /);
  assert.equal((user.match(/^T\d{3} /gm) ?? []).length, 20);
});

test("schema: strict, enum per dimension, evidence only when asked", () => {
  const withEvidence = buildResponseSchema({ library, dimensions: ["theme", "rhetoric"], evidence: true });
  const row = withEvidence.properties.results.items;
  assert.deepEqual(row.required, ["n", "theme", "rhetoric"]);
  assert.equal(row.properties.rhetoric.items.properties.c.enum.length, 15);
  assert.deepEqual(row.properties.theme.items.required, ["c", "e"]);
  const without = buildResponseSchema({ library, dimensions: ["theme"], evidence: false });
  assert.deepEqual(without.properties.results.items.properties.theme.items.required, ["c"]);
});

const QUOTES = [
  { quote_id: "q1", text_zh: "时间像一条河，带走了他的童年。" },
  { quote_id: "q2", text_zh: "他没有说话。" },
];
const time = [...library.byCode.values()].find((tag) => tag.label === "时间").code;
const childhood = [...library.byCode.values()].find((tag) => tag.label === "童年").code;
const parseOptions = { quotes: QUOTES, library, dimensions: ["theme", "rhetoric"], evidence: true };

test("parse: keeps supported tags, drops bad ones without repairing, allows empty", () => {
  const text = JSON.stringify({ results: [
    { n: 1, theme: [
      { c: time, e: "时间像一条河" },
      { c: childhood, e: "他的 童年" },          // whitespace differences are tolerated
      { c: "T999", e: "时间" },                   // unknown code
      { c: time, e: "带走了" },                   // duplicate
      { c: "R01", e: "像一条河" },                // wrong dimension
    ], rhetoric: [
      { c: "R01", e: "时间像一条河" },
      { c: "R02", e: "河水在歌唱" },              // evidence not in the quotation
      { c: "R03", e: "" },                        // no evidence
    ] },
    { n: 2, theme: [], rhetoric: [] },
  ] });
  const [first, second] = parseAnnotationResponse(text, parseOptions);
  assert.equal(first.status, "valid");
  assert.deepEqual(first.tags.theme.map((tag) => tag.code), [time, childhood]);
  assert.deepEqual(first.tags.rhetoric.map((tag) => tag.code), ["R01"]);
  assert.deepEqual(first.dropped.map((item) => item.reason).sort(), [
    "duplicate", "evidence_missing", "evidence_not_in_quote", "unknown_code", "wrong_dimension",
  ]);
  assert.equal(second.status, "valid");
  assert.deepEqual(second.tags, { theme: [], rhetoric: [] });
});

test("parse: malformed JSON or a missing row invalidates only what is unusable", () => {
  assert.ok(parseAnnotationResponse("not json", parseOptions).every((row) => row.reason === "malformed_json"));
  const partial = parseAnnotationResponse(JSON.stringify({ results: [{ n: 1, theme: [], rhetoric: [] }] }), parseOptions);
  assert.equal(partial[0].status, "valid");
  assert.equal(partial[1].reason, "missing_result");
  const fenced = parseAnnotationResponse("```json\n{\"results\":[{\"n\":1,\"theme\":[],\"rhetoric\":[]},{\"n\":2,\"theme\":[],\"rhetoric\":[]}]}\n```", parseOptions);
  assert.ok(fenced.every((row) => row.status === "valid"));
});

test("parse: top20 scope rejects a Theme outside that quotation's candidates", () => {
  const rows = parseAnnotationResponse(
    JSON.stringify({ results: [{ n: 1, theme: [{ c: time }, { c: childhood }] }] }),
    { quotes: QUOTES.slice(0, 1), library, dimensions: ["theme"], evidence: false, themeScope: "top20", candidatesByQuote: new Map([["q1", [time]]]) },
  );
  assert.deepEqual(rows[0].tags.theme.map((tag) => tag.code), [time]);
  assert.equal(rows[0].dropped[0].reason, "not_a_candidate");
});

test("run: dry-run sends nothing and writes nothing", async () => {
  const runsDir = tmp();
  const outcome = await runArm({ config: config(), executionMode: "dry-run", runsDir });
  assert.equal(outcome.run, null);
  assert.equal(outcome.plan.requests, 3);
  assert.deepEqual(fs.readdirSync(runsDir), []);
});

test("run: paid-api refuses without the explicit flag, and refuses the fake provider", async () => {
  await assert.rejects(runArm({ config: config(), executionMode: "paid-api", runId: "x", runsDir: tmp() }), /--allow-paid-api/);
  await assert.rejects(
    runArm({ config: config({ provider: { id: "fake", model_id: "fake" } }), executionMode: "paid-api", allowPaidApi: true, runId: "x", runsDir: tmp() }),
    /refuses provider/,
  );
});

test("run: paid-api without the provider key stops before writing a run", async () => {
  const runsDir = tmp();
  await assert.rejects(
    runArm({ config: config(), executionMode: "paid-api", allowPaidApi: true, runId: "x", runsDir, env: {} }),
    /OPENAI_API_KEY is not set/,
  );
  assert.deepEqual(fs.readdirSync(runsDir), []);
});

test("run: a plan larger than max_requests stops before any call", async () => {
  const small = config({ execution: { max_requests: 2 } });
  await assert.rejects(runArm({ config: small, executionMode: "fake", runId: "x", runsDir: tmp() }), /max_requests is 2/);
});

test("run: fake end-to-end is immutable and merges joint and separate modes identically", async () => {
  const runsDir = tmp();
  const joint = await runArm({ config: config(), executionMode: "fake", runId: "joint", runsDir });
  const separate = await runArm({
    config: config({ call_mode: "separate", execution: { max_requests: 9 } }),
    executionMode: "fake",
    runId: "separate",
    runsDir,
  });
  assert.equal(joint.run.summary.valid_quotes, 58);
  assert.equal(joint.run.summary.requests_sent, 3);
  assert.equal(separate.run.summary.requests_sent, 9);
  assert.deepEqual(joint.run.results.map((row) => row.tags), separate.run.results.map((row) => row.tags));
  assert.ok(joint.run.results.some((row) => row.tags.theme.length > 0));
  assert.ok(fs.existsSync(path.join(runsDir, "joint", "run.json")));
  await assert.rejects(runArm({ config: config(), executionMode: "fake", runId: "joint", runsDir }), /already exists/);
});

test("run: a malformed batch invalidates that batch only; provider errors are recorded", async () => {
  const good = JSON.stringify({ results: Array.from({ length: 20 }, (_, i) => ({ n: i + 1, theme: [] })) });
  const scripted = await runArm({
    config: config({ dimensions: ["theme"], execution: { concurrency: 1, max_requests: 3 } }),
    executionMode: "fake",
    runId: "scripted",
    runsDir: tmp(),
    provider: fakeProvider({ scripted: [good, "oops", good] }),
  });
  assert.equal(scripted.run.summary.valid_quotes, 38);
  assert.equal(scripted.run.results.filter((row) => row.reason === "malformed_json").length, 20);

  const failing = { provider_id: "fake", async complete() { throw Object.assign(new Error("boom sk-abcdefgh12345"), { retryable: false }); } };
  const errored = await runArm({
    config: config({ dimensions: ["theme"] }),
    executionMode: "fake",
    runId: "errored",
    runsDir: tmp(),
    provider: failing,
  });
  assert.equal(errored.run.summary.valid_quotes, 0);
  assert.ok(errored.run.results.every((row) => row.reason === "provider_error"));
  assert.doesNotMatch(JSON.stringify(errored.run), /sk-abcdefgh12345/);
});

function miniRun(runId, tagsByQuote, { invalid = [] } = {}) {
  const tag = (label) => {
    const found = [...library.byCode.values()].find((entry) => entry.label === label);
    return { code: found.code, tag_id: found.id, label, evidence: null };
  };
  return {
    run_id: runId,
    arm_id: runId,
    kind: "llm",
    dataset: { id: "mini", sha256: "x", limit: null },
    dimensions: ["theme"],
    summary: {},
    results: Object.entries(tagsByQuote).map(([quoteId, labels]) => (invalid.includes(quoteId)
      ? { quote_id: quoteId, text_zh: `文本${quoteId}`, status: "invalid", reason: "malformed_json", tags: null, dropped: [] }
      : { quote_id: quoteId, text_zh: `文本${quoteId}`, status: "valid", reason: null, tags: { theme: labels.map(tag) }, dropped: [] })),
  };
}
const idOf = (label) => [...library.byCode.values()].find((entry) => entry.label === label).id;

test("pool: public pack is blind, de-duplicated, deterministic, and skips judged tags", () => {
  const runs = [
    miniRun("arm-a", { q1: ["时间", "童年"], q2: [] }),
    miniRun("arm-b", { q1: ["时间", "记忆"], q2: ["孤独"] }),
  ];
  const first = buildReviewPack({ runs, library, seed: 7 });
  const again = buildReviewPack({ runs, library, seed: 7 });
  assert.deepEqual(first.pack, again.pack);
  assert.equal(first.pack.tags_to_judge, 4);
  assert.doesNotMatch(JSON.stringify(first.pack), /arm-a|arm-b|evidence|rank|gpt|deepseek/);
  assert.deepEqual(first.privateMapping.contributions.q1[idOf("时间")], ["arm-a", "arm-b"]);

  const judged = { q1: { [idOf("时间")]: "accept", [idOf("童年")]: "reject", [idOf("记忆")]: "accept" } };
  const later = buildReviewPack({ runs, library, seed: 7, judgments: judged });
  assert.equal(later.pack.tags_to_judge, 1);
  assert.deepEqual(later.pack.items.map((item) => item.quote_id), ["q2"]);
});

test("pool: smoke (--limit) runs and mixed datasets cannot enter a pack", () => {
  const smoke = miniRun("smoke", { q1: [] });
  smoke.dataset.limit = 3;
  assert.throws(() => buildReviewPack({ runs: [smoke], library, seed: 1 }), /smoke run/);
  const other = miniRun("other", { q1: [] });
  other.dataset.id = "elsewhere";
  assert.throws(() => buildReviewPack({ runs: [miniRun("a", { q1: [] }), other], library, seed: 1 }), /one dataset only/);
});

test("score: acceptance, pooled coverage, rank breakdown, empty handling, invalid penalty", () => {
  const runs = [
    miniRun("arm-a", { q1: ["时间", "童年"], q2: [], q3: ["孤独"] }),
    miniRun("arm-b", { q1: ["时间", "记忆"], q2: ["孤独"], q3: ["孤独", "恐惧"] }, { invalid: ["q3"] }),
  ];
  const { judgments, conflicts } = mergeJudgments([
    { judgments: { q1: { [idOf("时间")]: "accept", [idOf("童年")]: "reject", [idOf("记忆")]: "accept" } } },
    { judgments: { q2: { [idOf("孤独")]: "reject" }, q3: { [idOf("孤独")]: "accept" }, q1: { [idOf("童年")]: "reject" } } },
  ]);
  assert.equal(conflicts.length, 0);
  const pool = buildPool(runs, library);
  const a = scoreRun({ run: runs[0], judgments, poolByQuote: pool }).dimensions.theme;
  const b = scoreRun({ run: runs[1], judgments, poolByQuote: pool });
  // pool accepts: q1 {时间, 记忆}, q3 {孤独}  -> 3
  assert.equal(a.pool_accepted, 3);
  assert.equal(a.tags_accepted, 2);
  assert.equal(a.acceptance, 2 / 3);
  assert.equal(a.coverage, 2 / 3);
  assert.equal(a.acceptance_by_rank["2"].acceptance, 0);
  assert.equal(a.should_be_empty_quotes, 1);
  assert.equal(a.correctly_empty_quotes, 1);
  // arm-b: q3 invalid -> its tags do not count; q2 output is a rejected tag on a should-be-empty quote
  assert.equal(b.dimensions.theme.tags_produced, 3);
  assert.equal(b.dimensions.theme.acceptance, 2 / 3);
  assert.equal(b.dimensions.theme.coverage, 2 / 3);
  assert.equal(b.dimensions.theme.correctly_empty_quotes, 0);
  assert.equal(b.invalid_quote_rate, 1 / 3);
});

test("score: conflicting judgment files are reported, later file wins", () => {
  const id = idOf("时间");
  const { judgments, conflicts } = mergeJudgments([
    { judgments: { q1: { [id]: "accept" } } },
    { judgments: { q1: { [id]: "reject" } } },
  ]);
  assert.equal(judgments.q1[id], "reject");
  assert.equal(conflicts.length, 1);
});

test("dotenv: loads only provider variables, .env wins, values are not returned", () => {
  const file = path.join(tmp(), ".env");
  fs.writeFileSync(file, "# note\nDB_PASSWORD=hunter2\nOPENAI_API_KEY=\"sk-from-file\"\nexport DEEPSEEK_API_KEY=ds-file\nOPENAI_BASE_URL=\n");
  const env = { OPENAI_API_KEY: "sk-stale-shell" };
  assert.deepEqual(loadProviderEnv({ file, env }), ["OPENAI_API_KEY", "DEEPSEEK_API_KEY"]);
  assert.deepEqual(env, { OPENAI_API_KEY: "sk-from-file", DEEPSEEK_API_KEY: "ds-file" });
  assert.deepEqual(loadProviderEnv({ file: path.join(tmp(), "missing"), env }), []);
});
