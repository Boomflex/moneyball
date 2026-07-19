import { mean, normalise, roleIdsFromPositionText } from "./utils.js";

export const HEADER_ALIASES = new Map(Object.entries({
  "mins": ["Minutes"],
  "playername": ["Player", "Name"],
  "actualvalue": ["Transfer Value", "Value", "Actual Value (£)"],
  "actualwagewk": ["Wage", "Salary", "Actual Wage (£/wk)"],
  "averagerating": ["Rating"],
  "clearancesper90": ["Clearances per 90", "Clearences Per 90"],
  "clearencesper90": ["Clearances per 90"],
  "xgoalspreventedper90": ["xGP/90", "xG Prevented /90"],
  "expectedsave": ["Expected Save Percentage", "Exp Save %"],
  "goalsallowedper90": ["Con/90", "Goals Allowed /90"],
  "mistakesper90": ["Mistakes Leading to Goals", "Mistakes Leading To Goal Per 90"],
  "mistakesleadingtogoalper90": ["Mistakes Leading to Goals"],
  "passcompletion": ["Pass Completion Percentage"],
  "progressivepassesper90": ["Progressive Passes per 90"],
  "possessionwonper90": ["Possession Won per 90"],
  "possessionlostper90": ["Possession Lost per 90"],
  "passescompletedper90": ["Passes Completed per 90"],
  "passesattemptedper90": ["Passes Attempted per 90"],
  "interceptionsper90": ["Interceptions per 90"],
  "savesper90": ["Saves per 90"],
  "save": ["Save Percentage"],
  "saveability": ["Saves Held", "Saves Parried", "Saves Tipped"],
  "tacklecompletion": ["Tackle Completion Percentage"],
  "headerswon": ["Headers Won Percentage"],
  "headerswonper90": ["Headers Won per 90"],
  "pressurescompletedper90": ["Pressures Completed per 90", "Pres C/90"],
  "pressuresattemptedper90": ["Pres A/90"],
  "blocksper90": ["Blk/90", "Shts Blckd/90", "Blocks per 90"],
  "xassistsper90": ["xA/90", "xAssists per 90"],
  "chancescreatedper90": ["Chances Created per 90"],
  "openplaykeypassesper90": ["Open Play Key Passes per 90"],
  "conversion": ["Conv %", "Conversion Percentage"],
  "xgoalspershot": ["xG/shot", "xGoals per Shot"],
  "xgoverperformanceper90": ["xG-OP", "xG Overperformance per 90"],
  "xgoalsoverperformanceper90": ["xG-OP", "xG Overperformance per 90"],
  "shotsper90": ["Shot/90", "Shots per 90"],
  "shotsontarget": ["Shots on Target Percentage", "Shots On Target Percentage"],
  "shotsontargetper90": ["Shots on Target per 90", "Shots On Target per 90"],
  "keypassesper90": ["Open Play Key Passes per 90", "Key Passes per 90"],
  "assistsper90": ["Asts/90", "Assists per 90"],
  "openplaycrosscompletion": ["Open Play Cross Completion Percentage"],
  "openplaycrossescompletedper90": ["Open Play Crosses Completed per 90"],
  "openplaycrossesattemptedper90": ["Open Play Crosses Attempted per 90"],
  "dribblesmadeper90": ["Dribbles per 90", "Dribbles Made per 90"],
  "sprintsper90": ["Sprints/90", "Sprints per 90"],
  "tacklescompletedper90": ["Tackles Completed per 90"],
  "foulsmadeper90": ["Fouls Made", "Fouls Made per 90"],
  "foulsper90": ["Fouls Made", "Fouls per 90"],
  "goalsper90": ["Goals per 90 minutes", "Goals per 90"],
  "nonpenaltyxgoalsper90": ["NP-xG/90", "Non Penalty xGoals per 90"],
  "distanceper90": ["Dist/90"],
}));

export const safeNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text === "-") return null;
  const parts = text.split(/\s+-\s+/).map(parseCompactNumber).filter(Number.isFinite);
  if (parts.length > 1) return mean(parts);
  return parts[0] ?? null;
};

export function parseCompactNumber(value) {
  const text = String(value)
    .replace(/[\u00a3\u00c2,$]/g, "")
    .replace(/\bp\/w\b/gi, "")
    .replace(/%$/, "")
    .trim();
  if (!text || text === "-" || /^n\/?a$/i.test(text) || /^not for sale$/i.test(text)) return null;
  const match = text.match(/^(-?\d+(?:\.\d+)?)([kmb])?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const suffix = match[2]?.toLowerCase();
  const multiplier = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : 1;
  return amount * multiplier;
}

export function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((delimiter) => ({
    delimiter,
    count: firstLine.split(delimiter).length - 1,
  }));
  return counts.sort((a, b) => b.count - a.count)[0]?.delimiter || ",";
}

export function parseCsv(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let cell = "";
  let quote = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quote && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quote = !quote;
    } else if (char === delimiter && !quote) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quote) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((item) => item.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((item) => item.trim() !== "")) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map((header) => header.trim());
  const parsed = rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
  normaliseImportedScales(parsed);
  return parsed;
}

function normaliseImportedScales(rows) {
  const first = rows[0];
  if (!first) return;
  const saveAbilityKey = Object.keys(first).find((key) => normalise(key) === "saveability");
  if (!saveAbilityKey) return;

  const values = rows.map((row) => safeNumber(row[saveAbilityKey])).filter(Number.isFinite);
  if (!values.length) return;
  const max = Math.max(...values);
  const highShare = values.filter((value) => value > 10).length / values.length;
  if (max < 50 && highShare < 0.25) return;

  for (const row of rows) {
    const value = safeNumber(row[saveAbilityKey]);
    if (!Number.isFinite(value)) continue;
    row[saveAbilityKey] = fmtScale(value / 10);
    addNormalizationNote(row, "Save Ability scaled from 0-100 to 0-10 for workbook scoring");
  }
}

function fmtScale(value) {
  return Number(value.toFixed(2)).toString();
}

function addNormalizationNote(row, note) {
  const notes = row.__moneyballNormalizations || [];
  if (!notes.includes(note)) notes.push(note);
  Object.defineProperty(row, "__moneyballNormalizations", {
    value: notes,
    enumerable: false,
    configurable: true,
  });
}

export function rowGetter(row) {
  const lookup = new Map(Object.keys(row).map((key) => [normalise(key), key]));
  return (header) => {
    const names = [header, ...(HEADER_ALIASES.get(normalise(header)) || [])];
    for (const name of names) {
      const key = lookup.get(normalise(name));
      if (key && row[key] !== undefined && row[key] !== "") return row[key];
    }
    return "";
  };
}

export function headerMatches(headers, header) {
  const names = [header, ...(HEADER_ALIASES.get(normalise(header)) || [])];
  return names.some((name) => headers.has(normalise(name)));
}

export function scoreHeadersForRole(role) {
  return [...new Set(role.scoreColumns.flatMap((score) => score.stats.map((stat) => stat.header)))];
}

export function roleCoverage(rows, roles) {
  const headers = new Set(rows.flatMap((row) => Object.keys(row).map(normalise)));
  return roles.map((role) => {
    const scoreHeaders = scoreHeadersForRole(role);
    const matched = scoreHeaders.filter((header) => headerMatches(headers, header));
    const missing = scoreHeaders.filter((header) => !headerMatches(headers, header));
    const coverage = scoreHeaders.length ? matched.length / scoreHeaders.length : 0;
    return { role, coverage, matched, missing };
  }).sort((a, b) => b.coverage - a.coverage);
}

function positionRoleCoverage(rows, roles) {
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const counts = new Map();
  let rowsWithPosition = 0;

  for (const row of rows) {
    const get = rowGetter(row);
    const text = [get("Best Position"), get("Other Positions"), get("Position"), get("Role")].join(" ");
    const ids = [...new Set(roleIdsFromPositionText(text).filter((id) => roleById.has(id)))];
    if (!ids.length) continue;
    rowsWithPosition += 1;
    ids.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
  }

  const ranked = [...counts.entries()]
    .map(([id, count]) => ({ role: roleById.get(id), count, share: rows.length ? count / rows.length : 0 }))
    .sort((a, b) => b.count - a.count);
  return { rowsWithPosition, coveredShare: rows.length ? rowsWithPosition / rows.length : 0, ranked };
}
export function inferImportRole(rows, roles) {
  const candidates = roleCoverage(rows, roles);
  const positionCoverage = positionRoleCoverage(rows, roles);
  const positionBest = positionCoverage.ranked[0];
  const positionNext = positionCoverage.ranked[1];

  if (positionCoverage.coveredShare >= 0.65) {
    if (positionBest?.share >= 0.7) {
      const roleCandidate = candidates.find((item) => item.role.id === positionBest.role.id);
      return {
        id: positionBest.role.id,
        locked: true,
        coverage: roleCandidate?.coverage ?? positionBest.share,
        next: positionNext?.role.id ?? candidates[0]?.role.id ?? null,
        candidates,
        positionMatched: true,
      };
    }
    return {
      id: null,
      locked: false,
      coverage: positionCoverage.coveredShare,
      next: positionBest?.role.id ?? candidates[0]?.role.id ?? null,
      candidates,
      positionMatched: true,
    };
  }

  const best = candidates[0];
  const next = candidates[1];
  if (!best || best.coverage < 0.55) return { id: null, locked: false, coverage: 0, next: next?.role.id ?? null, candidates };
  return {
    id: best.role.id,
    locked: best.coverage >= 0.75,
    coverage: best.coverage,
    next: next?.role.id ?? null,
    candidates,
  };
}

export function analyzeImport(rows, roles, importRole) {
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const candidates = roleCoverage(rows, roles);
  const selected = roles.find((role) => role.id === importRole?.id) || candidates[0]?.role || null;
  const selectedCoverage = candidates.find((item) => item.role.id === selected?.id) || null;
  const derived = [...new Set(rows.flatMap((row) => row.__moneyballNormalizations || []))];
  if (importRole?.positionMatched) derived.push("Role detected from FM position column");
  const normalizedHeaders = new Set(headers.map(normalise));
  const hasXgOverperformance = selected?.scoreColumns.some((score) => score.stats.some((stat) => normalise(stat.header) === "xgoverperformanceper90"));
  if (selected?.id === "GK" && ["savesheld", "savesparried", "savestipped"].some((header) => normalizedHeaders.has(header)) && (normalizedHeaders.has("minutes") || normalizedHeaders.has("mins"))) {
    derived.push("Save Ability derived per 90 from Saves Held, Saves Parried and Saves Tipped");
  }
  if (hasXgOverperformance && normalizedHeaders.has("xgop") && (normalizedHeaders.has("minutes") || normalizedHeaders.has("mins"))) {
    derived.push("xG-OP converted to per 90 from total xG overperformance and minutes");
  }
  return {
    rowCount: rows.length,
    sourceColumnCount: headers.length,
    detectedRole: importRole?.id ?? null,
    locked: Boolean(importRole?.locked),
    coverage: importRole?.coverage ?? 0,
    nextRole: importRole?.next ?? null,
    roleCoverages: candidates.map((item) => ({ role: item.role.id, coverage: item.coverage, matched: item.matched.length, missing: item.missing.length })),
    matchedFields: selectedCoverage?.matched ?? [],
    missingFields: selectedCoverage?.missing ?? [],
    derivedFields: derived,
  };
}

export function templateHeaders(roles) {
  const headers = new Set(["Player Name", "Best Position", "Other Positions", "Division"]);
  for (const role of roles) role.rawHeaders.forEach((header) => headers.add(header));
  return [...headers];
}





