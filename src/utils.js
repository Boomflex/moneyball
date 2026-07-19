export const normalise = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const mean = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

export const stdev = (values) => {
  if (values.length < 2) return 1;
  const avg = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1)) || 1;
};

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}
export function roleIdsFromPositionText(value) {
  const compact = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact) return [];
  const ids = new Set();

  if (compact.includes("GK") || compact.includes("GOALKEEPER")) ids.add("GK");
  if (compact.includes("DC") || compact.includes("CB") || compact.includes("CENTREBACK") || compact.includes("CENTERBACK")) ids.add("CB");
  if (compact.includes("DL") || compact.includes("DR") || compact.includes("WBL") || compact.includes("WBR") || compact.includes("FULLBACK") || compact.includes("WINGBACK")) ids.add("FB");
  if (compact.includes("DM") || compact.includes("MC") || compact.includes("AMC") || compact.includes("CM") || compact.includes("MID")) ids.add("MID");
  if (compact.includes("AML") || compact.includes("AMR") || compact.includes("ML") || compact.includes("MR") || compact.includes("WINGER")) ids.add("Winger");
  if (compact.includes("ST") || compact.includes("SC") || compact.includes("STRIKER")) ids.add("Striker");

  return [...ids];
}
