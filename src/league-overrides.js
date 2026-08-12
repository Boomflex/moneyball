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
  {
    names: ["Brazilian National First Division"],
    baseLeague: "Sky Bet League One",
    strengthDelta: 0,
    ifMissingOnly: true,
    note: "Derived baseline: workbook has no native Brazilian National First Division data for this role, so it uses Sky Bet League One until a dedicated baseline exists.",
  },
  {
    names: ["K League 1"],
    baseLeague: "Swedish Premier Division",
    strengthDelta: 0,
    note: "Derived baseline: workbook has no native K League 1 data, so it uses Swedish Premier Division until a dedicated baseline exists.",
  },
  {
    names: ["J1 League"],
    baseLeague: "Norwegian Premier Division",
    strengthDelta: 0,
    note: "Derived baseline: workbook has no native J1 League data, so it uses Norwegian Premier Division until a dedicated baseline exists.",
  },
  {
    names: ["Belgian Pro League"],
    baseLeague: "Norwegian Premier Division",
    strengthDelta: 0,
    note: "Derived baseline: workbook has no native Belgian Pro League data, so it uses Norwegian Premier Division until a dedicated baseline exists.",
  },
  {
    names: ["Argentine Premier Division"],
    baseLeague: "Norwegian Premier Division",
    strengthDelta: 0,
    ifMissingOnly: true,
    note: "Derived baseline: workbook has no native Argentine Premier Division data for this role, so it uses Norwegian Premier Division until a dedicated baseline exists.",
  },
  {
    names: ["Uruguayan First Division"],
    baseLeague: "Norwegian Premier Division",
    strengthDelta: 0,
    ifMissingOnly: true,
    note: "Derived baseline: workbook has no native Uruguayan First Division data for this role, so it uses Norwegian Premier Division until a dedicated baseline exists.",
  },
  {
    names: ["Mexican First Division"],
    baseLeague: "Norwegian Premier Division",
    strengthDelta: 0,
    ifMissingOnly: true,
    note: "Derived baseline: workbook has no native Mexican First Division data for this role, so it uses Norwegian Premier Division until a dedicated baseline exists.",
  },
];

const LEAGUE_ALIASES = new Map([
  ["englishnationalleague", "Vanarama National League"],
  ["firstdivisionid102423", "Brazilian National First Division"],
  ["ligue1mcdonalds", "Ligue 1 Uber Eats"],
  ["mls", "Major League Soccer"],
  ["majorleaguesoccer", "Major League Soccer"],
  ["northernirelandpremiership", "NIFL Premiership"],
  ["northernirishpremiership", "NIFL Premiership"],
  ["niflpremierleague", "NIFL Premiership"],
  ["niflpremiership", "NIFL Premiership"],
]);

const BASED_IN_LEAGUE_ALIASES = new Map([
  ["firstdivision|bra", "Brazilian National First Division"],
  ["firstdivision|brazil", "Brazilian National First Division"],
  ["firstdivision|arg", "Argentine Premier Division"],
  ["firstdivision|argentina", "Argentine Premier Division"],
  ["firstdivision|bel", "Belgian Pro League"],
  ["firstdivision|belgium", "Belgian Pro League"],
  ["firstdivision|mex", "Mexican First Division"],
  ["firstdivision|mexico", "Mexican First Division"],
  ["firstleague|bih", "Bosnian Premier League"],
  ["firstleague|bosnia", "Bosnian Premier League"],
  ["firstleague|bosniaandherzegovina", "Bosnian Premier League"],
  ["firstleague|bul", "Bulgarian First League"],
  ["firstleague|bulgaria", "Bulgarian First League"],
  ["j1league|jpn", "J1 League"],
  ["j1league|japan", "J1 League"],
  ["premierdivision|nor", "Norwegian Premier Division"],
  ["premierdivision|norway", "Norwegian Premier Division"],
  ["premierdivision|arg", "Argentine Premier Division"],
  ["premierdivision|argentina", "Argentine Premier Division"],
  ["premierdivision|swe", "Swedish Premier Division"],
  ["premierdivision|sweden", "Swedish Premier Division"],
  ["premierleague|uru", "Uruguayan First Division"],
  ["premierleague|uruguay", "Uruguayan First Division"],
  ["premierleague|ukr", "Ukrainian Premier League"],
  ["premierleague|ukraine", "Ukrainian Premier League"],
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
        if (override.ifMissingOnly && role.leagues[name]) continue;
        role.leagues[name] = { ...derived };
      }
    }
  }

  return model;
}

export function resolveLeague(role, rawDivision, fallbackLeague = "", context = {}) {
  const division = String(rawDivision || "").trim();
  if (!division) return { name: "", data: null, matched: false };
  if (role.leagues[division]) return { name: division, data: role.leagues[division], matched: true };

  const normalised = normalise(division);
  const basedIn = normalise(context.basedIn || context.leagueCountry || context.country || "");
  const basedInAlias = BASED_IN_LEAGUE_ALIASES.get(`${normalised}|${basedIn}`);
  if (basedInAlias && role.leagues[basedInAlias]) {
    return { name: basedInAlias, data: role.leagues[basedInAlias], matched: true, aliasFrom: division };
  }

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
    const fallback = resolveLeague(role, fallbackName, "", context);
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
