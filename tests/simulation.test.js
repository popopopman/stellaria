import { describe, expect, it } from "vitest";
import {
  BODIES,
  BODY_BY_ID,
  formatSimulationDay,
  orbitVertices,
  positionAtDay,
  solveEccentricAnomaly,
} from "../src/simulation.js";

const angularDistance = (first, second) =>
  Math.abs(Math.atan2(Math.sin(first - second), Math.cos(first - second)));

describe("solveEccentricAnomaly", () => {
  it("keeps a circular orbit equal to its mean anomaly", () => {
    expect(solveEccentricAnomaly(1.25, 0)).toBeCloseTo(1.25, 12);
  });

  it("satisfies Kepler's equation for the model's largest eccentricity", () => {
    const meanAnomaly = 5.7;
    const eccentricity = BODY_BY_ID.mercury.eccentricity;
    const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, eccentricity);
    expect(
      angularDistance(
        eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly),
        meanAnomaly,
      ),
    ).toBeLessThan(1e-10);
  });
});

describe("positionAtDay", () => {
  it("keeps the sun fixed at the origin", () => {
    expect(positionAtDay(BODY_BY_ID.sun, 999)).toEqual([0, 0, 0]);
  });

  it("returns to the same position after one complete orbital period", () => {
    const earth = BODY_BY_ID.earth;
    const start = positionAtDay(earth, 20.5);
    const completed = positionAtDay(earth, 20.5 + earth.period);
    completed.forEach((coordinate, index) =>
      expect(coordinate).toBeCloseTo(start[index], 10),
    );
  });

  it("places an eccentric planet closer at periapsis than apoapsis", () => {
    const mercury = BODY_BY_ID.mercury;
    const periapsis = Math.hypot(
      ...positionAtDay(
        mercury,
        (-mercury.phase * mercury.period) / (Math.PI * 2),
      ),
    );
    const apoapsis = Math.hypot(
      ...positionAtDay(
        mercury,
        ((Math.PI - mercury.phase) * mercury.period) / (Math.PI * 2),
      ),
    );
    expect(periapsis).toBeLessThan(apoapsis);
  });

  it("applies a supplied orbit scale consistently", () => {
    const normal = Math.hypot(...positionAtDay(BODY_BY_ID.mars, 120));
    const doubled = Math.hypot(...positionAtDay(BODY_BY_ID.mars, 120, 2));
    expect(doubled).toBeCloseTo(normal * 2, 10);
  });

  it("produces finite coordinates for every body at varied dates", () => {
    [-1000, 0, 83.2, 10000].forEach((day) =>
      BODIES.forEach((body) =>
        positionAtDay(body, day).forEach((coordinate) =>
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

  it("creates the requested number of usable 3D points", () => {
    const vertices = orbitVertices(BODY_BY_ID.saturn, 48, 1.1);
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
