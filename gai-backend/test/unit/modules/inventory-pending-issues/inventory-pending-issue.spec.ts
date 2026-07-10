import { InventoryPendingIssue } from '../../../../src/modules/inventory-pending-issues/domain/entities/inventory-pending-issue';
import { InventoryPendingIssueSeverity } from '../../../../src/modules/inventory-pending-issues/domain/enums/inventory-pending-issue-severity.enum';
import { InventoryPendingIssueStatus } from '../../../../src/modules/inventory-pending-issues/domain/enums/inventory-pending-issue-status.enum';
import { InventoryPendingIssueType } from '../../../../src/modules/inventory-pending-issues/domain/enums/inventory-pending-issue-type.enum';
import { InventoryPendingIssueScopeService } from '../../../../src/modules/inventory-pending-issues/application/services/inventory-pending-issue-scope.service';

function makeIssue(type = InventoryPendingIssueType.MANUAL_ISSUE) {
  const now = new Date('2026-07-08T12:00:00.000Z');
  return new InventoryPendingIssue({
    id: 1,
    organizationId: 1,
    projectId: 1,
    inventoryItemId: 1,
    accountingItemId: null,
    type,
    status: InventoryPendingIssueStatus.OPEN,
    severity: InventoryPendingIssueSeverity.MEDIUM,
    title: 'Pendencia',
    description: null,
    oldValue: null,
    newValue: null,
    resolutionNotes: null,
    resolvedById: null,
    resolvedAt: null,
    ignoredById: null,
    ignoredAt: null,
    createdById: 1,
    updatedById: 1,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

describe('InventoryPendingIssue domain', () => {
  it('requires title', () => {
    expect(
      () => new InventoryPendingIssue({ ...makeIssue().toProps(), title: ' ' }),
    ).toThrow('title is required');
  });

  it('updates editable fields and records changes', () => {
    const issue = makeIssue();
    const changes = issue.updateFields({
      title: 'Nova pendencia',
      severity: InventoryPendingIssueSeverity.HIGH,
      updatedById: 2,
    });

    expect(changes).toHaveProperty('title');
    expect(changes).toHaveProperty('severity');
  });

  it('requires resolution notes for relevant divergences', () => {
    const issue = makeIssue(InventoryPendingIssueType.DESCRIPTION_DIVERGENCE);

    expect(() => issue.resolve(2, null, new Date())).toThrow(
      'resolution_notes is required for this issue type',
    );
  });

  it('resolves and ignores with actor/date metadata', () => {
    const issue = makeIssue();
    const now = new Date('2026-07-08T13:00:00.000Z');

    issue.resolve(2, 'Corrigido', now);

    expect(issue.status).toBe(InventoryPendingIssueStatus.RESOLVED);
    expect(issue.toProps().resolvedById).toBe(2);
    expect(issue.toProps().resolvedAt).toBe(now);
  });
});

describe('InventoryPendingIssueScopeService', () => {
  const scope = new InventoryPendingIssueScopeService();

  it('normalizes plate and trims text', () => {
    expect(scope.normalizePlate(' ab-123 c ')).toBe('AB123C');
    expect(scope.cleanText('  texto  ')).toBe('texto');
    expect(scope.cleanText('   ')).toBeNull();
  });
});
