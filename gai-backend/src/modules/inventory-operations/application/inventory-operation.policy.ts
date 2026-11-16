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
        message: 'Só sessões em rascunho podem ser iniciadas.',
      });
  }

  static assertCanFinishSession(
    status: InventorySessionStatus,
    activeRoundCount: number,
  ): void {
    if (status !== InventorySessionStatus.ACTIVE)
      throw new ConflictException({
        code: 'INVENTORY_SESSION_STATUS_INVALID',
        message: 'Só sessões ativas podem ser finalizadas.',
      });
    if (activeRoundCount > 0)
      throw new ConflictException({
        code: 'INVENTORY_SESSION_HAS_ACTIVE_ROUNDS',
        message:
          'Finalize todas as rodadas ativas antes de finalizar a sessão.',
      });
  }

  static assertCanCancelSession(status: InventorySessionStatus): void {
    if (
      ![InventorySessionStatus.DRAFT, InventorySessionStatus.ACTIVE].includes(
        status,
      )
    )
      throw new ConflictException({
        code: 'INVENTORY_SESSION_STATUS_INVALID',
        message: 'Só sessões em rascunho ou ativas podem ser canceladas.',
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
        message: 'A sessão e a rodada precisam estar ativas.',
      });
    if (kind === InventoryRoundKind.REINVENTORY && targetItemId !== itemId)
      throw new ConflictException({
        code: 'REINVENTORY_ITEM_MISMATCH',
        message: 'A rodada de reinventário vale só para o item de destino.',
      });
  }
}
