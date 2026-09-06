export function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return "";
  const normalized = digits.startsWith("0") ? digits.slice(1) : digits;
  if (!normalized.startsWith("60")) return `60${normalized}`;
  return normalized;
}

export function waMeLink(phone: string): string | null {
  const formatted = formatPhoneForWhatsApp(phone);
  if (!formatted) return null;
  return `https://wa.me/${formatted}`;
}
