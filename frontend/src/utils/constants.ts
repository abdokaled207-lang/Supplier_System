export const COMPANY_NAME = "ROTI CHANI KING";
const SETTINGS_KEY = "roti_company_name";

export function getCompanyName(): string {
  try {
    return localStorage.getItem(SETTINGS_KEY) ?? COMPANY_NAME;
  } catch {
    return COMPANY_NAME;
  }
}
