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

  it('finishes only active sessions without active rounds', () => {
    expect(() =>
      InventoryOperationPolicy.assertCanFinishSession(
        InventorySessionStatus.ACTIVE,
        0,
      ),
    ).not.toThrow();
    expect(() =>
      InventoryOperationPolicy.assertCanFinishSession(
        InventorySessionStatus.ACTIVE,
        1,
      ),
    ).toThrow(ConflictException);
    expect(() =>
      InventoryOperationPolicy.assertCanFinishSession(
        InventorySessionStatus.FINISHED,
        0,
      ),
    ).toThrow(ConflictException);
  });

  it('cancels only draft or active sessions', () => {
    expect(() =>
      InventoryOperationPolicy.assertCanCancelSession(
        InventorySessionStatus.DRAFT,
      ),
    ).not.toThrow();
    expect(() =>
      InventoryOperationPolicy.assertCanCancelSession(
        InventorySessionStatus.ACTIVE,
      ),
    ).not.toThrow();
    expect(() =>
      InventoryOperationPolicy.assertCanCancelSession(
        InventorySessionStatus.FINISHED,
      ),
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
