import test from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, scoreDesktop } from "../src/scorer.mjs";

test("demo scorer is deterministic and stays within the rubric", async () => {
  const input = {
    imageData: `data:image/png;base64,${Buffer.alloc(1200, 42).toString("base64")}`,
    fileName: "desktop.png",
    imageMeta: { width: 3440, height: 1440 },
    model: "openrouter/free",
    appUrl: "http://localhost:3000"
  };
  const first = await scoreDesktop(input);
  const second = await scoreDesktop(input);

  assert.equal(first.mode, "demo");
  assert.equal(first.model, "demo-simulator");
  assert.deepEqual(first.assessment, second.assessment);
  assert.ok(first.assessment.score >= 0 && first.assessment.score <= 100);
  assert.match(first.assessment.modelVerdict, /Demo score only/);
});

test("prompt includes concrete single-agent and extreme-stack anchors", () => {
  const prompt = buildSystemPrompt();

  assert.match(prompt, /40-55: one visible Codex/);
  assert.match(prompt, /90-100: overwhelming visible proof of four-plus/);
  assert.match(prompt, /wallpaper.*one busy terminal/i);
  assert.doesNotMatch(prompt, /forensic auditor/);
});
