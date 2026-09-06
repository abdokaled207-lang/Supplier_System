import type { Decimal } from "@prisma/client/runtime/library";

// Any value that represents money. Prisma Decimal is the DB type; we also accept
// plain numbers (from parsed input) and strings (from JSON / formatted output).
export type Money = Decimal | number | string;

// --- Primitive conversions (shallow util — no business rules) ---

export function moneyToNumber(value: Money): number {
  return Number(value);
}

export function moneyToString(value: Money): string {
  return moneyToNumber(value).toFixed(2);
}

// Money is handled as integer cents internally to avoid float drift.
export function toCents(value: Money): number {
  return Math.round(moneyToNumber(value) * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatPhoneForWhatsApp(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return null;
  const normalized = digits.startsWith("0") ? digits.slice(1) : digits;
  if (!normalized.startsWith("60")) return `60${normalized}`;
  return normalized;
}

export function waMeLink(phone: string): string | null {
  const formatted = formatPhoneForWhatsApp(phone);
  if (!formatted) return null;
  return `https://wa.me/${formatted}`;
}
