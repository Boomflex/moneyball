export const FM26_BRIDGE_DEFAULT_URL = "http://127.0.0.1:8711";

export const FM26_BRIDGE_SNAPSHOT_PATHS = {
  recruitment: "/snapshot/recruitment",
  squad: "/snapshot/squad",
  benchmark: "/snapshot/benchmark",
};

export function cleanBridgeUrl(value) {
  const text = String(value || "").trim().replace(/\/+$/, "");
  return text || FM26_BRIDGE_DEFAULT_URL;
}

export function bridgeSnapshotUrl(baseUrl, kind = "recruitment") {
  return `${cleanBridgeUrl(baseUrl)}${FM26_BRIDGE_SNAPSHOT_PATHS[kind] || FM26_BRIDGE_SNAPSHOT_PATHS.recruitment}`;
}

export function bridgeRowsFromPayload(payload, parseCsv) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.players)) return payload.players;
  if (typeof payload?.csv === "string") return parseCsv(payload.csv);
  if (typeof payload === "string") return parseCsv(payload);
  return [];
}

export function bridgeSnapshotLabel(payload, fallback = "FM26 bridge") {
  const parts = [
    payload?.saveName,
    payload?.club,
    payload?.screen,
    payload?.kind,
    payload?.source,
  ].map((part) => String(part || "").trim()).filter(Boolean);
  return parts.length ? parts.join(" / ") : fallback;
}
