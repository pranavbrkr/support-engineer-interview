import { describe, it, expect } from "vitest";
import { generateAccountNumber } from "./account";

describe("generateAccountNumber", () => {
  it("returns 10-digit string", () => {
    const num = generateAccountNumber();
    expect(num).toMatch(/^\d{10}$/);
  });

  it("pads with leading zeros when needed", () => {
    // Run multiple times; small values get padded (e.g. "0000000123")
    const results = Array.from({ length: 20 }, () => generateAccountNumber());
    expect(results.every((n) => n.length === 10)).toBe(true);
    expect(results.every((n) => /^\d{10}$/.test(n))).toBe(true);
  });

  it("produces different values on successive calls", () => {
    const results = new Set(Array.from({ length: 100 }, () => generateAccountNumber()));
    expect(results.size).toBe(100);
  });
});
