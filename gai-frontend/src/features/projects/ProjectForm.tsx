import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { useBlocker } from "react-router-dom";
import { ApiError } from "@/api/http";
import { FormField } from "@/components/base/FormField";
import { DateInput } from "@/components/base/Inputs";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/features/auth/usePermissions";
import type {
  CreateProjectRequest,
  Project,
  ProjectType,
  UpdateProjectRequest,
} from "@/types/api";
import { OrganizationSelect } from "./ProjectSelectors";
import { ProjectRegistrationSelect } from "./ProjectRegistrationSelect";
import {
  projectCreateFormSchema,
  projectEditFormSchema,
  type ProjectFormValues,
} from "./projectSchemas";
import {
  formatProjectDate,
  projectSelectClass,
  projectTypeLabels,
} from "./projectFields";

type ProjectFormProps = {
  mode: "create" | "edit";
  initial?: Project;
  busy?: boolean;
  onSubmit: (
    payload: CreateProjectRequest | UpdateProjectRequest,
  ) => Promise<void>;
  onCancel: () => void;
  onComplete: () => void;
};
const stages = [
  "Informações gerais",
  "Planejamento",
  "Estrutura operacional",
  "Revisão e confirmação",
];
const stageLabels = ["Geral", "Planejamento", "Estrutura", "Revisão"];
const generalFields: FieldPath<ProjectFormValues>[] = [
  "organization_id",
  "company_id",
  "name",
  "code",
  "project_type",
  "description",
];
const planningFields: FieldPath<ProjectFormValues>[] = [
  "start_date",
  "end_date",
  "responsible_user_id",
  "planning_responsible_user_id",
  "planning_notes",
];

export function ProjectForm({
  mode,
  initial,
  busy = false,
  onSubmit,
  onCancel,
  onComplete,
}: ProjectFormProps) {
  const { isPlatformAdmin, hasPermission } = usePermissions();
  const [stage, setStage] = useState(0);
  const [companyName, setCompanyName] = useState(initial?.company_name ?? "");
  const [responsibleName, setResponsibleName] = useState(
    initial?.responsible_user_name ?? "",
  );
  const [plannerName, setPlannerName] = useState(
    initial?.planning_responsible_user_name ?? "",
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const saved = useRef(false),
    sending = useRef(false);
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(
      mode === "create" ? projectCreateFormSchema : projectEditFormSchema,
    ),
    defaultValues: {
      organization_id: initial ? String(initial.organization_id) : "",
      company_id: initial?.company_id ? String(initial.company_id) : "",
      name: initial?.name ?? "",
      code: initial?.code ?? "",
      project_type: initial?.project_type ?? "",
      description: initial?.description ?? "",
      start_date: initial?.start_date ?? "",
      end_date: initial?.end_date ?? "",
      responsible_user_id: initial?.responsible_user_id
        ? String(initial.responsible_user_id)
        : "",
      planning_responsible_user_id: initial?.planning_responsible_user_id
        ? String(initial.planning_responsible_user_id)
        : "",
      planning_notes: initial?.planning_notes ?? "",
    },
  });
  const values = form.watch();
  const organizationId = isPlatformAdmin
    ? toId(values.organization_id)
    : undefined;
  const disabled = busy || form.formState.isSubmitting;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !saved.current &&
      (form.formState.isDirty || sending.current) &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );
  useEffect(() => {
    if (!form.formState.isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!saved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [form.formState.isDirty]);
  useEffect(() => {
    heading.current?.focus();
  }, [stage]);

  async function advance() {
    if (
      stage === 0 &&
      mode === "create" &&
      isPlatformAdmin &&
      !organizationId
    ) {
      form.setError("organization_id", { message: "Selecione a organização" });
      return;
    }
    if (
      await form.trigger(
        stage === 0 ? generalFields : stage === 1 ? planningFields : [],
      )
    )
      setStage((value) => Math.min(value + 1, 3));
  }
  const submit = form.handleSubmit(
    async (data) => {
      if (sending.current) return;
      sending.current = true;
      form.clearErrors("root");
      try {
        const fields = {
          name: data.name,
          code: data.code || null,
          project_type: (data.project_type || null) as ProjectType | null,
          description: data.description || null,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
          responsible_user_id: toId(data.responsible_user_id) ?? null,
          planning_responsible_user_id:
            toId(data.planning_responsible_user_id) ?? null,
          planning_notes: data.planning_notes || null,
        };
        const payload: CreateProjectRequest | UpdateProjectRequest =
          mode === "create"
            ? {
                ...fields,
                ...(isPlatformAdmin ? { organization_id: organizationId } : {}),
                company_id: toId(data.company_id)!,
              }
            : { ...fields, expected_updated_at: initial?.updated_at };
        await onSubmit(payload);
        saved.current = true;
        onComplete();
      } catch (error) {
        if (error instanceof ApiError) {
          let targetStage = 3;
          for (const detail of Array.isArray(error.details)
            ? error.details
            : []) {
            if (isProjectField(detail.field)) {
              form.setError(detail.field, { message: detail.message });
              targetStage = Math.min(
                targetStage,
                generalFields.includes(detail.field) ? 0 : 1,
              );
            }
          }
          setStage(targetStage);
        }
        form.setError("root", {
          message:
            error instanceof Error
              ? error.message
              : "Não foi possível salvar o projeto. Tente novamente.",
        });
      } finally {
        sending.current = false;
      }
    },
    (errors) => {
      setStage(generalFields.some((key) => key in errors) ? 0 : 1);
    },
  );

  return (
    <>
      <form
        className="grid min-w-0 gap-6"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (stage < 3) void advance();
          else void submit(event);
        }}
      >
        <nav
          aria-label="Etapas do cadastro"
          className="premium-panel p-3 sm:p-5"
        >
          <ol className="grid grid-cols-4 gap-1 sm:gap-4">
            {stages.map((title, index) => (
              <li
                key={title}
                aria-current={stage === index ? "step" : undefined}
              >
                <button
                  type="button"
                  disabled={index > stage || disabled}
                  onClick={() => setStage(index)}
                  className={`flex w-full flex-col items-center gap-2 rounded-xl p-2 text-center text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:text-left ${index === stage ? "bg-primary-subtle text-primary-text" : "text-muted-foreground"}`}
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full border ${index <= stage ? "border-primary/40 bg-primary text-primary-foreground" : "border-border"}`}
                  >
                    {index < stage ? (
                      <Check size={15} aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="break-words">{stageLabels[index]}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <section
          className="premium-panel min-w-0 p-5 sm:p-8"
          aria-labelledby="project-step-heading"
        >
          <div className="mb-6 border-b border-border/60 pb-5">
            <p className="eyebrow">
              Etapa {stage + 1} de {stages.length} ·{" "}
              {mode === "create" ? "Novo projeto" : "Editar projeto"}
            </p>
            <h2
              id="project-step-heading"
              ref={heading}
              tabIndex={-1}
              className="mt-2 text-xl font-bold tracking-tight outline-none"
            >
              {stages[stage]}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {stage === 0
                ? "Identifique o projeto e sua empresa contratante. Os dados opcionais podem ser completados depois."
                : stage === 1
                  ? "Defina a previsão e os responsáveis. As datas não alteram a situação do projeto."
                  : stage === 2
                    ? "Organize a operação nos módulos já disponíveis, após salvar o cadastro."
                    : "Confira as informações antes de salvar. Você pode voltar para ajustar qualquer etapa."}
            </p>
          </div>
          <fieldset disabled={disabled} className="grid min-w-0 gap-5">
            {stage === 0 ? (
              <>
                {mode === "create" && isPlatformAdmin ? (
                  <Controller
                    control={form.control}
                    name="organization_id"
                    render={({ field, fieldState }) => (
                      <FormField
                        label="Organização"
                        error={fieldState.error?.message}
                      >
                        <OrganizationSelect
                          value={field.value}
                          onChange={(value) => {
                            field.onChange(value);
                            form.setValue("company_id", "", {
                              shouldDirty: true,
                            });
                            form.setValue("responsible_user_id", "");
                            form.setValue("planning_responsible_user_id", "");
                            setCompanyName("");
                            setResponsibleName("");
                            setPlannerName("");
                          }}
                          required
                        />
                      </FormField>
                    )}
                  />
                ) : (
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
                    <p className="font-semibold">Organização</p>
                    <p className="mt-1 text-muted-foreground">
                      {mode === "edit"
                        ? "Organização do projeto · vínculo permanente"
                        : "Organização da sua sessão · definida automaticamente"}
                    </p>
                  </div>
                )}
                {mode === "create" ? (
                  <Controller
                    control={form.control}
                    name="company_id"
                    render={({ field, fieldState }) => (
                      <FormField
                        label="Empresa contratante"
                        error={fieldState.error?.message}
                      >
                        <ProjectRegistrationSelect
                          key={`company-${organizationId ?? "session"}`}
                          resource="companies"
                          purpose="create"
                          label="Empresa contratante"
                          organizationId={organizationId}
                          value={field.value}
                          onChange={field.onChange}
                          onLabelChange={setCompanyName}
                          initialLabel={companyName}
                          disabled={isPlatformAdmin && !organizationId}
                          required
                        />
                      </FormField>
                    )}
                  />
                ) : (
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
                    <p className="font-semibold">Empresa contratante</p>
                    <p className="mt-1">
                      {initial?.company_name || "Empresa vinculada ao projeto"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      A empresa não pode ser alterada após a criação.
                    </p>
                  </div>
                )}
                <FormField
                  label="Nome do projeto"
                  error={form.formState.errors.name?.message}
                >
                  <Input required maxLength={255} {...form.register("name")} />
                </FormField>
                <div className="grid gap-5 md:grid-cols-2">
                  <FormField
                    label="Código do projeto"
                    optional
                    hint={
                      mode === "create"
                        ? "Deixe vazio para gerar automaticamente. Único na organização."
                        : "O código permanece reservado mesmo após arquivamento."
                    }
                    error={form.formState.errors.code?.message}
                  >
                    <Input
                      maxLength={40}
                      autoCapitalize="characters"
                      {...form.register("code")}
                    />
                  </FormField>
                  <FormField
                    label="Tipo de projeto"
                    optional
                    error={form.formState.errors.project_type?.message}
                  >
                    <select
                      className={projectSelectClass}
                      {...form.register("project_type")}
                    >
                      <option value="">Não definido</option>
                      {Object.entries(projectTypeLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </FormField>
                </div>
                <FormField
                  label="Descrição"
                  optional
                  error={form.formState.errors.description?.message}
                >
                  <textarea
                    className={`${projectSelectClass} min-h-28`}
                    maxLength={5000}
                    {...form.register("description")}
                  />
                </FormField>
              </>
            ) : null}
            {stage === 1 ? (
              <>
                <div className="grid gap-5 md:grid-cols-2">
                  <FormField
                    label="Data prevista de início"
                    optional
                    error={form.formState.errors.start_date?.message}
                  >
                    <DateInput {...form.register("start_date")} />
                  </FormField>
                  <FormField
                    label="Data prevista de término"
                    optional
                    error={form.formState.errors.end_date?.message}
                  >
                    <DateInput {...form.register("end_date")} />
                  </FormField>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <Controller
                    control={form.control}
                    name="responsible_user_id"
                    render={({ field, fieldState }) => (
                      <FormField
                        label="Responsável pelo projeto"
                        optional
                        error={fieldState.error?.message}
                      >
                        <ProjectRegistrationSelect
                          resource="users"
                          purpose={mode}
                          organizationId={organizationId}
                          label="Responsável pelo projeto"
                          value={field.value}
                          onChange={field.onChange}
                          initialLabel={responsibleName}
                          onLabelChange={setResponsibleName}
                        />
                      </FormField>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="planning_responsible_user_id"
                    render={({ field, fieldState }) => (
                      <FormField
                        label="Responsável pelo planejamento"
                        optional
                        error={fieldState.error?.message}
                      >
                        <ProjectRegistrationSelect
                          resource="users"
                          purpose={mode}
                          organizationId={organizationId}
                          label="Responsável pelo planejamento"
                          value={field.value}
                          onChange={field.onChange}
                          initialLabel={plannerName}
                          onLabelChange={setPlannerName}
                        />
                      </FormField>
                    )}
                  />
                </div>
                <FormField
                  label="Observações de planejamento"
                  optional
                  error={form.formState.errors.planning_notes?.message}
                >
                  <textarea
                    className={`${projectSelectClass} min-h-28`}
                    maxLength={5000}
                    {...form.register("planning_notes")}
                  />
                </FormField>
              </>
            ) : null}
            {stage === 2 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <OperationalCard
                  title="Empresa e unidades"
                  text={`Empresa: ${companyName || initial?.company_name || "Empresa vinculada"}. As unidades ativas serão selecionadas no resumo do projeto, com as permissões e a auditoria do vínculo.`}
                  detail="Unidades opcionais no cadastro"
                />
                <OperationalCard
                  title="Equipe de campo"
                  text="Vincule agentes no resumo do projeto e distribua atividades na Coordenação de Campo. Os responsáveis deste cadastro não recebem permissões adicionais."
                  detail="Equipe pode ser definida depois"
                />
                <OperationalCard
                  title="Preparação e planejamento"
                  text="Questionários, responsáveis por atividades, prazos e aprovações permanecem no módulo de Preparação do projeto."
                  detail="Fluxo de preparação preservado"
                />
                <OperationalCard
                  title="Configurações operacionais"
                  text="Parâmetros específicos são definidos nos módulos de inventário, avaliação e laudos. Não há parâmetros gerais adicionais para preencher neste cadastro."
                  detail="Nenhuma configuração obrigatória"
                />
                <p className="text-sm leading-6 text-muted-foreground sm:col-span-2">
                  {hasPermission("project-units:read")
                    ? "Após salvar, acesse o resumo para consultar as unidades vinculadas e completar a estrutura conforme suas permissões."
                    : "Você pode criar o rascunho agora. A estrutura será gerenciada pelos usuários com as permissões correspondentes."}
                </p>
              </div>
            ) : null}
            {stage === 3 ? (
              <>
                <div className="rounded-xl border border-primary/20 bg-primary-subtle/40 p-4 text-sm">
                  <p className="font-semibold">
                    {mode === "create"
                      ? "O projeto será criado como rascunho"
                      : "A situação atual será preservada"}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {mode === "create"
                      ? "Unidades, equipe e parâmetros opcionais podem ser concluídos depois."
                      : "Organização e empresa permanecem vinculadas ao cadastro original."}
                  </p>
                </div>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Review label="Nome" value={values.name} />
                  <Review
                    label="Código"
                    value={
                      values.code ||
                      (mode === "create" ? "Gerado ao salvar" : "Não definido")
                    }
                  />
                  <Review
                    label="Empresa"
                    value={
                      companyName ||
                      initial?.company_name ||
                      "Empresa vinculada"
                    }
                  />
                  <Review
                    label="Tipo"
                    value={
                      projectTypeLabels[values.project_type as ProjectType] ||
                      "Não definido"
                    }
                  />
                  <Review
                    label="Início previsto"
                    value={formatProjectDate(values.start_date)}
                  />
                  <Review
                    label="Término previsto"
                    value={formatProjectDate(values.end_date)}
                  />
                  <Review
                    label="Responsável pelo projeto"
                    value={responsibleName || "Não definido"}
                  />
                  <Review
                    label="Responsável pelo planejamento"
                    value={plannerName || "Não definido"}
                  />
                  <Review
                    label="Descrição"
                    value={values.description || "Não informada"}
                  />
                  <Review
                    label="Observações de planejamento"
                    value={values.planning_notes || "Não informadas"}
                  />
                </dl>
              </>
            ) : null}
          </fieldset>
        </section>
        {form.formState.errors.root?.message ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {form.formState.errors.root.message}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4">
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <div className="flex flex-wrap gap-2">
            {stage > 0 ? (
              <Button
                type="button"
                variant="secondary"
                disabled={disabled}
                onClick={() => setStage(stage - 1)}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Voltar
              </Button>
            ) : null}
            {stage < 3 ? (
              <Button type="submit" disabled={disabled}>
                Avançar
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            ) : (
              <Button type="submit" loading={disabled}>
                <Save size={16} aria-hidden="true" />
                {mode === "create" ? "Criar projeto" : "Salvar alterações"}
              </Button>
            )}
          </div>
        </div>
      </form>
      <ConfirmDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset();
        }}
        title="Descartar alterações?"
        description="Os dados ainda não foram salvos. Deseja sair do cadastro e descartar as alterações?"
        busy={disabled}
        onConfirm={() => {
          if (blocker.state === "blocked") blocker.proceed();
        }}
      />
    </>
  );
}
function OperationalCard({
  title,
  text,
  detail,
}: {
  title: string;
  text: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-5">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
      <p className="mt-4 text-xs font-semibold text-primary-text">{detail}</p>
    </div>
  );
}
function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 p-4">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-2 whitespace-pre-wrap break-words text-sm font-medium">
        {value}
      </dd>
    </div>
  );
}
function isProjectField(value: string): value is keyof ProjectFormValues {
  return [...generalFields, ...planningFields].includes(
    value as FieldPath<ProjectFormValues>,
  );
}
function toId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}
