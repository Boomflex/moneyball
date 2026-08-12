import { normalise } from "./utils.js";

const OVERRIDES = [
  {
    names: ["NIFL Premiership", "Northern Irish Premiership"],
    baseLeague: "Vanarama National League",
    strengthDelta: -0.1,
    note: "Opta Power Rankings: one rank below the English National League.",
  },
  {
    names: ["Major League Soccer"],
    baseLeague: "Sky Bet League One",
    strengthDelta: 0,
    note: "Derived baseline: workbook has no native MLS league data, so MLS uses Sky Bet League One until a dedicated baseline exists.",
  },
];

const LEAGUE_ALIASES = new Map([
  ["englishnationalleague", "Vanarama National League"],
  ["mls", "Major League Soccer"],
  ["majorleaguesoccer", "Major League Soccer"],
  ["northernirelandpremiership", "NIFL Premiership"],
  ["northernirishpremiership", "NIFL Premiership"],
  ["niflpremierleague", "NIFL Premiership"],
  ["niflpremiership", "NIFL Premiership"],
]);

export function applyLeagueOverrides(model) {
  for (const role of model.roles) {
    for (const override of OVERRIDES) {
      const base = role.leagues[override.baseLeague];
      if (!base) continue;

      const derived = {
        ...base,
        strength: Number((base.strength + override.strengthDelta).toFixed(1)),
        sourceNote: override.note,
      };

      for (const name of override.names) {
        role.leagues[name] = { ...derived };
      }
    }
  }

  return model;
}

export function resolveLeague(role, rawDivision, fallbackLeague = "") {
  const division = String(rawDivision || "").trim();
  if (!division) return { name: "", data: null, matched: false };
  if (role.leagues[division]) return { name: division, data: role.leagues[division], matched: true };

  const normalised = normalise(division);
  const alias = LEAGUE_ALIASES.get(normalised);
  if (alias && role.leagues[alias]) {
    return { name: alias, data: role.leagues[alias], matched: true, aliasFrom: division };
  }

  const exactNormalised = Object.keys(role.leagues).find((name) => normalise(name) === normalised);
  if (exactNormalised) {
    return { name: exactNormalised, data: role.leagues[exactNormalised], matched: true, aliasFrom: division };
  }

  const fallbackName = String(fallbackLeague || "").trim();
  if (fallbackName) {
    const fallback = resolveLeague(role, fallbackName, "");
    if (fallback.data) {
      return {
        name: fallback.name,
        data: fallback.data,
        matched: false,
        fallback: true,
        fallbackFrom: division,
      };
    }
  }

  return { name: division, data: null, matched: false };
}
