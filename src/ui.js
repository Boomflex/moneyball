import { escapeHtml } from "./utils.js";

export const nf = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
export const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export function fmt(value) {
  return Number.isFinite(value) ? nf.format(value) : "";
}

export function compactStatLabel(label) {
  return label
    .replace(" Per 90", "/90")
    .replace(" Completion", " Comp")
    .replace("Percentage", "%")
    .replace("Progressive", "Prog")
    .replace("Possession", "Poss")
    .replace("Interceptions", "Ints")
    .replace("Tackles Completed", "Tackles")
    .replace("Headers Won", "Headers")
    .replace("Average Rating", "Rating")
    .replace("Open Play Cross", "Cross")
    .replace("Mistakes Leading To Goal", "Mistakes");
}

export function formatStatValue(stat) {
  if (!Number.isFinite(stat.value)) return "";
  if (stat.label.includes("%")) return `${nf.format(stat.value * 100)}%`;
  return nf.format(stat.value);
}

export function formatStatCell(stat) {
  if (!stat || !Number.isFinite(stat.value)) return "";
  return escapeHtml(formatStatValue(stat));
}

export function flagClass(value) {
  if (value === "Great value" || value === "FREE - bargain") return "flag good";
  if (value === "Overpriced") return "flag bad";
  return "flag";
}

export function upgradeClass(value) {
  if (["At benchmark", "Strong benchmark closer", "Benchmark closer", "Clear upgrade", "Possible upgrade", "Squad gap"].includes(value)) return "flag good";
  if (["Below benchmark", "No closer", "Depth only"].includes(value)) return "flag bad";
  return "flag";
}
export function labelFor(col) {
  return {
    totalVfm: "TOTAL VFM",
    bestScore: "Score",
    controlScore: "Control",
    controlCoverage: "Control conf",
    bestRole: "Role fit",
    matchedRoles: "Role scores",
    roleCount: "Roles",
    actualValue: "Actual value",
    expectedValue: "Exp value",
    valueRatio: "VFM",
    actualWage: "Actual wage",
    expectedWage: "Exp wage",
    dealFlag: "Deal flag",
    scoutStatus: "Status",
    priority: "Priority",
    notes: "Notes",
    modelRank: "Model rank",
    candidates: "Candidates",
    savedCount: "Saved",
    scoutCount: "Scout",
    watchCount: "Watch",
    greatValueCount: "Value flags",
    squadCount: "Your roles",
    squadBest: "Your best",
    squadBestScore: "Your score",
    benchmarkCount: "Benchmark roles",
    benchmarkBest: "Benchmark best",
    benchmarkScore: "Benchmark score",
    benchmarkPlayer: "Benchmark player",
    benchmarkGap: "Your vs benchmark",
    topCandidate: "Top candidate",
    squadPlayer: "Your player",
    squadScore: "Your score",
    candidate: "Candidate",
    candidateScore: "Candidate score",
    scoreGap: "Candidate vs yours",
    candidateBenchmarkGap: "Candidate vs benchmark",
    candidateDivision: "Division",
    candidateValue: "Value",
    upgradeCall: "Upgrade call",
    avgScore: "Avg score",
    action: "Action",
    leaderValue: "Value",
    playerA: "Player A",
    playerB: "Player B",
  }[col] || (col.startsWith("stat:") ? compactStatLabel(col.slice(5)) : col.replace(/[A-Z]/g, (m) => ` ${m}`).replace(/^./, (m) => m.toUpperCase()));
}

function optionList(options, selected) {
  return options.map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option || "-")}</option>`).join("");
}

function scoutStatusCell(row, value) {
  return `<select class="row-select status-${escapeHtml(String(value || "New").toLowerCase())}" data-scout-status="${escapeHtml(row.id)}">${optionList(["New", "Watch", "Scout", "Saved", "Ignore"], value || "New")}</select>`;
}

function priorityCell(row, value) {
  return `<select class="row-select priority-${escapeHtml(String(value || "unset").toLowerCase())}" data-scout-priority="${escapeHtml(row.id)}">${optionList(["", "A", "B", "C"], value || "")}</select>`;
}

function notesCell(row, value) {
  return `<input class="row-note" data-scout-notes="${escapeHtml(row.id)}" value="${escapeHtml(value || "")}" placeholder="Add note" />`;
}

export function formatCell(row, col) {
  const value = row[col];
  if (value && typeof value === "object" && "__html" in value) return value.__html;
  if (col === "scoutStatus") return scoutStatusCell(row, value);
  if (col === "priority") return priorityCell(row, value);
  if (col === "notes") return notesCell(row, value);
  if (col.startsWith("stat:")) return formatStatCell(value);
  if (["actualValue", "expectedValue", "actualWage", "expectedWage", "candidateValue"].includes(col)) return value ? money.format(value) : "";
  if (["bestScore", "controlScore", "totalVfm", "valueRatio", "wageRatio", "strength", "squadBestScore", "squadScore", "benchmarkScore", "candidateScore", "scoreGap", "benchmarkGap", "candidateBenchmarkGap", "avgScore"].includes(col)) return value === null || value === undefined ? "" : fmt(value);
  if (col === "controlCoverage") return Number.isFinite(value) ? `${fmt(value * 100)}%` : "";
  if (["player", "dealFlag", "archetype", "upgradeCall"].includes(col)) return `<span class="${col === "dealFlag" ? flagClass(value) : col === "upgradeCall" ? upgradeClass(value) : ""}">${escapeHtml(value ?? "")}</span>`;
  return escapeHtml(value ?? "");
}

export function table(rows, columns, className = "", options = {}) {
  if (!rows.length) return `<div class="empty">No rows yet.</div>`;
  return `<div class="table-wrap"><table class="${className}">
    <thead><tr>${columns.map((col) => headerCell(col, options)).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr${rowClassAttr(row, options)}${rowAttrs(row, options)}>${columns.map((col) => `<td>${formatCell(row, col)}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}

function rowClassAttr(row, options) {
  const value = typeof options.rowClass === "function" ? options.rowClass(row) : "";
  return value ? ` class="${escapeHtml(value)}"` : "";
}

function rowAttrs(row, options) {
  const attrs = typeof options.rowAttributes === "function" ? options.rowAttributes(row) : {};
  return Object.entries(attrs || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== false)
    .map(([key, value]) => ` ${escapeHtml(key)}="${escapeHtml(value === true ? "" : value)}"`)
    .join("");
}

function headerCell(col, options) {
  const filterable = options.filterableColumns?.includes(col);
  const filter = options.filters?.[col] || {};
  const hasFilter = filter.min !== "" && filter.min !== undefined || filter.max !== "" && filter.max !== undefined;
  const open = options.openFilter === col;
  const sortable = options.sortable !== false;
  return `<th>
    <div class="th-tools">
      ${sortable ? `<button data-sort="${escapeHtml(col)}">${labelFor(col)}</button>` : `<span>${labelFor(col)}</span>`}
      ${filterable ? `<button class="filter-toggle ${hasFilter ? "is-active" : ""}" data-filter-toggle="${escapeHtml(col)}" aria-label="Filter ${escapeHtml(labelFor(col))}">v</button>` : ""}
    </div>
    ${open ? filterPopover(col, filter) : ""}
  </th>`;
}

function filterPopover(col, filter) {
  return `<div class="column-filter" data-filter-popover="${escapeHtml(col)}">
    <label>Min<input data-filter-min="${escapeHtml(col)}" type="number" step="any" value="${escapeHtml(filter.min ?? "")}" /></label>
    <label>Max<input data-filter-max="${escapeHtml(col)}" type="number" step="any" value="${escapeHtml(filter.max ?? "")}" /></label>
    <div>
      <button data-filter-apply="${escapeHtml(col)}">Apply</button>
      <button data-filter-clear="${escapeHtml(col)}">Clear</button>
    </div>
  </div>`;
}

export function statCards({ rows, players, filteredPlayers, mean }) {
  const great = filteredPlayers.filter((item) => item.dealFlag === "Great value" || item.dealFlag === "FREE - bargain").length;
  const avgScore = mean(filteredPlayers.map((item) => item.bestScore));
  return `
    <section class="stats">
      <article><span>Imported rows</span><strong>${rows.length}</strong></article>
      <article><span>Role entries</span><strong>${players.length}</strong></article>
      <article><span>Average score</span><strong>${fmt(avgScore)}</strong></article>
      <article><span>Value flags</span><strong>${great}</strong></article>
    </section>
  `;
}

export function importReportCard(report) {
  if (!report?.rowCount) return "";
  const confidence = Math.round((report.coverage || 0) * 100);
  const topRoles = report.roleCoverages.slice(0, 3).map((item) => `${item.role} ${Math.round(item.coverage * 100)}%`).join(" / ");
  const missing = report.missingFields.slice(0, 6).map(escapeHtml).join(", ");
  const derived = report.derivedFields.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<section class="import-report ${confidence >= 75 ? "good" : "warn"}">
    <div>
      <span>Import confidence</span>
      <strong>${escapeHtml(report.detectedRole || "Unclassified")} ${confidence}%</strong>
      <small>${escapeHtml(report.sourceColumnCount)} source columns / ${escapeHtml(report.matchedFields.length)} matched score fields</small>
    </div>
    <div>
      <span>Role coverage</span>
      <strong>${escapeHtml(topRoles || "No role coverage")}</strong>
      <small>${report.locked ? "Role locked from export shape" : "Role can still use position hints"}</small>
    </div>
    <div>
      <span>Checks</span>
      <strong>${report.missingFields.length ? `${report.missingFields.length} missing score fields` : "All score fields matched"}</strong>
      <small>${missing || "No missing score inputs for detected role"}</small>
    </div>
    ${derived ? `<ul>${derived}</ul>` : ""}
  </section>`;
}

export function playerSelectors(players, a, b) {
  const groups = players.reduce((map, item) => {
    const source = item.compareSource || "Recruitment";
    if (!map.has(source)) map.set(source, []);
    map.get(source).push(item);
    return map;
  }, new Map());
  const options = [...groups.entries()].map(([source, items]) => `
    <optgroup label="${escapeHtml(source)}">
      ${items.map((item) => `<option value="${escapeHtml(item.compareKey || item.id)}">${escapeHtml(item.player)} - ${escapeHtml(item.role)} / ${escapeHtml(item.bestRole || "")}</option>`).join("")}
    </optgroup>`).join("");
  return `<section class="selectors">
    <label>Player A<select id="selectedA"><option></option>${options}</select></label>
    <label>Player B<select id="selectedB"><option></option>${options}</select></label>
    ${playerSummaryCard(a, "Selected")}
    ${playerSummaryCard(b, "Compare")}
  </section>`;
}

export function playerSummaryCard(player, label) {
  const source = player?.compareSource ? `${player.compareSource} / ` : "";
  return `<article class="player-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(player?.player || "No player")}</strong><small>${escapeHtml(source)}${escapeHtml(player?.bestRole || "")}${player?.bestScore ? ` / ${fmt(player.bestScore)}` : ""}</small></article>`;
}

export function metricCompare(rows, a, b) {
  if (!rows.length) return `<div class="empty">Import data to compare metrics.</div>`;
  const nameA = a?.player || "Player A";
  const nameB = b?.player || "Player B";
  return `<div class="metric-compare">
    ${rows.map((row) => metricCompareRow(row, nameA, nameB)).join("")}
  </div>`;
}

function metricCompareRow(row, nameA, nameB) {
  return `<article class="metric-row">
    <div class="metric-title">
      <strong>${escapeHtml(compactStatLabel(row.label))}</strong>
      <span>${escapeHtml(row.label)}</span>
    </div>
    ${metricBar(nameA, row.a, "a", row.aValue, row.label)}
    ${metricBar(nameB, row.b, "b", row.bValue, row.label)}
  </article>`;
}

function metricBar(name, value, series, rawValue, label) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  const actual = Number.isFinite(rawValue) ? ` <small>(${escapeHtml(formatStatValue({ label, value: rawValue }))})</small>` : "";
  return `<div class="metric-bar-row ${series}">
    <span>${escapeHtml(name)}</span>
    <div class="metric-track"><i style="width: ${safe}%"></i></div>
    <strong>${safe}${actual}</strong>
  </div>`;
}
function polarPoint(center, radius, angle) {
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function pizzaSlicePath(center, innerRadius, outerRadius, startAngle, endAngle) {
  const outerStart = polarPoint(center, outerRadius, startAngle);
  const outerEnd = polarPoint(center, outerRadius, endAngle);
  const innerEnd = polarPoint(center, innerRadius, endAngle);
  const innerStart = polarPoint(center, innerRadius, startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function pizzaMarkerPath(center, radius, startAngle, endAngle) {
  const start = polarPoint(center, radius, startAngle);
  const end = polarPoint(center, radius, endAngle);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
}

export function percentilePizza(rows, { centerLabel = "", centerValue = "" } = {}) {
  if (!rows.length) return `<div class="empty">No percentile metrics available.</div>`;
  const size = 620;
  const center = size / 2;
  const innerRadius = 48;
  const outerRadius = 178;
  const labelRadius = 244;
  const sliceAngle = (Math.PI * 2) / rows.length;
  const gap = Math.min(0.035, sliceAngle * 0.12);
  const grid = [25, 50, 75, 100].map((value) => {
    const radius = innerRadius + (outerRadius - innerRadius) * value / 100;
    return `<circle cx="${center}" cy="${center}" r="${radius}" />`;
  }).join("");
  const slices = rows.map((row, index) => {
    const startAngle = -Math.PI / 2 + index * sliceAngle + gap;
    const endAngle = -Math.PI / 2 + (index + 1) * sliceAngle - gap;
    const midAngle = (startAngle + endAngle) / 2;
    const percentile = Math.max(1, Math.min(99, Number(row.percentile) || 0));
    const fillRadius = innerRadius + (outerRadius - innerRadius) * percentile / 100;
    const markerPercentile = Number.isFinite(row.benchmarkPercentile) ? Math.max(1, Math.min(99, row.benchmarkPercentile)) : null;
    const markerRadius = markerPercentile === null ? null : innerRadius + (outerRadius - innerRadius) * markerPercentile / 100;
    const title = `${row.label}: ${row.valueLabel || "-"}, percentile ${percentile}${markerPercentile === null ? "" : `, benchmark median ${markerPercentile}`}`;
    const labelPoint = polarPoint(center, labelRadius, midAngle);
    const cosine = Math.cos(midAngle);
    const anchor = cosine > 0.22 ? "start" : cosine < -0.22 ? "end" : "middle";
    return `<g class="pizza-slice ${escapeHtml(row.category || "possession")}">
      <title>${escapeHtml(title)}</title>
      <path class="pizza-track" d="${pizzaSlicePath(center, innerRadius, outerRadius, startAngle, endAngle)}" />
      <path class="pizza-fill" d="${pizzaSlicePath(center, innerRadius, fillRadius, startAngle, endAngle)}" />
      ${markerRadius === null ? "" : `<path class="pizza-benchmark-marker" d="${pizzaMarkerPath(center, markerRadius, startAngle + gap, endAngle - gap)}" />`}
      <text class="pizza-label" x="${labelPoint.x}" y="${labelPoint.y}" text-anchor="${anchor}">
        <tspan x="${labelPoint.x}">${escapeHtml(compactStatLabel(row.label).slice(0, 24))}</tspan>
        <tspan class="pizza-value" x="${labelPoint.x}" dy="15">${escapeHtml(row.valueLabel || "-")} / P${percentile}</tspan>
      </text>
    </g>`;
  }).join("");
  return `<div class="pizza-stage"><svg class="percentile-pizza" viewBox="0 0 ${size} ${size}" role="img" aria-label="Role percentile pizza chart">
    <g class="pizza-grid">${grid}</g>
    ${slices}
    <circle class="pizza-center" cx="${center}" cy="${center}" r="${innerRadius - 5}" />
    <text class="pizza-center-label" x="${center}" y="${center - 4}">${escapeHtml(centerLabel)}</text>
    <text class="pizza-center-value" x="${center}" y="${center + 17}">${escapeHtml(centerValue)}</text>
  </svg></div>`;
}
export function radar(rows) {
  if (!rows.length) return `<div class="empty">Import data to draw the chart.</div>`;
  const size = 460;
  const center = size / 2;
  const radius = 152;
  const pointsFor = (key) => rows.map((row, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / rows.length;
    const r = radius * (row[key] / 100);
    return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
  }).join(" ");
  const grid = [25, 50, 75, 100].map((value) => `<circle cx="${center}" cy="${center}" r="${radius * value / 100}" />`).join("");
  const labels = rows.map((row, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / rows.length;
    return `<text x="${center + Math.cos(angle) * (radius + 44)}" y="${center + Math.sin(angle) * (radius + 36)}">${escapeHtml(shortLabel(row.label))}</text>`;
  }).join("");
  return `<svg class="radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="Player percentile radar chart">
    <g class="grid">${grid}</g>
    <polygon class="series-a" points="${pointsFor("a")}"></polygon>
    <polygon class="series-b" points="${pointsFor("b")}"></polygon>
    <g class="labels">${labels}</g>
  </svg>`;
}

export function shortLabel(label) {
  return label.replace(" Per 90", "/90").replace(" Completion", " Comp").slice(0, 20);
}










