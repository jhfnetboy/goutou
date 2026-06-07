/**
 * CSV field encoding per RFC 4180, plus spreadsheet formula-injection defense.
 *
 * A cell beginning with =, +, -, @, tab or CR is executed as a formula by
 * Excel / Google Sheets / LibreOffice. Exported text can carry user-controlled
 * values (project / task names, comment excerpts), so we prefix a single quote
 * to force literal rendering. Only applied to strings so genuine numeric values
 * aren't mangled.
 */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvRow(
  values: Array<string | number | null | undefined>,
): string {
  return values.map(csvField).join(",");
}
