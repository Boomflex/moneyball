import { normalise } from "./utils.js";

const OVERRIDES = [
  {
    names: ["NIFL Premiership", "Northern Irish Premiership"],
    baseLeague: "Vanarama National League",
    strengthDelta: -0.1,
    note: "Opta Power Rankings: one rank below the English National League.",
  },
];

const LEAGUE_ALIASES = new Map([
  ["englishnationalleague", "Vanarama National League"],
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

export function resolveLeague(role, rawDivision) {
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

  return { name: division, data: null, matched: false };
}
