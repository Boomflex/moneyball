const OVERRIDES = [
  {
    names: ["NIFL Premiership", "Northern Irish Premiership"],
    baseLeague: "Vanarama National League",
    strengthDelta: -0.1,
    note: "Opta Power Rankings: one rank below the English National League.",
  },
];

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
