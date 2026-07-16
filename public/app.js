const state = {
  config: null,
  file: null,
  imageData: null,
  imageMeta: null,
  result: null
};

const $ = (selector) => document.querySelector(selector);
const elements = {
  form: $("#audit-form"),
  file: $("#screenshot"),
  dropZone: $("#drop-zone"),
  dropIdle: $("#drop-idle"),
  previewWrap: $("#preview-wrap"),
  preview: $("#preview"),
  previewCaption: $("#preview-caption"),
  button: $("#audit-button"),
  message: $("#form-message"),
  result: $("#result"),
  modeLabel: $("#mode-label")
};

boot();

async function boot() {
  $("#year").textContent = new Date().getFullYear();
  $("#case-number").textContent = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  wireEvents();

  try {
    const [configResponse] = await Promise.all([fetch("/api/config"), loadLeaderboard()]);
    state.config = await configResponse.json();
    renderConfig();
  } catch {
    elements.modeLabel.textContent = "Uplink unavailable";
    setMessage("The scoring service is offline. Reload after the server starts.", "error");
  }
}

function wireEvents() {
  elements.file.addEventListener("change", () => selectFile(elements.file.files[0]));
  elements.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("dragging");
  });
  elements.dropZone.addEventListener("dragleave", () => elements.dropZone.classList.remove("dragging"));
  elements.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("dragging");
    selectFile(event.dataTransfer.files[0]);
  });
  elements.form.addEventListener("submit", submitAudit);
  $("#reset-button").addEventListener("click", resetAudit);
  $("#share-button").addEventListener("click", shareResult);
}

function renderConfig() {
  const isLive = state.config.mode === "live";
  elements.modeLabel.textContent = isLive ? "Live scoring" : "Demo scoring";
  document.body.dataset.mode = state.config.mode;

  const metricList = $("#metric-list");
  metricList.innerHTML = state.config.rubric.map((item) => `
    <article class="metric-card">
      <div><h3>${escapeHtml(item.label)}</h3><strong>${item.max}<small> pts</small></strong></div>
      <p>${escapeHtml(item.description)}</p>
    </article>
  `).join("");
}

async function selectFile(file) {
  clearMessage();
  if (!file) return;
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return setMessage("Use a PNG, JPEG, or WebP screenshot.", "error");
  }
  if (file.size > 6 * 1024 * 1024) {
    return setMessage("That screenshot is over 6 MB. Compress it and try again.", "error");
  }

  try {
    const imageData = await readAsDataUrl(file);
    const imageMeta = await inspectImage(imageData);
    state.file = file;
    state.imageData = imageData;
    state.imageMeta = imageMeta;
    elements.preview.src = imageData;
    elements.previewCaption.textContent = `${file.name} · ${formatBytes(file.size)} · ${imageMeta.width}×${imageMeta.height}`;
    elements.dropIdle.hidden = true;
    elements.previewWrap.hidden = false;
    elements.dropZone.classList.add("has-preview");
  } catch {
    setMessage("That image could not be read. Try a different screenshot.", "error");
  }
}

async function submitAudit(event) {
  event.preventDefault();
  clearMessage();
  if (!state.imageData) return setMessage("Choose a desktop screenshot first.", "error");
  if (!$("#consent").checked) return setMessage("Confirm the image analysis consent to continue.", "error");

  setLoading(true);
  try {
    const response = await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageData: state.imageData,
        imageMeta: state.imageMeta,
        fileName: state.file.name,
        displayName: $("#display-name").value,
        xHandle: $("#x-handle").value,
        publish: $("#publish").checked,
        consent: true
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "The audit failed.");

    state.result = payload;
    renderResult(payload);
    if (payload.entry) await loadLeaderboard(payload.entry.id);
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    setLoading(false);
  }
}

function renderResult(payload) {
  const { assessment } = payload;
  elements.form.hidden = true;
  elements.result.hidden = false;
  $("#score-value").textContent = "0";
  $("#rank-code").textContent = assessment.band.code;
  $("#rank-name").textContent = assessment.band.name;
  $("#model-verdict").textContent = assessment.modelVerdict;
  $("#roast").textContent = `“${assessment.roast}”`;
  $("#evidence-list").innerHTML = assessment.evidence.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  $("#breakdown").innerHTML = state.config.rubric.map((item) => {
    const value = assessment.breakdown[item.key];
    const percent = Math.round((value / item.max) * 100);
    return `
      <div class="breakdown-row">
        <span>${escapeHtml(item.label)}</span>
        <div class="meter" aria-hidden="true"><i data-target="${percent}"></i></div>
        <strong>${value}<small>/${item.max}</small></strong>
      </div>`;
  }).join("");
  $("#model-note").textContent = payload.mode === "demo"
    ? "Demo score only. Add a live key before you flex it. Demo scores stay off the leaderboard."
    : "Scored from this screenshot. The image is not saved or shown publicly.";

  const shareText = buildShareText(assessment);
  $("#x-button").href = `https://twitter.com/intent/tweet?${new URLSearchParams({ text: shareText, url: location.origin })}`;
  animateResult(assessment.score);
  elements.result.scrollIntoView({ behavior: "smooth", block: "center" });
}

function animateResult(targetScore) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scoreNode = $("#score-value");
  const bars = Array.from(document.querySelectorAll(".meter i"));

  requestAnimationFrame(() => {
    bars.forEach((bar, index) => {
      const apply = () => { bar.style.width = `${bar.dataset.target}%`; };
      if (reducedMotion) apply();
      else setTimeout(apply, 140 + index * 90);
    });
  });

  if (reducedMotion) {
    scoreNode.textContent = String(targetScore);
    return;
  }

  const duration = 900;
  const startedAt = performance.now();
  const tick = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    scoreNode.textContent = String(Math.round(targetScore * eased));
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function resetAudit() {
  state.file = null;
  state.imageData = null;
  state.imageMeta = null;
  state.result = null;
  elements.form.reset();
  elements.file.value = "";
  elements.preview.removeAttribute("src");
  elements.previewWrap.hidden = true;
  elements.dropIdle.hidden = false;
  elements.dropZone.classList.remove("has-preview");
  elements.result.hidden = true;
  elements.form.hidden = false;
  clearMessage();
  elements.dropZone.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function shareResult() {
  if (!state.result) return;
  const text = buildShareText(state.result.assessment);
  if (navigator.share) {
    try {
      await navigator.share({ title: "My LARPmaxxing audit", text, url: location.origin });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  await navigator.clipboard.writeText(`${text} ${location.origin}`);
  const button = $("#share-button");
  button.textContent = "Score copied ✓";
  setTimeout(() => { button.textContent = "Copy my score"; }, 1800);
}

function buildShareText(assessment) {
  return `My desktop scored ${assessment.score}/100 on LARPmaxxing. Official diagnosis: ${assessment.band.name}.`;
}

async function loadLeaderboard(highlightId) {
  try {
    const response = await fetch("/api/leaderboard?limit=12");
    const { entries } = await response.json();
    const list = $("#leaderboard-list");
    if (!entries.length) {
      list.innerHTML = `<li class="leaderboard-empty"><strong>Nobody has embarrassed themselves yet.</strong><span>You could change that.</span></li>`;
      return;
    }
    list.innerHTML = entries.map((entry, index) => {
      const identity = entry.xHandle
        ? `<a href="https://x.com/${encodeURIComponent(entry.xHandle)}" target="_blank" rel="noopener noreferrer">@${escapeHtml(entry.xHandle)}</a>`
        : `<span>${escapeHtml(entry.band)}</span>`;
      return `
        <li class="leaderboard-entry ${entry.id === highlightId ? "is-new" : ""}">
          <span class="place">${String(index + 1).padStart(2, "0")}</span>
          <div><strong>${escapeHtml(entry.displayName)}</strong>${identity}</div>
          <b>${entry.score}</b>
        </li>`;
    }).join("");
  } catch {
    $("#leaderboard-list").innerHTML = `<li class="leaderboard-empty">The leaderboard is taking a little walk.</li>`;
  }
}

function setLoading(loading) {
  elements.button.disabled = loading;
  elements.button.classList.toggle("loading", loading);
  elements.button.querySelector("span").textContent = loading ? "Counting your agents…" : "Rate my LARP";
  elements.dropZone.classList.toggle("scanning", loading);
}

function setMessage(message, type) {
  elements.message.textContent = message;
  elements.message.dataset.type = type;
}

function clearMessage() {
  elements.message.textContent = "";
  delete elements.message.dataset.type;
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function inspectImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = source;
  });
}

function formatBytes(bytes) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = String(value ?? "");
  return node.innerHTML;
}
