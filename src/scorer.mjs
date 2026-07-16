import crypto from "node:crypto";
import { RUBRIC, normalizeAssessment } from "./metric.mjs";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function scoreDesktop({ imageData, fileName, imageMeta, apiKey, model, appUrl }) {
  if (!apiKey) {
    return {
      assessment: demoAssessment(imageData, imageMeta),
      model: "demo-simulator",
      mode: "demo"
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": appUrl,
        "X-Title": "LARPmaxxing"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 900,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "larpmaxxing_assessment",
            strict: true,
            schema: assessmentSchema()
          }
        },
        messages: [
          {
            role: "system",
            content: buildSystemPrompt()
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Audit this desktop screenshot named ${JSON.stringify(fileName)}. Be specific about only what is actually visible.`
              },
              {
                type: "image_url",
                image_url: { url: imageData }
              }
            ]
          }
        ]
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || `OpenRouter returned ${response.status}`;
      throw new ScoringError(message, response.status);
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new ScoringError("The vision model returned an empty assessment.", 502);
    }

    let raw;
    try {
      raw = JSON.parse(content);
    } catch {
      throw new ScoringError("The vision model returned an unreadable assessment.", 502);
    }

    return {
      assessment: normalizeAssessment(raw),
      model: payload.model || model,
      mode: "live"
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ScoringError("The vision audit timed out. Try again with a smaller image.", 504);
    }
    if (error instanceof ScoringError) throw error;
    throw new ScoringError("The vision service could not be reached.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export class ScoringError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function buildSystemPrompt() {
  const rubric = RUBRIC.map((item) => `- ${item.key}: 0-${item.max}. ${item.description}`).join("\n");
  return `You are the LARPmaxxing forensic auditor: funny, dry, observant, and never cruel. Score how theatrically over-engineered a person's vibe-coding desktop is. This is affectionate satire of Bay Area builder culture.

Rubric:
${rubric}

Rules:
- Judge only visible evidence. Do not infer sensitive personal traits, identity, wealth, employer, location, or private information.
- Do not repeat secrets, API keys, email addresses, message contents, file paths, or other personal text visible in the screenshot.
- A busy, redundant, ceremonial workflow scores high. A clean practical desktop scores low.
- Make the roast sharp but playful, in 1-2 sentences. No insults about the person; roast the setup.
- evidence must contain 3-7 short, non-sensitive visual observations.
- modelVerdict is one short sentence.
- Return only JSON matching the provided schema.`;
}

function assessmentSchema() {
  const properties = Object.fromEntries(
    RUBRIC.map((item) => [item.key, { type: "integer", minimum: 0, maximum: item.max }])
  );
  return {
    type: "object",
    additionalProperties: false,
    required: ["breakdown", "roast", "evidence", "modelVerdict"],
    properties: {
      breakdown: {
        type: "object",
        additionalProperties: false,
        required: RUBRIC.map((item) => item.key),
        properties
      },
      roast: { type: "string" },
      evidence: {
        type: "array",
        minItems: 3,
        maxItems: 7,
        items: { type: "string" }
      },
      modelVerdict: { type: "string" }
    }
  };
}

function demoAssessment(imageData, imageMeta = {}) {
  const hash = crypto.createHash("sha256").update(imageData.slice(-10_000)).digest();
  const wideBonus = Number(imageMeta.width) / Math.max(Number(imageMeta.height), 1) > 1.8 ? 4 : 0;
  const values = RUBRIC.map((item, index) => {
    const floor = Math.round(item.max * 0.38);
    const range = Math.max(1, item.max - floor);
    return floor + (hash[index] % range);
  });
  values[0] = Math.min(RUBRIC[0].max, values[0] + wideBonus);

  return normalizeAssessment({
    breakdown: Object.fromEntries(RUBRIC.map((item, index) => [item.key, values[index]])),
    roast: "The simulator has reviewed the pixels and found probable cause: this desktop looks one orchestration layer away from achieving sentience.",
    evidence: [
      imageMeta.width && imageMeta.height ? `${imageMeta.width}×${imageMeta.height} pixels of operational theater` : "A suspicious volume of desktop pixels",
      wideBonus ? "Cinematically wide command surface" : "Conventional display geometry, unconventional intent",
      "Screenshot submitted voluntarily as evidence"
    ],
    modelVerdict: "Demo score only—add an OpenRouter key for an actual visual audit."
  });
}
