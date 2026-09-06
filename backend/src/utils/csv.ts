// Minimal RFC 4180 CSV writer + Express response helper.
// Money/values are emitted as already-serialized strings (no float drift).

type Row = Record<string, string | number | null | undefined>;

function escapeField(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Row[]): string {
  const lines = [headers.map(escapeField).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeField(row[h])).join(","));
  }
  return lines.join("\r\n");
}

export function csvResponse(res: import("express").Response, filename: string, csv: string): void {
  // UTF-8 BOM so Excel detects encoding.
  res
    .status(200)
    .set("Content-Type", "text/csv; charset=utf-8")
    .set("Content-Disposition", `attachment; filename="${filename}"`)
    .send(`\uFEFF${csv}`);
}