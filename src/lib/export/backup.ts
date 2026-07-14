export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_ROWS_PER_COLLECTION = 5000;

const EXCLUDED_FIELD = /(credential|token|secret|password|subscription|vapid|shortcut.*hash|auth|operational.*log)/i;
const EXCLUDED_COLLECTION =
  /^(connections|push_subscriptions|shortcut_devices|auth_records|operational_logs)$/i;

export type BackupCollection = Record<string, unknown>[];
export type BackupData = Record<string, BackupCollection>;

function redactSensitiveFields(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !EXCLUDED_FIELD.test(key)),
  );
}

export function buildBackup(
  data: BackupData,
  exportedAt = new Date().toISOString(),
): { schemaVersion: 1; exportedAt: string; data: BackupData } {
  const safeData = Object.fromEntries(
    Object.entries(data)
      .filter(([collection]) => !EXCLUDED_COLLECTION.test(collection))
      .map(([collection, rows]) => [
        collection,
        rows.slice(0, MAX_BACKUP_ROWS_PER_COLLECTION).map(redactSensitiveFields),
      ]),
  );

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    data: safeData,
  };
}
