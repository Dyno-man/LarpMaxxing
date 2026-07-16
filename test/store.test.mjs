import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LeaderboardStore } from "../src/store.mjs";

test("keeps the full public leaderboard when new entries are added", async (context) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "larpmaxxing-store-"));
  context.after(() => fs.rm(dataDir, { recursive: true, force: true }));

  const store = new LeaderboardStore(dataDir);
  await store.init();
  const existing = Array.from({ length: 501 }, (_, index) => ({
    id: `existing-${index}`,
    displayName: `LARPer ${index}`,
    xHandle: null,
    score: index % 101,
    band: "Actually Shipping",
    roast: "Existing evidence.",
    evidence: [],
    mode: "live",
    createdAt: new Date(2026, 0, 1, 0, 0, index).toISOString()
  }));
  await fs.writeFile(path.join(dataDir, "leaderboard.json"), `${JSON.stringify(existing)}\n`, "utf8");

  await store.add({
    displayName: "Newest LARPer",
    xHandle: "newest_larper",
    assessment: {
      score: 88,
      band: { name: "Agent Middle Manager" },
      roast: "The org chart has an org chart.",
      evidence: ["agent swarm"]
    },
    mode: "live"
  });

  const entries = await store.list(Number.MAX_SAFE_INTEGER);
  assert.equal(entries.length, 502);
  assert.ok(entries.some((entry) => entry.displayName === "Newest LARPer"));
});
