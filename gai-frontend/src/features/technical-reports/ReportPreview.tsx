import type { Content } from "./reportApi";
import { familyLabels } from "./reportApi";
import "./reports.css";
import { GaiLogo } from '@/components/base/GaiLogo';
const metricLabels: Record<string, string> = {
  "units.count": "Unidades vinculadas",
  "inventory.count": "Itens no inventário",
  "accounting.count": "Registros contábeis",
  "observations.count": "Observações registradas",
  "observations.distinct_items": "Itens com observações",
  "reconciliation.count": "Registros na conciliação",
  "reconciliation.run": "Execução da conciliação",
  "reconciliation.unresolved": "Divergências sem consolidação válida",
  "valuation.count": "Avaliações consideradas",
  "valuation.used_total": "Total avaliado usado (moeda não informada)",
  "issues.open_count": "Pendências em aberto",
};
function reportText(text: string, fields: Content["fields"]) {
  return text.replace(
    /\{\{([^{}]+)\}\}/g,
    (_match: string, key: string) =>
      fields.find((f) => f.key === key.trim())?.value || "[não preenchido]",
  );
}
export function ReportPreview({
  data,
  revision,
  status,
  hash,
}: {
  data: Content;
  revision: number;
  status: string;
  hash?: string;
}) {
  return (
    <article className="technical-report-document mx-auto w-full max-w-5xl rounded-xl border bg-white p-5 text-slate-900 shadow-sm sm:p-10">
      <section className="report-cover grid min-h-80 content-between gap-8 border-b-4 border-slate-800 pb-8">
        <div className="text-sm font-bold tracking-widest text-slate-700">
          <GaiLogo appearance="light" />
        </div>
        <div>
          <p className="text-sm uppercase tracking-wider">
            {data.template.data.report_type}
          </p>
          <h1 className="mt-3 text-3xl font-bold">{data.title}</h1>
          <p className="mt-4 text-lg">
            {data.sources.fields["company.name"] ?? "Empresa não informada"}
          </p>
          <p>
            {data.sources.fields["project.name"]} · Projeto #
            {data.sources.fields["project.id"]}
          </p>
        </div>
        <div className="grid gap-1 text-xs">
          <p>
            {status === "approved"
              ? "Versão aprovada preservada"
              : "Prévia de trabalho · não aprovada"}{" "}
            · Revisão {revision}
          </p>
          <p>
            Modelo ID {data.template.id} · versão publicada ID{" "}
            {data.template.version_id}
          </p>
          <p>
            Extração:{" "}
            {new Date(data.sources.generated_at).toLocaleString("pt-BR")}
          </p>
          <p>
            Aprovação interna não equivale a assinatura digital ou comprovação
            de habilitação profissional.
          </p>
        </div>
      </section>
      <section className="my-8">
        <h2 className="text-xl font-semibold">Sumário</h2>
        <ol className="mt-3 grid gap-2">
          {data.sections.map((s, i) => (
            <li key={s.key}>
              <a href={"#laudo-secao-" + s.key}>
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
          <li>Indicadores e quadros de fontes</li>
          <li>Conclusão e responsáveis</li>
          <li>Referências e limitações</li>
        </ol>
      </section>
      <section className="my-8">
        <h2 className="text-xl font-semibold">Campos do documento</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {data.fields.map((f) => (
            <div key={f.key}>
              <dt className="text-sm font-semibold">{f.label}</dt>
              <dd className="whitespace-pre-wrap text-sm">
                {f.value || "[não preenchido]"}
                <span className="block text-xs text-slate-600">
                  {f.origin === "system"
                    ? "Extraído do sistema: " + f.source_key
                    : f.origin === "manual"
                      ? "Editado manualmente"
                      : "Campo não preenchido"}
                  {f.origin === "manual" && f.source_key
                    ? " · valor original extraído: " +
                      (f.original_value ?? "indisponível")
                    : ""}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      {data.sections.map((s, i) => (
        <section
          key={s.key}
          id={"laudo-secao-" + s.key}
          className="report-section my-8"
        >
          <h2 className="border-b border-slate-400 pb-2 text-xl font-semibold">
            {i + 1}. {s.title}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {s.origin === "template"
              ? "Texto do modelo versionado"
              : "Texto editado manualmente"}
          </p>
          <p className="mt-4 whitespace-pre-wrap break-words leading-7">
            {reportText(s.text, data.fields) || "[não preenchido]"}
          </p>
        </section>
      ))}
      <section className="report-section my-8">
        <h2 className="text-xl font-semibold">
          Indicadores extraídos e calculados
        </h2>
        <p className="text-xs text-slate-600">
          Contagens do recorte selecionado. Totais de avaliação não comprovam
          método ou moeda; ausência de fonte não é zero.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          {Object.entries(data.sources.metrics).map(([k, v]) => (
            <div key={k} className="rounded border p-3">
              <dt className="break-words text-xs text-slate-600">
                {metricLabels[k] ?? k}
              </dt>
              <dd className="text-lg font-semibold">{v ?? "Indisponível"}</dd>
            </div>
          ))}
        </dl>
      </section>
      {data.sources.tables
        .filter((t) => data.template.data.tables.includes(t.family))
        .map((t) => (
          <section key={t.family} className="report-section my-8">
            <h2 className="text-xl font-semibold">{familyLabels[t.family]}</h2>
            <p className="my-2 text-xs text-slate-600">
              Dados extraídos do sistema · {t.rows.length} registro(s) ·
              referência à origem preservada
            </p>
            <div className="overflow-x-auto">
              <table className="report-source-table w-full border-collapse text-left text-xs">
                <thead>
                  <tr>
                    {t.columns.map((c) => (
                      <th
                        className="border border-slate-300 bg-slate-800 p-2 text-white"
                        key={c}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r, i) => (
                    <tr key={i}>
                      {r.map((cell, j) => (
                        <td
                          className="border border-slate-300 p-2 align-top"
                          key={j}
                        >
                          {cell === null ? "Não informado" : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!t.rows.length && (
              <p className="text-sm">
                Sem registros no recorte extraído. Confira a aplicabilidade e a
                cobertura.
              </p>
            )}
            <p className="mt-2 break-all text-[10px] text-slate-500">
              Fonte {t.family} · SHA-256 {t.hash}
            </p>
          </section>
        ))}
      <section className="report-section my-8">
        <h2 className="text-xl font-semibold">Observações técnicas</h2>
        <p className="mt-3 whitespace-pre-wrap leading-7">
          {data.technical_notes || "[não preenchido]"}
        </p>
        <h2 className="mt-8 text-xl font-semibold">Conclusão</h2>
        <p className="mt-3 whitespace-pre-wrap leading-7">
          {data.conclusion || "[não preenchido]"}
        </p>
      </section>
      <section className="report-section my-8">
        <h2 className="text-xl font-semibold">Responsáveis declarados</h2>
        {data.responsibles.length ? (
          data.responsibles.map((r) => (
            <div key={r.id} className="mt-3 rounded border p-4">
              <p className="font-semibold">{r.display_name}</p>
              <p>
                {r.function} · Usuário #{r.user_id}
              </p>
              <p className="text-sm">
                Registro declarado:{" "}
                {r.professional_registration || "Não informado"}
              </p>
              {r.registration_evidence && (
                <p className="text-sm">
                  Referência comprobatória informada: {r.registration_evidence}
                </p>
              )}
            </div>
          ))
        ) : (
          <p>Nenhum responsável vinculado.</p>
        )}
        <p className="mt-4 text-xs">
          Identificação declarada e autorização interna de cadastro. Este
          documento não contém assinatura digital, ART/RRT emitida nem atestado
          automático de conformidade normativa.
        </p>
      </section>
      <footer className="report-section mt-8 border-t pt-4 text-xs">
        <h2 className="font-semibold">Referências e limitações</h2>
        <p>Critérios: {JSON.stringify(data.sources.selection)}</p>
        <p>
          Fontes sem informação suficiente:{" "}
          {data.sources.missing.join(", ") ||
            "Nenhuma ausência identificada nas fontes selecionadas; isso não certifica completude do trabalho."}
        </p>
        <p className="break-all">Snapshot das fontes: {data.sources.hash}</p>
        <p className="break-all">Modelo: {data.template.hash}</p>
        {hash && <p className="break-all">Versão documental: {hash}</p>}
      </footer>
    </article>
  );
}
