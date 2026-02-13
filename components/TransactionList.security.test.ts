import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * SEC-303 regression: TransactionList must not use dangerouslySetInnerHTML
 * to prevent XSS when rendering transaction descriptions.
 */
describe("TransactionList XSS regression (SEC-303)", () => {
  it("does not use dangerouslySetInnerHTML", () => {
    const filePath = path.join(__dirname, "TransactionList.tsx");
    const content = readFileSync(filePath, "utf-8");
    expect(content).not.toContain("dangerouslySetInnerHTML");
  });

  it("renders transaction description as plain text (JSX interpolation)", () => {
    const filePath = path.join(__dirname, "TransactionList.tsx");
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("{transaction.description");
  });
});
