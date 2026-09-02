// JPL approximate planetary elements, mean ecliptic and equinox of J2000.
// Valid from 1800-01-01 through 2050-12-31. See the source link in the UI.
export const J2000_JULIAN_DAY = 2451545.0;
export const AU_TO_SCENE = 1.45;
export const SUPPORTED_START_DATE = "1800/01/01";
export const SUPPORTED_END_DATE = "2050/12/31";

const TAU = Math.PI * 2;
const DEGREE = Math.PI / 180;
const UNIX_EPOCH_JULIAN_DAY = 2440587.5;
const DAY_MS = 86_400_000;
const AU_IN_KM = 149_597_870.7;

export type BodyId =
  | "sun"
  | "mercury"
  | "venus"
  | "earth"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "moon";

export type Vector3 = readonly [number, number, number];
type OrbitalRates = readonly [number, number, number, number, number, number];

export interface OrbitalElements {
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  meanLongitude: number;
  longitudeOfPerihelion: number;
  longitudeOfAscendingNode: number;
  rates: OrbitalRates;
}

export interface CelestialBody {
  id: BodyId;
  name: string;
  detail: string;
  color: string;
  radius: number;
  meanRadiusKm: number;
  period: number;
  elements?: OrbitalElements;
}

export interface Moon extends CelestialBody {
  id: "moon";
  semiMajorAxisAu: number;
  eccentricity: number;
  inclination: number;
}

const elements = (
  semiMajorAxis: number,
  eccentricity: number,
  inclination: number,
  meanLongitude: number,
  longitudeOfPerihelion: number,
  longitudeOfAscendingNode: number,
  rates: OrbitalRates,
): OrbitalElements => ({
  semiMajorAxis,
  eccentricity,
  inclination,
  meanLongitude,
  longitudeOfPerihelion,
  longitudeOfAscendingNode,
  rates,
});

export const BODIES: readonly CelestialBody[] = [
  {
    id: "sun",
    name: "太陽",
    detail: "G2V型主系列星 • 平均半径 695,700 km • 太陽系質量の約99.86%",
    color: "#ffcf70",
    radius: 0.25,
    meanRadiusKm: 695700,
    period: 25.38,
  },
  {
    id: "mercury",
    name: "水星",
    detail: "岩石惑星 • 平均半径 2,439.4 km • 軌道離心率 0.2056",
    color: "#aeb1bd",
    radius: 0.1,
    meanRadiusKm: 2439.4,
    period: 87.969,
    elements: elements(
      0.38709927,
      0.20563593,
      7.00497902,
      252.2503235,
      77.45779628,
      48.33076593,
      [
        0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689,
        -0.12534081,
      ],
    ),
  },
  {
    id: "venus",
    name: "金星",
    detail: "岩石惑星 • 平均半径 6,051.8 km • 逆行自転（恒星日 243.02日）",
    color: "#f5b967",
    radius: 0.15,
    meanRadiusKm: 6051.8,
    period: 224.701,
    elements: elements(
      0.72333566,
      0.00677672,
      3.39467605,
      181.9790995,
      131.60246718,
      76.67984255,
      [
        0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329,
        -0.27769418,
      ],
    ),
  },
  {
    id: "earth",
    name: "地球",
    detail: "岩石惑星 • 平均半径 6,371.0 km • 表示位置は地球・月系重心（EMB）",
    color: "#5fa8ff",
    radius: 0.17,
    meanRadiusKm: 6371.0084,
    period: 365.256,
    elements: elements(
      1.00000261,
      0.01671123,
      -0.00001531,
      100.46457166,
      102.93768193,
      0,
      [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
    ),
  },
  {
    id: "mars",
    name: "火星",
    detail: "岩石惑星 • 平均半径 3,389.5 km • 軌道離心率 0.0934",
    color: "#f48166",
    radius: 0.13,
    meanRadiusKm: 3389.5,
    period: 686.98,
    elements: elements(
      1.52371034,
      0.0933941,
      1.84969142,
      -4.55343205,
      -23.94362959,
      49.55953891,
      [
        0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088,
        -0.29257343,
      ],
    ),
  },
  {
    id: "jupiter",
    name: "木星",
    detail: "ガス巨星 • 平均半径 69,911 km • 質量 1.898 × 10²⁷ kg",
    color: "#e5b080",
    radius: 0.35,
    meanRadiusKm: 69911,
    period: 4332.589,
    elements: elements(
      5.202887,
      0.04838624,
      1.30439695,
      34.39644051,
      14.72847983,
      100.47390909,
      [
        -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668,
        0.20469106,
      ],
    ),
  },
  {
    id: "saturn",
    name: "土星",
    detail: "ガス巨星 • 平均半径 58,232 km • 主に水氷粒子から成る環系",
    color: "#f3d38c",
    radius: 0.3,
    meanRadiusKm: 58232,
    period: 10759.22,
    elements: elements(
      9.53667594,
      0.05386179,
      2.48599187,
      49.95424423,
      92.59887831,
      113.66242448,
      [
        -0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216,
        -0.28867794,
      ],
    ),
  },
  {
    id: "uranus",
    name: "天王星",
    detail: "氷巨星 • 平均半径 25,362 km • 自転軸傾斜は約98°",
    color: "#9fe2e8",
    radius: 0.21,
    meanRadiusKm: 25362,
    period: 30688.5,
    elements: elements(
      19.18916464,
      0.04725744,
      0.77263783,
      313.23810451,
      170.9542763,
      74.01692503,
      [
        -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281,
        0.04240589,
      ],
    ),
  },
  {
    id: "neptune",
    name: "海王星",
    detail: "氷巨星 • 平均半径 24,622 km • 恒星周回周期 164.79年",
    color: "#4b79d8",
    radius: 0.2,
    meanRadiusKm: 24622,
    period: 60182,
    elements: elements(
      30.06992276,
      0.00859048,
      1.77004347,
      -55.12002969,
      44.96476227,
      131.78422574,
      [
        0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464,
        -0.00508664,
      ],
    ),
  },
];

export const MOON: Moon = {
  id: "moon",
  name: "月",
  detail: "地球の自然衛星 • 平均半径 1,737.4 km • 恒星月 27.322日",
  color: "#d7d7cf",
  radius: 0.05,
  meanRadiusKm: 1737.4,
  period: 27.321661,
  semiMajorAxisAu: 384400 / AU_IN_KM,
  eccentricity: 0.0549,
  inclination: 5.145,
};

export const BODY_BY_ID = Object.fromEntries(
  [...BODIES, MOON].map((body) => [body.id, body]),
) as Record<BodyId, CelestialBody>;

export function relativeRadius(
  body: CelestialBody,
  sunDisplayRadius = 1,
): number {
  return (body.meanRadiusKm / BODY_BY_ID.sun.meanRadiusKm) * sunDisplayRadius;
}

export function calendarDateToJulianDay(value: string): number | null {
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.getTime() / DAY_MS + UNIX_EPOCH_JULIAN_DAY;
}

export function julianDayToCalendarDate(julianDay: number): string {
  const date = new Date((julianDay - UNIX_EPOCH_JULIAN_DAY) * DAY_MS);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

export function isSupportedJulianDay(julianDay: number): boolean {
  const firstJulianDay = calendarDateToJulianDay(SUPPORTED_START_DATE);
  const lastJulianDay = calendarDateToJulianDay(SUPPORTED_END_DATE);
  return (
    firstJulianDay !== null &&
    lastJulianDay !== null &&
    julianDay >= firstJulianDay &&
    julianDay <= lastJulianDay
  );
}

export function solveEccentricAnomaly(
  meanAnomaly: number,
  eccentricity: number,
): number {
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

export function orbitalElementsAtJulianDay(
  body: CelestialBody,
  julianDay: number,
): Omit<OrbitalElements, "rates"> | null {
  if (!body.elements) return null;
  const centuries = (julianDay - J2000_JULIAN_DAY) / 36525;
  const base = body.elements;
  const values = [
    base.semiMajorAxis + base.rates[0] * centuries,
    base.eccentricity + base.rates[1] * centuries,
    base.inclination + base.rates[2] * centuries,
    base.meanLongitude + base.rates[3] * centuries,
    base.longitudeOfPerihelion + base.rates[4] * centuries,
    base.longitudeOfAscendingNode + base.rates[5] * centuries,
  ] as const;
  return {
    semiMajorAxis: values[0],
    eccentricity: values[1],
    inclination: values[2],
    meanLongitude: values[3],
    longitudeOfPerihelion: values[4],
    longitudeOfAscendingNode: values[5],
  };
}

function positionFromElements(
  elementsAtDate: Omit<OrbitalElements, "rates">,
  eccentricAnomaly: number,
  scale: number,
): Vector3 {
  const {
    semiMajorAxis,
    eccentricity,
    inclination,
    longitudeOfPerihelion,
    longitudeOfAscendingNode,
  } = elementsAtDate;
  const xPrime = semiMajorAxis * (Math.cos(eccentricAnomaly) - eccentricity);
  const yPrime =
    semiMajorAxis *
    Math.sqrt(1 - eccentricity ** 2) *
    Math.sin(eccentricAnomaly);
  const node = longitudeOfAscendingNode * DEGREE;
  const perihelion =
    (longitudeOfPerihelion - longitudeOfAscendingNode) * DEGREE;
  const tilt = inclination * DEGREE;
  const x =
    (Math.cos(perihelion) * Math.cos(node) -
      Math.sin(perihelion) * Math.sin(node) * Math.cos(tilt)) *
      xPrime +
    (-Math.sin(perihelion) * Math.cos(node) -
      Math.cos(perihelion) * Math.sin(node) * Math.cos(tilt)) *
      yPrime;
  const y =
    (Math.cos(perihelion) * Math.sin(node) +
      Math.sin(perihelion) * Math.cos(node) * Math.cos(tilt)) *
      xPrime +
    (-Math.sin(perihelion) * Math.sin(node) +
      Math.cos(perihelion) * Math.cos(node) * Math.cos(tilt)) *
      yPrime;
  const z =
    Math.sin(perihelion) * Math.sin(tilt) * xPrime +
    Math.cos(perihelion) * Math.sin(tilt) * yPrime;
  const sceneScale = scale * AU_TO_SCENE;
  return [x * sceneScale, z * sceneScale, y * sceneScale];
}

function moonElementsAtJulianDay(
  julianDay: number,
): Omit<OrbitalElements, "rates"> {
  const days = julianDay - J2000_JULIAN_DAY;
  return {
    semiMajorAxis: MOON.semiMajorAxisAu,
    eccentricity: MOON.eccentricity,
    inclination: MOON.inclination,
    meanLongitude: 218.3164477 + 13.17639648 * days,
    longitudeOfPerihelion: 83.3532465 + 0.11140353 * days,
    longitudeOfAscendingNode: 125.04452 - 0.0529538083 * days,
  };
}

export function moonPositionAtJulianDay(julianDay: number, scale = 1): Vector3 {
  const elementsAtDate = moonElementsAtJulianDay(julianDay);
  const meanAnomaly =
    (elementsAtDate.meanLongitude - elementsAtDate.longitudeOfPerihelion) *
    DEGREE;
  return positionFromElements(
    elementsAtDate,
    solveEccentricAnomaly(meanAnomaly, elementsAtDate.eccentricity),
    scale,
  );
}

export function moonOrbitVertices(
  segments = 120,
  scale = 1,
  julianDay = J2000_JULIAN_DAY,
): Vector3[] {
  const elementsAtDate = moonElementsAtJulianDay(julianDay);
  return Array.from({ length: segments }, (_, index) =>
    positionFromElements(elementsAtDate, (index / segments) * TAU, scale),
  );
}

export function positionAtJulianDay(
  body: CelestialBody,
  julianDay: number,
  scale = 1,
): Vector3 {
  const elementsAtDate = orbitalElementsAtJulianDay(body, julianDay);
  if (!elementsAtDate) return [0, 0, 0];
  const meanAnomaly =
    (elementsAtDate.meanLongitude - elementsAtDate.longitudeOfPerihelion) *
    DEGREE;
  return positionFromElements(
    elementsAtDate,
    solveEccentricAnomaly(meanAnomaly, elementsAtDate.eccentricity),
    scale,
  );
}

export function positionAtDay(
  body: CelestialBody,
  day: number,
  scale = 1,
): Vector3 {
  return positionAtJulianDay(body, J2000_JULIAN_DAY + day, scale);
}

export function orbitVertices(
  body: CelestialBody,
  segments = 160,
  scale = 1,
  julianDay = J2000_JULIAN_DAY,
): Vector3[] {
  const elementsAtDate = orbitalElementsAtJulianDay(body, julianDay);
  if (!elementsAtDate) return [];
  return Array.from({ length: segments }, (_, index) =>
    positionFromElements(elementsAtDate, (index / segments) * TAU, scale),
  );
}

export function formatSimulationDay(day: number): string {
  return Math.max(0, day).toFixed(1).padStart(6, "0");
}
