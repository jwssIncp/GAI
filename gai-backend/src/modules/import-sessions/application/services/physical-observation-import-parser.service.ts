import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { InventoryObservationResult } from '../../../inventory-operations/domain/inventory-operation.enums';
import {
  ImportItemOperation,
  ImportPayloadItemDto,
} from '../dto/import-sessions-inputs';

const HEADER_ALIASES = {
  inventory_item_id: ['inventory_item_id', 'item_id', 'id_item', 'id_ativo'],
  external_item_id: [
    'external_item_id',
    'codigo_externo',
    'codigo_ativo',
    'id_externo',
  ],
  observed_plate: [
    'observed_plate',
    'placa_encontrada',
    'placa_fisica',
    'placa',
    'tombo',
  ],
  observed_serial_number: [
    'observed_serial_number',
    'numero_serie',
    'serial',
    'serie',
  ],
  inventory_session_id: [
    'inventory_session_id',
    'sessao_inventario_id',
    'session_id',
  ],
  round_id: ['round_id', 'rodada_id'],
  field_agent_id: ['field_agent_id', 'inventariante_id', 'agent_id'],
  observation_result: ['observation_result', 'resultado', 'status_inventario'],
  unit_text: ['unit_text', 'unidade', 'filial'],
  sector_text: ['sector_text', 'setor', 'departamento', 'area'],
  location_text: ['location_text', 'localizacao', 'local'],
  notes: ['notes', 'observacao', 'observacoes', 'obs'],
  captured_at: ['captured_at', 'capturado_em', 'data_inventario'],
} as const;

@Injectable()
export class PhysicalObservationImportParserService {
  parse(buffer: Buffer): ImportPayloadItemDto[] {
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      raw: false,
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[sheetName],
      { defval: null },
    );
    return rows.map((source) => {
      const row = this.normalizeKeys(source);
      return {
        operation: ImportItemOperation.UPSERT,
        inventory_item_id: this.integer(
          this.pick(row, HEADER_ALIASES.inventory_item_id),
        ),
        external_item_id: this.text(
          this.pick(row, HEADER_ALIASES.external_item_id),
        ),
        observed_plate: this.text(
          this.pick(row, HEADER_ALIASES.observed_plate),
        ),
        observed_serial_number: this.text(
          this.pick(row, HEADER_ALIASES.observed_serial_number),
        ),
        inventory_session_id: this.integer(
          this.pick(row, HEADER_ALIASES.inventory_session_id),
        ),
        round_id: this.integer(this.pick(row, HEADER_ALIASES.round_id)),
        field_agent_id: this.integer(
          this.pick(row, HEADER_ALIASES.field_agent_id),
        ),
        observation_result: this.result(
          this.pick(row, HEADER_ALIASES.observation_result),
        ),
        unit_text: this.text(this.pick(row, HEADER_ALIASES.unit_text)),
        sector_text: this.text(this.pick(row, HEADER_ALIASES.sector_text)),
        location_text: this.text(this.pick(row, HEADER_ALIASES.location_text)),
        notes: this.text(this.pick(row, HEADER_ALIASES.notes)),
        captured_at: this.dateTime(this.pick(row, HEADER_ALIASES.captured_at)),
        metadata: { original_row: source },
      };
    });
  }

  private normalizeKeys(row: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, ''),
        value,
      ]),
    );
  }
  private pick(
    row: Record<string, unknown>,
    aliases: readonly string[],
  ): unknown {
    for (const alias of aliases)
      if (row[alias] !== null && row[alias] !== undefined && row[alias] !== '')
        return row[alias];
    return undefined;
  }
  private text(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean' &&
      typeof value !== 'bigint'
    ) {
      return undefined;
    }
    return String(value).trim() || undefined;
  }
  private integer(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }
  private dateTime(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
    }
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean' &&
      typeof value !== 'bigint'
    ) {
      return undefined;
    }
    const raw = String(value);
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? raw : date.toISOString();
  }
  private result(value: unknown): InventoryObservationResult | undefined {
    const normalized = this.text(value)
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '_');
    const aliases: Record<string, InventoryObservationResult> = {
      encontrado: InventoryObservationResult.FOUND,
      found: InventoryObservationResult.FOUND,
      nao_encontrado: InventoryObservationResult.NOT_FOUND,
      not_found: InventoryObservationResult.NOT_FOUND,
      divergente: InventoryObservationResult.DIVERGENT,
      divergent: InventoryObservationResult.DIVERGENT,
      duplicado: InventoryObservationResult.DUPLICATED,
      duplicated: InventoryObservationResult.DUPLICATED,
    };
    return normalized ? aliases[normalized] : undefined;
  }
}
