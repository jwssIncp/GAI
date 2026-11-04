export type DocumentFormat = 'pdf' | 'docx';
export type DocumentKind = 'report' | 'budget' | 'proposal';
export interface VisualTemplate {
  version: string;
  organization_name: string;
  institutional: string;
  primary_color: string;
  header: string;
  footer: string;
  font: 'Roboto' | 'Times';
  cover: boolean;
  logo_png: string | null;
}
export const DEFAULT_VISUAL: Readonly<VisualTemplate> = Object.freeze({
  version: 'gai-a4-v1',
  organization_name: 'GAI · Gestão Patrimonial',
  institutional: '',
  primary_color: '#16324F',
  header: 'GAI · Documentos',
  footer: 'Gestão do Ativo Imobilizado',
  font: 'Roboto',
  cover: true,
  logo_png: null,
});
export interface DocumentBlock {
  title: string;
  paragraphs?: string[];
  table?: { columns: string[]; rows: string[][] };
}
export interface ProfessionalDocument {
  title: string;
  subtitle: string;
  version: string;
  date: string;
  status: string;
  sourceHash: string;
  visual: VisualTemplate;
  blocks: DocumentBlock[];
}
export interface DocumentSource {
  kind: DocumentKind;
  id: number;
  versionId: number;
  projectId: number | null;
  organizationId: number;
  hash: string;
  model: ProfessionalDocument;
}
export const DOCUMENT_MIME: Record<DocumentFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
export const DOCUMENT_ENGINE = 'gai-documents-v2';
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
