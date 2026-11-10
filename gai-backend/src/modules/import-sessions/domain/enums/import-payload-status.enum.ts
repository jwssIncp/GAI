export enum ImportPayloadStatus {
  RECEIVED = 'received',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  /** Some items failed (see errors); successful items were applied. */
  PARTIALLY_PROCESSED = 'partially_processed',
  FAILED = 'failed',
  DUPLICATED = 'duplicated',
  IGNORED = 'ignored',
}
