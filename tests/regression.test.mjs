import assert from "node:assert/strict";
import fs from "node:fs";
import { WORKBOOK_MODEL } from "../src/model.js";
import { applyLeagueOverrides, resolveLeague } from "../src/league-overrides.js";
import { analyzeImport, applySquadDivisionOverride, dominantDivisionForRows, inferImportRole, parseCsv, rowGetter } from "../src/importer.js";
import { dealFlag, percentileForStat, recalcRows, valueForStat } from "../src/scoring.js";
import { goodLookBand } from "../src/good-look.js";

const MODEL = applyLeagueOverrides(WORKBOOK_MODEL);

const mixedSquadRows = [
  { Player: "First", Division: "Premier League" },
  { Player: "Second", Division: "Regional Div. West" },
  { Player: "Third", Division: "Premier League" },
];
assert.equal(dominantDivisionForRows(mixedSquadRows), "Premier League", "Squad imports should default to their dominant division");
const overriddenSquadRows = applySquadDivisionOverride(mixedSquadRows, "Premier League");
assert.ok(overriddenSquadRows.every((row) => row.Division === "English Premier Division"), "Squad division override should resolve FM's Premier League label for scoring");
assert.equal(mixedSquadRows[1].Division, "Regional Div. West", "Squad division override should preserve imported rows");

const percentileRole = { id: "Test" };
const percentilePlayers = [1, 2, 3].map((value) => ({ role: "Test", source: { Metric: value } }));
assert.ok(
  percentileForStat(percentilePlayers[0], { header: "Metric", direction: -1 }, percentileRole, percentilePlayers)
    > percentileForStat(percentilePlayers[2], { header: "Metric", direction: -1 }, percentileRole, percentilePlayers),
  "Lower-is-better metrics should invert percentile rank",
);
assert.equal(
  valueForStat(rowGetter({ "Pres C/90": "1.8" }), { header: "Pressures Completed Per 90" }),
  1.8,
  "FM pressure completed shorthand should map to Pressures Completed Per 90",
);
assert.equal(
  goodLookBand({ roleId: "Striker", header: "Goals Per 90", value: 0.5 })?.label,
  "Elite",
  "Forward goals above the Mustermann 80th percentile should be elite",
);
assert.equal(
  goodLookBand({ roleId: "CB", header: "Possession Lost Per 90", value: 13 })?.label,
  "Below",
  "Lower-is-better Mustermann bands should flag poor possession security",
);
const fallbackLeague = resolveLeague(MODEL.roles[0], "Made Up Super League", "Vanarama National League");
assert.equal(fallbackLeague.name, "Vanarama National League", "Unmatched divisions should be able to use a fallback league baseline");
assert.equal(fallbackLeague.matched, false, "Fallback league baselines should not pretend the raw division matched");
assert.equal(fallbackLeague.fallback, true, "Fallback league baselines should be marked as fallback data");
const mlsLeague = resolveLeague(MODEL.roles[0], "MLS");
assert.equal(mlsLeague.name, "Major League Soccer", "MLS should resolve to the derived Major League Soccer baseline");
assert.equal(mlsLeague.matched, true, "MLS alias should count as matched league data");
assert.equal(
  analyzeImport([{ Player: "Test", Division: "Made Up Super League" }], MODEL.roles, { id: "CB", locked: true }).unmatchedDivisions[0]?.division,
  "Made Up Super League",
  "Import report should list unmatched division names",
);
assert.equal(
  dealFlag({ bestScore: 99, age: 21, actualValue: null, valueStatus: "Not For Sale" }, { freeAgentThreshold: 1 }),
  "Not For Sale",
  "Not for sale exports should not be treated as free-agent bargains",
);

const EXPORTS = {
  GK: {
    path: "C:/Users/jakek/OneDrive/Documents/Sports Interactive/Football Manager 26/FM26PlayerExport by vinteset/Exports CSV/moneyball_export_20260718_134937.csv",
    expected: { rowCount: 223, importRole: "GK", entries: 223, top: { player: "Craig Mairs", role: "GK", bestRole: "GK", bestScore: 39.1, totalVfm: 3.3, valueRatio: 1.9, dealFlag: "Great value" } },
  },
  FB: {
    path: "C:/Users/jakek/OneDrive/Documents/Sports Interactive/Football Manager 26/FM26PlayerExport by vinteset/Exports CSV/moneyball_export_20260718_145856.csv",
    expected: { rowCount: 256, importRole: "FB", entries: 256, top: { player: "Mame Ass Barro", role: "FB", bestRole: "Attacking WB", bestScore: 41.9, totalVfm: 4.2, valueRatio: 344.7, dealFlag: "Great value" } },
  },
  CB: {
    path: "C:/Users/jakek/OneDrive/Documents/Sports Interactive/Football Manager 26/FM26PlayerExport by vinteset/Exports CSV/moneyball_export_20260718_145956.csv",
    expected: { rowCount: 323, importRole: "CB", entries: 323, top: { player: "Daniel Dickens", role: "CB", bestRole: "Ball-Playing", bestScore: 26.1, totalVfm: 1.9, valueRatio: 10.3, dealFlag: "Great value" } },
  },
  WillumCB: {
    path: "C:/Users/jakek/OneDrive/Documents/Sports Interactive/Football Manager 26/FM26PlayerExport by vinteset/Exports CSV/moneyball_export_20260719_134047.csv",
    expected: { rowCount: 8, importRole: "CB", coverage: 93.3, entries: 8, positionMatched: true, top: { player: "Kennie Cockburn", role: "CB", bestRole: "Stopper", bestScore: 26.7, totalVfm: 1.5, valueRatio: null, dealFlag: "No league data" } },
  },
  MixedBestPos: {
    path: "C:/Users/jakek/OneDrive/Documents/Sports Interactive/Football Manager 26/FM26PlayerExport by vinteset/Exports CSV/moneyball_export_20260720_095224.csv",
    expected: { rowCount: 160, importRole: null, locked: false, coverage: 100, entries: 182, positionMatched: true, roleCounts: { MID: 64, Winger: 39, CB: 36, FB: 23, Striker: 20 } },
  },
  CorrectedRioTinto: {
    path: "C:/Users/jakek/OneDrive/Documents/Sports Interactive/Football Manager 26/FM26PlayerExport by vinteset/Exports CSV/moneyball_export_20260721_212326.csv",
    expected: { rowCount: 31, importRole: "CB", coverage: 93.3, entries: 31, positionMatched: true, top: { player: "Denis Moukoko", role: "CB", bestRole: "Stopper", bestScore: 27.3, totalVfm: 2.1, valueRatio: null, dealFlag: "No league data" }, players: { "Abulai Mendy": { division: "No league data", bestScore: 22.2, dealFlag: "FREE - bargain" } }, noteIncludes: "Rio Tinto division corrected to No league data" },
  },
  CM: {
    path: "C:/Users/jakek/OneDrive/Documents/Sports Interactive/Football Manager 26/FM26PlayerExport by vinteset/Exports CSV/moneyball_export_20260718_152255.csv",
    expected: { rowCount: 213, importRole: "MID", entries: 213, top: { player: "Rob Leather", role: "MID", bestRole: "CAM", bestScore: 44.1, totalVfm: 3.5, valueRatio: 2.3, dealFlag: "Great value" } },
  },
  CAM: {
    path: "C:/Users/jakek/OneDrive/Documents/Sports Interactive/Football Manager 26/FM26PlayerExport by vinteset/Exports CSV/moneyball_export_20260718_152409.csv",
    expected: { rowCount: 62, importRole: "MID", entries: 62, top: { player: "Dwayne Edwards", role: "MID", bestRole: "CAM", bestScore: 40.4, totalVfm: 2.2, valueRatio: 1.3, dealFlag: "Fair price" } },
  },
  Striker: {
    path: "C:/Users/jakek/OneDrive/Documents/Sports Interactive/Football Manager 26/FM26PlayerExport by vinteset/Exports CSV/moneyball_export_20260718_182900.csv",
    expected: { rowCount: 260, importRole: "Striker", entries: 260, top: { player: "Lee Clarke", role: "Striker", bestRole: "False 9 / Creator", bestScore: 59.3, totalVfm: 3.6, valueRatio: 0.7, dealFlag: "Fair price" } },
  },
  Winger: {
    path: "C:/Users/jakek/OneDrive/Documents/Sports Interactive/Football Manager 26/FM26PlayerExport by vinteset/Exports CSV/moneyball_export_20260718_184114.csv",
    expected: { rowCount: 256, importRole: "Winger", entries: 256, top: { player: "Rex Campbell", role: "Winger", bestRole: "Touchline Winger", bestScore: 45.7, totalVfm: 3.2, valueRatio: 47.6, dealFlag: "Great value" } },
  },
};

const round1 = (value) => value === null || value === undefined ? null : Number(value.toFixed(1));
const skipped = [];

for (const [name, fixture] of Object.entries(EXPORTS)) {
  if (!fs.existsSync(fixture.path)) {
    skipped.push(name);
    continue;
  }
  const rows = parseCsv(fs.readFileSync(fixture.path, "utf8"));
  const importRole = inferImportRole(rows, MODEL.roles);
  const report = analyzeImport(rows, MODEL.roles, importRole);
  const players = recalcRows({ rows, roles: MODEL.roles, importRole: importRole.id, importRoleLocked: importRole.locked });
  const top = players[0];

  assert.equal(rows.length, fixture.expected.rowCount, `${name} row count changed`);
  assert.equal(importRole.id, fixture.expected.importRole, `${name} detected role changed`);
  assert.equal(importRole.locked, fixture.expected.locked ?? true, `${name} lock state changed`);
  assert.equal(round1(importRole.coverage * 100), fixture.expected.coverage ?? 100, `${name} header coverage changed`);
  assert.equal(report.detectedRole, fixture.expected.importRole, `${name} report detected role changed`);
  if (fixture.expected.positionMatched) assert.equal(importRole.positionMatched, true, `${name} should be detected from FM position`);
  assert.equal(players.length, fixture.expected.entries, `${name} role entry count changed`);
  if (fixture.expected.roleCounts) {
    const roleCounts = Object.fromEntries(MODEL.roles.map((role) => [role.id, players.filter((player) => player.role === role.id).length]).filter(([, count]) => count));
    assert.deepEqual(roleCounts, fixture.expected.roleCounts, `${name} role mix changed`);
  }

  if (fixture.expected.top) {
    assert.equal(top.player, fixture.expected.top.player, `${name} top player changed`);
    assert.equal(top.role, fixture.expected.top.role, `${name} top role changed`);
    assert.equal(top.bestRole, fixture.expected.top.bestRole, `${name} top role fit changed`);
    assert.equal(round1(top.bestScore), fixture.expected.top.bestScore, `${name} top score changed`);
    assert.equal(round1(top.totalVfm), fixture.expected.top.totalVfm, `${name} top total VFM changed`);
    assert.equal(round1(top.valueRatio), fixture.expected.top.valueRatio, `${name} top value ratio changed`);
    assert.equal(top.dealFlag, fixture.expected.top.dealFlag, `${name} top deal flag changed`);
  }
  if (fixture.expected.players) {
    for (const [playerName, expectedPlayer] of Object.entries(fixture.expected.players)) {
      const player = players.find((item) => item.player === playerName);
      assert.ok(player, `${name} should include ${playerName}`);
      if ("division" in expectedPlayer) assert.equal(player.division, expectedPlayer.division, `${name} ${playerName} division changed`);
      if ("bestScore" in expectedPlayer) assert.equal(round1(player.bestScore), expectedPlayer.bestScore, `${name} ${playerName} score changed`);
      if ("dealFlag" in expectedPlayer) assert.equal(player.dealFlag, expectedPlayer.dealFlag, `${name} ${playerName} deal flag changed`);
    }
  }

  if (fixture.expected.noteIncludes) {
    assert.ok(report.derivedFields.some((field) => field.includes(fixture.expected.noteIncludes)), `${name} should report source correction`);
  }

  if (name === "GK") {
    assert.ok(report.derivedFields.some((field) => field.includes("Save Ability")), "GK import should report Save Ability per-90 derivation");
  }

  if (name === "Winger") {
    assert.ok(report.derivedFields.some((field) => field.includes("xG-OP")), "Winger import should report xG-OP per-90 derivation");
  }
}


const sampleRows = parseCsv(fs.readFileSync(new URL("../sample-moneyball-import.csv", import.meta.url), "utf8"));
const sampleImportRole = inferImportRole(sampleRows, MODEL.roles);
const samplePlayers = recalcRows({ rows: sampleRows, roles: MODEL.roles, importRole: sampleImportRole.id, importRoleLocked: sampleImportRole.locked });
assert.equal(sampleRows.length, 2, "sample CSV row count changed");
assert.ok(samplePlayers.length > 0, "sample CSV should produce scored role entries");
assert.equal(new Set(samplePlayers.map((player) => player.id)).size, samplePlayers.length, "scored players should have unique stable IDs");
assert.ok(samplePlayers.every((player) => player.legacyId && player.id !== player.legacyId), "scored players should retain legacy IDs for saved scout records");
for (const role of MODEL.roles) {
  const nationalLeague = role.leagues["Vanarama National League"];
  const nifl = role.leagues["NIFL Premiership"];
  assert.ok(nifl, `${role.id} should include NIFL Premiership league data`);
  assert.equal(Number(nifl.strength.toFixed(1)), Number((nationalLeague.strength - 0.1).toFixed(1)), `${role.id} NIFL strength should sit one tick below Vanarama National League`);
  assert.equal(nifl.valueScoreCoef, nationalLeague.valueScoreCoef, `${role.id} NIFL value score coefficient should mirror Vanarama National League`);
  assert.equal(nifl.wageScoreCoef, nationalLeague.wageScoreCoef, `${role.id} NIFL wage score coefficient should mirror Vanarama National League`);
  assert.equal(resolveLeague(role, "Northern Ireland Premiership").name, "NIFL Premiership", `${role.id} Northern Ireland Premiership alias should resolve to NIFL Premiership`);
}


console.log(`Regression checks passed for ${Object.keys(EXPORTS).length - skipped.length} available exports${skipped.length ? `; skipped missing fixtures: ${skipped.join(", ")}` : ""}.`);








