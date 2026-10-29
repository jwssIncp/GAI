import { ConflictException } from '@nestjs/common';
import { TemplateDataDto } from './report.dto';
import { ReportContent, Validation } from './report.entity';
import { reportInvalid } from './report.sources';
import { REPORT_HASH_ALGORITHM } from './report.hash';
export const REPORT_ENGINE = 'technical-report-v1';
export function reportConflict(message: string): never {
  throw new ConflictException({ code: 'TECHNICAL_REPORT_CONFLICT', message });
}
export function plain(value: string) {
  if (
    typeof value !== 'string' ||
    [...value].some(
      (c) => c.charCodeAt(0) < 32 && ![9, 10, 13].includes(c.charCodeAt(0)),
    )
  )
    reportInvalid('Texto contém caracteres de controle inválidos.');
  if (/<\s*\/?\s*[a-z!][^>]*>/i.test(value))
    reportInvalid('Use texto simples. HTML e scripts não são aceitos.');
  return value.trim();
}
export function validateTemplate(data: TemplateDataDto) {
  if (
    !data ||
    !data.rules ||
    !data.sections?.length ||
    !Array.isArray(data.fields) ||
    !Array.isArray(data.tables)
  )
    reportInvalid('Estrutura completa do modelo obrigatória.');
  plain(data.name);
  plain(data.report_type);
  if (plain(data.name).length < 3 || plain(data.report_type).length < 3)
    reportInvalid('Nome e tipo do modelo devem ser significativos.');
  plain(data.description);
  const keys = new Set<string>();
  for (const s of data.sections) {
    if (keys.has(s.key)) reportInvalid('Chave de seção repetida.');
    keys.add(s.key);
    plain(s.title);
    plain(s.text);
  }
  const fields = new Set<string>();
  for (const f of data.fields) {
    if (fields.has(f.key)) reportInvalid('Chave de campo repetida.');
    fields.add(f.key);
    plain(f.label);
  }
  for (const s of data.sections)
    for (const match of s.text.matchAll(/\{\{([^{}]+)\}\}/g))
      if (!fields.has(match[1].trim()))
        reportInvalid('Texto contém campo dinâmico não definido: ' + match[1]);
  return JSON.parse(JSON.stringify(data)) as TemplateDataDto;
}
export function renderSection(text: string, fields: ReportContent['fields']) {
  return text.replace(
    /\{\{([^{}]+)\}\}/g,
    (_match: string, key: string) =>
      fields.find((f) => f.key === key.trim())?.value || '[não preenchido]',
  );
}
export function reportValidation(
  data: ReportContent,
  currentHash: string,
  invalidResponsibles: number[] = [],
): Validation {
  const issues: Validation['issues'] = [],
    rules = data.template.data.rules;
  const add = (
    code: string,
    severity: 'warning' | 'block',
    message: string,
    key?: string,
  ) => issues.push({ code, severity, message, ...(key ? { key } : {}) });
  if (
    !data.sources.fields['project.id'] ||
    !data.sources.fields['project.name']
  )
    add('PROJECT_REQUIRED', 'block', 'Identificação do projeto indisponível.');
  for (const s of data.template.data.sections) {
    const c = data.sections.find((c) => c.key === s.key);
    if (s.required && !c?.text.trim())
      add(
        'SECTION_REQUIRED',
        'block',
        'Seção obrigatória não preenchida: ' + s.title,
        s.key,
      );
  }
  for (const f of data.template.data.fields) {
    const c = data.fields.find((c) => c.key === f.key);
    if (f.required && !c?.value.trim())
      add(
        'FIELD_REQUIRED',
        'block',
        'Campo obrigatório não preenchido: ' + f.label,
        f.key,
      );
  }
  for (const s of data.sections) {
    for (const match of s.text.matchAll(/\{\{([^{}]+)\}\}/g)) {
      const f = data.fields.find((f) => f.key === match[1].trim());
      if (!f?.value.trim())
        add(
          'DYNAMIC_FIELD_EMPTY',
          'block',
          'Campo dinâmico ausente: ' + match[1],
          s.key,
        );
    }
  }
  for (const f of data.template.data.tables)
    if (!data.sources.tables.some((t) => t.family === f))
      add(
        'TABLE_SOURCE_REQUIRED',
        'block',
        'Fonte exigida pela tabela não foi extraída: ' + f,
        f,
      );
  if (
    (rules.responsible_required || rules.professional_registration_required) &&
    !data.responsibles.length
  )
    add(
      'RESPONSIBLE_REQUIRED',
      'block',
      'Responsável técnico cadastrado e autorizado obrigatório.',
    );
  for (const r of data.responsibles) {
    if (invalidResponsibles.includes(r.id))
      add(
        'RESPONSIBLE_INACTIVE',
        'block',
        'Responsável sem autorização vigente: ' + r.display_name,
      );
    if (
      rules.professional_registration_required &&
      (!r.professional_registration.trim() || !r.registration_evidence.trim())
    )
      add(
        'REGISTRATION_REQUIRED',
        'block',
        'Registro profissional e evidência exigidos pelo modelo: ' +
          r.display_name,
      );
  }
  if (
    rules.reconciliation_required &&
    (!data.sources.tables.some((t) => t.family === 'reconciliation') ||
      data.sources.missing.includes('reconciliation'))
  )
    add(
      'RECONCILIATION_REQUIRED',
      'block',
      'Conciliação com registros obrigatória para este modelo.',
    );
  if (
    rules.valuation_required &&
    (!data.sources.tables.some((t) => t.family === 'valuation') ||
      data.sources.missing.includes('valuation'))
  )
    add(
      'VALUATION_REQUIRED',
      'block',
      'Avaliação com registros obrigatória para este modelo.',
    );
  if (data.sources.unresolved !== null && data.sources.unresolved > 0)
    add(
      'UNRESOLVED_DIVERGENCES',
      rules.unresolved_divergences,
      `${data.sources.unresolved} divergência(s) sem consolidação na última execução selecionada.`,
    );
  if (Number(data.sources.metrics['issues.open_count'] ?? 0) > 0)
    add(
      'OPEN_ISSUES',
      rules.unresolved_divergences,
      'Há pendências patrimoniais em aberto; conferir limitações do trabalho.',
    );
  if (data.sources.missing.length)
    add(
      'INCOMPLETE_SOURCES',
      rules.incomplete_indicators,
      'Fontes/indicadores incompletos: ' + data.sources.missing.join(', '),
    );
  if (data.sources.hash !== currentHash)
    add(
      'STALE_SOURCES',
      rules.stale_sources,
      'Novas fontes disponíveis. Atualize explicitamente ou registre nova revisão conforme a política do modelo.',
    );
  if (!data.conclusion.trim())
    add(
      'CONCLUSION_EMPTY',
      'warning',
      'Conclusão técnica ainda não preenchida; confira os requisitos das seções do modelo.',
    );
  add(
    'INTERNAL_APPROVAL',
    'warning',
    'Aprovação interna não é assinatura digital nem comprova habilitação ou conformidade normativa.',
  );
  return {
    engine: REPORT_ENGINE,
    hash_algorithm: REPORT_HASH_ALGORITHM,
    valid: !issues.some((i) => i.severity === 'block'),
    issues,
    source_hash: currentHash,
  };
}
