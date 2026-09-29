import { describe, expect, it } from "vitest";
import {
  calculateMetrics,
  generateHrv,
  shuffleRrOrder,
  type GeneratorTargets,
} from "./model";

const generate = (targets: GeneratorTargets) => generateHrv(targets);

function correlation(left: number[], right: number[]) {
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  left.forEach((value, index) => {
    const a = value - leftMean;
    const b = right[index] - rightMean;
    covariance += a * b;
    leftVariance += a * a;
    rightVariance += b * b;
  });
  return covariance / Math.sqrt(leftVariance * rightVariance);
}

describe("hybrid HRV generator", () => {
  it("is deterministic and keeps every interval physiological", () => {
    const targets: GeneratorTargets = {
      primary: "rmssd",
      primaryValue: 42,
      secondary: { mo: 825, breathingRate: 14 },
    };
    const first = generate(targets);
    const second = generate(targets);

    expect(first.rr).toEqual(second.rr);
    expect(first.rr).toHaveLength(150);
    expect(Math.min(...first.rr)).toBeGreaterThanOrEqual(380);
    expect(Math.max(...first.rr)).toBeLessThanOrEqual(1500);
  });

  it("morphs one sequence smoothly between adjacent slider values", () => {
    const common = { mo: 825, breathingRate: 14 };
    const lower = generate({
      primary: "rmssd",
      primaryValue: 40,
      secondary: common,
    });
    const upper = generate({
      primary: "rmssd",
      primaryValue: 41,
      secondary: common,
    });

    expect(correlation(lower.rr, upper.rr)).toBeGreaterThan(0.96);
    const meanChange =
      lower.rr.reduce((sum, value, index) => sum + Math.abs(value - upper.rr[index]), 0) /
      lower.rr.length;
    expect(meanChange).toBeLessThan(8);
  });

  it.each([
    ["rmssd", 42, { mo: 825, breathingRate: 14 }],
    ["amo", 42, { mo: 825, rmssd: 42 }],
    ["mo", 825, { amo: 42, rmssd: 42 }],
    ["sat", 200, { mo: 825, amo: 42 }],
    ["si", 110, { mo: 825, amo: 42, range: 250 }],
  ] as const)("fits the primary %s target", (primary, primaryValue, secondary) => {
    const result = generate({ primary, primaryValue, secondary });
    const actual = result.metrics[primary];
    const tolerance =
      primary === "mo"
        ? 25
        : primary === "amo"
          ? 4
          : Math.max(2, primaryValue * 0.07);
    expect(Math.abs(actual - primaryValue)).toBeLessThanOrEqual(tolerance);
  });

  it("keeps SAT fixed while AMo changes the required fast variability", () => {
    const lowerAmo = generate({
      primary: "sat",
      primaryValue: 200,
      secondary: { mo: 825, amo: 42 },
    });
    const higherAmo = generate({
      primary: "sat",
      primaryValue: 200,
      secondary: { mo: 825, amo: 60 },
    });

    expect(Math.abs(lowerAmo.metrics.sat - 200)).toBeLessThan(10);
    expect(Math.abs(higherAmo.metrics.sat - 200)).toBeLessThan(10);
    expect(higherAmo.metrics.amo).toBeGreaterThan(lowerAmo.metrics.amo);
    expect(higherAmo.metrics.rmssd).toBeGreaterThan(lowerAmo.metrics.rmssd);
  });

  it("calculates Kaplan SAT and Baevsky SI as distinct metrics", () => {
    const result = generate({
      primary: "sat",
      primaryValue: 200,
      secondary: { mo: 825, amo: 42 },
    });
    const recalculated = calculateMetrics(result.rr);

    expect(recalculated.sat).toBeCloseTo(result.metrics.sat, 8);
    expect(recalculated.si).not.toBeCloseTo(recalculated.sat, 1);
  });

  it("shuffling preserves the distribution but destroys temporal metrics", () => {
    const result = generate({
      primary: "rmssd",
      primaryValue: 42,
      secondary: { mo: 825, breathingRate: 14 },
    });
    const shuffled = shuffleRrOrder(result.rr);
    const shuffledMetrics = calculateMetrics(shuffled);

    expect([...shuffled].sort((a, b) => a - b)).toEqual(
      [...result.rr].sort((a, b) => a - b),
    );
    expect(shuffledMetrics.mo).toBe(result.metrics.mo);
    expect(shuffledMetrics.amo).toBe(result.metrics.amo);
    expect(shuffledMetrics.range).toBeCloseTo(result.metrics.range, 10);
    expect(Math.abs(shuffledMetrics.rmssd - result.metrics.rmssd)).toBeGreaterThan(3);
  });
});
