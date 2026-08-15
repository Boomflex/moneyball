import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import process from "node:process";

const port = Number(process.argv[2] || process.env.PORT || 8711);
const host = process.env.HOST || "127.0.0.1";
const defaultExportDir = path.join(
  os.homedir(),
  "OneDrive",
  "Documents",
  "Sports Interactive",
  "Football Manager 26",
  "FM26PlayerExport by vinteset",
  "Exports CSV",
);
const exportDir = path.resolve(process.env.FM26_EXPORT_DIR || process.argv[3] || defaultExportDir);

function csvFiles() {
  return fs.readdirSync(exportDir)
    .filter((name) => name.toLowerCase().endsWith(".csv"))
    .map((name) => {
      const filePath = path.join(exportDir, name);
      const stat = fs.statSync(filePath);
      return { name, filePath, modifiedMs: stat.mtimeMs, size: stat.size };
    })
    .sort((a, b) => b.modifiedMs - a.modifiedMs);
}

function latestCsv() {
  const files = csvFiles();
  if (!files.length) throw new Error(`No CSV exports found in ${exportDir}`);
  return files[0];
}

function snapshot(kind) {
  const file = latestCsv();
  return {
    source: "fm26-player-export-folder",
    kind,
    saveName: "FM26 latest export",
    club: kind === "benchmark" ? "Benchmark squad" : kind === "squad" ? "Current squad" : "Recruitment pool",
    screen: file.name,
    exportDir,
    exportedAt: new Date(file.modifiedMs).toISOString(),
    csv: fs.readFileSync(file.filePath, "utf8"),
  };
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  const kind = url.pathname.match(/^\/snapshot\/(recruitment|squad|benchmark)$/)?.[1];

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (url.pathname === "/health") {
      const files = csvFiles();
      json(res, 200, {
        ok: true,
        source: "fm26-player-export-folder",
        exportDir,
        csvCount: files.length,
        latest: files[0]?.name || null,
        latestModifiedMs: files[0]?.modifiedMs || null,
        latestExportedAt: files[0] ? new Date(files[0].modifiedMs).toISOString() : null,
      });
      return;
    }

    if (!kind) {
      json(res, 404, { error: "Unknown export bridge endpoint" });
      return;
    }

    json(res, 200, snapshot(kind));
  } catch (error) {
    json(res, 500, {
      error: error?.message || "Could not read FM26 export folder",
      exportDir,
    });
  }
});

server.listen(port, host, () => {
  console.log(`FM26 export bridge running at http://${host}:${port}/`);
  console.log(`Reading latest CSV from ${exportDir}`);
});
