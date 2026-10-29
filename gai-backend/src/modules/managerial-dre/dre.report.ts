import type { DreReportDto } from './dre.dto';
import type { SourceSnapshot } from './dre.entity';
import type { calculateDre, DreLineInput } from './dre.policy';
export type DreCalculated = ReturnType<typeof calculateDre>;
export interface DreReport {
  engine_version: string;
  organization_id: number;
  filters: DreReportDto;
  generated_at: string;
  complete: boolean;
  totals: (DreCalculated & { currency: string })[];
  monthly: (DreCalculated & {
    currency: string;
    month: string;
    closed: boolean;
  })[];
  by_project: (DreCalculated & {
    project_id: number | null;
    currency: string;
  })[];
  rows: DreLineInput[];
  unclassified: Record<string, unknown>[];
  pending_sources: SourceSnapshot[];
  stale_sources: SourceSnapshot[];
  source_permissions: string[];
  warnings: string[];
  periods: {
    month: string;
    revision: number;
    closed: boolean;
    closure_hash: string;
    policy_reference: string;
  }[];
  entry_versions: { id: number; revision: number; hash: string }[];
  comparison: {
    start_month: string;
    end_month: string;
    totals: (DreCalculated & { currency: string })[];
  } | null;
}
