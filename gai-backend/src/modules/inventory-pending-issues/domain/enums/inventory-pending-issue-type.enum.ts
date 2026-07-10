export enum InventoryPendingIssueType {
  MISSING_PLATE = 'missing_plate',
  ACCOUNTING_ITEM_NOT_FOUND = 'accounting_item_not_found',
  PHYSICAL_ITEM_WITHOUT_ACCOUNTING_MATCH = 'physical_item_without_accounting_match',
  PLATE_DIVERGENCE = 'plate_divergence',
  DESCRIPTION_DIVERGENCE = 'description_divergence',
  LOCATION_DIVERGENCE = 'location_divergence',
  DUPLICATED_ITEM = 'duplicated_item',
  MANUAL_ISSUE = 'manual_issue',
  OTHER = 'other',
}
