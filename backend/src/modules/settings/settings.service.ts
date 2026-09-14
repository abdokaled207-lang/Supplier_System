import { prisma } from "../../db/prisma.js";

// Wire keys mirror the frontend `SystemSettings` interface. The frontend stores
// the same values in localStorage as a per-device cache; this table is the
// shared source of truth so every device/origin sees identical settings.
export const SETTING_KEYS = [
  "companyName",
  "companyOwner",
  "companyAddress",
  "companyCity",
  "companyPhone",
  "companyEmail",
  "bankName",
  "bankAccountName",
  "bankAccountNumber",
  "lowStockThreshold",
  "logoUrl",
  "signatureUrl",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export type SettingsRecord = { [K in SettingKey]: string };

// Wire shape mirrors the frontend `SystemSettings` interface: every value is a
// string except `lowStockThreshold`, which is a number.
export type SettingsResponse = Omit<SettingsRecord, "lowStockThreshold"> & { lowStockThreshold: number };

const STRING_DEFAULTS: SettingsRecord = {
  companyName: "DOH GRED A1",
  companyOwner: "",
  companyAddress: "",
  companyCity: "",
  companyPhone: "",
  companyEmail: "",
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  lowStockThreshold: "5",
  logoUrl: "",
  signatureUrl: "",
};

export async function getSettings(): Promise<SettingsResponse> {
  const rows = await prisma.systemSetting.findMany();
  const record = { ...STRING_DEFAULTS };
  for (const row of rows) {
    if (isSettingKey(row.key)) record[row.key] = row.value;
  }
  return toResponse(record);
}

export async function updateSettings(input: Partial<SettingsRecord>): Promise<SettingsResponse> {
  const provided = SETTING_KEYS.filter((k) => input[k] !== undefined);
  await prisma.$transaction(
    provided.map((k) =>
      prisma.systemSetting.upsert({
        where: { key: k },
        create: { key: k, value: String(input[k]) },
        update: { value: String(input[k]) },
      }),
    ),
  );
  return getSettings();
}

function toResponse(record: SettingsRecord): SettingsResponse {
  const threshold = Number(record.lowStockThreshold);
  return { ...record, lowStockThreshold: Number.isFinite(threshold) && threshold > 0 ? threshold : 5 };
}

function isSettingKey(key: string): key is SettingKey {
  return (SETTING_KEYS as readonly string[]).includes(key);
}