import { z } from "zod";
import {
  isValidDocument,
  isValidPhone,
  normalizeDocument,
  normalizePhone,
} from "./brazilianContact";
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres`)
    .transform((value) => value || null);
const email = z
  .string()
  .trim()
  .max(255)
  .refine(
    (value) => !value || z.string().email().safeParse(value).success,
    "Informe um e-mail válido",
  )
  .transform((value) => (value ? value.toLowerCase() : null));
export function makeFieldAgentSchema(legacyDocument?: string | null) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(2, "Nome deve ter pelo menos 2 caracteres")
        .max(255, "Nome muito longo"),
      email,
      phone: z
        .string()
        .trim()
        .refine(
          (value) => !value || isValidPhone(value),
          "Telefone brasileiro inválido",
        )
        .transform((value) => (value ? normalizePhone(value) : null)),
      document: z
        .string()
        .trim()
        .refine(
          (value) =>
            !value || value === legacyDocument || isValidDocument(value),
          "CPF ou CNPJ inválido",
        )
        .transform((value) =>
          value
            ? value === legacyDocument
              ? value
              : normalizeDocument(value)
            : null,
        ),
      user_id: z
        .string()
        .transform((value) => (value ? Number(value) : null))
        .pipe(z.number().int().positive().nullable()),
      access: z.enum(["none", "existing", "invite"]),
      login: z.string().trim(),
    })
    .superRefine((value, ctx) => {
      if (value.access === "existing" && !value.user_id)
        ctx.addIssue({
          code: "custom",
          path: ["user_id"],
          message: "Selecione uma conta da organização",
        });
      if (value.access === "invite") {
        if (value.name.length < 3)
          ctx.addIssue({
            code: "custom",
            path: ["name"],
            message:
              "Para criar acesso, informe um nome com pelo menos 3 caracteres",
          });
        if (!value.email)
          ctx.addIssue({
            code: "custom",
            path: ["email"],
            message: "Informe o e-mail para o convite",
          });
        if (!/^[a-zA-Z0-9._-]{3,100}$/.test(value.login))
          ctx.addIssue({
            code: "custom",
            path: ["login"],
            message:
              "Login: 3 a 100 letras, números, ponto, hífen ou sublinhado",
          });
      }
    });
}
export const fieldAgentFormSchema = makeFieldAgentSchema();
export const fieldAgentEditSchema = fieldAgentFormSchema;
const projectFields = z.object({
  role: text(100),
  start_date: text(10),
  end_date: text(10),
  notes: text(65535),
});
const period = (value: {
  start_date: string | null;
  end_date: string | null;
}) =>
  !value.start_date || !value.end_date || value.end_date >= value.start_date;
export const projectFieldAgentFormSchema = projectFields
  .extend({
    field_agent_id: z
      .string()
      .trim()
      .min(1, "Informe o inventariante")
      .transform(Number)
      .pipe(z.number().int().positive("Inventariante inválido")),
  })
  .refine(period, {
    path: ["end_date"],
    message: "O fim não pode ser anterior ao início",
  });
export const projectFieldAgentEditSchema = projectFields
  .extend({ status: z.enum(["active", "inactive", "finished"]) })
  .refine(period, {
    path: ["end_date"],
    message: "O fim não pode ser anterior ao início",
  });
export type FieldAgentFormValues = z.input<typeof fieldAgentFormSchema>;
export type FieldAgentEditValues = FieldAgentFormValues;
export type ProjectFieldAgentFormValues = z.input<
  typeof projectFieldAgentFormSchema
>;
export type ProjectFieldAgentEditValues = z.input<
  typeof projectFieldAgentEditSchema
>;
/** Omitted fields remain unchanged; clearing a dirty optional sends null. */
export function changedFields<T extends Record<string, unknown>>(
  values: T,
  dirty: Record<string, unknown>,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => Boolean(dirty[key])),
  ) as Partial<T>;
}
