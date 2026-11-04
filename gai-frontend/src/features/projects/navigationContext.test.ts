import { describe, expect, it } from "vitest";
import { dashboardReturn, navigationContext, navigationHref, projectContextId, requestFilters } from "./navigationContext";

describe("Persistent navigation context and safe return destinations", () => {
  it.each(["https://outside.example", "//outside.example", "/app/dashboard/other", "/app/dashboard#x", "/app/dashboard?return_to=//evil", "/app/dashboard\\evil", "/app/dashboard\n", "/app/projects/7/summary"])("rejects return destination %s", (path) => {
    expect(dashboardReturn(path)).toBeNull();
    expect(navigationHref("/app/budgets", new URLSearchParams({ return_to: path }))).toBe("/app/budgets");
  });
  it("retains dashboard filters across project and global links including fragments", () => {
    const back = "/app/dashboard?year=2026&status=active";
    const params = new URLSearchParams({ project_id: "7", return_to: back, status: "approved", page: "2", tab: "payments", version: "11" });
    expect(navigationHref("/app/budgets/9", params)).toBe("/app/budgets/9?project_id=7&return_to=%2Fapp%2Fdashboard%3Fyear%3D2026%26status%3Dactive&status=approved&page=2");
    expect(navigationHref("/app/projects/7/summary#unidades", params)).toBe("/app/projects/7/summary?return_to=%2Fapp%2Fdashboard%3Fyear%3D2026%26status%3Dactive#unidades");
    expect(requestFilters(params)).toEqual({ project_id: "7", status: "approved", page: "2" });
  });
  it.each(["-1", "0", "1.1", "1e2", "NaN", "9007199254740993", "../2"])("rejects malformed project context %s", (project) => {
    const params = new URLSearchParams({ project_id: project });
    expect(projectContextId(params)).toBeNull(); expect(navigationContext(params).size).toBe(0);
  });
  it("does not leak detail versions or unrelated budget filters into a project link", () => {
    expect(navigationHref("/app/projects/7/summary", "project_id=7&page=2&tab=history&version=12&status=draft")).toBe("/app/projects/7/summary");
  });
});
