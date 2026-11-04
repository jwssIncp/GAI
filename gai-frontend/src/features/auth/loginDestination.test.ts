import { expect, it } from "vitest";
import type { CurrentUser } from "@/types/api";
import { loginDestination } from "./loginDestination";
const permanent = { must_change_password: false } as CurrentUser;
it("requires the change route only while the server requires it", () => {
  expect(
    loginDestination(
      { ...permanent, must_change_password: true },
      "/app/projects",
    ),
  ).toBe("/app/change-password");
});
it.each([
  "/app/change-password",
  "/app/change-password/",
  "/app/change-password?from=login",
])("does not return to a completed password change from %s", (previous) => {
  expect(loginDestination(permanent, previous)).toBe("/app/dashboard");
});
it("preserves authorized internal return paths and rejects external ones", () => {
  expect(loginDestination(permanent, "/app/projects/10/summary")).toBe(
    "/app/projects/10/summary",
  );
  expect(loginDestination(permanent, "https://untrusted.example/app")).toBe(
    "/app/dashboard",
  );
  expect(loginDestination(permanent)).toBe("/app/dashboard");
});
