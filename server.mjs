import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { RUBRIC, SCORE_BANDS } from "./src/metric.mjs";
import { scoreDesktop, ScoringError } from "./src/scorer.mjs";
import { LeaderboardStore } from "./src/store.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const appUrl = process.env.APP_URL || `http://localhost:${port}`;
const model = process.env.OPENROUTER_MODEL || "openrouter/free";
const hasApiKey = Boolean(process.env.OPENROUTER_API_KEY);
const store = new LeaderboardStore(process.env.DATA_DIR || path.join(root, "data"));
await store.init();

const app = express();
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginResourcePolicy: { policy: "same-origin" }
}));
app.use(express.json({ limit: "9mb" }));
// Keep local runs fresh so a CSS/JS change is visible without fighting a stale
// browser cache. Production deploys can add immutable asset versioning later.
app.use(express.static(path.join(root, "public"), { extensions: ["html"], maxAge: 0 }));

const scoringLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Five audits per minute is already advanced LARPing. Try again shortly." }
});

app.get("/api/config", (_request, response) => {
  response.json({
    mode: hasApiKey ? "live" : "demo",
    maxImageBytes: 6 * 1024 * 1024,
    rubric: RUBRIC,
    bands: SCORE_BANDS
  });
});

app.get("/api/leaderboard", async (request, response) => {
  const limit = Math.min(50, Math.max(1, Number(request.query.limit) || 25));
  response.json({ entries: await store.list(limit) });
});

app.post("/api/score", scoringLimiter, async (request, response) => {
  try {
    const input = validateSubmission(request.body);
    const result = await scoreDesktop({
      ...input,
      apiKey: process.env.OPENROUTER_API_KEY,
      model,
      appUrl
    });

    const entry = input.publish && result.mode === "live"
      ? await store.add({
          displayName: input.displayName,
          xHandle: input.xHandle,
          assessment: result.assessment,
          mode: result.mode
        })
      : null;

    response.json({
      assessment: result.assessment,
      mode: result.mode,
      entry,
      publicationSkipped: input.publish && result.mode !== "live"
    });
  } catch (error) {
    const status = error instanceof ScoringError ? error.status : error.status || 400;
    response.status(status).json({ error: error.message || "The audit could not be completed." });
  }
});

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, mode: hasApiKey ? "live" : "demo" });
});

app.use((error, _request, response, _next) => {
  if (error?.type === "entity.too.large") {
    return response.status(413).json({ error: "That screenshot is too large. Keep it under 6 MB." });
  }
  console.error(error);
  response.status(500).json({ error: "The evidence locker jammed. Try again." });
});

app.listen(port, (error) => {
  if (error) {
    console.error(`LARPmaxxing could not listen on port ${port}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`LARPmaxxing listening on ${appUrl} (${hasApiKey ? `live via ${model}` : "demo mode"})`);
});

function validateSubmission(body = {}) {
  if (body.consent !== true) throw httpError("Confirm that the screenshot can be sent for analysis.", 400);
  if (typeof body.imageData !== "string") throw httpError("Choose a desktop screenshot first.", 400);

  const match = body.imageData.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw httpError("Use a PNG, JPEG, or WebP screenshot.", 415);

  const imageBuffer = Buffer.from(match[2], "base64");
  const byteLength = imageBuffer.byteLength;
  if (byteLength > 6 * 1024 * 1024) throw httpError("That screenshot is too large. Keep it under 6 MB.", 413);
  if (byteLength < 500) throw httpError("That image does not contain enough evidence.", 400);
  if (!hasExpectedSignature(match[1], imageBuffer)) throw httpError("That file does not match its image type.", 415);

  const xHandle = cleanHandle(body.xHandle);
  const displayName = cleanName(body.displayName, xHandle);
  const width = clampDimension(body.imageMeta?.width);
  const height = clampDimension(body.imageMeta?.height);

  return {
    imageData: body.imageData,
    fileName: cleanFileName(body.fileName),
    imageMeta: { width, height },
    xHandle,
    displayName,
    publish: body.publish === true
  };
}

function cleanHandle(value) {
  if (!value) return "";
  const handle = String(value).trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    throw httpError("Enter a valid X handle without the URL.", 400);
  }
  return handle;
}

function cleanName(value, handle) {
  const name = String(value || handle || "Anonymous LARPer").replace(/[<>]/g, "").trim();
  return name.slice(0, 32) || "Anonymous LARPer";
}

function cleanFileName(value) {
  return String(value || "desktop.png").replace(/[^A-Za-z0-9._ -]/g, "").slice(0, 80);
}

function clampDimension(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(20_000, Math.round(number))) : 0;
}

function hasExpectedSignature(mime, buffer) {
  if (mime === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mime === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === "image/webp") {
    return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
