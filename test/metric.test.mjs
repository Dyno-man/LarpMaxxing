import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAssessment } from "../src/metric.mjs";

test("normalizes and totals rubric values", () => {
  const result = normalizeAssessment({
    breakdown: {
      agentMultiplication: 26,
      toolSprawl: 19.6,
      terminalPageantry: -10,
      workflowCeremony: 200,
      aestheticSignaling: "8",
      hardwareStaging: null
    },
    roast: "  A very dramatic   desktop.  ",
    evidence: ["one", "two", 3]
  });

  assert.equal(result.score, 74);
  assert.equal(result.breakdown.terminalPageantry, 0);
  assert.equal(result.breakdown.workflowCeremony, 20);
  assert.equal(result.band.code, "D3");
  assert.equal(result.roast, "A very dramatic desktop.");
  assert.deepEqual(result.evidence, ["one", "two"]);
});

test("caps text and evidence returned by a model", () => {
  const result = normalizeAssessment({
    breakdown: {},
    roast: "x".repeat(500),
    evidence: Array.from({ length: 12 }, (_, index) => `signal ${index}`)
  });

  assert.equal(result.roast.length, 240);
  assert.equal(result.evidence.length, 7);
  assert.equal(result.score, 0);
  assert.equal(result.band.code, "D1");
});

test("calibrates a single-agent setup around baseline and reserves 90 for extreme LARP", () => {
  const singleAgent = normalizeAssessment({
    breakdown: {
      agentMultiplication: 13,
      toolSprawl: 10,
      terminalPageantry: 7,
      workflowCeremony: 10,
      aestheticSignaling: 7,
      hardwareStaging: 3
    }
  });
  const fourAgentStack = normalizeAssessment({
    breakdown: {
      agentMultiplication: 29,
      toolSprawl: 18,
      terminalPageantry: 14,
      workflowCeremony: 18,
      aestheticSignaling: 8,
      hardwareStaging: 4
    }
  });

  assert.equal(singleAgent.score, 50);
  assert.equal(singleAgent.band.code, "D2");
  assert.equal(fourAgentStack.score, 91);
  assert.equal(fourAgentStack.band.code, "D5");
});
