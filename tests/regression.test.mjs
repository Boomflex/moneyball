import assert from "node:assert/strict";
import fs from "node:fs";
import { WORKBOOK_MODEL } from "../src/model.js";
import { applyLeagueOverrides, resolveLeague } from "../src/league-overrides.js";
import { analyzeImport, inferImportRole, parseCsv } from "../src/importer.js";
import { controlProfileForRow, recalcRows } from "../src/scoring.js";
import { parseFmScreenshotText, screenshotDraftToRow } from "../src/screenshot-importer.js";

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

const controlRole = MODEL.roles.find((role) => role.id === "Winger");
const controlProfile = controlProfileForRow({
  Division: "NIFL Premiership",
  "Expected Assists Per 90": "0.30",
  "Open Play Key Passes Per 90": "1.20",
  "Goals Per 90": "0.40",
  "Expected Goals Per 90": "0.35",
  "Shots Per 90": "2.10",
  "Pressures Won Per 90": "5.50",
  "Pressures Attempted Per 90": "10.00",
  "Possession Won Per 90": "6.20",
  "Possession Lost Per 90": "9.00",
  "Passes Attempted Per 90": "42.00",
}, controlRole);
assert.ok(Number.isFinite(controlProfile.controlRaw), "Control Score raw calculation should be finite when inputs are present");
assert.equal(round1(controlProfile.controlCoverage * 100), 100, "Control Score should report full coverage when all inputs are present");

const screenshotText = `Bundesliga 2
Goals 3
Expected Goals 2.15
Expected Goals/90 mins 0.23
Assists 2
Expected Assists 2.35
Expected Assists/90 Mins 0.25
Chances Created 4
Goal Attempts 12
Shots on Target/90 mins 0.65
Key Passes 10
Progressive Passes/90 mins 2.48
Minutes on Pitch Per Goal 278.67
Minutes on Pitch Per Assist 418.00
Pass Completion Percentage 92
Interceptions 4
Bundesliga 2 10 3 2 2.2 2.3 1 2 0 0 92% 6.91`;
const screenshotDraft = parseFmScreenshotText(screenshotText, {
  "Player Name": "Tobias Oelschlagel",
  "Age": "21",
  "Best Position": "Midfielder/Attacking Midfielder (Centre)",
});
const screenshotRow = screenshotDraftToRow(screenshotDraft);
assert.equal(screenshotDraft.meta.Division, "Bundesliga 2", "screenshot parser should keep numbered division names");
assert.equal(screenshotRow.Mins, "841", "screenshot parser should estimate minutes from totals and per-90s");
assert.equal(screenshotRow["Average Rating"], "6.91", "screenshot parser should read average rating from selected competition row");
assert.equal(screenshotRow["Pass Completion %"], "0.92", "screenshot parser should normalize percentage stats to workbook scale");
assert.equal(screenshotRow["Shots On Target %"], "0.51", "screenshot parser should derive shot accuracy when only SOT per-90 is shown");

const noisyHeaderText = `60 FPS]
= Eintracht Frankfurt (H;
Portal Squad - Recruitment Match Day Cb Geer - ENN a d
Overview FirstTeam Under19s 1.FCKOInIl Training Youth Setup v Dynamics v More v
Overview > First Team > Player Report
= U National: Yes
~, Jerath Jurgeleit fg (02005706754) LO Kon as lu | (c) Coy (c) \u00a33w-esam
: rent por sty
"A | Attacking Midfielder (Left) Regular Starter es evolve: EN =
v vo POR - Tactical Role: Condition: EUR | 12U21 caps 4 goals \u00a319.25K p/w 30/6/2070
F (c) GER 19 years old (7/4/2047) ual Playing Time For
L Important Player Inge Sharpness LANE |`;
const noisyHeaderDraft = parseFmScreenshotText(noisyHeaderText);
assert.equal(noisyHeaderDraft.meta.Age, "19", "screenshot parser should still extract age from noisy header OCR");
assert.equal(noisyHeaderDraft.meta["Best Position"], "Attacking Midfielder (Left)", "screenshot parser should trim noisy position lines");
assert.equal(noisyHeaderDraft.meta["Actual Wage (\u00a3/wk)"], "\u00a319.25K p/w", "screenshot parser should keep the wage from noisy header OCR");
assert.equal(noisyHeaderDraft.meta["Actual Value (\u00a3)"], "", "screenshot parser should ignore broken currency fragments");
assert.equal(noisyHeaderDraft.meta.Division, "", "screenshot parser should not treat national status or navigation as a division");
assert.equal(noisyHeaderDraft.meta.Club, "", "screenshot parser should not infer club from noisy role-header fragments");

const noisyMergedText = `${noisyHeaderText}

--- Enhanced stat panel OCR ---

Bundesliga 2
Attacking
Goals 3
Expected Goals 2.15
Expected Goals/90 mins 0.23
Assists 2
Expected Assists/90 Mins 0.25
Chances Created 4
Goal Attempts 12
Shots on Target/90 mins 0.65
Key Passes 10
Progressive Passes/90 mins 2.48
Passes Completed/90 Mins 21.10
Pass Completion Percentage 92
Possession Won/90 Mins 9.37
Possession Lost/90 Mins 13.13
Interceptions 4
Bundesliga 2 10 3 2 2.2 2.3 1 2 0 0 92% 6.91`;
const noisyMergedDraft = parseFmScreenshotText(noisyMergedText);
const noisyMergedRow = screenshotDraftToRow(noisyMergedDraft);
assert.equal(noisyMergedDraft.meta.Division, "Bundesliga 2", "enhanced stat OCR should restore the selected competition");
assert.equal(noisyMergedRow["Non Penalty xGoals Per 90"], "0.23", "enhanced stat OCR should read xG per 90");
assert.equal(noisyMergedRow["Progressive Passes Per 90"], "2.48", "enhanced stat OCR should read progressive passing");
assert.equal(noisyMergedRow["Possession Won Per 90"], "9.37", "enhanced stat OCR should read possession won");
assert.equal(noisyMergedRow["Average Rating"], "6.91", "enhanced stat OCR should keep table average rating");
const screenshotImportRole = inferImportRole([screenshotRow], MODEL.roles);
const screenshotPlayers = recalcRows({ rows: [screenshotRow], roles: MODEL.roles, importRole: screenshotImportRole.id, importRoleLocked: screenshotImportRole.locked });
assert.ok(screenshotPlayers.length > 0, "screenshot row should produce scored role entries");
console.log(`Regression checks passed for ${Object.keys(EXPORTS).length - skipped.length} available exports${skipped.length ? `; skipped missing fixtures: ${skipped.join(", ")}` : ""}.`);








