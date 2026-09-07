// Shared field highlight: green border once a field has valid content,
// amber while a required field is still empty.
export function fieldClass(
  value: string | number | undefined | null,
  opts?: { required?: boolean },
): string {
  const filled = value !== undefined && value !== null && String(value).trim() !== "";
  if (filled) return "field-valid";
  return opts?.required ? "field-missing" : "";
}
