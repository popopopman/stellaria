import { describe, expect, it } from "vitest";
import {
  AU_TO_SCENE,
  BODIES,
  BODY_BY_ID,
  J2000_JULIAN_DAY,
  MOON,
  SUPPORTED_END_DATE,
  SUPPORTED_START_DATE,
  calendarDateToJulianDay,
  formatSimulationDay,
  isSupportedJulianDay,
  julianDayToCalendarDate,
  moonOrbitVertices,
  moonPositionAtJulianDay,
  orbitVertices,
  orbitalElementsAtJulianDay,
  positionAtDay,
  positionAtJulianDay,
  relativeRadius,
  solveEccentricAnomaly,
} from "../src/simulation.js";
const angularDistance = (first: number, second: number): number =>
  Math.abs(Math.atan2(Math.sin(first - second), Math.cos(first - second)));

function requireJulianDay(value: string): number {
  const julianDay = calendarDateToJulianDay(value);
  if (julianDay === null) throw new Error(`Invalid test date: ${value}`);
  return julianDay;
}

function requireOrbitalElements(
  body: (typeof BODIES)[number],
  julianDay: number,
): NonNullable<ReturnType<typeof orbitalElementsAtJulianDay>> {
  const elements = orbitalElementsAtJulianDay(body, julianDay);
  if (elements === null)
    throw new Error(`Missing orbital elements: ${body.id}`);
  return elements;
}

describe("calendar dates", () => {
  it("converts UTC calendar dates to Julian dates", () => {
    expect(calendarDateToJulianDay("2000/01/01")).toBe(2451544.5);
    expect(calendarDateToJulianDay("2024/02/29")).toBe(2460369.5);
    expect(julianDayToCalendarDate(2451544.5)).toBe("2000/01/01");
  });

  it("rejects malformed and impossible calendar dates", () => {
    expect(calendarDateToJulianDay("2024-02-29")).toBeNull();
    expect(calendarDateToJulianDay("2023/02/29")).toBeNull();
    expect(calendarDateToJulianDay("2024/13/01")).toBeNull();
  });

  it("limits the model to JPL Table 1's supported interval", () => {
    expect(isSupportedJulianDay(requireJulianDay(SUPPORTED_START_DATE))).toBe(
      true,
    );
    expect(isSupportedJulianDay(requireJulianDay(SUPPORTED_END_DATE))).toBe(
      true,
    );
    expect(isSupportedJulianDay(requireJulianDay("1799/12/31"))).toBe(false);
    expect(isSupportedJulianDay(requireJulianDay("2051/01/01"))).toBe(false);
  });
});

describe("JPL orbital elements", () => {
  it("keeps rendered radii proportional to the published mean radii", () => {
    const earth = relativeRadius(BODY_BY_ID.earth, 1.3);
    const jupiter = relativeRadius(BODY_BY_ID.jupiter, 1.3);
    expect(earth).toBeCloseTo((6371.0084 / 695700) * 1.3, 12);
    expect(jupiter / earth).toBeCloseTo(69911 / 6371.0084, 10);
  });

  it("keeps observation-mode bodies clear of neighboring orbital envelopes", () => {
    const defaultPlanetSize = 1;
    const envelopes = BODIES.map((body) => {
      if (!body.elements) return { body, minimum: 0, maximum: 0 };
      const { semiMajorAxis, eccentricity } = requireOrbitalElements(
        body,
        J2000_JULIAN_DAY,
      );
      return {
        body,
        minimum: semiMajorAxis * (1 - eccentricity) * AU_TO_SCENE,
        maximum: semiMajorAxis * (1 + eccentricity) * AU_TO_SCENE,
      };
    });
    envelopes.slice(1).forEach((outer, index) => {
      const inner = envelopes[index];
      if (!inner) throw new Error("Missing inner orbit envelope");
      expect(outer.minimum - inner.maximum).toBeGreaterThan(
        (outer.body.radius + inner.body.radius) * defaultPlanetSize,
      );
    });
    const moonPerigee =
      (BODY_BY_ID.earth.radius + MOON.radius + 0.1) * (1 - MOON.eccentricity);
    expect(moonPerigee).toBeGreaterThan(
      BODY_BY_ID.earth.radius * defaultPlanetSize + MOON.radius,
    );
  });

  it("keeps the J2000 semi-major axes from JPL's published table", () => {
    const mercury = requireOrbitalElements(
      BODY_BY_ID.mercury,
      J2000_JULIAN_DAY,
    );
    const earth = requireOrbitalElements(BODY_BY_ID.earth, J2000_JULIAN_DAY);
    const neptune = requireOrbitalElements(
      BODY_BY_ID.neptune,
      J2000_JULIAN_DAY,
    );
    expect(mercury.semiMajorAxis).toBeCloseTo(0.38709927, 8);
    expect(earth.semiMajorAxis).toBeCloseTo(1.00000261, 8);
    expect(neptune.semiMajorAxis).toBeCloseTo(30.06992276, 8);
  });

  it("applies JPL's secular rates over time", () => {
    const first = requireOrbitalElements(BODY_BY_ID.mars, J2000_JULIAN_DAY);
    const later = requireOrbitalElements(
      BODY_BY_ID.mars,
      J2000_JULIAN_DAY + 36525,
    );
    expect(later.semiMajorAxis - first.semiMajorAxis).toBeCloseTo(
      0.00001847,
      10,
    );
    expect(later.meanLongitude - first.meanLongitude).toBeCloseTo(
      19140.30268499,
      8,
    );
  });
});

describe("Keplerian coordinates", () => {
  it("keeps the Moon on a bounded inclined orbit around Earth", () => {
    const distances = moonOrbitVertices(720, 1, J2000_JULIAN_DAY).map((point) =>
      Math.hypot(...point),
    );
    const meanDistance = MOON.semiMajorAxisAu * AU_TO_SCENE;
    expect(Math.min(...distances)).toBeCloseTo(
      meanDistance * (1 - MOON.eccentricity),
      5,
    );
    expect(Math.max(...distances)).toBeCloseTo(
      meanDistance * (1 + MOON.eccentricity),
      5,
    );
    expect(
      Math.abs(moonPositionAtJulianDay(J2000_JULIAN_DAY)[1]),
    ).toBeGreaterThan(0);
  });

  it("keeps a circular orbit equal to its mean anomaly", () => {
    expect(solveEccentricAnomaly(1.25, 0)).toBeCloseTo(1.25, 12);
  });

  it("satisfies Kepler's equation for Mercury's J2000 eccentricity", () => {
    const meanAnomaly = 5.7;
    const eccentricity = requireOrbitalElements(
      BODY_BY_ID.mercury,
      J2000_JULIAN_DAY,
    ).eccentricity;
    const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, eccentricity);
    expect(
      angularDistance(
        eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly),
        meanAnomaly,
      ),
    ).toBeLessThan(1e-10);
  });

  it("keeps the sun fixed at the heliocentric origin", () => {
    expect(positionAtJulianDay(BODY_BY_ID.sun, 2460000.5)).toEqual([0, 0, 0]);
  });

  it("uses the date to move a planet through its real orbit", () => {
    const first = positionAtJulianDay(BODY_BY_ID.earth, 2460000.5);
    const later = positionAtJulianDay(BODY_BY_ID.earth, 2460060.5);
    expect(Math.hypot(...first)).toBeGreaterThan(1.4);
    expect(Math.hypot(...later)).toBeGreaterThan(1.4);
    expect(
      Math.hypot(first[0] - later[0], first[1] - later[1], first[2] - later[2]),
    ).toBeGreaterThan(0.5);
  });

  it("preserves physical perihelion and aphelion distances in an orbit path", () => {
    const mercury = BODY_BY_ID.mercury;
    const [minimum, maximum] = orbitVertices(mercury, 1440, 1, J2000_JULIAN_DAY)
      .map((point) => Math.hypot(...point))
      .reduce(
        ([min, max], value) => [Math.min(min, value), Math.max(max, value)],
        [Infinity, -Infinity],
      );
    const { semiMajorAxis, eccentricity } = requireOrbitalElements(
      mercury,
      J2000_JULIAN_DAY,
    );
    expect(minimum).toBeCloseTo(
      semiMajorAxis * (1 - eccentricity) * AU_TO_SCENE,
      5,
    );
    expect(maximum).toBeCloseTo(
      semiMajorAxis * (1 + eccentricity) * AU_TO_SCENE,
      5,
    );
  });

  it("applies a supplied display scale without changing the underlying geometry", () => {
    const normal = Math.hypot(...positionAtDay(BODY_BY_ID.mars, 120));
    const doubled = Math.hypot(...positionAtDay(BODY_BY_ID.mars, 120, 2));
    expect(doubled).toBeCloseTo(normal * 2, 10);
  });

  it("produces finite coordinates for every body over the supported interval", () => {
    [
      requireJulianDay(SUPPORTED_START_DATE),
      J2000_JULIAN_DAY,
      requireJulianDay("2026/09/01"),
      requireJulianDay(SUPPORTED_END_DATE),
    ].forEach((julianDay) =>
      BODIES.forEach((body) =>
        positionAtJulianDay(body, julianDay).forEach((coordinate) =>
          expect(Number.isFinite(coordinate)).toBe(true),
        ),
      ),
    );
  });
});

describe("orbitVertices", () => {
  it("does not create an orbit for the sun", () => {
    expect(orbitVertices(BODY_BY_ID.sun)).toEqual([]);
  });

  it("creates the requested number of usable three-dimensional points", () => {
    const vertices = orbitVertices(BODY_BY_ID.saturn, 48, 1.1, 2460000.5);
    expect(vertices).toHaveLength(48);
    vertices.forEach((vertex) => {
      expect(vertex).toHaveLength(3);
      vertex.forEach((coordinate) =>
        expect(Number.isFinite(coordinate)).toBe(true),
      );
    });
  });
});

describe("formatSimulationDay", () => {
  it.each([
    [0, "0000.0"],
    [12.34, "0012.3"],
    [-2, "0000.0"],
    [12345.67, "12345.7"],
  ])("formats %s as %s", (day, expected) => {
    expect(formatSimulationDay(day)).toBe(expected);
  });
});
