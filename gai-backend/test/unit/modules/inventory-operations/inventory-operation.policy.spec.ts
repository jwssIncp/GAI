import { ConflictException } from '@nestjs/common';
import { InventoryOperationPolicy } from '../../../../src/modules/inventory-operations/application/inventory-operation.policy';
import {
  InventoryRoundKind,
  InventoryRoundStatus,
  InventorySessionStatus,
} from '../../../../src/modules/inventory-operations/domain/inventory-operation.enums';

describe('InventoryOperationPolicy', () => {
  it('normalizes plate evidence without changing the master record', () => {
    expect(InventoryOperationPolicy.normalizePlate(' abc-12.34 ')).toBe(
      'ABC1234',
    );
    expect(InventoryOperationPolicy.normalizePlate('  ')).toBeNull();
  });

  it('allows only draft sessions to start', () => {
    expect(() =>
      InventoryOperationPolicy.assertCanStart(InventorySessionStatus.DRAFT),
    ).not.toThrow();
    expect(() =>
      InventoryOperationPolicy.assertCanStart(InventorySessionStatus.ACTIVE),
    ).toThrow(ConflictException);
  });

  it('restricts a reinventory round to its requested item', () => {
    expect(() =>
      InventoryOperationPolicy.assertCanReceiveObservation(
        InventorySessionStatus.ACTIVE,
        InventoryRoundStatus.ACTIVE,
        InventoryRoundKind.REINVENTORY,
        10,
        11,
      ),
    ).toThrow(ConflictException);
  });

  it('rejects observations in closed rounds or sessions', () => {
    expect(() =>
      InventoryOperationPolicy.assertCanReceiveObservation(
        InventorySessionStatus.FINISHED,
        InventoryRoundStatus.FINISHED,
        InventoryRoundKind.INITIAL,
        null,
        10,
      ),
    ).toThrow(ConflictException);
  });
});
