export const BODIES = [
  {
    id: "sun",
    name: "太陽",
    detail: "すべての軌道の中心",
    color: "#ffcf70",
    radius: 1.88,
    orbit: 0,
    period: 1,
    eccentricity: 0,
    inclination: 0,
    phase: 0,
  },
  {
    id: "mercury",
    name: "水星",
    detail: "太陽にいちばん近い小さな星",
    color: "#aeb1bd",
    radius: 0.24,
    orbit: 4.4,
    period: 88,
    eccentricity: 0.206,
    inclination: 7,
    phase: 0.5,
  },
  {
    id: "venus",
    name: "金星",
    detail: "雲に包まれた明けの明星",
    color: "#f5b967",
    radius: 0.39,
    orbit: 6.2,
    period: 224.7,
    eccentricity: 0.007,
    inclination: 3.4,
    phase: 2.8,
  },
  {
    id: "earth",
    name: "地球",
    detail: "青い海をたたえた私たちの星",
    color: "#5fa8ff",
    radius: 0.45,
    orbit: 8.4,
    period: 365.25,
    eccentricity: 0.017,
    inclination: 0,
    phase: 4.3,
  },
  {
    id: "mars",
    name: "火星",
    detail: "赤い砂漠が広がる隣人",
    color: "#f48166",
    radius: 0.33,
    orbit: 10.9,
    period: 687,
    eccentricity: 0.093,
    inclination: 1.9,
    phase: 1.4,
  },
  {
    id: "jupiter",
    name: "木星",
    detail: "嵐を抱く太陽系最大の星",
    color: "#e5b080",
    radius: 1.08,
    orbit: 16.2,
    period: 4331,
    eccentricity: 0.049,
    inclination: 1.3,
    phase: 5.2,
  },
  {
    id: "saturn",
    name: "土星",
    detail: "環をまとう淡い黄金の星",
    color: "#f3d38c",
    radius: 0.92,
    orbit: 21.6,
    period: 10747,
    eccentricity: 0.057,
    inclination: 2.5,
    phase: 3.5,
  },
];

export const BODY_BY_ID = Object.fromEntries(
  BODIES.map((body) => [body.id, body]),
);

export function solveEccentricAnomaly(meanAnomaly, eccentricity) {
  let eccentricAnomaly = meanAnomaly;
  for (let index = 0; index < 8; index += 1) {
    eccentricAnomaly -=
      (eccentricAnomaly -
        eccentricity * Math.sin(eccentricAnomaly) -
        meanAnomaly) /
      (1 - eccentricity * Math.cos(eccentricAnomaly));
  }
  return eccentricAnomaly;
}

export function positionAtDay(body, day, scale = 1) {
  if (!body.orbit) return [0, 0, 0];
  const meanAnomaly = (day / body.period) * Math.PI * 2 + body.phase;
  const eccentricAnomaly = solveEccentricAnomaly(
    meanAnomaly,
    body.eccentricity,
  );
  const x =
    body.orbit * scale * (Math.cos(eccentricAnomaly) - body.eccentricity);
  const flatZ =
    body.orbit *
    scale *
    Math.sqrt(1 - body.eccentricity ** 2) *
    Math.sin(eccentricAnomaly);
  const inclination = (body.inclination * Math.PI) / 180;
  return [x, flatZ * Math.sin(inclination), flatZ * Math.cos(inclination)];
}

export function orbitVertices(body, segments = 160, scale = 1) {
  if (!body.orbit) return [];
  return Array.from({ length: segments }, (_, index) =>
    positionAtDay(
      body,
      (((index / segments) * Math.PI * 2 - body.phase) * body.period) /
        (Math.PI * 2),
      scale,
    ),
  );
}

export function formatSimulationDay(day) {
  return Math.max(0, day).toFixed(1).padStart(6, "0");
}
