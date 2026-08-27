export enum InventorySessionStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  FINISHED = 'finished',
  CANCELLED = 'cancelled',
}

export enum InventoryRoundKind {
  INITIAL = 'initial',
  REINVENTORY = 'reinventory',
}

export enum InventoryRoundStatus {
  ACTIVE = 'active',
  FINISHED = 'finished',
  CANCELLED = 'cancelled',
}

export enum InventoryObservationEvidenceStatus {
  PENDING_UPLOAD = 'pending_upload',
  UPLOADED = 'uploaded',
}

export enum InventoryObservationResult {
  FOUND = 'found',
  NOT_FOUND = 'not_found',
  DIVERGENT = 'divergent',
  DUPLICATED = 'duplicated',
}

export enum PlateEvidenceSource {
  FIELD = 'field',
  PHYSICAL_BASE = 'physical_base',
  ACCOUNTING_BASE = 'accounting_base',
  MANUAL = 'manual',
}

export enum ReconciliationStatus {
  MATCHED = 'matched',
  PHYSICAL_SURPLUS = 'physical_surplus',
  ACCOUNTING_SURPLUS = 'accounting_surplus',
  DUPLICATE = 'duplicate',
  PLATE_DIVERGENCE = 'plate_divergence',
}

export enum ConsolidationDecision {
  ACCEPTED = 'accepted',
  CORRECTED = 'corrected',
  REJECTED = 'rejected',
}
