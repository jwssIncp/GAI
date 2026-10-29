import { describe, it, expect } from "vitest";
import { formatValuationDate } from "./valuationFormatting";
describe("Valuation civil date presentation", () => {
  it("preserves the valuation day for SQL DATE and historic midnight ISO responses", () => {
    expect(formatValuationDate("2026-10-27")).toBe("27/10/2026");
    expect(formatValuationDate("2026-10-27T00:00:00.000Z")).toBe("27/10/2026");
  });
  it("keeps the existing empty date presentation", () =>
    expect(formatValuationDate(null)).toBe("-"));
});
