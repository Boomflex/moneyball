import { normalise } from "./utils.js";

const BANDS = [20, 40, 60, 80];

const metric = (header, values, options = {}) => ({ header, values, ...options });

export const GOOD_LOOK_GROUPS = {
  GK: {
    label: "Goalkeepers",
    metrics: [
      metric("Goals Allowed Per 90", [1.57, 1.45, 1.31, 1.2], { lowerBetter: true }),
      metric("xGoals Prevented Per 90", [-0.16, -0.12, -0.07, -0.02]),
      metric("Progressive Passes Per 90", [0.37, 0.58, 0.74, 0.98]),
      metric("Possession Lost Per 90", [8.21, 6.04, 3.67, 2.35], { lowerBetter: true }),
      metric("Possession Won Per 90", [7.25, 7.62, 8.17, 8.53]),
    ],
  },
  DEF: {
    label: "Defenders",
    metrics: [
      metric("Possession Won Per 90", [8.33, 9.09, 9.77, 10.54]),
      metric("Headers Won %", [0.524, 0.608, 0.656, 0.707], { percent: true }),
      metric("Headers Won Per 90", [3.15, 3.82, 4.57, 5.35]),
      metric("Tackle Completion %", [0.724, 0.747, 0.767, 0.79], { percent: true }),
      metric("Tackles Completed Per 90", [0.87, 1.07, 2.25, 3.48]),
      metric("Interceptions Per 90", [2.38, 2.65, 2.88, 3.12]),
      metric("Clearances Per 90", [0.9, 1.03, 1.13, 1.28]),
      metric("Blocks Per 90", [0.56, 0.62, 0.68, 0.75]),
      metric("Goals Per 90", [0.01, 0.02, 0.03, 0.05]),
      metric("Non Penalty xGoals Per 90", [0.01, 0.02, 0.03, 0.04]),
      metric("Shots Per 90", [0.25, 0.34, 0.48, 0.68]),
      metric("Assists Per 90", [0.01, 0.02, 0.06, 0.13]),
      metric("xAssists Per 90", [0.02, 0.03, 0.06, 0.13]),
      metric("Key Passes Per 90", [0.2, 0.29, 0.77, 1.39]),
      metric("Open Play Key Passes Per 90", [0.2, 0.29, 0.77, 1.39]),
      metric("Dribbles Made Per 90", [0.04, 0.08, 0.55, 1.75]),
      metric("Possession Lost Per 90", [12.01, 8.18, 4.9, 4.05], { lowerBetter: true }),
      metric("Progressive Passes Per 90", [3.19, 4.44, 6.18, 7.95]),
      metric("Passes Completed Per 90", [50.96, 56.45, 62.33, 69.88]),
    ],
  },
  MID: {
    label: "Midfielders",
    metrics: [
      metric("Possession Won Per 90", [5.63, 6.92, 7.82, 8.53]),
      metric("Headers Won %", [0.27, 0.361, 0.448, 0.544], { percent: true }),
      metric("Headers Won Per 90", [1.67, 2.16, 2.64, 3.45]),
      metric("Tackle Completion %", [0.673, 0.698, 0.724, 0.747], { percent: true }),
      metric("Tackles Completed Per 90", [1.49, 1.98, 2.34, 2.72]),
      metric("Interceptions Per 90", [1.96, 2.32, 2.52, 2.86]),
      metric("Clearances Per 90", [0.49, 0.7, 0.84, 1.01]),
      metric("Blocks Per 90", [0.27, 0.4, 0.51, 0.61]),
      metric("Goals Per 90", [0.04, 0.07, 0.11, 0.23]),
      metric("Non Penalty xGoals Per 90", [0.04, 0.06, 0.11, 0.22]),
      metric("Shots Per 90", [0.88, 1.17, 1.57, 2.02]),
      metric("Assists Per 90", [0.05, 0.08, 0.13, 0.2]),
      metric("xAssists Per 90", [0.06, 0.09, 0.13, 0.19]),
      metric("Key Passes Per 90", [0.87, 1.2, 1.6, 2.08]),
      metric("Open Play Key Passes Per 90", [0.87, 1.2, 1.6, 2.08]),
      metric("Dribbles Made Per 90", [0.22, 0.37, 0.72, 1.56]),
      metric("Possession Lost Per 90", [10.21, 8.44, 7.15, 6.04], { lowerBetter: true }),
      metric("Progressive Passes Per 90", [3.69, 5.02, 5.82, 6.91]),
      metric("Passes Completed Per 90", [48.62, 54.66, 60.74, 68.83]),
    ],
  },
  FWD: {
    label: "Forwards",
    metrics: [
      metric("Possession Won Per 90", [2.47, 4.16, 6.52, 7.52]),
      metric("Headers Won %", [0.195, 0.269, 0.335, 0.403], { percent: true }),
      metric("Headers Won Per 90", [2.92, 3.6, 4.94, 6.86]),
      metric("Tackle Completion %", [0.653, 0.707, 0.74, 0.766], { percent: true }),
      metric("Tackles Completed Per 90", [0.48, 1.24, 2.34, 2.94]),
      metric("Interceptions Per 90", [0.9, 1.37, 1.97, 2.34]),
      metric("Clearances Per 90", [0.17, 0.31, 0.49, 0.64]),
      metric("Blocks Per 90", [0.1, 0.16, 0.24, 0.32]),
      metric("Goals Per 90", [0.22, 0.29, 0.37, 0.47]),
      metric("Non Penalty xGoals Per 90", [0.21, 0.26, 0.32, 0.4]),
      metric("Shots Per 90", [1.96, 2.22, 2.47, 2.81]),
      metric("Assists Per 90", [0.12, 0.17, 0.22, 0.27]),
      metric("xAssists Per 90", [0.12, 0.16, 0.21, 0.26]),
      metric("Key Passes Per 90", [1.18, 1.53, 1.95, 2.31]),
      metric("Open Play Key Passes Per 90", [1.18, 1.53, 1.95, 2.31]),
      metric("Dribbles Made Per 90", [0.84, 1.63, 3.43, 5.62]),
      metric("Possession Lost Per 90", [14.95, 12.36, 8.53, 6.12], { lowerBetter: true }),
      metric("Progressive Passes Per 90", [0.98, 2.1, 3.55, 4.75]),
      metric("Passes Completed Per 90", [28.63, 35.1, 43.27, 50.29]),
    ],
  },
};

export function goodLookGroupForRole(roleId) {
  if (roleId === "GK") return "GK";
  if (roleId === "CB" || roleId === "FB") return "DEF";
  if (roleId === "MID") return "MID";
  return "FWD";
}

function metricFor(groupId, header) {
  const group = GOOD_LOOK_GROUPS[groupId];
  if (!group) return null;
  const key = normalise(header);
  return group.metrics.find((item) => normalise(item.header) === key) || null;
}

export function goodLookBand({ roleId, header, value }) {
  if (!Number.isFinite(value)) return null;
  const groupId = goodLookGroupForRole(roleId);
  const benchmark = metricFor(groupId, header);
  if (!benchmark) return null;
  const scoreValue = benchmark.percent && value > 1.5 ? value / 100 : value;
  let percentile = 0;
  benchmark.values.forEach((threshold, index) => {
    const passed = benchmark.lowerBetter ? scoreValue <= threshold : scoreValue >= threshold;
    if (passed) percentile = BANDS[index];
  });
  const label = percentile >= 80 ? "Elite" : percentile >= 60 ? "Good" : percentile >= 40 ? "Average" : percentile >= 20 ? "Poor" : "Below";
  return {
    groupId,
    groupLabel: GOOD_LOOK_GROUPS[groupId].label,
    percentile,
    label,
    lowerBetter: Boolean(benchmark.lowerBetter),
    thresholds: benchmark.values,
  };
}

export function goodLookSummary(items) {
  const counts = { Elite: 0, Good: 0, Average: 0, Poor: 0, Below: 0 };
  for (const item of items) {
    if (item?.band?.label in counts) counts[item.band.label] += 1;
  }
  return counts;
}
