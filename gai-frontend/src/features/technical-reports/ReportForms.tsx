import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  familyLabels,
  reportInput as cls,
  systemFields,
  emptyTemplate,
  type TemplateData,
  type Selection,
} from "./reportApi";
export function ReportField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      {children}
    </label>
  );
}
export function TemplateForm({
  initial,
  onSave,
}: {
  initial?: TemplateData;
  onSave: (d: TemplateData, reason: string) => Promise<void>;
}) {
  const [d, setD] = useState(initial ?? emptyTemplate()),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const put = <K extends keyof TemplateData>(key: K, value: TemplateData[K]) =>
    setD((v) => ({ ...v, [key]: value }));
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        try {
          await onSave(d, String(f.get("reason")));
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <ReportField label="Nome do modelo">
        <input
          className={cls}
          required
          minLength={3}
          value={d.name}
          onChange={(e) => put("name", e.target.value)}
        />
      </ReportField>
      <ReportField label="Tipo de laudo">
        <input
          className={cls}
          required
          minLength={3}
          value={d.report_type}
          onChange={(e) => put("report_type", e.target.value)}
        />
      </ReportField>
      <ReportField label="Descrição do modelo">
        <textarea
          className={cls}
          value={d.description}
          onChange={(e) => put("description", e.target.value)}
        />
      </ReportField>
      <h4 className="font-semibold">Seções na ordem do documento</h4>
      <p className="text-sm">
        Texto simples. Para campo dinâmico, use {"{{chave}}"} de um campo
        definido abaixo. Nenhuma declaração técnica é inserida automaticamente.
      </p>
      {d.sections.map((s, i) => (
        <fieldset className="grid gap-2 rounded-xl border p-3" key={i}>
          <legend>Seção {i + 1}</legend>
          <ReportField label={`Chave da seção ${i + 1}`}>
            <input
              className={cls}
              required
              pattern="[a-z][a-z0-9_-]*"
              value={s.key}
              onChange={(e) =>
                put(
                  "sections",
                  d.sections.map((r, n) =>
                    n === i ? { ...r, key: e.target.value } : r,
                  ),
                )
              }
            />
          </ReportField>
          <ReportField label={`Título da seção ${i + 1}`}>
            <input
              className={cls}
              required
              value={s.title}
              onChange={(e) =>
                put(
                  "sections",
                  d.sections.map((r, n) =>
                    n === i ? { ...r, title: e.target.value } : r,
                  ),
                )
              }
            />
          </ReportField>
          <ReportField label={`Texto padrão da seção ${i + 1}`}>
            <textarea
              rows={4}
              className={cls}
              value={s.text}
              onChange={(e) =>
                put(
                  "sections",
                  d.sections.map((r, n) =>
                    n === i ? { ...r, text: e.target.value } : r,
                  ),
                )
              }
            />
          </ReportField>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.required}
              onChange={(e) =>
                put(
                  "sections",
                  d.sections.map((r, n) =>
                    n === i ? { ...r, required: e.target.checked } : r,
                  ),
                )
              }
            />
            Seção {i + 1} obrigatória
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={i === 0}
              onClick={() => {
                const a = [...d.sections];
                [a[i - 1], a[i]] = [a[i], a[i - 1]];
                put("sections", a);
              }}
            >
              Subir seção {i + 1}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={d.sections.length === 1}
              onClick={() =>
                put(
                  "sections",
                  d.sections.filter((_, n) => n !== i),
                )
              }
            >
              Remover seção {i + 1}
            </Button>
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="secondary"
        disabled={d.sections.length >= 30}
        onClick={() =>
          put("sections", [
            ...d.sections,
            {
              key: "secao_" + Date.now(),
              title: "Nova seção",
              text: "",
              required: false,
            },
          ])
        }
      >
        Adicionar seção
      </Button>
      <h4 className="font-semibold">Campos dinâmicos</h4>
      {d.fields.map((f, i) => (
        <fieldset className="grid gap-2 rounded-xl border p-3" key={i}>
          <legend>Campo {i + 1}</legend>
          <ReportField label={`Chave do campo ${i + 1}`}>
            <input
              className={cls}
              required
              pattern="[a-z][a-z0-9_-]*"
              value={f.key}
              onChange={(e) =>
                put(
                  "fields",
                  d.fields.map((r, n) =>
                    n === i ? { ...r, key: e.target.value } : r,
                  ),
                )
              }
            />
          </ReportField>
          <ReportField label={`Nome do campo ${i + 1}`}>
            <input
              className={cls}
              required
              value={f.label}
              onChange={(e) =>
                put(
                  "fields",
                  d.fields.map((r, n) =>
                    n === i ? { ...r, label: e.target.value } : r,
                  ),
                )
              }
            />
          </ReportField>
          <ReportField label={`Fonte do campo ${i + 1}`}>
            <select
              className={cls}
              value={f.system_key ?? ""}
              onChange={(e) =>
                put(
                  "fields",
                  d.fields.map((r, n) =>
                    n === i
                      ? {
                          key: r.key,
                          label: r.label,
                          required: r.required,
                          ...(e.target.value
                            ? { system_key: e.target.value }
                            : {}),
                        }
                      : r,
                  ),
                )
              }
            >
              <option value="">Preenchimento manual</option>
              {systemFields.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </ReportField>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.required}
              onChange={(e) =>
                put(
                  "fields",
                  d.fields.map((r, n) =>
                    n === i ? { ...r, required: e.target.checked } : r,
                  ),
                )
              }
            />
            Campo {i + 1} obrigatório
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              put(
                "fields",
                d.fields.filter((_, n) => n !== i),
              )
            }
          >
            Remover campo {i + 1}
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          put("fields", [
            ...d.fields,
            {
              key: "campo_" + Date.now(),
              label: "Novo campo",
              required: false,
            },
          ])
        }
      >
        Adicionar campo dinâmico
      </Button>
      <fieldset className="grid gap-2 rounded-xl border p-3">
        <legend>Tabelas aplicáveis ao modelo</legend>
        {Object.entries(familyLabels).map(([k, l]) => (
          <label className="flex gap-2 text-sm" key={k}>
            <input
              type="checkbox"
              checked={d.tables.includes(k)}
              onChange={(e) =>
                put(
                  "tables",
                  e.target.checked
                    ? [...d.tables, k]
                    : d.tables.filter((v) => v !== k),
                )
              }
            />
            {l}
          </label>
        ))}
      </fieldset>
      <fieldset className="grid gap-2 rounded-xl border p-3">
        <legend>Regras de validação auditáveis</legend>
        {Object.entries({
          responsible_required: "Exigir responsável cadastrado",
          professional_registration_required:
            "Exigir registro profissional e referência comprobatória",
          reconciliation_required: "Exigir conciliação com registros",
          valuation_required: "Exigir avaliação com registros",
        }).map(([k, l]) => (
          <label key={k} className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(d.rules[k as keyof typeof d.rules])}
              onChange={(e) =>
                put("rules", { ...d.rules, [k]: e.target.checked })
              }
            />
            {l}
          </label>
        ))}
        {Object.entries({
          unresolved_divergences: "Divergências e pendências abertas",
          incomplete_indicators: "Fontes e indicadores incompletos",
          stale_sources: "Fontes alteradas após extração",
        }).map(([k, l]) => (
          <ReportField label={l} key={k}>
            <select
              className={cls}
              value={String(d.rules[k as keyof typeof d.rules])}
              onChange={(e) =>
                put("rules", { ...d.rules, [k]: e.target.value })
              }
            >
              <option value="warning">Aviso, exige conferência técnica</option>
              <option value="block">Bloqueia aprovação</option>
            </select>
          </ReportField>
        ))}
      </fieldset>
      <ReportField label="Justificativa">
        <input className={cls} name="reason" required minLength={5} />
      </ReportField>
      <label className="flex gap-2 text-sm">
        <input type="checkbox" required />
        Confirmo as regras e o conteúdo do modelo
      </label>
      {error && <p role="alert">{error}</p>}
      <Button disabled={busy}>Salvar rascunho do modelo</Button>
    </form>
  );
}
export function SourceSelection({
  initial,
  name = "selection",
}: {
  initial?: Selection;
  name?: string;
}) {
  const [families, setFamilies] = useState(initial?.families ?? ["identity"]);
  return (
    <fieldset className="grid gap-2 rounded-xl border p-3">
      <legend>Fontes controladas do projeto</legend>
      <p className="text-xs text-muted-foreground">
        A extração exige as permissões específicas das fontes. Projeto e empresa
        sempre são identificados; avaliações não são convertidas em declarações
        técnicas.
      </p>
      {Object.entries(familyLabels).map(([k, l]) => (
        <label key={k} className="flex gap-2 text-sm">
          <input
            type="checkbox"
            name={name + ".families"}
            value={k}
            checked={families.includes(k)}
            disabled={k === "identity"}
            onChange={(e) =>
              setFamilies(
                e.target.checked
                  ? [...families, k]
                  : families.filter((v) => v !== k),
              )
            }
          />
          {l}
        </label>
      ))}
      <input type="hidden" name={name + ".families"} value="identity" />
      {(families.includes("observations") ||
        families.includes("reconciliation")) && (
        <ReportField label="Sessão de inventário (ID)">
          <input
            className={cls}
            type="number"
            min={1}
            name={name + ".session_id"}
            required
            defaultValue={initial?.session_id}
          />
        </ReportField>
      )}
      {families.includes("valuation") && (
        <ReportField label="Lote confirmado de avaliação (ID, opcional)">
          <input
            className={cls}
            type="number"
            min={1}
            name={name + ".valuation_batch_id"}
            defaultValue={initial?.valuation_batch_id}
          />
        </ReportField>
      )}
      <p className="text-xs text-muted-foreground">
        Sem lote específico, usa a última avaliação por item, pela data e ID.
        Consulte IDs nas abas Inventário e Avaliações do projeto.
      </p>
    </fieldset>
  );
}
