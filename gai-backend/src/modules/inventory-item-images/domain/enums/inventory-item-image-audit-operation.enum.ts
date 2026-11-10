export enum InventoryItemImageAuditOperation {
  CREATE_UPLOAD_URL = 'CREATE_UPLOAD_URL',
  CONFIRM_UPLOAD = 'CONFIRM_UPLOAD',
  REMOVE = 'REMOVE',
  DOWNLOAD_URL = 'DOWNLOAD_URL',
  /** Linked from a verified import-session file (mobile reconciliation). */
  IMPORT_LINK = 'IMPORT_LINK',
}
