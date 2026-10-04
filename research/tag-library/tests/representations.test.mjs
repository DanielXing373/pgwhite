import test from "node:test";
import assert from "node:assert/strict";
import {
  representationA,
  representationB,
  representationC,
  buildRepresentations,
} from "../src/representations.mjs";

test("representation A is label only", () => {
  assert.equal(representationA("记忆"), "记忆");
});

test("representation B joins label and definition", () => {
  assert.equal(
    representationB("记忆", "记住与回想的心智领地。"),
    "记忆：记住与回想的心智领地。",
  );
});

test("representation C includes aliases but never related concepts", () => {
  const c = representationC("悲伤", "哀伤与难过。", ["伤心", "难过", "悲伤"]);
  assert.equal(c, "悲伤：哀伤与难过。｜别名：伤心、难过");
  assert.ok(!c.includes("失去"));
  assert.ok(!c.includes("related"));
});

test("representation C handles empty aliases", () => {
  assert.equal(
    representationC("轮回", "循环往复。", []),
    "轮回：循环往复。｜别名：（无）",
  );
});

test("buildRepresentations matches library shape", () => {
  const reps = buildRepresentations({
    canonical_zh: "记忆",
    definition: "记住、回想与被过去经验塑造的心智领地。",
    aliases: ["回忆"],
    related: ["遗忘", "童年"],
  });
  assert.equal(reps.A_label, "记忆");
  assert.match(reps.B_label_definition, /^记忆：/);
  assert.match(reps.C_label_definition_aliases, /别名：回忆$/);
  assert.ok(!reps.C_label_definition_aliases.includes("遗忘"));
});
