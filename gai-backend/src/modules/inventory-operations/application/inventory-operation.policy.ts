import { ConflictException } from '@nestjs/common';
import {
  InventoryRoundKind,
  InventoryRoundStatus,
  InventorySessionStatus,
} from '../domain/inventory-operation.enums';

export class InventoryOperationPolicy {
  static normalizePlate(value: string | null | undefined): string | null {
    if (value == null) return null;
    const normalized = value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    return normalized || null;
  }

  static assertCanStart(status: InventorySessionStatus): void {
    if (status !== InventorySessionStatus.DRAFT)
      throw new ConflictException({
        code: 'INVENTORY_SESSION_STATUS_INVALID',
        message: 'Only draft sessions can be started',
      });
  }

  static assertCanReceiveObservation(
    sessionStatus: InventorySessionStatus,
    roundStatus: InventoryRoundStatus,
    kind: InventoryRoundKind,
    targetItemId: number | null,
    itemId: number,
  ): void {
    if (
      sessionStatus !== InventorySessionStatus.ACTIVE ||
      roundStatus !== InventoryRoundStatus.ACTIVE
    )
      throw new ConflictException({
        code: 'INVENTORY_ROUND_NOT_ACTIVE',
        message: 'Session and round must be active',
      });
    if (kind === InventoryRoundKind.REINVENTORY && targetItemId !== itemId)
      throw new ConflictException({
        code: 'REINVENTORY_ITEM_MISMATCH',
        message: 'Reinventory round is restricted to its target item',
      });
  }
}
