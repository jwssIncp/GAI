import { describe, expect, it } from "vitest";
import {
  changedFields,
  makeFieldAgentSchema,
  projectFieldAgentEditSchema,
} from "./fieldAgentSchemas";
const values = {
  name: "Pessoa Teste",
  email: "",
  phone: "",
  document: "",
  user_id: "",
  access: "none" as const,
  login: "",
};
describe("field agent editing contract", () => {
  it("clears only explicitly edited fields with null", () => {
    const parsed = makeFieldAgentSchema().parse(values);
    expect(
      changedFields(parsed, {
        email: true,
        phone: true,
        document: true,
        user_id: true,
      }),
    ).toEqual({ email: null, phone: null, document: null, user_id: null });
    expect(changedFields(parsed, { name: true })).toEqual({
      name: "Pessoa Teste",
    });
  });
  it("preserves an unchanged invalid legacy document without legitimizing a new write", () => {
    const legacy = "LEGADO-INVALIDO";
    const parsed = makeFieldAgentSchema(legacy).parse({
      ...values,
      document: legacy,
    });
    expect(changedFields(parsed, { name: true })).not.toHaveProperty(
      "document",
    );
    expect(
      makeFieldAgentSchema().safeParse({ ...values, document: legacy }).success,
    ).toBe(false);
    expect(
      makeFieldAgentSchema(legacy).safeParse({ ...values, document: "123" })
        .success,
    ).toBe(false);
  });
  it("requires an email and valid login for invitations", () =>
    expect(
      makeFieldAgentSchema().safeParse({ ...values, access: "invite" }).success,
    ).toBe(false));
  it("requires selection for existing access", () =>
    expect(
      makeFieldAgentSchema().safeParse({ ...values, access: "existing" })
        .success,
    ).toBe(false));
  it("clears role, dates and notes without changing status", () => {
    const parsed = projectFieldAgentEditSchema.parse({
      role: "",
      start_date: "",
      end_date: "",
      notes: "",
      status: "active",
    });
    expect(
      changedFields(parsed, {
        role: true,
        start_date: true,
        end_date: true,
        notes: true,
      }),
    ).toEqual({ role: null, start_date: null, end_date: null, notes: null });
  });
  it("validates period and role length", () => {
    expect(
      projectFieldAgentEditSchema.safeParse({
        role: "",
        start_date: "2026-11-05",
        end_date: "2026-11-04",
        notes: "",
        status: "active",
      }).success,
    ).toBe(false);
    expect(
      projectFieldAgentEditSchema.safeParse({
        role: "x".repeat(101),
        start_date: "",
        end_date: "",
        notes: "",
        status: "active",
      }).success,
    ).toBe(false);
  });
});
