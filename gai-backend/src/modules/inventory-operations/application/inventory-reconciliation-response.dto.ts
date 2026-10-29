import { ApiProperty } from '@nestjs/swagger';
import { ReconciliationStatus } from '../domain/inventory-operation.enums';

export class InventoryReconciliationResponseDto {
  @ApiProperty({ type: 'integer' }) id!: number;
  @ApiProperty({ type: 'integer' }) session_id!: number;
  @ApiProperty({ type: 'integer' }) run_number!: number;
  @ApiProperty({ type: 'integer', nullable: true }) inventory_item_id!:
    | number
    | null;
  @ApiProperty({ type: 'integer', nullable: true }) observation_id!:
    | number
    | null;
  @ApiProperty({ type: 'integer', nullable: true }) accounting_item_id!:
    | number
    | null;
  @ApiProperty({ enum: ReconciliationStatus }) status!: ReconciliationStatus;
  @ApiProperty({ type: String, nullable: true }) physical_plate!: string | null;
  @ApiProperty({ type: String, nullable: true }) accounting_plate!:
    | string
    | null;
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  evidence!: Record<string, unknown> | null;
  @ApiProperty({ type: 'integer', nullable: true }) created_by_id!:
    | number
    | null;
  @ApiProperty({ type: String, format: 'date-time' }) created_at!: Date;
}

export class InventoryReconciliationRunResponseDto {
  @ApiProperty({ type: 'integer', minimum: 1 }) run_number!: number;
  @ApiProperty({ type: [InventoryReconciliationResponseDto] })
  records!: InventoryReconciliationResponseDto[];
}
