export const RUBRIC = [
  {
    key: "toolDensity",
    label: "Tool density",
    max: 25,
    description: "Editors, terminals, AI panes, dashboards, and tiny apps competing for oxygen."
  },
  {
    key: "agenticExcess",
    label: "Agentic excess",
    max: 20,
    description: "Multiple copilots, agents, MCPs, orchestration layers, and suspiciously autonomous tabs."
  },
  {
    key: "terminalTheater",
    label: "Terminal theater",
    max: 15,
    description: "Split panes, streaming logs, custom prompts, tmux grids, and commands nobody needed to see."
  },
  {
    key: "visualOverkill",
    label: "Visual overkill",
    max: 15,
    description: "Needlessly cinematic themes, transparent windows, widgets, wallpapers, and RGB mood."
  },
  {
    key: "hardwarePosturing",
    label: "Hardware posturing",
    max: 10,
    description: "Ultrawide real estate, extra displays, niche peripherals, and conspicuous compute."
  },
  {
    key: "ritualComplexity",
    label: "Ritual complexity",
    max: 15,
    description: "The distance between having an idea and actually changing a line of code."
  }
];

export const SCORE_BANDS = [
  { min: 90, name: "Founding LARPer", code: "L5", verdict: "No discernible boundary remains between shipping and performance art." },
  { min: 75, name: "Series A Sorcerer", code: "L4", verdict: "The workflow has become the product." },
  { min: 55, name: "Agent Wrangler", code: "L3", verdict: "You could still close some tabs. You will not." },
  { min: 35, name: "Vibe Apprentice", code: "L2", verdict: "Promising levels of unnecessary infrastructure." },
  { min: 0, name: "Civilian Engineer", code: "L1", verdict: "Disturbingly normal. Consider installing three more terminals." }
];

export function clampScore(value, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(max, Math.max(0, Math.round(number)));
}

export function normalizeAssessment(raw = {}) {
  const breakdown = Object.fromEntries(
    RUBRIC.map((item) => [item.key, clampScore(raw.breakdown?.[item.key], item.max)])
  );
  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const band = SCORE_BANDS.find((item) => score >= item.min) ?? SCORE_BANDS.at(-1);
  const evidence = Array.isArray(raw.evidence)
    ? raw.evidence.filter((item) => typeof item === "string").slice(0, 7).map((item) => item.slice(0, 80))
    : [];

  return {
    score,
    breakdown,
    band,
    roast: cleanText(raw.roast, "An immaculate setup with a concerning amount of ceremony.", 280),
    evidence,
    modelVerdict: cleanText(raw.modelVerdict, band.verdict, 180)
  };
}

function cleanText(value, fallback, maxLength) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}
