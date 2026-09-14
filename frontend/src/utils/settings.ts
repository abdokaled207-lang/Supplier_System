const PREFIX = "roti_";

export interface SystemSettings {
  companyName: string;
  companyOwner: string;
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
  companyName: "DOH GRED A1",
  companyOwner: "",
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

export const SETTINGS_DEFAULTS: SystemSettings = DEFAULTS;

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
    companyOwner: String(getSetting("companyOwner")),
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

// Mirror a full settings object into localStorage. Used after a successful
// server save so this device has an instant, offline-safe copy on next load.
export function persistSettings(settings: SystemSettings): void {
  try {
    (Object.keys(DEFAULTS) as (keyof SystemSettings)[]).forEach((k) => {
      localStorage.setItem(`${PREFIX}${k}`, String(settings[k]));
    });
  } catch {
    /* storage unavailable */
  }
}
