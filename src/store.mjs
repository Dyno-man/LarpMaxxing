import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export class LeaderboardStore {
  constructor(dataDir) {
    this.file = path.resolve(dataDir, "leaderboard.json");
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try {
      await fs.access(this.file);
    } catch {
      await fs.writeFile(this.file, "[]\n", "utf8");
    }
  }

  async list(limit = 25) {
    const entries = await this.#read();
    return entries
      .sort((a, b) => b.score - a.score || new Date(a.createdAt) - new Date(b.createdAt))
      .slice(0, limit);
  }

  async add({ displayName, xHandle, assessment, mode }) {
    const entry = {
      id: crypto.randomUUID(),
      displayName,
      xHandle: xHandle || null,
      score: assessment.score,
      band: assessment.band.name,
      roast: assessment.roast,
      evidence: assessment.evidence.slice(0, 3),
      mode,
      createdAt: new Date().toISOString()
    };

    this.writeQueue = this.writeQueue.catch(() => {}).then(async () => {
      const entries = await this.#read();
      entries.push(entry);
      const trimmed = entries
        .sort((a, b) => b.score - a.score || new Date(a.createdAt) - new Date(b.createdAt))
        .slice(0, 500);
      const temporaryFile = `${this.file}.${process.pid}.tmp`;
      await fs.writeFile(temporaryFile, `${JSON.stringify(trimmed, null, 2)}\n`, "utf8");
      await fs.rename(temporaryFile, this.file);
    });

    await this.writeQueue;
    return entry;
  }

  async #read() {
    try {
      const value = JSON.parse(await fs.readFile(this.file, "utf8"));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }
}
