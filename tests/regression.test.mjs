import assert from "node:assert/strict";
import fs from "node:fs";
import { WORKBOOK_MODEL } from "../src/model.js";
import { applyLeagueOverrides } from "../src/league-overrides.js";
import { analyzeImport, inferImportRole, parseCsv } from "../src/importer.js";
import { recalcRows } from "../src/scoring.js";

const MODEL = applyLeagueOverrides(WORKBOOK_MODEL);

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
  assert.equal(importRole.locked, true, `${name} should be locked by export shape or position`);
  assert.equal(round1(importRole.coverage * 100), fixture.expected.coverage ?? 100, `${name} header coverage changed`);
  assert.equal(report.detectedRole, fixture.expected.importRole, `${name} report detected role changed`);
  if (fixture.expected.positionMatched) assert.equal(importRole.positionMatched, true, `${name} should be detected from FM position`);
  assert.equal(players.length, fixture.expected.entries, `${name} role entry count changed`);

  assert.equal(top.player, fixture.expected.top.player, `${name} top player changed`);
  assert.equal(top.role, fixture.expected.top.role, `${name} top role changed`);
  assert.equal(top.bestRole, fixture.expected.top.bestRole, `${name} top role fit changed`);
  assert.equal(round1(top.bestScore), fixture.expected.top.bestScore, `${name} top score changed`);
  assert.equal(round1(top.totalVfm), fixture.expected.top.totalVfm, `${name} top total VFM changed`);
  assert.equal(round1(top.valueRatio), fixture.expected.top.valueRatio, `${name} top value ratio changed`);
  assert.equal(top.dealFlag, fixture.expected.top.dealFlag, `${name} top deal flag changed`);

  if (name === "GK") {
    assert.ok(report.derivedFields.some((field) => field.includes("Save Ability")), "GK import should report Save Ability per-90 derivation");
  }

  if (name === "Winger") {
    assert.ok(report.derivedFields.some((field) => field.includes("xG-OP")), "Winger import should report xG-OP per-90 derivation");
  }
}

for (const role of MODEL.roles) {
  const nationalLeague = role.leagues["Vanarama National League"];
  const nifl = role.leagues["NIFL Premiership"];
  assert.ok(nifl, `${role.id} should include NIFL Premiership league data`);
  assert.equal(Number(nifl.strength.toFixed(1)), Number((nationalLeague.strength - 0.1).toFixed(1)), `${role.id} NIFL strength should sit one tick below Vanarama National League`);
  assert.equal(nifl.valueScoreCoef, nationalLeague.valueScoreCoef, `${role.id} NIFL value score coefficient should mirror Vanarama National League`);
  assert.equal(nifl.wageScoreCoef, nationalLeague.wageScoreCoef, `${role.id} NIFL wage score coefficient should mirror Vanarama National League`);
}
console.log(`Regression checks passed for ${Object.keys(EXPORTS).length - skipped.length} available exports${skipped.length ? `; skipped missing fixtures: ${skipped.join(", ")}` : ""}.`);








