import { expect, it } from "vitest";
import { passwordHint, validatePassword } from "./userFields";

it.each([8, 15, 128])(
  "accepts a password of %i characters without composition requirements",
  (length) => {
    expect(validatePassword("x".repeat(length))).toBe(true);
  },
);
it.each(["x".repeat(7), " ".repeat(8), "x".repeat(129), "😀".repeat(7)])(
  "rejects an invalid password",
  (value) => {
    expect(validatePassword(value)).toBe(
      "Informe uma senha com 8 a 128 caracteres.",
    );
  },
);
it("counts unicode code points and describes the current policy", () => {
  expect(validatePassword("😀".repeat(8))).toBe(true);
  expect(passwordHint).toContain("8 a 128");
});
