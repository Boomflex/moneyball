import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] || process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
]);

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const target = path.resolve(root, decoded === "/" ? "index.html" : decoded.slice(1));
  return target.startsWith(root) ? target : null;
}

const server = http.createServer((req, res) => {
  const target = safePath(req.url || "/");
  if (!target) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(target, (error, data) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500);
      res.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types.get(path.extname(target).toLowerCase()) || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Moneyball app running at http://${host}:${port}/`);
});