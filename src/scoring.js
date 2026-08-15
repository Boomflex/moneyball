import { isNotForSaleValue, rowGetter, safeNumber } from "./importer.js";
import { resolveLeague } from "./league-overrides.js";
import { clamp, mean, normalise, roleIdsFromPositionText, stdev } from "./utils.js";

export const roleById = (roles, id) => roles.find((role) => role.id === id);


function stableIdPart(value) {
  const text = String(value ?? "").trim();
  return normalise(text) || "unknown";
}

function makePlayerId({ playerName, roleId, club, division, age, rowIndex }) {
  return [playerName || "Unnamed player", roleId, club || "No club", division || "No division", age ?? "No age", rowIndex]
    .map(stableIdPart)
    .join("__");
}

export function hasRoleHint(row, role) {
  const get = rowGetter(row);
  const text = [get("Best Position"), get("Other Positions"), get("Position"), get("Role")]
    .join(" ")
    .trim();
  const positionRoles = roleIdsFromPositionText(text);
  if (positionRoles.includes(role.id)) return true;
  const tokens = text.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  return role.aliases.some((alias) => {
    const cleanAlias = alias.toUpperCase();
    if (cleanAlias.length <= 3 && !cleanAlias.includes(" ")) return tokens.includes(cleanAlias);
    return text.toLowerCase().includes(alias.toLowerCase());
  });
}

export function valueForStat(get, stat) {
  const statKey = normalise(stat.header);
  if (statKey === "saveability") {
    const saveActions = ["Saves Held", "Saves Parried", "Saves Tipped"].map((header) => safeNumber(get(header))).filter(Number.isFinite);
    const minutes = safeNumber(get("Mins"));
    if (saveActions.length && minutes) return saveActions.reduce((sum, value) => sum + value, 0) / (minutes / 90);
  }
  if (statKey === "xgoverperformanceper90") {
    const total = safeNumber(get("xG-OP"));
    const minutes = safeNumber(get("Mins"));
    if (total !== null && minutes) return total / (minutes / 90);
  }
  const raw = safeNumber(get(stat.header));
  if (raw === null) return null;
  if (stat.header.includes("%") && raw > 1.5) return raw / 100;
  return raw;
}

export function scoreRole(row, role, rowIndex = 0, options = {}) {
  const get = rowGetter(row);
  const leagueContext = { basedIn: get("Based In") };
  const scores = role.scoreColumns.map((score) => {
    let sum = 0;
    let coverage = 0;
    let weightSeen = 0;
    for (const stat of score.stats) {
      weightSeen += stat.weight;
      const value = valueForStat(get, stat);
      if (value !== null && stat.stdev) {
        coverage += stat.weight;
        sum += stat.weight * stat.direction * ((value - stat.mean) / stat.stdev);
      }
    }
    const resolvedLeague = resolveLeague(role, get("Division"), options.leagueFallback, leagueContext);
    const leagueStrength = Number(resolvedLeague.data?.strength) || 35;
    const rawOutput = ((sum / score.denominator) + 3) * 10;
    const adjusted = rawOutput * (leagueStrength / 55);
    return {
      label: score.label,
      score: adjusted,
      rawOutput,
      coverage: weightSeen ? coverage / weightSeen : 0,
    };
  });
  const validScores = scores.filter((item) => item.coverage >= 0.35);
  if (!validScores.length) return null;
  const best = validScores.reduce((top, item) => item.score > top.score ? item : top, validScores[0]);
  const playerName = get("Player Name") || get("Player") || get("Name");
  const age = safeNumber(get("Age"));
  const rawActualValue = get("Actual Value") || get("Value");
  const actualValue = safeNumber(get("Actual Value")) ?? safeNumber(get("Value"));
  const actualWage = safeNumber(get("Actual Wage")) ?? safeNumber(get("Wage"));
  const resolvedLeague = resolveLeague(role, get("Division"), options.leagueFallback, leagueContext);
  const league = resolvedLeague.data;
  const expectedValue = league && age !== null && [league.valueScoreCoef, league.valueAgeCoef, league.valueIntercept].every(Number.isFinite)
    ? Math.exp(league.valueScoreCoef * best.score + league.valueAgeCoef * age + league.valueIntercept)
    : null;
  const expectedWage = league && age !== null && [league.wageScoreCoef, league.wageAgeCoef, league.wageIntercept].every(Number.isFinite)
    ? Math.exp(league.wageScoreCoef * best.score + league.wageAgeCoef * age + league.wageIntercept)
    : null;

  const rawDivision = get("Division") || "Unknown";
  const club = get("Club") || get("Team") || "";
  const legacyId = `${playerName}-${role.id}`;
  const archetype = inferArchetype(role.id, best.label, row);
  return {
    id: makePlayerId({ playerName, roleId: role.id, club, division: rawDivision, age, rowIndex }),
    legacyId,
    player: playerName || "Unnamed player",
    club,
    role: role.id,
    division: resolvedLeague.matched ? resolvedLeague.name : rawDivision,
    sourceDivision: rawDivision,
    leagueBaseline: resolvedLeague.fallback ? resolvedLeague.name : "",
    age,
    minutes: safeNumber(get("Mins")),
    scores,
    bestRole: best.label.replace(" Score", ""),
    bestScore: best.score,
    rawOutputScore: best.rawOutput,
    coverage: best.coverage,
    actualValue,
    valueStatus: isNotForSaleValue(rawActualValue) ? "Not For Sale" : "",
    actualWage,
    expectedValue,
    expectedWage,
    valueRatio: expectedValue && actualValue ? expectedValue / actualValue : null,
    wageRatio: expectedWage && actualWage ? expectedWage / actualWage : null,
    archetype,
    source: row,
  };
}

export function inferArchetype(role, bestRole, row) {
  const fromCsv = rowGetter(row)("Archetype");
  if (fromCsv) return fromCsv;
  const lower = bestRole.toLowerCase();
  if (role === "GK") return "Shot-Stopper";
  if (lower.includes("ball")) return "Ball-Player";
  if (lower.includes("stopper")) return "Front-Foot Stopper";
  if (lower.includes("defensive")) return "Pressing FB";
  if (lower.includes("attacking")) return "Progressive FB";
  if (lower.includes("cdm")) return "Anchor";
  if (lower === "cm") return "Metronome";
  if (lower.includes("cam")) return "Creator";
  if (lower.includes("touchline")) return "Touchline Winger";
  if (lower.includes("inside")) return "Inside Forward";
  if (lower.includes("poacher")) return "Poacher";
  if (lower.includes("target")) return "Target Man";
  if (lower.includes("false")) return "False 9 / Creator";
  return bestRole;
}

export function recalcRows({ rows, roles, importRole, importRoleLocked, leagueFallback = "" }) {
  const entries = [];
  const selectedRole = importRole ? roleById(roles, importRole) : null;
  for (const [rowIndex, row] of rows.entries()) {
    const hintedRoles = roles.filter((role) => hasRoleHint(row, role));
    const inferredRole = selectedRole ? [selectedRole] : roles;
    const candidateRoles = importRoleLocked ? inferredRole : (hintedRoles.length ? hintedRoles : inferredRole);
    const scoredRoles = candidateRoles
      .map((role) => ({ role, calculated: scoreRole(row, role, rowIndex, { leagueFallback }) }))
      .filter((item) => item.calculated);

    if (hintedRoles.length) {
      scoredRoles.forEach((item) => entries.push(item.calculated));
    } else {
      const maxCoverage = Math.max(0, ...scoredRoles.map((item) => item.calculated.coverage));
      const bestCoverageRows = scoredRoles.filter((item) => item.calculated.coverage === maxCoverage);
      bestCoverageRows.forEach((item) => entries.push(item.calculated));
    }
  }

  for (const role of roles) {
    const group = entries.filter((item) => item.role === role.id);
    const scoreAvg = mean(group.map((item) => item.bestScore));
    const scoreSd = stdev(group.map((item) => item.bestScore));
    const valueAvg = mean(group.map((item) => item.actualValue).filter(Number.isFinite));
    const valueSd = stdev(group.map((item) => item.actualValue).filter(Number.isFinite));
    const wageAvg = mean(group.map((item) => item.actualWage).filter(Number.isFinite));
    const wageSd = stdev(group.map((item) => item.actualWage).filter(Number.isFinite));
    for (const item of group) {
      const zScore = (item.bestScore - scoreAvg) / scoreSd;
      const zValue = item.actualValue ? (valueAvg - item.actualValue) / valueSd : 0;
      const zWage = item.actualWage ? (wageAvg - item.actualWage) / wageSd : 0;
      item.totalVfm = zScore + zValue + zWage;
      item.dealFlag = dealFlag(item, role);
    }
  }
  entries.sort((a, b) => b.totalVfm - a.totalVfm);
  return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function dealFlag(item, role) {
  if (!item.bestScore || item.age === null) return "";
  if (item.valueStatus === "Not For Sale") return "Not For Sale";
  if (!item.actualValue && role.freeAgentThreshold && item.bestScore >= role.freeAgentThreshold) return "FREE - bargain";
  if (!item.actualValue) return "Free agent";
  if (!item.expectedValue) return "No league data";
  if (item.valueRatio >= 1.5) return "Great value";
  if (item.valueRatio < 0.6) return "Overpriced";
  return "Fair price";
}

export function scoreProfileForPlayer(player, role) {
  const cleanBestRole = String(player.bestRole || "").toLowerCase();
  return role.scoreColumns.find((score) => score.label.toLowerCase().includes(cleanBestRole)) || role.scoreColumns[0];
}


export function roleStatColumns(role, rows, limit = 6) {
  const displayLimit = role.id === "CB" ? Math.max(limit, 8) : limit;
  const requiredStats = role.id === "CB" ? ["Tackles Completed Per 90", "Tackle Completion %"] : [];
  const counts = new Map(role.scoreColumns.map((profile) => [profile.label, 0]));
  for (const row of rows) {
    const profile = scoreProfileForPlayer(row, role);
    if (profile) counts.set(profile.label, (counts.get(profile.label) || 0) + 1);
  }
  const profile = [...role.scoreColumns]
    .sort((a, b) => (counts.get(b.label) || 0) - (counts.get(a.label) || 0))[0];
  const stats = [...(profile?.stats || [])].sort((a, b) => b.weight - a.weight);
  const selected = stats.slice(0, displayLimit);

  for (const header of requiredStats) {
    if (selected.some((stat) => stat.header === header)) continue;
    const required = stats.find((stat) => stat.header === header);
    if (!required) continue;
    if (selected.length < displayLimit) {
      selected.push(required);
    } else {
      const replaceAt = selected.findLastIndex((stat) => !requiredStats.includes(stat.header));
      if (replaceAt >= 0) selected[replaceAt] = required;
    }
  }

  return selected.sort((a, b) => b.weight - a.weight).slice(0, displayLimit);
}

export function allRoleStatColumns(role) {
  const byHeader = new Map();
  for (const profile of role.scoreColumns) {
    for (const stat of profile.stats) {
      if (!byHeader.has(stat.header)) byHeader.set(stat.header, stat);
    }
  }

  const ordered = role.rawHeaders
    .filter((header) => byHeader.has(header))
    .map((header) => byHeader.get(header));
  const seen = new Set(ordered.map((stat) => stat.header));
  for (const stat of byHeader.values()) {
    if (!seen.has(stat.header)) ordered.push(stat);
  }
  return ordered;
}

export function roleSheetRows(rows, statColumns) {
  return rows.map((row) => {
    const get = rowGetter(row.source);
    const statValues = Object.fromEntries(statColumns.map((stat) => [statColumnKey(stat), {
      label: stat.header,
      value: valueForStat(get, stat),
    }]));
    return { ...row, ...statValues };
  });
}

export function statColumnKey(stat) {
  return `stat:${stat.header}`;
}

export function percentileForStat(player, stat, role, players) {
  if (!player) return 0;
  const value = valueForStat(rowGetter(player.source), stat);
  if (value === null) return 0;
  const values = players
    .filter((item) => item.role === role.id)
    .map((item) => valueForStat(rowGetter(item.source), stat))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!values.length) return 0;
  const betterOrEqual = stat.direction < 0
    ? values.filter((item) => item >= value).length
    : values.filter((item) => item <= value).length;
  return Math.round(clamp((betterOrEqual / values.length) * 100, 1, 99));
}

export function similarPlayers(player, players, roles) {
  if (!player) return [];
  const role = roleById(roles, player.role);
  const score = role.scoreColumns.find((item) => item.label.includes(player.bestRole)) || role.scoreColumns[0];
  const base = score.stats.map((stat) => valueForStat(rowGetter(player.source), stat));
  return players
    .filter((item) => item.id !== player.id && item.role === player.role)
    .map((item) => {
      const vec = score.stats.map((stat) => valueForStat(rowGetter(item.source), stat));
      let sum = 0;
      let count = 0;
      vec.forEach((value, index) => {
        if (value !== null && base[index] !== null) {
          const sd = score.stats[index].stdev || 1;
          sum += ((value - base[index]) / sd) ** 2;
          count += 1;
        }
      });
      const similarity = count ? Math.round(clamp(100 * Math.exp(-Math.sqrt(sum / count) / 2), 0, 100)) : 0;
      return { ...item, similarity };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}







