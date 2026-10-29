import { TemplateDataDto } from '../../../../src/modules/technical-reports/report.dto';
import { ReportContent } from '../../../../src/modules/technical-reports/report.entity';
export const templateFixture = (): TemplateDataDto => ({
  name: 'SINTETICO Modelo',
  report_type: 'Relatorio patrimonial sintetico',
  description: 'Somente homologacao',
  sections: [
    {
      key: 'identificacao',
      title: 'Identificacao',
      text: 'Projeto {{projeto}}',
      required: true,
    },
    { key: 'objetivo', title: 'Objetivo', text: '', required: true },
  ],
  fields: [
    {
      key: 'projeto',
      label: 'Projeto',
      required: true,
      system_key: 'project.name',
    },
  ],
  tables: ['identity'],
  rules: {
    responsible_required: true,
    professional_registration_required: false,
    reconciliation_required: false,
    valuation_required: false,
    unresolved_divergences: 'warning',
    incomplete_indicators: 'warning',
    stale_sources: 'block',
  },
});
export const contentFixture = (): ReportContent => ({
  title: 'SINTETICO Laudo',
  template: {
    id: 1,
    version_id: 1,
    hash: 'template-hash',
    data: templateFixture(),
  },
  sections: [
    {
      key: 'identificacao',
      title: 'Identificacao',
      text: 'Projeto {{projeto}}',
      origin: 'template',
    },
    {
      key: 'objetivo',
      title: 'Objetivo',
      text: 'SINTETICO levantamento documental limitado',
      origin: 'manual',
    },
  ],
  fields: [
    {
      key: 'projeto',
      label: 'Projeto',
      value: 'SINTETICO Projeto',
      origin: 'system',
      source_key: 'project.name',
      original_value: 'SINTETICO Projeto',
    },
  ],
  sources: {
    selection: { families: ['identity'] },
    generated_at: '2026-10-28T12:00:00.000Z',
    permissions: ['projects:read', 'companies:read'],
    tables: [
      {
        family: 'identity',
        columns: ['Projeto ID'],
        rows: [[1]],
        references: [{ id: 1, version: 'v1' }],
        hash: 'identity-hash',
      },
    ],
    fields: { 'project.id': '1', 'project.name': 'SINTETICO Projeto' },
    metrics: {},
    missing: [],
    unresolved: 0,
    hash: 'source-hash',
  },
  responsibles: [
    {
      id: 1,
      user_id: 2,
      display_name: 'SINTETICO Autor',
      function: 'Elaborador',
      professional_registration: '',
      registration_evidence: '',
    },
  ],
  technical_notes: 'Dados sinteticos',
  conclusion: 'Conclusao sintetica sem afirmacao normativa',
});
