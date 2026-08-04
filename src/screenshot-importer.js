import { normalise } from "./utils.js";

export const SCREENSHOT_META_FIELDS = [
  { key: "Player Name", label: "Player", placeholder: "Player name" },
  { key: "Age", label: "Age", placeholder: "Age" },
  { key: "Division", label: "Division", placeholder: "Bundesliga 2" },
  { key: "Club", label: "Club", placeholder: "Club" },
  { key: "Best Position", label: "Position", placeholder: "Midfielder/Attacking Midfielder (Centre)" },
  { key: "Other Positions", label: "Other positions", placeholder: "Optional" },
  { key: "Actual Value (\u00a3)", label: "Value", placeholder: "\u00a33.6M" },
  { key: "Actual Wage (\u00a3/wk)", label: "Wage", placeholder: "\u00a313.75K p/w" },
];

export const SCREENSHOT_REVIEW_FIELDS = [
  "Mins",
  "Average Rating",
  "Goals Per 90",
  "Non Penalty xGoals Per 90",
  "Assists Per 90",
  "xAssists Per 90",
  "Chances Created Per 90",
  "Open Play Key Passes Per 90",
  "Progressive Passes Per 90",
  "Shots Per 90",
  "Shots On Target %",
  "Pass Completion %",
  "Passes Completed Per 90",
  "Open Play Cross Completion %",
  "Open Play Crosses Completed Per 90",
  "Dribbles Made Per 90",
  "Possession Won Per 90",
  "Possession Lost Per 90",
  "Tackles Completed Per 90",
  "Headers Won Per 90",
  "Interceptions Per 90",
  "Blocks Per 90",
  "Fouls Made Per 90",
  "Mistakes Per 90",
  "xGoals Prevented Per 90",
  "Goals Allowed Per 90",
  "Saves Per 90",
];

const STAT_ALIASES = new Map([
  ["goals", "Goals"],
  ["expectedgoals", "Expected Goals"],
  ["expectedgoals90mins", "Non Penalty xGoals Per 90"],
  ["expectedgoalsper90mins", "Non Penalty xGoals Per 90"],
  ["expectedgoals90", "Non Penalty xGoals Per 90"],
  ["assists", "Assists"],
  ["expectedassists", "Expected Assists"],
  ["expectedassists90mins", "xAssists Per 90"],
  ["expectedassistsper90mins", "xAssists Per 90"],
  ["chancescreated", "Chances Created"],
  ["goalattempts", "Shots"],
  ["shotsontarget90mins", "Shots On Target Per 90"],
  ["shotsontargetper90mins", "Shots On Target Per 90"],
  ["keypasses", "Key Passes"],
  ["progressivepasses90mins", "Progressive Passes Per 90"],
  ["progressivepassesper90mins", "Progressive Passes Per 90"],
  ["dribblespergame", "Dribbles Made Per 90"],
  ["minutesonpitchpergoal", "Minutes on Pitch Per Goal"],
  ["minutesonpitchperassist", "Minutes on Pitch Per Assist"],
  ["distance ran per 90", "Distance Per 90"],
  ["distanceranper90", "Distance Per 90"],
  ["sprints90", "Sprints Per 90"],
  ["sprintsper90", "Sprints Per 90"],
  ["passesattempted", "Passes Attempted"],
  ["passescompleted90mins", "Passes Completed Per 90"],
  ["passescompletedper90mins", "Passes Completed Per 90"],
  ["passcompletionpercentage", "Pass Completion %"],
  ["crossesattempted", "Open Play Crosses Attempted"],
  ["crossescompleted", "Open Play Crosses Completed"],
  ["crossescompletedratio", "Open Play Cross Completion %"],
  ["possessionwon90mins", "Possession Won Per 90"],
  ["possessionwonper90mins", "Possession Won Per 90"],
  ["possessionlost90mins", "Possession Lost Per 90"],
  ["possessionlostper90mins", "Possession Lost Per 90"],
  ["tackleswon", "Tackles Won"],
  ["tackleswonpergame", "Tackles Completed Per 90"],
  ["keytackles", "Key Tackles"],
  ["tacklecompletionpercentage", "Tackle Completion %"],
  ["headerswon", "Headers Won"],
  ["keyheaders90mins", "Headers Won Per 90"],
  ["keyheadersper90mins", "Headers Won Per 90"],
  ["clearances", "Clearances Per 90"],
  ["interceptions", "Interceptions"],
  ["shotsblocked", "Blocks"],
  ["fouls90", "Fouls Made Per 90"],
  ["foulsper90", "Fouls Made Per 90"],
  ["mistakesleadingtogoals", "Mistakes Leading to Goals"],
  ["cleansheetspergamesplayed", "Clean Sheets"],
  ["conceded90mins", "Goals Allowed Per 90"],
  ["concededper90mins", "Goals Allowed Per 90"],
  ["saves", "Saves"],
  ["saves90", "Saves Per 90"],
  ["savesper90", "Saves Per 90"],
  ["expectedgoalsprevented90mins", "xGoals Prevented Per 90"],
  ["expectedgoalspreventedper90mins", "xGoals Prevented Per 90"],
  ["held", "Saves Held"],
]);

const META_LABELS = new Set(["attacking", "passescompleted", "defensive", "goalkeeper", "competition", "apps", "goals", "assists", "xg", "xa", "pens", "pom", "yel", "red", "pas", "avgrat"]);
const COMPETITION_PATTERN = /\b(?:bundesliga|league|division|liga|serie|premier|championship|eredivisie|jupiler|national league)\b/i;
const NON_COMPETITION_PATTERN = /\b(?:national:|portal|squad|overview|bookmarks|tactical role|condition|caps|messages|player report|first team|under19s|training|youth setup)\b/i;
const INLINE_STAT_PATTERNS = [
  [/\bExpected Goals\/\s*90\s*(?:mins?)?\s+(-?\d+(?:\.\d+)?)/i, "Non Penalty xGoals Per 90"],
  [/\bExpected Goals\s+(-?\d+(?:\.\d+)?)/i, "Expected Goals"],
  [/\bExpected Assists\/\s*90\s*(?:mins?)?\s+(-?\d+(?:\.\d+)?)/i, "xAssists Per 90"],
  [/\bExpected Assists\s+(-?\d+(?:\.\d+)?)/i, "Expected Assists"],
  [/\bChances Created\s+(-?\d+(?:\.\d+)?)/i, "Chances Created"],
  [/\bGoal Attempts\s+(-?\d+(?:\.\d+)?)/i, "Shots"],
  [/\bShots on Target\/\s*90\s*(?:mins?)?\s+(-?\d+(?:\.\d+)?)/i, "Shots On Target Per 90"],
  [/\bKey Passes\s+(-?\d+(?:\.\d+)?)/i, "Key Passes"],
  [/\bProgressive Passes\/\s*90\s*(?:mins?)?\s+(-?\d+(?:\.\d+)?)/i, "Progressive Passes Per 90"],
  [/\bPasses Completed\/\s*90\s*(?:mins?)?\s+(-?\d+(?:\.\d+)?)/i, "Passes Completed Per 90"],
  [/\bPass Completion Percentage\s+(-?\d+(?:\.\d+)?)/i, "Pass Completion %"],
  [/\bCrosses completed\s+(-?\d+(?:\.\d+)?)/i, "Open Play Crosses Completed"],
  [/\bCrosses Completed Ratio\s+(-?\d+(?:\.\d+)?)/i, "Open Play Cross Completion %"],
  [/\bPossession Won\/\s*90\s*(?:mins?)?\s+(-?\d+(?:\.\d+)?)/i, "Possession Won Per 90"],
  [/\bPossession Lost\/\s*90\s*(?:mins?)?\s+(-?\d+(?:\.\d+)?)/i, "Possession Lost Per 90"],
  [/\bTackles Won per Game\s+(-?\d+(?:\.\d+)?)/i, "Tackles Completed Per 90"],
  [/\bHeaders Won\s+(-?\d+(?:\.\d+)?)/i, "Headers Won"],
  [/\bKey Headers\/\s*90\s*(?:mins?)?\s+(-?\d+(?:\.\d+)?)/i, "Headers Won Per 90"],
  [/\bInterceptions\s+(-?\d+(?:\.\d+)?)/i, "Interceptions"],
  [/\bShots Blocked\s+(-?\d+(?:\.\d+)?)/i, "Blocks"],
  [/\bFouls\/\s*90\s+(-?\d+(?:\.\d+)?)/i, "Fouls Made Per 90"],
  [/\bMistakes Leading to Goals\s+(-?\d+(?:\.\d+)?)/i, "Mistakes Leading to Goals"],
  [/\bConceded\/\s*90\s*(?:mins?)?\s+(-?\d+(?:\.\d+)?)/i, "Goals Allowed Per 90"],
  [/\bSaves\/\s*90\s+(-?\d+(?:\.\d+)?)/i, "Saves Per 90"],
  [/\bExpected Goals Prevented\/\s*90\s*(?:mins?)?\s+(-?\d+(?:\.\d+)?)/i, "xGoals Prevented Per 90"],
  [/\bMinutes on Pitch Per Goal\s+(-?\d+(?:\.\d+)?)/i, "Minutes on Pitch Per Goal"],
  [/\bMinutes on Pitch Per Assist\s+(-?\d+(?:\.\d+)?)/i, "Minutes on Pitch Per Assist"],
];

export function createEmptyScreenshotDraft() {
  return {
    meta: Object.fromEntries(SCREENSHOT_META_FIELDS.map((field) => [field.key, ""])),
    stats: Object.fromEntries(SCREENSHOT_REVIEW_FIELDS.map((field) => [field, ""])),
    rawText: "",
    warnings: [],
    detected: [],
  };
}

function parseNumber(value) {
  const text = String(value ?? "").replace(/[,%]/g, "").trim();
  if (!text || text === "-") return null;
  const match = text.match(/^-?\d+(?:\.\d+)?$/);
  return match ? Number(match[0]) : null;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function valueFromLine(line) {
  const match = line.trim().match(/(.+?)\s+(-?\(?\u00a3?\d[\d,.]*(?:\.\d+)?\)?(?:[KMB])?(?:\s*p\/w)?%?)$/i);
  if (!match) return null;
  return { label: match[1].trim(), value: match[2].replace(/^\((.*)\)$/, "$1").trim() };
}

function cleanOcrLine(line) {
  return line
    .replace(/["'=|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCompetitionLine(line) {
  return COMPETITION_PATTERN.test(line) && !NON_COMPETITION_PATTERN.test(line);
}

function extractPosition(line) {
  const clean = cleanOcrLine(line);
  const match = clean.match(/\b(?:(?:Defensive|Attacking)\s+)?(?:Goalkeeper|Defender|Midfielder|Winger|Striker|Forward)(?:\/(?:Defensive|Attacking)?\s*(?:Defender|Midfielder|Winger|Striker|Forward))*\s*(?:\([^)]+\))?/i);
  return match ? match[0].replace(/\s+/g, " ").trim() : "";
}

function extractInlineStats(draft, line) {
  let found = 0;
  for (const [pattern, target] of INLINE_STAT_PATTERNS) {
    const match = line.match(pattern);
    if (!match) continue;
    setDetected(draft, target, match[1], line);
    found += 1;
  }
  return found;
}

function canonicalStat(label) {
  const key = normalise(label);
  return STAT_ALIASES.get(key) || null;
}

function setDetected(draft, target, value, source) {
  if (value === null || value === undefined || value === "") return;
  const text = String(value).trim();
  if (!text) return;
  if (!draft.stats[target]) draft.stats[target] = text;
  draft.detected.push({ target, value: text, source });
}

function setPer90FromTotal(draft, target, totalKey, minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0 || draft.stats[target]) return;
  const total = parseNumber(draft.stats[totalKey]);
  if (!Number.isFinite(total)) return;
  setDetected(draft, target, formatNumber(total / minutes * 90), `${totalKey} / estimated minutes`);
}

function tableRowFromLine(line) {
  const match = line.trim().match(/^(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)%\s+(\d+(?:\.\d+)?)$/i);
  if (!match) return null;
  return {
    competition: match[1].replace(/^[^A-Za-z0-9]+\s+/, "").trim(),
    apps: match[2],
    goals: match[3],
    assists: match[4],
    xg: match[5],
    xa: match[6],
    passCompletion: String(Number(match[11]) / 100),
    rating: match[12],
  };
}

function inferMetaFromText(draft, lines) {
  const joined = lines.join(" ");
  const age = joined.match(/(\d{2})\s+years old/i)?.[1];
  if (age) draft.meta.Age = age;

  const wage = joined.match(/\u00a3\s?\d+(?:\.\d+)?\s?[KMB]?\s*p\/w/i)?.[0];
  if (wage) draft.meta["Actual Wage (\u00a3/wk)"] = wage;

  const values = [...joined.matchAll(/\u00a3\s?\d+(?:\.\d+)?\s?[KMB](?!\s*p\/w)/gi)].map((match) => match[0]);
  if (values[0]) draft.meta["Actual Value (\u00a3)"] = values[0];

  const position = lines.map(extractPosition).find(Boolean);
  if (position) draft.meta["Best Position"] = position;
}

function estimateMinutes(draft) {
  const candidates = [];
  const pairs = [
    ["Expected Goals", "Non Penalty xGoals Per 90"],
    ["Expected Assists", "xAssists Per 90"],
    ["Goals", "Minutes on Pitch Per Goal", "inverse"],
    ["Assists", "Minutes on Pitch Per Assist", "inverse"],
  ];

  for (const [totalKey, rateKey, mode] of pairs) {
    const total = parseNumber(draft.stats[totalKey]);
    const rate = parseNumber(draft.stats[rateKey]);
    if (!Number.isFinite(total) || !Number.isFinite(rate) || total <= 0 || rate <= 0) continue;
    candidates.push(mode === "inverse" ? total * rate : total / rate * 90);
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a - b);
  return candidates[Math.floor(candidates.length / 2)];
}

function deriveRates(draft) {
  const minutes = parseNumber(draft.stats.Mins) || estimateMinutes(draft);
  if (Number.isFinite(minutes) && minutes > 0) {
    if (!draft.stats.Mins) {
      setDetected(draft, "Mins", String(Math.round(minutes)), "estimated from totals and per-90 stats");
      draft.warnings.push("Minutes estimated from screenshot totals and per-90 values.");
    }
    setPer90FromTotal(draft, "Goals Per 90", "Goals", minutes);
    setPer90FromTotal(draft, "Assists Per 90", "Assists", minutes);
    setPer90FromTotal(draft, "Chances Created Per 90", "Chances Created", minutes);
    setPer90FromTotal(draft, "Shots Per 90", "Shots", minutes);
    setPer90FromTotal(draft, "Open Play Key Passes Per 90", "Key Passes", minutes);
    setPer90FromTotal(draft, "Open Play Crosses Completed Per 90", "Open Play Crosses Completed", minutes);
    setPer90FromTotal(draft, "Tackles Completed Per 90", "Tackles Won", minutes);
    setPer90FromTotal(draft, "Headers Won Per 90", "Headers Won", minutes);
    setPer90FromTotal(draft, "Interceptions Per 90", "Interceptions", minutes);
    setPer90FromTotal(draft, "Blocks Per 90", "Blocks", minutes);
    setPer90FromTotal(draft, "Mistakes Per 90", "Mistakes Leading to Goals", minutes);
  }
}

function deriveShotAccuracy(draft) {
  if (draft.stats["Shots On Target %"]) return;
  const shots = parseNumber(draft.stats["Shots Per 90"]);
  const onTarget = parseNumber(draft.stats["Shots On Target Per 90"]);
  if (Number.isFinite(shots) && shots > 0 && Number.isFinite(onTarget)) {
    setDetected(draft, "Shots On Target %", formatNumber(onTarget / shots), "shots on target per 90 / shots per 90");
  }
}

function normalizePercentageStats(draft) {
  for (const key of ["Pass Completion %", "Open Play Cross Completion %", "Shots On Target %", "Tackle Completion %"]) {
    const value = parseNumber(draft.stats[key]);
    if (Number.isFinite(value) && value > 1.5) draft.stats[key] = formatNumber(value / 100);
  }
}

export function parseFmScreenshotText(text, manualMeta = {}) {
  const draft = createEmptyScreenshotDraft();
  draft.rawText = text || "";
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/[|]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  inferMetaFromText(draft, lines);

  for (const line of lines) {
    const row = tableRowFromLine(line);
    if (row) {
      draft.meta.Division = row.competition || draft.meta.Division;
      setDetected(draft, "Goals", row.goals, line);
      setDetected(draft, "Assists", row.assists, line);
      setDetected(draft, "Expected Goals", row.xg, line);
      setDetected(draft, "Expected Assists", row.xa, line);
      setDetected(draft, "Pass Completion %", row.passCompletion, line);
      setDetected(draft, "Average Rating", row.rating, line);
      continue;
    }

    extractInlineStats(draft, line);
    const pair = valueFromLine(line);
    if (!pair) {
      const maybeDivision = normalise(line);
      if (!draft.meta.Division && maybeDivision && !META_LABELS.has(maybeDivision) && isCompetitionLine(line)) {
        draft.meta.Division = line;
      }
      continue;
    }

    const target = canonicalStat(pair.label);
    if (target) setDetected(draft, target, pair.value, line);
    if (!draft.meta.Division && isCompetitionLine(pair.label)) {
      draft.meta.Division = pair.label;
    }
  }
  deriveRates(draft);
  deriveShotAccuracy(draft);
  normalizePercentageStats(draft);

  for (const field of SCREENSHOT_META_FIELDS) {
    if (manualMeta[field.key] !== undefined && String(manualMeta[field.key] || "").trim()) draft.meta[field.key] = String(manualMeta[field.key]).trim();
  }

  if (!draft.meta["Player Name"]) draft.warnings.push("Player name usually needs manual confirmation from the screenshot header.");
  if (!draft.meta["Best Position"]) draft.warnings.push("Position usually needs manual confirmation so the workbook can choose the right role.");
  if (!draft.stats.Mins) draft.warnings.push("Minutes were not detected; guide baseline and per-90 derived stats may be weaker.");

  return draft;
}

export function screenshotDraftToRow(draft) {
  const row = {};
  for (const field of SCREENSHOT_META_FIELDS) {
    if (draft.meta[field.key]) row[field.key] = draft.meta[field.key];
  }
  for (const field of SCREENSHOT_REVIEW_FIELDS) {
    if (!draft.stats[field]) continue;
    row[field] = draft.stats[field];
  }
  row["Import Source"] = "FM screenshot";
  return row;
}

export function screenshotConfidence(draft) {
  const populatedMeta = SCREENSHOT_META_FIELDS.filter((field) => draft.meta[field.key]).length;
  const populatedStats = SCREENSHOT_REVIEW_FIELDS.filter((field) => draft.stats[field]).length;
  return {
    meta: populatedMeta,
    stats: populatedStats,
    total: populatedMeta + populatedStats,
  };
}
