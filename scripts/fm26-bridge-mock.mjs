import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] || process.env.PORT || 8711);
const host = process.env.HOST || "127.0.0.1";
const sampleCsv = fs.readFileSync(path.join(root, "sample-moneyball-import.csv"), "utf8");

function snapshot(kind) {
  return {
    source: "fm26-bepinex-mock",
    kind,
    saveName: "Mock FM26 Save",
    club: kind === "recruitment" ? "Recruitment Pool" : kind === "benchmark" ? "Benchmark XI" : "Current Squad",
    screen: kind === "recruitment" ? "Player Search" : "Squad",
    exportedAt: new Date().toISOString(),
    csv: sampleCsv,
  };
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

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, source: "fm26-bepinex-mock" }));
    return;
  }

  if (!kind) {
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Unknown mock bridge endpoint" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(snapshot(kind)));
});

server.listen(port, host, () => {
  console.log(`FM26 mock bridge running at http://${host}:${port}/`);
});
