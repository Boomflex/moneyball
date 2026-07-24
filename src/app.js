import { WORKBOOK_MODEL } from "./model.js";
import { applyLeagueOverrides } from "./league-overrides.js";
import { analyzeImport, inferImportRole, parseCsv, rowGetter } from "./importer.js";
import {
  allRoleStatColumns,
  percentileForStat,
  valueForStat,
  recalcRows,
  roleById,
  roleSheetRows,
  roleStatColumns,
  similarPlayers,
  statColumnKey,
} from "./scoring.js";
import { csvCell, escapeHtml, mean } from "./utils.js";
import { fmt, formatStatValue, importReportCard, labelFor, metricCompare, playerSelectors, radar, table } from "./ui.js";

const SCOUT_STORAGE_KEY = "moneyball.scoutRecords.v1";
const DATABASE_VIEWS_STORAGE_KEY = "moneyball.databaseViews.v1";
const SQUAD_STORAGE_KEY = "moneyball.squadBaseline.v1";
const DATABASE_STATUSES = ["New", "Watch", "Scout", "Saved", "Ignore"];
const DATABASE_PRIORITIES = ["", "A", "B", "C"];
let initialStorageWarning = "";

const model = applyLeagueOverrides(WORKBOOK_MODEL);
const roles = model.roles;
const app = document.getElementById("app");

const state = {
  rows: [],
  players: [],
  activeTab: "Import",
  roleFilter: "All",
  search: "",
  minMinutes: 0,
  ageMin: 15,
  ageMax: 45,
  minScore: 0,
  selectedA: null,
  selectedB: null,
  sortKey: "totalVfm",
  sortDir: "desc",
  importRole: null,
  importRoleLocked: false,
  importReport: null,
  showEmptyRoles: false,
  roleSheetMode: "simple",
  roleSheetFilters: {},
  openRoleSheetFilter: null,
  databaseDivision: "All",
  databaseVisibleStats: [],
  databaseStatPicker: "",
  databaseFilters: {},
  openDatabaseFilter: null,
  databaseStatus: "Active",
  databasePriority: "All",
  databaseDeal: "All",
  scoutRecords: loadScoutRecords(),
  databaseViews: loadDatabaseViews(),
  squadBaseline: loadSquadBaseline(),
  databaseViewName: "",
  databaseSavedView: "",
  leaderStat: "",
  storageWarning: initialStorageWarning,
};

const tabs = [
  { id: "Import", label: "Import" },
  { id: "Database", label: "Database" },
  { id: "Role Sheets", label: "Role Sheets" },
  { id: "Compare", label: "Compare" },
  { id: "Squad Planner", label: "Squad Planner" },
  { id: "Model", label: "Model" },
];

function setTab(tab) {
  state.activeTab = tab;
  render();
}

function setRows(rows) {
  state.rows = rows;
  const importRole = inferImportRole(rows, roles);
  state.importRole = importRole.id;
  state.importRoleLocked = importRole.locked;
  state.importReport = analyzeImport(rows, roles, importRole);
  state.players = recalcRows({ rows, roles, importRole: state.importRole, importRoleLocked: state.importRoleLocked });
  state.selectedA = state.players[0]?.id ?? null;
  state.selectedB = state.players[1]?.id ?? null;
  state.sortKey = "totalVfm";
  state.sortDir = "desc";
  state.databaseDivision = "All";
  state.databaseFilters = {};
  state.openDatabaseFilter = null;
  state.databaseStatus = "Active";
  state.databasePriority = "All";
  state.databaseDeal = "All";
  state.activeTab = "Database";
  render();
}

function filteredPlayers() {
  const q = state.search.trim().toLowerCase();
  const filtered = state.players.filter((item) => {
    const roleMatch = state.roleFilter === "All" || item.role === state.roleFilter;
    const minutesMatch = !state.minMinutes || (item.minutes ?? 0) >= state.minMinutes;
    const ageMatch = item.age === null || item.age === undefined ? state.ageMin === 15 && state.ageMax === 45 : item.age >= state.ageMin && item.age <= state.ageMax;
    const scoreMatch = !state.minScore || item.bestScore >= state.minScore;
    const searchMatch = !q || [item.player, item.division, item.bestRole, item.archetype, item.dealFlag].join(" ").toLowerCase().includes(q);
    return roleMatch && minutesMatch && ageMatch && scoreMatch && searchMatch;
  });
  return sortedRows(filtered);
}

function activeColumnFilterCount(filters) {
  return Object.values(filters || {}).filter((filter) => filter && (filter.min !== "" || filter.max !== "")).length;
}

function activeRoleSheetFilterCount() {
  return activeColumnFilterCount(state.roleSheetFilters);
}

function activeDatabaseFilterCount() {
  return activeColumnFilterCount(state.databaseFilters);
}

function loadScoutRecords() {
  try {
    const raw = localStorage.getItem(SCOUT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    initialStorageWarning = "Saved scouting notes could not be loaded from browser storage.";
    return {};
  }
}

function saveScoutRecords() {
  try {
    localStorage.setItem(SCOUT_STORAGE_KEY, JSON.stringify(state.scoutRecords));
    state.storageWarning = "";
  } catch {
    state.storageWarning = "Scouting notes could not be saved. Browser storage may be blocked or full.";
  }
}

function loadDatabaseViews() {
  try {
    const raw = localStorage.getItem(DATABASE_VIEWS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((view) => view?.name) : [];
  } catch {
    initialStorageWarning = "Saved database views could not be loaded from browser storage.";
    return [];
  }
}

function saveDatabaseViews() {
  try {
    localStorage.setItem(DATABASE_VIEWS_STORAGE_KEY, JSON.stringify(state.databaseViews));
    state.storageWarning = "";
  } catch {
    state.storageWarning = "Database views could not be saved. Browser storage may be blocked or full.";
  }
}
function buildSquadBaseline(rows, metadata = {}) {
  const importRole = inferImportRole(rows, roles);
  return {
    name: metadata.name || "Current squad",
    savedAt: metadata.savedAt || new Date().toISOString(),
    rows,
    importRole: importRole.id,
    importRoleLocked: importRole.locked,
    importReport: analyzeImport(rows, roles, importRole),
    players: recalcRows({ rows, roles, importRole: importRole.id, importRoleLocked: importRole.locked }),
  };
}

function loadSquadBaseline() {
  try {
    const raw = localStorage.getItem(SQUAD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.rows) ? buildSquadBaseline(parsed.rows, parsed) : null;
  } catch {
    initialStorageWarning = "Saved squad baseline could not be loaded from browser storage.";
    return null;
  }
}

function saveSquadBaseline() {
  try {
    if (!state.squadBaseline) {
      localStorage.removeItem(SQUAD_STORAGE_KEY);
      state.storageWarning = "";
      return;
    }
    const { name, savedAt, rows } = state.squadBaseline;
    localStorage.setItem(SQUAD_STORAGE_KEY, JSON.stringify({ name, savedAt, rows }));
    state.storageWarning = "";
  } catch {
    state.storageWarning = "Squad baseline could not be saved. Browser storage may be blocked or full.";
  }
}

function setSquadRows(rows, name = "Current squad") {
  state.squadBaseline = buildSquadBaseline(rows, { name });
  saveSquadBaseline();
  state.activeTab = "Squad Planner";
  render();
}

function databaseViewSnapshot(name) {
  return {
    name,
    roleFilter: state.roleFilter,
    search: state.search,
    minMinutes: state.minMinutes,
    ageMin: state.ageMin,
    ageMax: state.ageMax,
    minScore: state.minScore,
    sortKey: state.sortKey,
    sortDir: state.sortDir,
    databaseDivision: state.databaseDivision,
    databaseVisibleStats: [...state.databaseVisibleStats],
    databaseFilters: { ...state.databaseFilters },
    databaseStatus: state.databaseStatus,
    databasePriority: state.databasePriority,
    databaseDeal: state.databaseDeal,
    leaderStat: state.leaderStat,
  };
}

function applySavedDatabaseView(name) {
  const view = state.databaseViews.find((item) => item.name === name);
  if (!view) return;
  state.roleFilter = view.roleFilter || "All";
  state.search = view.search || "";
  state.minMinutes = Number(view.minMinutes) || 0;
  state.ageMin = Number(view.ageMin) || 15;
  state.ageMax = Number(view.ageMax) || 45;
  state.minScore = Number(view.minScore) || 0;
  state.sortKey = view.sortKey || "totalVfm";
  state.sortDir = view.sortDir === "asc" ? "asc" : "desc";
  state.databaseDivision = view.databaseDivision || "All";
  state.databaseVisibleStats = Array.isArray(view.databaseVisibleStats) ? view.databaseVisibleStats : [];
  state.databaseFilters = view.databaseFilters || {};
  state.databaseStatus = view.databaseStatus || "Active";
  state.databasePriority = view.databasePriority || "All";
  state.databaseDeal = view.databaseDeal || "All";
  state.leaderStat = view.leaderStat || state.leaderStat;
  state.databaseSavedView = name;
  state.databaseViewName = name;
  state.openDatabaseFilter = null;
  render();
}

function saveCurrentDatabaseView() {
  const name = state.databaseViewName.trim();
  if (!name) return;
  const next = databaseViewSnapshot(name);
  state.databaseViews = [...state.databaseViews.filter((view) => view.name !== name), next].sort((a, b) => a.name.localeCompare(b.name));
  state.databaseSavedView = name;
  state.databaseViewName = name;
  saveDatabaseViews();
  render();
}

function deleteSavedDatabaseView() {
  if (!state.databaseSavedView) return;
  state.databaseViews = state.databaseViews.filter((view) => view.name !== state.databaseSavedView);
  state.databaseSavedView = "";
  saveDatabaseViews();
  render();
}
function scoutRecord(playerOrId) {
  const id = typeof playerOrId === "string" ? playerOrId : playerOrId?.id;
  const legacyId = typeof playerOrId === "string" ? null : playerOrId?.legacyId;
  const record = state.scoutRecords[id] || (legacyId ? state.scoutRecords[legacyId] : null) || {};
  return {
    status: DATABASE_STATUSES.includes(record.status) ? record.status : "New",
    priority: DATABASE_PRIORITIES.includes(record.priority) ? record.priority : "",
    notes: String(record.notes || ""),
  };
}

function updateScoutRecord(id, patch) {
  const next = { ...scoutRecord(id), ...patch };
  state.scoutRecords = { ...state.scoutRecords, [id]: next };
  saveScoutRecords();
}

function databaseStatusCounts(players) {
  const counts = Object.fromEntries(DATABASE_STATUSES.map((status) => [status, 0]));
  for (const player of players) counts[player.scoutStatus || scoutRecord(player).status] += 1;
  return counts;
}

function databaseDealOptions(players) {
  return [...new Set(players.map((item) => item.dealFlag).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function statusWeight(status) {
  return { Saved: 5, Scout: 4, Watch: 3, New: 2, Ignore: 1 }[status] || 0;
}

function priorityWeight(priority) {
  return { A: 3, B: 2, C: 1 }[priority] || 0;
}

function bestScoutRecord(entries) {
  const records = entries.map((entry) => scoutRecord(entry));
  return records.reduce((best, record) => {
    if (statusWeight(record.status) !== statusWeight(best.status)) return statusWeight(record.status) > statusWeight(best.status) ? record : best;
    if (priorityWeight(record.priority) !== priorityWeight(best.priority)) return priorityWeight(record.priority) > priorityWeight(best.priority) ? record : best;
    if (!best.notes && record.notes) return record;
    return best;
  }, records[0] || scoutRecord(null));
}

function bestDealFlag(entries) {
  const flags = entries.map((entry) => entry.dealFlag).filter(Boolean);
  for (const preferred of ["FREE - bargain", "Great value", "Fair price", "Free agent", "No league data", "Overpriced"]) {
    if (flags.includes(preferred)) return preferred;
  }
  return flags[0] || "";
}

function databasePlayerRecords(players) {
  const groups = new Map();
  for (const player of players) {
    const key = player.source || player.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(player);
  }

  return [...groups.values()].map((entries) => {
    const sorted = [...entries].sort((a, b) => b.bestScore - a.bestScore || b.totalVfm - a.totalVfm);
    const primary = sorted[0];
    const record = bestScoutRecord(sorted);
    const roleSummary = sorted.map((entry) => `${entry.role} ${fmt(entry.bestScore)}`).join(" / ");
    return {
      ...primary,
      modelRank: Math.min(...sorted.map((entry) => entry.rank).filter(Number.isFinite)),
      matchedRoles: roleSummary,
      roleCount: sorted.length,
      scoutStatus: record.status,
      priority: record.priority,
      notes: record.notes,
      dealFlag: bestDealFlag(sorted),
      roleEntries: sorted,
    };
  });
}
function databasePassesScoutFilters(player) {
  const record = scoutRecord(player);
  const statusMatch = state.databaseStatus === "All"
    || (state.databaseStatus === "Active" ? record.status !== "Ignore" : record.status === state.databaseStatus);
  const priorityMatch = state.databasePriority === "All"
    || (state.databasePriority === "Unset" ? !record.priority : record.priority === state.databasePriority);
  const dealMatch = state.databaseDeal === "All" || player.dealFlag === state.databaseDeal;
  return statusMatch && priorityMatch && dealMatch;
}

function databaseRows(players) {
  return players;
}

function databaseCompactSummary(players, visiblePlayers) {
  const counts = databaseStatusCounts(players);
  const confidence = Math.round((state.importReport?.coverage || 0) * 100);
  const role = state.importReport?.detectedRole || "Import";
  const avgScore = mean(visiblePlayers.map((item) => item.bestScore));
  const valueFlags = visiblePlayers.filter((item) => item.dealFlag === "Great value" || item.dealFlag === "FREE - bargain").length;
  const missing = state.importReport?.missingFields?.length || 0;
  return `<section class="database-compact-summary" aria-label="Database summary">
    <article><span>Import</span><strong>${escapeHtml(role)} ${confidence}%</strong></article>
    <article><span>Players</span><strong>${visiblePlayers.length}</strong></article>
    <article><span>Avg score</span><strong>${fmt(avgScore)}</strong></article>
    <article><span>Value flags</span><strong>${valueFlags}</strong></article>
    <article><span>Saved / scout</span><strong>${counts.Saved} / ${counts.Scout}</strong></article>
    <article><span>Checks</span><strong>${missing ? `${missing} missing` : "Matched"}</strong></article>
  </section>`;
}

function databaseToolDrawer() {
  return `<details class="database-tool-drawer">
    <summary><span>Saved views</span><strong>${state.databaseViews.length} saved view${state.databaseViews.length === 1 ? "" : "s"}</strong></summary>
    <section class="database-utility-grid saved-only">${databaseSavedViewsPanel()}</section>
  </details>`;
}
function databaseViewButtons() {
  const isActive = (view) => {
    if (view === "active") return state.databaseStatus === "Active" && state.databasePriority === "All" && state.databaseDeal === "All";
    if (view === "shortlist") return state.databaseStatus === "Saved";
    if (view === "scout") return state.databaseStatus === "Scout";
    if (view === "watch") return state.databaseStatus === "Watch";
    if (view === "value") return state.databaseStatus === "Active" && ["Great value", "FREE - bargain"].includes(state.databaseDeal);
    return false;
  };
  const views = [
    ["active", "Active pool"],
    ["shortlist", "Shortlist"],
    ["scout", "Scout next"],
    ["watch", "Watchlist"],
    ["value", "Value finds"],
  ];
  return `<div class="database-views" aria-label="Database views">
    ${views.map(([view, label]) => `<button class="${isActive(view) ? "active" : ""}" data-database-view="${view}" type="button">${label}</button>`).join("")}
  </div>`;
}

function applyDatabaseView(view) {
  if (view === "active") {
    state.databaseStatus = "Active";
    state.databasePriority = "All";
    state.databaseDeal = "All";
  } else if (view === "shortlist") {
    state.databaseStatus = "Saved";
    state.databasePriority = "All";
    state.databaseDeal = "All";
  } else if (view === "scout") {
    state.databaseStatus = "Scout";
    state.databasePriority = "All";
    state.databaseDeal = "All";
  } else if (view === "watch") {
    state.databaseStatus = "Watch";
    state.databasePriority = "All";
    state.databaseDeal = "All";
  } else if (view === "value") {
    state.databaseStatus = "Active";
    state.databasePriority = "All";
    state.databaseDeal = "Great value";
  }
  state.databaseSavedView = "";
  state.openDatabaseFilter = null;
  render();
}

function squadPlayersForRole(roleId) {
  return (state.squadBaseline?.players || [])
    .filter((item) => item.role === roleId)
    .sort((a, b) => b.bestScore - a.bestScore);
}

function upgradeCall(candidate, incumbent) {
  if (!candidate) return "No candidates";
  if (!incumbent) return "Squad gap";
  const gap = candidate.bestScore - incumbent.bestScore;
  if (gap >= 5) return "Clear upgrade";
  if (gap >= 1) return "Possible upgrade";
  if (gap >= -2) return "Comparable depth";
  return "Depth only";
}

function squadPlannerRows() {
  return roles.map((role) => {
    const players = filteredPlayers().filter((item) => item.role === role.id);
    const ranked = [...players].sort((a, b) => b.bestScore - a.bestScore);
    const top = ranked[0];
    const squad = squadPlayersForRole(role.id);
    const incumbent = squad[0];
    const saved = players.filter((item) => scoutRecord(item).status === "Saved").length;
    const scout = players.filter((item) => scoutRecord(item).status === "Scout").length;
    const watch = players.filter((item) => scoutRecord(item).status === "Watch").length;
    const greatValue = players.filter((item) => item.dealFlag === "Great value" || item.dealFlag === "FREE - bargain").length;
    const scoreGap = top && incumbent ? top.bestScore - incumbent.bestScore : null;
    const action = upgradeCall(top, incumbent);
    return {
      role: role.id,
      squadCount: squad.length,
      squadBest: incumbent?.player || "",
      squadBestScore: incumbent?.bestScore ?? null,
      candidates: players.length,
      savedCount: saved,
      scoutCount: scout,
      watchCount: watch,
      greatValueCount: greatValue,
      topCandidate: top?.player || "",
      bestRole: top?.bestRole || "",
      bestScore: top?.bestScore ?? null,
      scoreGap,
      avgScore: mean(players.map((item) => item.bestScore)),
      action,
    };
  });
}

function squadUpgradeRows() {
  return roles.map((role) => {
    const candidates = filteredPlayers().filter((item) => item.role === role.id).sort((a, b) => b.bestScore - a.bestScore);
    const candidate = candidates[0];
    const incumbent = squadPlayersForRole(role.id)[0];
    return {
      role: role.id,
      squadPlayer: incumbent?.player || "",
      squadScore: incumbent?.bestScore ?? null,
      candidate: candidate?.player || "",
      candidateScore: candidate?.bestScore ?? null,
      scoreGap: candidate && incumbent ? candidate.bestScore - incumbent.bestScore : null,
      candidateDivision: candidate?.division || "",
      candidateValue: candidate?.actualValue ?? null,
      dealFlag: candidate?.dealFlag || "",
      upgradeCall: upgradeCall(candidate, incumbent),
    };
  }).sort((a, b) => (b.scoreGap ?? -999) - (a.scoreGap ?? -999));
}
function filterComparableValue(row, col) {
  const value = row[col];
  if (value && typeof value === "object" && "value" in value) {
    if (!Number.isFinite(value.value)) return null;
    return String(value.label || "").includes("%") ? value.value * 100 : value.value;
  }
  return Number.isFinite(value) ? value : null;
}

function applyColumnFilters(rows, columns, filters = state.roleSheetFilters) {
  const active = columns.map((col) => [col, filters[col]]).filter(([, filter]) => filter && (filter.min !== "" || filter.max !== ""));
  if (!active.length) return rows;
  return rows.filter((row) => active.every(([col, filter]) => {
    const value = filterComparableValue(row, col);
    if (value === null) return false;
    const min = filter.min === "" ? null : Number(filter.min);
    const max = filter.max === "" ? null : Number(filter.max);
    if (Number.isFinite(min) && value < min) return false;
    if (Number.isFinite(max) && value > max) return false;
    return true;
  }));
}
function sortValue(row, key) {
  const value = row[key];
  if (value && typeof value === "object" && "value" in value) return value.value ?? "";
  return value ?? "";
}

function sortedRows(rows) {
  const dir = state.sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = sortValue(a, state.sortKey);
    const bv = sortValue(b, state.sortKey);
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}


function databaseStatOptions() {
  const roleIds = new Set(filteredPlayers().map((item) => item.role));
  const selectedRoles = roles.filter((role) => state.roleFilter === "All" ? roleIds.has(role.id) : role.id === state.roleFilter);
  const byHeader = new Map();
  for (const role of selectedRoles) {
    for (const stat of allRoleStatColumns(role)) {
      if (!byHeader.has(stat.header)) byHeader.set(stat.header, stat);
    }
  }
  return [...byHeader.values()];
}

function databaseSelectedStats(options) {
  const available = new Map(options.map((stat) => [stat.header, stat]));
  const selected = state.databaseVisibleStats
    .filter((header) => available.has(header))
    .slice(0, 12)
    .map((header) => available.get(header));
  if (selected.length) return selected;
  const preferred = [
    "Average Rating",
    "Goals Per 90",
    "Non Penalty xGoals Per 90",
    "xAssists Per 90",
    "Chances Created Per 90",
    "Progressive Passes Per 90",
    "Tackles Completed Per 90",
    "Tackle Completion %",
  ];
  const defaults = preferred.filter((header) => available.has(header)).map((header) => available.get(header));
  return (defaults.length ? defaults : options).slice(0, 8);
}

function databaseSavedViewsPanel() {
  const options = state.databaseViews.map((view) => `<option value="${escapeHtml(view.name)}" ${state.databaseSavedView === view.name ? "selected" : ""}>${escapeHtml(view.name)}</option>`).join("");
  return `<section class="utility-panel saved-views-panel">
    <div class="panel-head compact"><div><span>Custom views</span><h2>Saved Database Views</h2></div></div>
    <div class="saved-view-controls">
      <label>Saved view
        <select id="databaseSavedView"><option value="">Choose view</option>${options}</select>
      </label>
      <div class="database-actions">
        <button class="ghost" id="applyDatabaseView" type="button">Apply</button>
        <button class="ghost" id="deleteDatabaseView" type="button">Delete</button>
      </div>
      <label>View name
        <input id="databaseViewName" value="${escapeHtml(state.databaseViewName)}" placeholder="e.g. U21 value CBs" />
      </label>
      <button class="primary" id="saveDatabaseView" type="button">Save current view</button>
    </div>
  </section>`;
}

function statLeaderRows(players, stat, limit = 10) {
  if (!stat) return [];
  return players
    .map((player) => {
      const value = valueForStat(rowGetter(player.source), stat);
      return { player, value };
    })
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => stat.direction < 0 ? a.value - b.value : b.value - a.value)
    .slice(0, limit)
    .map((item, index) => ({
      rank: index + 1,
      player: item.player.player,
      role: item.player.role,
      bestRole: item.player.bestRole,
      division: item.player.division,
      leaderValue: {
        value: item.value,
        __html: escapeHtml(formatStatValue({ label: stat.header, value: item.value })),
      },
      bestScore: item.player.bestScore,
      dealFlag: item.player.dealFlag,
    }));
}

function statLeadersPanel(statOptions, rows, selectedStat) {
  const options = statOptions.map((stat) => `<option value="${escapeHtml(stat.header)}" ${state.leaderStat === stat.header ? "selected" : ""}>${escapeHtml(labelFor(statColumnKey(stat)))}</option>`).join("");
  const direction = selectedStat?.direction < 0 ? "Lower is better" : "Higher is better";
  return `<section class="utility-panel stat-leaders-panel">
    <div class="panel-head compact"><div><span>Stat leaders</span><h2>${escapeHtml(selectedStat ? labelFor(statColumnKey(selectedStat)) : "Stat Leaders")}</h2></div><strong>${escapeHtml(direction)}</strong></div>
    <label>Metric
      <select id="leaderStat">${options}</select>
    </label>
    ${table(rows, ["rank", "player", "role", "bestRole", "division", "leaderValue", "bestScore", "dealFlag"], "leader-table")}
  </section>`;
}

function databaseUtilityPanels(statOptions, leaderRows, selectedStat) {
  return `<section class="database-utility-grid">
    ${databaseSavedViewsPanel()}
    ${statLeadersPanel(statOptions, leaderRows, selectedStat)}
  </section>`;
}
function databaseDivisionOptions(players) {
  return [...new Set(players.map((item) => item.division).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function csvValue(row, col) {
  const value = row[col];
  if (value && typeof value === "object" && "value" in value) return value.value ?? "";
  return value ?? "";
}

function toCsvColumns(rows, columns) {
  return [columns.map((col) => csvCell(labelFor(col))).join(","), ...rows.map((row) => columns.map((col) => csvCell(csvValue(row, col))).join(","))].join("\n");
}
function download(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function storageNotice() {
  if (!state.storageWarning) return "";
  return `<section class="notice storage-notice" role="status">
    <strong>Save warning</strong>
    <span>${escapeHtml(state.storageWarning)}</span>
    <button class="ghost" data-dismiss-storage-warning type="button">Dismiss</button>
  </section>`;
}

function renderShell(content, options = {}) {
  const showControls = options.showControls ?? state.activeTab !== "Import";
  const showImportReport = options.showImportReport ?? state.activeTab !== "Import";
  const workspaceClass = options.workspaceClass ? ` workspace-${options.workspaceClass}` : "";
  app.innerHTML = `
    <header class="app-header">
      <div class="brand-block">
        <div class="brand-mark"><img src="assets/moneyballlogo.png" alt="Moneyball logo" /></div>
        <div>
          <span>Moneyball</span>
          <strong>Recruitment Desk</strong>
          <small>E14 workbook model locked</small>
        </div>
      </div>
      <nav class="tabs" aria-label="Primary">
        ${tabs.map((tab) => `<button class="${state.activeTab === tab.id ? "active" : ""}" data-tab="${tab.id}">${tab.label}</button>`).join("")}
      </nav>
      <aside class="credits-bar">Spreadsheet by <a href="https://x.com/MattFitz94" target="_blank" rel="noopener noreferrer">Matt Fitzgerald</a> and <a href="https://x.com/Thecultof" target="_blank" rel="noopener noreferrer">Jack</a> from <a href="https://www.youtube.com/@TheCultofFM" target="_blank" rel="noopener noreferrer">TheCultofFM</a>; additional ideas from <a href="https://x.com/nstntly" target="_blank" rel="noopener noreferrer">Willum</a></aside>
    </header>
    <main class="workspace${workspaceClass}">
      ${storageNotice()}
      ${showControls ? controls() : ""}
      ${showImportReport ? importReportCard(state.importReport) : ""}
      ${content}
    </main>
  `;
  bindGlobal();
}

function scoreSliderMax() {
  const topScore = Math.max(100, ...state.players.map((player) => Number(player.bestScore) || 0));
  return Math.ceil(topScore / 10) * 10;
}

function controls() {
  const showEmpty = state.activeTab === "Role Sheets";
  const roleSheetFilterCount = activeRoleSheetFilterCount();
  const scoreMax = scoreSliderMax();
  const roleSheetTools = state.activeTab === "Role Sheets" ? `<div class="segmented role-sheet-mode" aria-label="Role sheet mode">
    <button id="roleSheetSimple" class="${state.roleSheetMode === "simple" ? "active" : ""}" type="button">Simple</button>
    <button id="roleSheetDetailed" class="${state.roleSheetMode === "detailed" ? "active" : ""}" type="button">Detailed</button>
  </div>
  ${roleSheetFilterCount ? `<button class="ghost clear-filters" id="clearRoleSheetFilters" type="button">Clear ${roleSheetFilterCount} filter${roleSheetFilterCount === 1 ? "" : "s"}</button>` : ""}` : "";
  return `
    <section class="controls">
      <label>Role
        <select id="roleFilter">
          <option>All</option>
          ${roles.map((role) => `<option ${state.roleFilter === role.id ? "selected" : ""}>${role.id}</option>`).join("")}
        </select>
      </label>
      <label>Search
        <input id="search" type="search" value="${escapeHtml(state.search)}" placeholder="Player, league, role, flag" />
      </label>
      <div class="range-filter age-filter">
        <div class="range-head"><span>Age range</span><strong id="ageRangeLabel">${state.ageMin}-${state.ageMax}</strong></div>
        <div class="range-row dual">
          <input id="ageMin" type="range" min="15" max="45" step="1" value="${state.ageMin}" aria-label="Minimum age" />
          <input id="ageMax" type="range" min="15" max="45" step="1" value="${state.ageMax}" aria-label="Maximum age" />
        </div>
      </div>
      <div class="range-filter">
        <div class="range-head"><span>Minutes</span><strong id="minutesLabel">${state.minMinutes}+</strong></div>
        <input id="minutes" type="range" min="0" max="5000" step="100" value="${state.minMinutes}" aria-label="Minimum minutes" />
      </div>
      <div class="range-filter">
        <div class="range-head"><span>Score</span><strong id="scoreLabel">${fmt(state.minScore)}+</strong></div>
        <input id="scoreMin" type="range" min="0" max="${scoreMax}" step="0.5" value="${Math.min(state.minScore, scoreMax)}" aria-label="Minimum score" />
      </div>
      ${showEmpty ? `<label class="check"><input id="showEmptyRoles" type="checkbox" ${state.showEmptyRoles ? "checked" : ""} /> Show empty roles</label>` : ""}
      ${roleSheetTools}
    </section>
  `;
}

function bindGlobal() {
  app.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tab)));
  app.querySelector("[data-dismiss-storage-warning]")?.addEventListener("click", () => { state.storageWarning = ""; render(); });
  app.querySelector("#roleFilter")?.addEventListener("change", (event) => { state.roleFilter = event.target.value; render(); });
  app.querySelector("#search")?.addEventListener("input", (event) => {
    const caret = event.target.selectionStart;
    state.search = event.target.value;
    render();
    restoreInputFocus("#search", caret);
  });
  bindSlider("#ageMin", (input) => {
    state.ageMin = Math.min(Number(input.value) || 15, state.ageMax);
    input.value = state.ageMin;
  });
  bindSlider("#ageMax", (input) => {
    state.ageMax = Math.max(Number(input.value) || 45, state.ageMin);
    input.value = state.ageMax;
  });
  bindSlider("#minutes", (input) => { state.minMinutes = Number(input.value) || 0; });
  bindSlider("#scoreMin", (input) => { state.minScore = Number(input.value) || 0; });
  syncRangeLabels();
  app.querySelector("#showEmptyRoles")?.addEventListener("change", (event) => { state.showEmptyRoles = event.target.checked; render(); });
  app.querySelector("#roleSheetSimple")?.addEventListener("click", () => { state.roleSheetMode = "simple"; state.openRoleSheetFilter = null; render(); });
  app.querySelector("#roleSheetDetailed")?.addEventListener("click", () => { state.roleSheetMode = "detailed"; state.openRoleSheetFilter = null; render(); });
  app.querySelector("#clearRoleSheetFilters")?.addEventListener("click", () => { state.roleSheetFilters = {}; state.openRoleSheetFilter = null; render(); });
}

function bindSlider(selector, update) {
  const input = app.querySelector(selector);
  if (!input) return;
  input.addEventListener("input", () => {
    update(input);
    syncRangeLabels();
  });
  input.addEventListener("change", () => render());
}

function syncRangeLabels() {
  const ageLabel = app.querySelector("#ageRangeLabel");
  const minutesLabel = app.querySelector("#minutesLabel");
  const scoreLabel = app.querySelector("#scoreLabel");
  if (ageLabel) ageLabel.textContent = `${state.ageMin}-${state.ageMax}`;
  if (minutesLabel) minutesLabel.textContent = `${state.minMinutes}+`;
  if (scoreLabel) scoreLabel.textContent = `${fmt(state.minScore)}+`;
}

function restoreInputFocus(selector, caret) {
  const input = app.querySelector(selector);
  if (!input) return;
  input.focus();
  if (Number.isInteger(caret)) input.setSelectionRange(caret, caret);
}

function renderImport() {
  const content = `
    <section class="import-hero">
      <div class="hero-copy">
        <span>FM26 CSV intake</span>
        <h1>Import FM26 CSV export.</h1>
        <p>Drop a squad or role file and the workbook model will build the database, role sheets, compare views, and squad planner.</p>
      </div>
      <div class="hero-metrics" aria-label="Model coverage">
        <article><span>Roles</span><strong>${roles.length}</strong></article>
        <article><span>Archetypes</span><strong>${model.archetypes.length}</strong></article>
        <article><span>Score maps</span><strong>${roles.reduce((sum, role) => sum + role.scoreColumns.length, 0)}</strong></article>
      </div>
    </section>
    <section class="import-grid">
      <section class="dropzone" id="dropzone">
        <div class="upload-icon"><span>CSV</span></div>
        <div>
          <h2>Drop FM export</h2>
          <p>Role-specific files are detected and checked against the workbook model.</p>
        </div>
        <input class="sr-only" id="fileInput" type="file" accept=".csv,text/csv" />
        <label class="file-picker" for="fileInput">Browse export</label>
        <small id="fileStatus">No file selected</small>
      </section>
      <section class="schema-panel">
        <div class="panel-head compact"><div><span>Workbook coverage</span><h2>Input maps</h2></div></div>
        <div class="schema-list">
          ${roles.map((role) => `<details><summary>${role.id}<small>${role.rawHeaders.length} inputs / ${role.scoreColumns.length} scores</small></summary><p>${role.rawHeaders.join(", ")}</p></details>`).join("")}
        </div>
      </section>
    </section>
  `;
  renderShell(content);
  const fileInput = app.querySelector("#fileInput");
  const dropzone = app.querySelector("#dropzone");
  fileInput.addEventListener("change", () => {
    updateFileStatus(fileInput.files[0]);
    importFile(fileInput.files[0]);
  });
  dropzone.addEventListener("dragover", (event) => { event.preventDefault(); dropzone.classList.add("dragging"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragging"));
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragging");
    const file = event.dataTransfer.files[0];
    updateFileStatus(file);
    importFile(file);
  });
}

function updateFileStatus(file) {
  const status = app.querySelector("#fileStatus");
  if (status) status.textContent = file?.name || "No file selected";
}

function importFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setRows(parseCsv(String(reader.result)));
  reader.readAsText(file);
}


function rolesWithRows() {
  if (state.roleFilter !== "All") return [roleById(roles, state.roleFilter)].filter(Boolean);
  if (state.showEmptyRoles || !state.players.length) return roles;
  const roleIds = new Set(filteredPlayers().map((item) => item.role));
  return roles.filter((role) => roleIds.has(role.id));
}

function renderPlayerDatabase() {
  const baseEntries = filteredPlayers();
  const basePlayers = databasePlayerRecords(baseEntries);
  const divisionOptions = databaseDivisionOptions(basePlayers);
  if (state.databaseDivision !== "All" && !divisionOptions.includes(state.databaseDivision)) state.databaseDivision = "All";

  const divisionPlayers = state.databaseDivision === "All"
    ? basePlayers
    : basePlayers.filter((item) => item.division === state.databaseDivision);
  const dealOptions = databaseDealOptions(divisionPlayers);
  if (state.databaseDeal !== "All" && !dealOptions.includes(state.databaseDeal)) state.databaseDeal = "All";

  const databasePlayers = divisionPlayers.filter(databasePassesScoutFilters);
  const columns = ["scoutStatus", "priority", "player", "bestRole", "matchedRoles", "division", "age", "minutes", "bestScore", "controlScore", "valueRatio", "actualValue", "actualWage", "dealFlag", "notes"];
  const fullRows = databaseRows(databasePlayers);
  const filteredRows = applyColumnFilters(fullRows, columns, state.databaseFilters);
  const rows = sortedRows(filteredRows);
  const filterCount = activeDatabaseFilterCount();
  const filterableColumns = ["age", "minutes", "bestScore", "controlScore", "valueRatio", "actualValue", "actualWage"];
  const noteCount = basePlayers.filter((player) => player.notes).length;

  renderShell(`
    ${databaseCompactSummary(basePlayers, databasePlayers)}
    <section class="panel database-panel compact-database-panel">
      <div class="panel-head">
        <div><span>Scouting CRM</span><h2>Player Database</h2></div>
        <div class="toolbar">
          ${filterCount ? `<button class="ghost" id="clearDatabaseFilters" type="button">Clear ${filterCount} filter${filterCount === 1 ? "" : "s"}</button>` : ""}
          <button class="ghost" id="resetScouting" type="button">Reset scouting</button>
          <button class="ghost" id="exportDatabase" type="button">Export current view</button>
        </div>
      </div>
      ${databaseViewButtons()}
      <div class="database-tools database-scout-tools database-crm-tools">
        <label>Status
          <select id="databaseStatus">
            ${["Active", "All", ...DATABASE_STATUSES].map((status) => `<option ${state.databaseStatus === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
          </select>
        </label>
        <label>Priority
          <select id="databasePriority">
            ${["All", "Unset", "A", "B", "C"].map((priority) => `<option ${state.databasePriority === priority ? "selected" : ""}>${escapeHtml(priority)}</option>`).join("")}
          </select>
        </label>
        <label>Deal flag
          <select id="databaseDeal">
            <option>All</option>
            ${dealOptions.map((deal) => `<option ${state.databaseDeal === deal ? "selected" : ""}>${escapeHtml(deal)}</option>`).join("")}
          </select>
        </label>
        <label>Division
          <select id="databaseDivision">
            <option>All</option>
            ${divisionOptions.map((division) => `<option ${state.databaseDivision === division ? "selected" : ""}>${escapeHtml(division)}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="database-summary"><strong>${rows.length}</strong> of ${divisionPlayers.length} players shown / ${baseEntries.length} role entries / ${noteCount} saved notes</div>
      ${databaseToolDrawer()}
      ${table(rows, columns, "database-table database-crm-table", { filterableColumns, filters: state.databaseFilters, openFilter: state.openDatabaseFilter })}
    </section>
  `, { showImportReport: false, workspaceClass: "database" });
  bindTable();
  bindDatabaseControls(rows, columns);
}
function bindDatabaseControls(rows, columns) {
  app.querySelectorAll("[data-database-view]").forEach((button) => button.addEventListener("click", () => applyDatabaseView(button.dataset.databaseView)));
  app.querySelector("#databaseSavedView")?.addEventListener("change", (event) => { state.databaseSavedView = event.target.value; });
  app.querySelector("#databaseViewName")?.addEventListener("input", (event) => { state.databaseViewName = event.target.value; });
  app.querySelector("#applyDatabaseView")?.addEventListener("click", () => applySavedDatabaseView(state.databaseSavedView));
  app.querySelector("#deleteDatabaseView")?.addEventListener("click", deleteSavedDatabaseView);
  app.querySelector("#saveDatabaseView")?.addEventListener("click", saveCurrentDatabaseView);
  app.querySelector("#leaderStat")?.addEventListener("change", (event) => {
    state.leaderStat = event.target.value;
    render();
  });
  app.querySelector("#databaseStatus")?.addEventListener("change", (event) => {
    state.databaseStatus = event.target.value;
    state.openDatabaseFilter = null;
    render();
  });
  app.querySelector("#databasePriority")?.addEventListener("change", (event) => {
    state.databasePriority = event.target.value;
    state.openDatabaseFilter = null;
    render();
  });
  app.querySelector("#databaseDeal")?.addEventListener("change", (event) => {
    state.databaseDeal = event.target.value;
    state.openDatabaseFilter = null;
    render();
  });
  app.querySelector("#databaseDivision")?.addEventListener("change", (event) => {
    state.databaseDivision = event.target.value;
    state.openDatabaseFilter = null;
    render();
  });
  app.querySelector("#databaseStatPicker")?.addEventListener("change", (event) => { state.databaseStatPicker = event.target.value; });
  app.querySelector("#addDatabaseStat")?.addEventListener("click", () => {
    if (!state.databaseStatPicker || state.databaseVisibleStats.includes(state.databaseStatPicker)) return;
    state.databaseVisibleStats = [...state.databaseVisibleStats, state.databaseStatPicker].slice(0, 12);
    state.openDatabaseFilter = null;
    render();
  });
  app.querySelector("#resetDatabaseStats")?.addEventListener("click", () => {
    state.databaseVisibleStats = [];
    state.openDatabaseFilter = null;
    render();
  });
  app.querySelectorAll("[data-db-remove-stat]").forEach((button) => button.addEventListener("click", () => {
    const header = button.dataset.dbRemoveStat;
    state.databaseVisibleStats = state.databaseVisibleStats.filter((item) => item !== header);
    state.openDatabaseFilter = null;
    render();
  }));
  app.querySelector("#clearDatabaseFilters")?.addEventListener("click", () => {
    state.databaseFilters = {};
    state.openDatabaseFilter = null;
    render();
  });
  app.querySelector("#resetScouting")?.addEventListener("click", () => {
    if (!confirm("Clear all saved statuses, priorities and notes?")) return;
    state.scoutRecords = {};
    saveScoutRecords();
    render();
  });
  app.querySelectorAll("[data-scout-status]").forEach((select) => select.addEventListener("change", (event) => {
    updateScoutRecord(select.dataset.scoutStatus, { status: event.target.value });
    render();
  }));
  app.querySelectorAll("[data-scout-priority]").forEach((select) => select.addEventListener("change", (event) => {
    updateScoutRecord(select.dataset.scoutPriority, { priority: event.target.value });
    render();
  }));
  app.querySelectorAll("[data-scout-notes]").forEach((input) => input.addEventListener("change", (event) => {
    updateScoutRecord(input.dataset.scoutNotes, { notes: event.target.value });
  }));
  app.querySelector("#exportDatabase")?.addEventListener("click", () => download("moneyball-player-database.csv", toCsvColumns(rows, columns)));
}
function renderSquadPlanner() {
  const rows = squadPlannerRows();
  const upgrades = squadUpgradeRows();
  const squad = state.squadBaseline;
  const clearUpgrades = upgrades.filter((row) => row.upgradeCall === "Clear upgrade" || row.upgradeCall === "Possible upgrade").length;
  const squadRoles = new Set((squad?.players || []).map((item) => item.role)).size;
  const savedDate = squad?.savedAt ? new Date(squad.savedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Not saved";
  renderShell(`
    <section class="squad-baseline-grid">
      <section class="squad-baseline-strip">
        <div class="panel-head compact"><div><span>Current squad baseline</span><h2>Saved Squad</h2></div></div>
        <div class="squad-summary">
          <article><span>Rows</span><strong>${squad?.rows.length || 0}</strong></article>
          <article><span>Role entries</span><strong>${squad?.players.length || 0}</strong></article>
          <article><span>Roles covered</span><strong>${squadRoles}</strong></article>
          <article><span>Saved</span><strong>${escapeHtml(savedDate)}</strong></article>
        </div>
        <div class="toolbar squad-upload-actions">
          <input class="sr-only" id="squadFileInput" type="file" accept=".csv,text/csv" />
          <label class="file-picker" for="squadFileInput">Upload squad CSV</label>
          ${squad ? `<button class="ghost" id="clearSquadBaseline" type="button">Clear squad</button>` : ""}
        </div>
        <p class="lede">Your saved squad stays in this browser and is used as the comparison baseline for upgrade calls.</p>
      </section>
      <section class="panel squad-upgrade-panel">
        <div class="panel-head compact">
          <div><span>Upgrade radar</span><h2>Best Candidate vs Squad</h2></div>
          <strong>${clearUpgrades} upgrade flags</strong>
        </div>
        ${squad ? table(upgrades, ["role", "squadPlayer", "squadScore", "candidate", "candidateScore", "scoreGap", "candidateDivision", "candidateValue", "dealFlag", "upgradeCall"], "upgrade-table", { rowClass: (row) => ["Clear upgrade", "Possible upgrade"].includes(row.upgradeCall) ? "upgrade-row" : "" }) : `<div class="empty">Upload your squad CSV to unlock upgrade comparisons.</div>`}
      </section>
    </section>
    <section class="panel squad-planner-panel">
      <div class="panel-head">
        <div><span>Role coverage</span><h2>Squad Planner</h2></div>
        <strong>${state.players.length} recruitment entries / ${squad?.players.length || 0} squad entries</strong>
      </div>
      ${table(rows, ["role", "squadCount", "squadBest", "squadBestScore", "candidates", "savedCount", "scoutCount", "watchCount", "greatValueCount", "topCandidate", "bestRole", "bestScore", "scoreGap", "avgScore", "action"], "planner-table")}
    </section>
  `, { showControls: false, showImportReport: false });
  bindTable();
  bindSquadPlannerControls();
}

function bindSquadPlannerControls() {
  app.querySelector("#squadFileInput")?.addEventListener("change", (event) => importSquadFile(event.target.files[0]));
  app.querySelector("#clearSquadBaseline")?.addEventListener("click", () => {
    if (!confirm("Clear the saved squad baseline from this browser?")) return;
    state.squadBaseline = null;
    saveSquadBaseline();
    render();
  });
}

function importSquadFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setSquadRows(parseCsv(String(reader.result)), file.name.replace(/\.csv$/i, ""));
  reader.readAsText(file);
}
function renderRoleSheets() {
  const sections = rolesWithRows().map((role) => {
    const rows = filteredPlayers().filter((item) => item.role === role.id);
    const statColumns = state.roleSheetMode === "detailed" ? allRoleStatColumns(role) : roleStatColumns(role, rows);
    const columns = ["player", "division", "minutes", "age", "bestRole", "bestScore", "controlScore", ...statColumns.map(statColumnKey), "expectedValue", "actualValue", "valueRatio", "dealFlag"];
    const avg = mean(rows.map((item) => item.bestScore));
    const filterableColumns = columns.filter((col) => !["player", "division", "bestRole", "dealFlag"].includes(col));
    const fullRoleRows = roleSheetRows(rows, statColumns);
    const filteredRoleRows = applyColumnFilters(fullRoleRows, columns);
    const roleRows = sortedRows(filteredRoleRows);
    const filteredCopy = filteredRoleRows.length === fullRoleRows.length ? `${rows.length} players` : `${filteredRoleRows.length} of ${rows.length} players`;
    return `<section class="panel role-panel">
      <div class="panel-head"><div><span>${role.rawHeaders.length} source columns / ${role.scoreColumns.length} score columns / ${state.roleSheetMode}</span><h2>${role.id}</h2></div><strong>${filteredCopy} / avg ${fmt(avg)}</strong></div>
      ${table(roleRows, columns, "role-table", { filterableColumns, filters: state.roleSheetFilters, openFilter: state.openRoleSheetFilter })}
    </section>`;
  }).join("");
  renderShell(`<section class="stack">${sections || `<div class="empty">No role sheets match the current filters.</div>`}</section>`);
  bindTable();
}

function renderCompare() {
  const players = filteredPlayers();
  const a = players.find((item) => item.id === state.selectedA) || players[0];
  const b = players.find((item) => item.id === state.selectedB) || players[1] || players[0];
  const role = roleById(roles, a?.role || "GK");
  const statsForRole = role?.scoreColumns.find((score) => a?.bestRole && score.label.includes(a.bestRole))?.stats || role?.scoreColumns[0]?.stats || [];
  const selectedStats = statsForRole.slice(0, 12).map((stat) => ({
    label: stat.header,
    a: percentileForStat(a, stat, role, state.players),
    b: percentileForStat(b, stat, role, state.players),
    aValue: a ? valueForStat(rowGetter(a.source), stat) : null,
    bValue: b ? valueForStat(rowGetter(b.source), stat) : null,
  }));
  const peers = similarPlayers(a, state.players, roles).slice(0, 16);
  renderShell(`
    <section class="compare-grid">
      ${playerSelectors(players, a, b)}
      <section class="panel chart-panel">
        <div class="panel-head"><div><span>${escapeHtml(role?.id || "Role")}</span><h2>Player Compare</h2></div></div>
        ${radar(selectedStats)}
      </section>
      <section class="panel stat-panel">
        <div class="panel-head"><div><span>Percentile rank</span><h2>Weighted metrics</h2></div></div>
        ${metricCompare(selectedStats, a, b)}
      </section>
      <section class="panel similarity-panel">
        <div class="panel-head"><div><span>${escapeHtml(a?.archetype || "Profile")}</span><h2>Similar Players</h2></div></div>
        ${a ? `<p class="lede">${escapeHtml(a.player)} profiles as ${escapeHtml(a.archetype)}. Similarity uses the same weighted metrics as the selected role score.</p>` : ""}
        ${table(peers, ["rank", "player", "role", "bestRole", "archetype", "division", "similarity", "bestScore", "dealFlag"], "similarity-table")}
      </section>
    </section>
  `);
  bindSelectors();
  bindTable();
}
function renderModel() {
  const selectedRoles = state.roleFilter === "All" ? roles : [roleById(roles, state.roleFilter)].filter(Boolean);
  const leagueSections = selectedRoles.map((role) => {
    const rows = Object.entries(role.leagues)
      .filter(([, league]) => league.strength)
      .sort((a, b) => b[1].strength - a[1].strength)
      .slice(0, 40)
      .map(([league, data], index) => ({ rank: index + 1, league, strength: data.strength }));
    return `<section class="panel"><div class="panel-head"><div><span>League baseline</span><h2>${role.id}</h2></div></div>${table(rows, ["rank", "league", "strength"])}</section>`;
  }).join("");
  const archetypes = state.roleFilter === "All" ? model.archetypes : model.archetypes.filter((item) => item.role === state.roleFilter);
  renderShell(`
    <section class="model-layout">
      <section class="stack model-standards">${leagueSections}</section>
      <section class="panel model-guide control-model-card">
        <div class="panel-head"><div><span>Experimental model</span><h2>Control Score</h2></div></div>
        <div class="guide-grid compact-guide">
          <article class="guide-card">
            <span>Creation</span>
            <h2>xA quality</h2>
            <p>xAssists multiplied by xAssists divided by open-play key passes, then scaled by 67.5.</p>
            <small>Rewards higher-quality chance creation over pure pass volume.</small>
          </article>
          <article class="guide-card">
            <span>Scoring</span>
            <h2>Shot quality</h2>
            <p>Goals multiplied by expected goals divided by shots, then scaled by 54.</p>
            <small>Balances output with shooting efficiency.</small>
          </article>
          <article class="guide-card">
            <span>Pressure</span>
            <h2>Press efficiency</h2>
            <p>Pressures won multiplied by pressures won divided by pressures attempted, then scaled by 2.23.</p>
            <small>Requires pressure attempted data when available.</small>
          </article>
          <article class="guide-card">
            <span>Possession</span>
            <h2>Control adjustment</h2>
            <p>Possession won is scaled, then the raw total is adjusted by possession lost rate and league strength.</p>
            <small>Valid rows are normalised so the imported role average sits around 100.</small>
          </article>
        </div>
      </section>
      <section class="panel model-guide">
        <div class="panel-head"><div><span>Workbook guide</span><h2>Archetypes</h2></div></div>
        <div class="guide-grid compact-guide">
          ${archetypes.map((item) => `
            <article class="guide-card">
              <span>${escapeHtml(item.role)}</span>
              <h2>${escapeHtml(item.archetype)}</h2>
              <p>${escapeHtml(item.meaning)}</p>
              <small>${escapeHtml(item.metrics)}</small>
            </article>
          `).join("")}
        </div>
      </section>
    </section>
  `);
  bindTable();
}
function bindSelectors() {
  const a = app.querySelector("#selectedA");
  const b = app.querySelector("#selectedB");
  if (a) {
    a.value = state.selectedA || "";
    a.addEventListener("change", () => { state.selectedA = a.value; render(); });
  }
  if (b) {
    b.value = state.selectedB || "";
    b.addEventListener("change", () => { state.selectedB = b.value; render(); });
  }
}

function bindTable() {
  const databaseTable = state.activeTab === "Database";
  app.querySelectorAll("[data-sort]").forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.sort;
    state.sortDir = state.sortKey === key && state.sortDir === "desc" ? "asc" : "desc";
    state.sortKey = key;
    render();
  }));

  app.querySelectorAll("[data-filter-toggle]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const key = button.dataset.filterToggle;
    if (databaseTable) state.openDatabaseFilter = state.openDatabaseFilter === key ? null : key;
    else state.openRoleSheetFilter = state.openRoleSheetFilter === key ? null : key;
    render();
  }));

  app.querySelectorAll(".table-wrap tbody tr").forEach((row) => row.addEventListener("click", (event) => {
    if (event.target.closest("button, input, select, textarea, a, label")) return;
    const table = row.closest("table");
    table?.querySelectorAll("tbody tr.selected-row").forEach((selected) => selected.classList.remove("selected-row"));
    row.classList.add("selected-row");
  }));

  app.querySelectorAll("[data-filter-popover]").forEach((popover) => popover.addEventListener("click", (event) => event.stopPropagation()));
  app.querySelectorAll("[data-filter-apply]").forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.filterApply;
    const minInput = [...app.querySelectorAll("[data-filter-min]")].find((input) => input.dataset.filterMin === key);
    const maxInput = [...app.querySelectorAll("[data-filter-max]")].find((input) => input.dataset.filterMax === key);
    const filter = { min: minInput?.value.trim() ?? "", max: maxInput?.value.trim() ?? "" };
    if (databaseTable) {
      state.databaseFilters = { ...state.databaseFilters, [key]: filter };
      state.openDatabaseFilter = null;
    } else {
      state.roleSheetFilters = { ...state.roleSheetFilters, [key]: filter };
      state.openRoleSheetFilter = null;
    }
    render();
  }));
  app.querySelectorAll("[data-filter-clear]").forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.filterClear;
    if (databaseTable) {
      const next = { ...state.databaseFilters };
      delete next[key];
      state.databaseFilters = next;
      state.openDatabaseFilter = null;
    } else {
      const next = { ...state.roleSheetFilters };
      delete next[key];
      state.roleSheetFilters = next;
      state.openRoleSheetFilter = null;
    }
    render();
  }));
}
function render() {
  if (state.activeTab === "Import") renderImport();
  else if (state.activeTab === "Database") renderPlayerDatabase();
  else if (state.activeTab === "Role Sheets") renderRoleSheets();
  else if (state.activeTab === "Compare") renderCompare();
  else if (state.activeTab === "Squad Planner") renderSquadPlanner();
  else renderModel();
}
render();
