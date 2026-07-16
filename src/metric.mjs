export const RUBRIC = [
  {
    key: "agentMultiplication",
    label: "Agent multiplication",
    max: 30,
    description: "How many Codex, Claude Code, Cursor, OMP, or other agent sessions are visibly working the same shift."
  },
  {
    key: "toolSprawl",
    label: "Tool sprawl",
    max: 20,
    description: "Editors, copilots, dashboards, browsers, MCP tools, and niche apps stacked beyond practical need."
  },
  {
    key: "terminalPageantry",
    label: "Terminal pageantry",
    max: 15,
    description: "Split panes, tmux grids, streaming logs, custom prompts, and terminal acreage."
  },
  {
    key: "workflowCeremony",
    label: "Workflow ceremony",
    max: 20,
    description: "The visible distance between having an idea and letting a human change one line of code."
  },
  {
    key: "aestheticSignaling",
    label: "Aesthetic signaling",
    max: 10,
    description: "Themes, widgets, transparency, status panes, and visual proof that this is a whole lifestyle."
  },
  {
    key: "hardwareStaging",
    label: "Hardware staging",
    max: 5,
    description: "Ultrawides and extra displays. Worth a few points, never enough to carry the bit."
  }
];

export const SCORE_BANDS = [
  { min: 90, name: "Full-time LARPer", code: "D5", verdict: "You are managing a small consultancy made entirely of terminals." },
  { min: 75, name: "Agent Middle Manager", code: "D4", verdict: "You opened enough agents to need an org chart." },
  { min: 60, name: "Workflow Influencer", code: "D3", verdict: "There is visibly more process than product here." },
  { min: 40, name: "One-tab Warrior", code: "D2", verdict: "One agent, one dream, completely normal by current standards." },
  { min: 0, name: "Actually Shipping", code: "D1", verdict: "Almost no visible LARP. Concerningly efficient." }
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
    roast: cleanText(raw.roast, "Clean setup. You may be at risk of finishing the feature.", 240),
    evidence,
    modelVerdict: cleanText(raw.modelVerdict, band.verdict, 180)
  };
}

function cleanText(value, fallback, maxLength) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}
