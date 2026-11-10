export enum ImportSessionStatus {
  OPEN = 'open',
  RECEIVING = 'receiving',
  PROCESSING = 'processing',
  FINISHED = 'finished',
  /** Finished with some failed items (partial success). */
  FINISHED_WITH_ERRORS = 'finished_with_errors',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}
