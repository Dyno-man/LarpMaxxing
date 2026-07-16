const elements = {
  podium: document.querySelector("#podium-grid"),
  ranking: document.querySelector("#full-ranking"),
  search: document.querySelector("#leaderboard-search"),
  clear: document.querySelector("#clear-search"),
  status: document.querySelector("#search-status"),
  count: document.querySelector("#entry-count")
};

let entries = [];

boot();

async function boot() {
  document.querySelector("#year").textContent = new Date().getFullYear();
  elements.search.addEventListener("input", renderSearch);
  elements.clear.addEventListener("click", clearSearch);

  try {
    const response = await fetch("/api/leaderboard?limit=all");
    if (!response.ok) throw new Error("Leaderboard request failed");
    const payload = await response.json();
    entries = payload.entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
    renderPodium();
    renderRanking(entries);
    elements.count.textContent = `${entries.length} public ${entries.length === 1 ? "operator" : "operators"}`;
  } catch {
    elements.podium.innerHTML = `<li class="podium-loading">The podium uplink is unavailable.</li>`;
    elements.ranking.innerHTML = `<li class="ranking-empty">The leaderboard wandered off. Reload when the server is back.</li>`;
    elements.count.textContent = "Uplink unavailable";
  }
}

function renderPodium() {
  const leaders = entries.slice(0, 3);
  if (!leaders.length) {
    elements.podium.innerHTML = `<li class="podium-loading">No one has publicly embarrassed themselves yet.</li>`;
    return;
  }

  elements.podium.innerHTML = leaders.map((entry) => {
    const identity = entry.xHandle
      ? `<a href="https://x.com/${encodeURIComponent(entry.xHandle)}" target="_blank" rel="noopener noreferrer">@${escapeHtml(entry.xHandle)}</a>`
      : `<span>${escapeHtml(entry.band)}</span>`;
    return `
      <li class="podium-card rank-${entry.rank}">
        <span class="podium-rank">0${entry.rank}</span>
        <div class="podium-identity">
          <p>${entry.rank === 1 ? "Chief orchestration officer" : entry.rank === 2 ? "Senior agent wrangler" : "Principal terminal arranger"}</p>
          <h3>${escapeHtml(entry.displayName)}</h3>
          ${identity}
        </div>
        <strong>${entry.score}<small>/100</small></strong>
        <blockquote>“${escapeHtml(entry.roast)}”</blockquote>
      </li>`;
  }).join("");
}

function renderSearch() {
  const query = normalize(elements.search.value);
  elements.clear.hidden = !query;
  if (!query) {
    elements.status.textContent = "";
    renderRanking(entries);
    return;
  }

  const matches = entries.filter((entry) => {
    const name = normalize(entry.displayName);
    const handle = normalize(entry.xHandle || "");
    return fuzzyMatch(name, query) || fuzzyMatch(handle, query);
  });

  elements.status.textContent = matches.length
    ? `${matches.length} ${matches.length === 1 ? "operator" : "operators"} matched. Global ranks stay intact.`
    : `No public operator matches “${elements.search.value.trim()}”.`;
  renderRanking(matches, query);
}

function renderRanking(items, query = "") {
  if (!items.length) {
    elements.ranking.innerHTML = `<li class="ranking-empty">No matching LARP profile. Try fewer letters or search an X handle.</li>`;
    return;
  }

  elements.ranking.innerHTML = items.map((entry) => {
    const identity = entry.xHandle
      ? `<a href="https://x.com/${encodeURIComponent(entry.xHandle)}" target="_blank" rel="noopener noreferrer">@${escapeHtml(entry.xHandle)}</a>`
      : `<span>No public handle</span>`;
    return `
      <li class="ranking-row ${query ? "is-match" : ""}">
        <span class="ranking-place">#${entry.rank}</span>
        <div class="ranking-person"><strong>${escapeHtml(entry.displayName)}</strong>${identity}</div>
        <div class="ranking-band"><span>${escapeHtml(entry.band)}</span><small>${formatDate(entry.createdAt)}</small></div>
        <b>${entry.score}</b>
      </li>`;
  }).join("");
}

function clearSearch() {
  elements.search.value = "";
  elements.clear.hidden = true;
  elements.status.textContent = "";
  renderRanking(entries);
  elements.search.focus();
}

function fuzzyMatch(value, query) {
  if (!query) return true;
  if (value.includes(query)) return true;
  let queryIndex = 0;
  for (const character of value) {
    if (character === query[queryIndex]) queryIndex += 1;
    if (queryIndex === query.length) return true;
  }
  return false;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Audit date unknown";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = String(value ?? "");
  return node.innerHTML;
}
