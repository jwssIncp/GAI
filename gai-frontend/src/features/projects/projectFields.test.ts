import { describe, expect, it } from "vitest";
import { formatProjectDate } from "./projectFields";

describe("Project planned civil dates", () => {
  it("preserves the selected calendar day without applying a timezone offset", () => {
    expect(formatProjectDate("2026-11-03")).toBe("03/11/2026");
    expect(formatProjectDate("2026-11-30")).toBe("30/11/2026");
    expect(formatProjectDate("2028-02-29")).toBe("29/02/2028");
  });
  it("represents optional empty dates without inventing a date", () => {
    expect(formatProjectDate(null)).toBe("-");
    expect(formatProjectDate(undefined)).toBe("-");
    expect(formatProjectDate("")).toBe("-");
  });
});
