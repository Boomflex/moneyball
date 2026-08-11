import { mean, normalise } from "./utils.js";
import { safeNumber } from "./importer.js";

export const ROLE_FIT_PHASES = ["All", "In Possession", "Out of Possession"];
export const ROLE_FIT_AREAS = ["All", "Defensive", "Midfield", "Attacking"];

const ATTRIBUTE_ALIASES = {
  Name: ["Player", "Player Name", "Name"],
  BestPos: ["Best Pos", "Best Position", "Position"],
  Acc: ["Acceleration", "Acc"],
  Agg: ["Aggression", "Agg"],
  Agi: ["Agility", "Agi"],
  Ant: ["Anticipation", "Ant"],
  Bal: ["Balance", "Bal"],
  Bra: ["Bravery", "Bra"],
  Cmp: ["Composure", "Cmp"],
  Cnt: ["Concentration", "Cnt"],
  Cor: ["Corners", "Cor"],
  Cro: ["Crossing", "Cro"],
  Dec: ["Decisions", "Dec"],
  Det: ["Determination", "Det"],
  Dri: ["Dribbling", "Dri"],
  Fin: ["Finishing", "Fin"],
  Fir: ["First Touch", "First Touches", "Fir"],
  Fla: ["Flair", "Fla"],
  Fre: ["Free Kick Taking", "Free Kicks", "Fre"],
  Hea: ["Heading", "Hea"],
  Jum: ["Jumping Reach", "Jumping", "Jum"],
  Ldr: ["Leadership", "Ldr"],
  Lon: ["Long Shots", "Lon"],
  Mar: ["Marking", "Mar"],
  Nat: ["Natural Fitness", "Nat"],
  OtB: ["Off The Ball", "Off the Ball", "OtB"],
  Pac: ["Pace", "Pac"],
  Pas: ["Passing", "Pas"],
  Pen: ["Penalty Taking", "Penalties", "Pen"],
  Pos: ["Positioning", "Pos"],
  Sta: ["Stamina", "Sta"],
  Str: ["Strength", "Str"],
  Tck: ["Tackling", "Tck"],
  Tea: ["Team Work", "Teamwork", "Tea"],
  Tec: ["Technique", "Tec"],
  Vis: ["Vision", "Vis"],
  Wor: ["Work Rate", "Work Rate", "Wor"],
};

const ALIAS_LOOKUP = new Map(
  Object.entries(ATTRIBUTE_ALIASES).flatMap(([target, aliases]) => aliases.map((alias) => [normalise(alias), target])),
);

export const ROLE_FIT_ROLES = [
  { phase: "In Possession", area: "Defensive", role: "Centre-Back", key: ["Hea", "Mar", "Tck", "Ant", "Pos", "Jum", "Str"], preferred: ["Agg", "Bra", "Cmp", "Cnt", "Dec", "Pac"] },
  { phase: "In Possession", area: "Defensive", role: "Ball-Playing Centre-Back", key: ["Hea", "Mar", "Pas", "Tck", "Ant", "Cmp", "Pos", "Jum", "Str"], preferred: ["Fir", "Tec", "Agg", "Bra", "Cnt", "Dec", "Vis", "Pac"] },
  { phase: "In Possession", area: "Defensive", role: "Wide Centre-Back", key: ["Hea", "Mar", "Tck", "Ant", "Pos", "Jum", "Str"], preferred: ["Dri", "Agg", "Bra", "Cmp", "Cnt", "Dec", "Wor", "Acc", "Agi", "Pac", "Sta"] },
  { phase: "In Possession", area: "Defensive", role: "Full-Back", key: ["Mar", "Tck", "Ant", "Cnt", "Pos", "Tea", "Acc"], preferred: ["Cro", "Dri", "Pas", "Tec", "Dec", "Wor", "Agi", "Pac", "Sta"] },
  { phase: "In Possession", area: "Defensive", role: "Wing-Back", key: ["Cro", "Mar", "Tck", "Tea", "Wor", "Acc", "Pac", "Sta"], preferred: ["Dri", "Fir", "Pas", "Tec", "Ant", "Cnt", "Dec", "OtB", "Pos", "Agi", "Bal"] },
  { phase: "In Possession", area: "Defensive", role: "Inverted Wing-Back", key: ["Pas", "Tck", "Ant", "Cmp", "Dec", "Pos", "Tea", "Acc"], preferred: ["Fir", "Mar", "Tec", "Cnt", "Wor", "Agi", "Pac", "Sta"] },
  { phase: "In Possession", area: "Midfield", role: "Defensive Midfielder", key: ["Tck", "Ant", "Cnt", "Pos", "Tea"], preferred: ["Fir", "Mar", "Pas", "Agg", "Cmp", "Dec", "Wor", "Sta", "Str"] },
  { phase: "In Possession", area: "Midfield", role: "Half-Back", key: ["Hea", "Mar", "Tck", "Ant", "Cnt", "Pos", "Tea", "Jum", "Str"], preferred: ["Fir", "Pas", "Agg", "Bra", "Cmp", "Dec", "Wor", "Sta"] },
  { phase: "In Possession", area: "Midfield", role: "Central Midfielder", key: ["Fir", "Pas", "Tck", "Dec", "Tea"], preferred: ["Tec", "Ant", "Cmp", "Cnt", "OtB", "Pos", "Vis", "Wor", "Sta"] },
  { phase: "In Possession", area: "Midfield", role: "Box-to-Box Midfielder", key: ["Pas", "Tck", "OtB", "Tea", "Wor", "Sta"], preferred: ["Dri", "Fin", "Fir", "Lon", "Tec", "Agg", "Ant", "Cmp", "Dec", "Pos", "Acc", "Bal", "Pac", "Str"] },
  { phase: "In Possession", area: "Midfield", role: "Deep-Lying Playmaker", key: ["Fir", "Pas", "Tec", "Cmp", "Dec", "OtB", "Tea", "Vis"], preferred: ["Mar", "Tck", "Ant", "Cnt", "Pos", "Wor", "Bal", "Sta"] },
  { phase: "In Possession", area: "Midfield", role: "Advanced Playmaker", key: ["Fir", "Pas", "Tec", "Cmp", "Dec", "OtB", "Tea", "Vis"], preferred: ["Cro", "Dri", "Ant", "Fla", "Acc", "Agi"] },
  { phase: "In Possession", area: "Midfield", role: "Wide Midfielder", key: ["Cro", "Pas", "Tec", "Tea", "Wor", "Pac", "Sta"], preferred: ["Dri", "Fir", "Ant", "Cmp", "OtB", "Vis", "Acc", "Agi"] },
  { phase: "In Possession", area: "Midfield", role: "Winger", key: ["Cro", "Dri", "Tec", "Tea", "Acc", "Agi", "Pac"], preferred: ["Fir", "Pas", "Ant", "Fla", "OtB", "Wor", "Bal", "Sta"] },
  { phase: "In Possession", area: "Midfield", role: "Inside Winger", key: ["Dri", "Fir", "Tec", "Cmp", "Tea", "Acc", "Agi"], preferred: ["Cro", "Lon", "Pas", "Ant", "Fla", "OtB", "Vis", "Wor", "Bal", "Pac", "Sta"] },
  { phase: "In Possession", area: "Attacking", role: "Attacking Midfielder", key: ["Fir", "Lon", "Pas", "Tec", "Cmp", "Fla", "OtB"], preferred: ["Cro", "Dri", "Fin", "Ant", "Dec", "Vis", "Acc", "Agi"] },
  { phase: "In Possession", area: "Attacking", role: "Second Striker", key: ["Fin", "Fir", "Ant", "Cmp", "OtB", "Acc"], preferred: ["Dri", "Lon", "Pas", "Tec", "Cnt", "Dec", "Wor", "Agi", "Pac", "Sta"] },
  { phase: "In Possession", area: "Attacking", role: "Inside Forward", key: ["Dri", "Fir", "Tec", "Ant", "Cmp", "OtB", "Acc", "Agi"], preferred: ["Cro", "Fin", "Lon", "Pas", "Fla", "Vis", "Wor", "Bal", "Pac", "Sta"] },
  { phase: "In Possession", area: "Attacking", role: "Advanced Forward", key: ["Fin", "Fir", "Tec", "Cmp", "OtB", "Acc", "Pac"], preferred: ["Dri", "Hea", "Ant", "Dec", "Agi", "Bal", "Jum", "Str"] },
  { phase: "In Possession", area: "Attacking", role: "Deep-Lying Forward", key: ["Fin", "Fir", "Tec", "Cmp", "OtB", "Str"], preferred: ["Dri", "Pas", "Ant", "Dec", "Tea", "Vis", "Bal"] },
  { phase: "In Possession", area: "Attacking", role: "False Nine", key: ["Dri", "Fir", "Pas", "Tec", "Cmp", "Dec", "OtB", "Tea", "Vis", "Acc"], preferred: ["Fin", "Ant", "Fla", "Agi", "Bal"] },
  { phase: "In Possession", area: "Attacking", role: "Poacher", key: ["Fin", "Hea", "Ant", "Cmp", "Cnt", "OtB", "Acc"], preferred: ["Fir", "Tec", "Dec", "Bal"] },
  { phase: "In Possession", area: "Attacking", role: "Target Forward", key: ["Fin", "Hea", "Agg", "Bra", "Cmp", "OtB", "Bal", "Jum", "Str"], preferred: ["Fir", "Ant", "Dec", "Tea"] },
  { phase: "Out of Possession", area: "Defensive", role: "Covering Centre-Back", key: ["Ant", "Pac", "Mar"], preferred: [] },
  { phase: "Out of Possession", area: "Defensive", role: "Stopping Centre-Back", key: ["Agg", "Tck", "Str"], preferred: [] },
  { phase: "Out of Possession", area: "Defensive", role: "Holding Full-Back", key: ["Pos", "Cnt", "Mar"], preferred: [] },
  { phase: "Out of Possession", area: "Defensive", role: "Pressing Full-Back", key: ["Agg", "Wor", "Ant"], preferred: [] },
  { phase: "Out of Possession", area: "Midfield", role: "Screening Defensive Midfielder", key: ["Pos", "Cnt", "Mar"], preferred: [] },
  { phase: "Out of Possession", area: "Midfield", role: "Pressing Midfielder", key: ["Agg", "Wor", "Ant"], preferred: [] },
  { phase: "Out of Possession", area: "Midfield", role: "Tracking Wide Midfielder", key: ["Mar", "Wor", "Sta"], preferred: [] },
  { phase: "Out of Possession", area: "Attacking", role: "Central Outlet Attacker", key: ["OtB", "Dec", "Ant"], preferred: [] },
  { phase: "Out of Possession", area: "Attacking", role: "Wide Outlet Attacker", key: ["OtB", "Pac", "Ant"], preferred: [] },
  { phase: "Out of Possession", area: "Attacking", role: "Tracking Forward", key: ["Mar", "Wor", "Sta"], preferred: [] },
];

export const ROLE_FIT_ATTRIBUTES = [...new Set(ROLE_FIT_ROLES.flatMap((role) => [...role.key, ...role.preferred]))].sort();
export const ROLE_FIT_ROLE_NAMES = ROLE_FIT_ROLES.map((role) => role.role);

function lookupForRow(row) {
  return new Map(Object.keys(row).map((key) => [normalise(key), key]));
}

export function roleFitValue(row, attr) {
  const lookup = lookupForRow(row);
  for (const alias of ATTRIBUTE_ALIASES[attr] || [attr]) {
    const key = lookup.get(normalise(alias));
    if (key && row[key] !== "") return safeNumber(row[key]);
  }
  return null;
}

export function roleFitName(row, fallbackIndex = 0) {
  return roleFitText(row, "Name") || `Player ${fallbackIndex + 1}`;
}

export function roleFitText(row, attr) {
  const lookup = lookupForRow(row);
  for (const alias of ATTRIBUTE_ALIASES[attr] || [attr]) {
    const key = lookup.get(normalise(alias));
    if (key && row[key] !== "") return String(row[key]).trim();
  }
  return "";
}

export function isGoalkeeperRow(row) {
  return /\bGK\b|goalkeeper/i.test(roleFitText(row, "BestPos"));
}

export function roleFitImportReport(rows) {
  const sourceHeaders = rows[0] ? Object.keys(rows[0]) : [];
  const normalized = new Set(sourceHeaders.map(normalise));
  const matched = ROLE_FIT_ATTRIBUTES.filter((attr) => (ATTRIBUTE_ALIASES[attr] || [attr]).some((alias) => normalized.has(normalise(alias))));
  const missing = ROLE_FIT_ATTRIBUTES.filter((attr) => !matched.includes(attr));
  return {
    rowCount: rows.length,
    sourceColumnCount: sourceHeaders.length,
    outfieldCount: rows.filter((row) => !isGoalkeeperRow(row)).length,
    matched,
    missing,
    coverage: ROLE_FIT_ATTRIBUTES.length ? matched.length / ROLE_FIT_ATTRIBUTES.length : 0,
  };
}

function attrAverage(row, attrs) {
  const values = attrs.map((attr) => roleFitValue(row, attr));
  const scored = values.map((value) => Number.isFinite(value) ? value : 0);
  return { score: mean(scored), missing: values.filter((value) => !Number.isFinite(value)).length };
}

export function calculateRoleFitRows(rows) {
  const outfield = rows.filter((row) => !isGoalkeeperRow(row));
  const roleRows = outfield.flatMap((row, index) => ROLE_FIT_ROLES.map((roleInfo) => {
    const key = attrAverage(row, roleInfo.key);
    const preferred = roleInfo.preferred.length ? attrAverage(row, roleInfo.preferred) : { score: 0, missing: 0 };
    const score = roleInfo.preferred.length ? key.score * 0.8 + preferred.score * 0.2 : key.score;
    const missing = key.missing + preferred.missing;
    return {
      player: roleFitName(row, index),
      phase: roleInfo.phase,
      area: roleInfo.area,
      roleFit: roleInfo.role,
      score: Number(score.toFixed(2)),
      keyScore: Number(key.score.toFixed(2)),
      preferredScore: roleInfo.preferred.length ? Number(preferred.score.toFixed(2)) : null,
      missing,
      bestPos: roleFitText(row, "BestPos"),
      source: row,
    };
  }));

  for (const roleInfo of ROLE_FIT_ROLES) {
    const rowsForRole = roleRows
      .filter((row) => row.roleFit === roleInfo.role)
      .sort((a, b) => b.score - a.score || a.player.localeCompare(b.player));
    rowsForRole.forEach((row, index) => { row.rank = index + 1; });
  }

  return roleRows;
}

export function topRoleFitPerPlayer(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.player)) grouped.set(row.player, []);
    grouped.get(row.player).push(row);
  }
  return [...grouped.values()].map((entries) => [...entries].sort((a, b) => b.score - a.score || a.rank - b.rank)[0]);
}

export function attributeColumnsForCsv() {
  return ["Player", "Best Pos", ...ROLE_FIT_ATTRIBUTES];
}
