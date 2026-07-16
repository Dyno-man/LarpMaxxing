import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAssessment } from "../src/metric.mjs";

test("normalizes and totals rubric values", () => {
  const result = normalizeAssessment({
    breakdown: {
      toolDensity: 25,
      agenticExcess: 19.6,
      terminalTheater: -10,
      visualOverkill: 200,
      hardwarePosturing: "8",
      ritualComplexity: null
    },
    roast: "  A very dramatic   desktop.  ",
    evidence: ["one", "two", 3]
  });

  assert.equal(result.score, 68);
  assert.equal(result.breakdown.terminalTheater, 0);
  assert.equal(result.breakdown.visualOverkill, 15);
  assert.equal(result.band.code, "L3");
  assert.equal(result.roast, "A very dramatic desktop.");
  assert.deepEqual(result.evidence, ["one", "two"]);
});

test("caps text and evidence returned by a model", () => {
  const result = normalizeAssessment({
    breakdown: {},
    roast: "x".repeat(500),
    evidence: Array.from({ length: 12 }, (_, index) => `signal ${index}`)
  });

  assert.equal(result.roast.length, 280);
  assert.equal(result.evidence.length, 7);
  assert.equal(result.score, 0);
  assert.equal(result.band.code, "L1");
});
