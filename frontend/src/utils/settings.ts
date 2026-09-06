const PREFIX = "roti_";

export interface SystemSettings {
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyPhone: string;
  companyEmail: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  lowStockThreshold: number;
  logoUrl: string;
  signatureUrl: string;
}

const DEFAULTS: SystemSettings = {
  companyName: "ROTI CHANI KING",
  companyAddress: "",
  companyCity: "",
  companyPhone: "",
  companyEmail: "",
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  lowStockThreshold: 5,
  logoUrl: "",
  signatureUrl: "",
};

function key(k: keyof SystemSettings): string {
  return `${PREFIX}${k}`;
}

export function getSetting(k: keyof SystemSettings): string | number {
  try {
    const stored = localStorage.getItem(`${PREFIX}${k}`);
    if (stored === null) return DEFAULTS[k];
    if (k === "lowStockThreshold") return Number(stored);
    return stored;
  } catch {
    return DEFAULTS[k];
  }
}

export function setSetting<K extends keyof SystemSettings>(k: K, value: SystemSettings[K]): void {
  try {
    localStorage.setItem(key(k), String(value));
  } catch {
    /* storage unavailable */
  }
}

export function getAllSettings(): SystemSettings {
  return {
    companyName: String(getSetting("companyName")),
    companyAddress: String(getSetting("companyAddress")),
    companyCity: String(getSetting("companyCity")),
    companyPhone: String(getSetting("companyPhone")),
    companyEmail: String(getSetting("companyEmail")),
    bankName: String(getSetting("bankName")),
    bankAccountName: String(getSetting("bankAccountName")),
    bankAccountNumber: String(getSetting("bankAccountNumber")),
    lowStockThreshold: Number(getSetting("lowStockThreshold")),
    logoUrl: String(getSetting("logoUrl")),
    signatureUrl: String(getSetting("signatureUrl")),
  };
}

export function invoiceNumber(orderId: number): string {
  return `INV-${String(orderId).padStart(3, "0")}`;
}
