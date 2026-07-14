export type CsvValue = string | number | boolean | null | undefined;

export function escapeCsvValue(value: CsvValue): string {
  if (value == null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(
  columns: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<CsvValue>>,
): string {
  return [
    columns.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ].join("\r\n");
}
