import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { InventoryAccountingItemStatus } from '../../domain/enums/inventory-accounting-item-status.enum';
import { InventoryAccountingItemScopeService } from './inventory-accounting-item-scope.service';

export interface ParsedAccountingRow {
  rowNumber: number;
  data: {
    plate: string | null;
    description: string | null;
    accountingAccountDescription: string | null;
    location: string | null;
    acquisitionDate: Date | null;
    acquisitionValue: string | null;
    baseCode: string | null;
    status: InventoryAccountingItemStatus;
    investorCode: string | null;
    note1: string | null;
    note2: string | null;
    newInventoryPlate: string | null;
    inventoryDescription: string | null;
    inventoryLocation: string | null;
    metadata: Record<string, unknown> | null;
  };
  errors: string[];
}

@Injectable()
export class AccountingImportParserService {
  constructor(private readonly scope: InventoryAccountingItemScopeService) {}

  parse(buffer: Buffer): ParsedAccountingRow[] {
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      raw: false,
    });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return [];
    }
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
    });

    return rows.map((row, index) => this.parseRow(row, index + 2));
  }

  private parseRow(
    row: Record<string, unknown>,
    rowNumber: number,
  ): ParsedAccountingRow {
    const normalized = this.normalizeKeys(row);
    const errors: string[] = [];
    const date = this.scope.parseDate(
      this.pick(normalized, ['data_aquisicao', 'acquisition_date']),
    );
    const money = this.scope.normalizeMoney(
      this.pick(normalized, ['valor_aquisicao', 'acquisition_value']),
    );
    const statusValue = this.scope.cleanText(this.pick(normalized, ['status']));
    const status = this.parseStatus(statusValue, errors);

    if (
      date === null &&
      this.pick(normalized, ['data_aquisicao', 'acquisition_date']) != null
    ) {
      errors.push('acquisition_date must be a real date');
    }
    if (
      money !== null &&
      money !== undefined &&
      !/^\d{1,13}(\.\d{1,2})?$/.test(money)
    ) {
      errors.push('acquisition_value must be a decimal string');
    }

    const consumed = new Set([
      'placa',
      'description',
      'descricao_01',
      'descricao_conta_contabil',
      'localizacao',
      'data_aquisicao',
      'valor_aquisicao',
      'cod_base',
      'status',
      'codigo_investor',
      'obs_1',
      'obs_2',
      'placa_nova_inventario',
      'descricao_inventario',
      'localizacao_inventario',
    ]);
    const metadata = Object.fromEntries(
      Object.entries(normalized).filter(([key]) => !consumed.has(key)),
    );

    return {
      rowNumber,
      data: {
        plate:
          this.scope.normalizePlate(
            this.pick(normalized, ['placa', 'plate']),
          ) ?? null,
        description:
          this.scope.cleanText(
            this.pick(normalized, ['descricao_01', 'description']),
          ) ?? null,
        accountingAccountDescription:
          this.scope.cleanText(
            this.pick(normalized, ['descricao_conta_contabil']),
          ) ?? null,
        location:
          this.scope.cleanText(this.pick(normalized, ['localizacao'])) ?? null,
        acquisitionDate: date ?? null,
        acquisitionValue: money ?? null,
        baseCode:
          this.scope.cleanText(
            this.pick(normalized, ['cod_base', 'base_code']),
          ) ?? null,
        status,
        investorCode:
          this.scope.cleanText(
            this.pick(normalized, ['codigo_investor', 'investor_code']),
          ) ?? null,
        note1:
          this.scope.cleanText(this.pick(normalized, ['obs_1', 'note_1'])) ??
          null,
        note2:
          this.scope.cleanText(this.pick(normalized, ['obs_2', 'note_2'])) ??
          null,
        newInventoryPlate:
          this.scope.normalizePlate(
            this.pick(normalized, [
              'placa_nova_inventario',
              'new_inventory_plate',
            ]),
          ) ?? null,
        inventoryDescription:
          this.scope.cleanText(
            this.pick(normalized, [
              'descricao_inventario',
              'inventory_description',
            ]),
          ) ?? null,
        inventoryLocation:
          this.scope.cleanText(
            this.pick(normalized, [
              'localizacao_inventario',
              'inventory_location',
            ]),
          ) ?? null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      },
      errors,
    };
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
        typeof value === 'string' ? value.trim() : value,
      ]),
    );
  }

  private pick(
    row: Record<string, unknown>,
    aliases: string[],
  ): string | Date | number | null {
    for (const alias of aliases) {
      if (
        row[alias] !== undefined &&
        row[alias] !== null &&
        row[alias] !== ''
      ) {
        return row[alias] as string | Date | number;
      }
    }
    return null;
  }

  private parseStatus(
    value: string | null | undefined,
    errors: string[],
  ): InventoryAccountingItemStatus {
    if (!value) {
      return InventoryAccountingItemStatus.PENDING;
    }
    if (
      Object.values(InventoryAccountingItemStatus).includes(
        value as InventoryAccountingItemStatus,
      )
    ) {
      return value as InventoryAccountingItemStatus;
    }
    errors.push(`Invalid status: ${value}`);
    return InventoryAccountingItemStatus.PENDING;
  }
}
