// Client-side money display only — the backend integer-cents math remains the
// authority on anything computed or compared.
export function formatMoney(value: string | number): string {
  const n = Number(value);
  return `RM ${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}
