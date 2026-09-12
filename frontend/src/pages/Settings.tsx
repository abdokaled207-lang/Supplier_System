import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, setToken } from "../api/client";
import type { UserRole } from "../api/types";
import { getAllSettings, type SystemSettings } from "../utils/settings";
import { useAuth } from "../auth/auth";
import { InlineError } from "../components/InlineError";
import { UsersPanel } from "../components/UsersPanel";
import { fieldClass } from "../utils/forms";

const KEYS: (keyof SystemSettings)[] = [
  "companyName",
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
];

function loadSettings(): SystemSettings {
  return getAllSettings();
}

export function Settings() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [form, setForm] = useState<SystemSettings>(loadSettings);
  const [saved, setSaved] = useState(false);

  const initialEmail = (() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? (JSON.parse(raw) as { email: string }).email : "";
    } catch {
      return "";
    }
  })();

  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState(false);

  const updateAccount = useMutation({
    mutationFn: (body: { email?: string; currentPassword: string; newPassword: string }) =>
      api.put<{ token: string; user: { id: number; email: string; role: UserRole } }>("/auth/me", body),
    onSuccess: (data) => {
      setToken(data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setAccountSuccess(true);
      setAccountError(null);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      qc.invalidateQueries({ queryKey: ["auth-user"] });
      setTimeout(() => {
        setToken(null);
        localStorage.removeItem("user");
        navigate("/login?reason=password_changed");
      }, 1500);
    },
    onError: (err: { message?: string }) => {
      setAccountError(err?.message ?? "Could not update account. Check your current password.");
    },
  });

  function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAccountError(null);
    if (newPassword !== confirmPassword) {
      setAccountError("New passwords do not match.");
      return;
    }
    updateAccount.mutate({
      email: email !== initialEmail ? email : undefined,
      currentPassword,
      newPassword,
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    KEYS.forEach((k) => {
      if (k === "lowStockThreshold") {
        const v = Number(form.lowStockThreshold);
        localStorage.setItem(`roti_${k}`, String(isNaN(v) || v < 1 ? 5 : v));
      } else {
        localStorage.setItem(`roti_${k}`, (form[k] as string) ?? "");
      }
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleChange<K extends keyof SystemSettings>(k: K, value: SystemSettings[K]) {
    setForm((prev) => ({ ...prev, [k]: value }));
  }

  return (
    <section>
      <h2 className="page-title">Settings</h2>

      {isAdmin && <UsersPanel />}

      <form onSubmit={handleAccountSubmit}>
        <div className="panel" style={{ marginBottom: "var(--space-4)" }}>
          <h3>Account</h3>
          <p className="field-hint">Change your login email or password.</p>
          <div className="form-grid">
            <label className="field">
              Email (login)
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={fieldClass(email, { required: true })}
              />
            </label>
            <label className="field">
              Current password
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={fieldClass(currentPassword, { required: true })}
              />
            </label>
            <label className="field">
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                className={fieldClass(newPassword)}
              />
            </label>
            <label className="field">
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className={fieldClass(confirmPassword)}
              />
            </label>
          </div>
          {accountError && <InlineError message={accountError} />}
          {accountSuccess && (
            <p className="field-hint success-text">
              Account updated. You will be logged out shortly — please log in with your new password.
            </p>
          )}
          <button
            type="submit"
            disabled={updateAccount.isPending || !currentPassword || !newPassword}
          >
            {updateAccount.isPending ? "Updating…" : "Update account"}
          </button>
        </div>
      </form>

      <form onSubmit={handleSave}>
        <div className="panel" style={{ marginBottom: "var(--space-4)" }}>
          <h3>Company Information</h3>
          <div className="form-grid">
            <label className="field">
              Company Name
              <input type="text" value={form.companyName} onChange={(e) => handleChange("companyName", e.target.value)} autoComplete="off" />
            </label>
            <label className="field">
              Phone
              <input type="text" value={form.companyPhone} onChange={(e) => handleChange("companyPhone", e.target.value)} autoComplete="off" placeholder="e.g. 0123456789" />
            </label>
            <label className="field">
              Email
              <input type="email" value={form.companyEmail} onChange={(e) => handleChange("companyEmail", e.target.value)} autoComplete="off" />
            </label>
            <label className="field">
              Street Address
              <input type="text" value={form.companyAddress} onChange={(e) => handleChange("companyAddress", e.target.value)} autoComplete="off" />
            </label>
            <label className="field">
              City / Postcode
              <input type="text" value={form.companyCity} onChange={(e) => handleChange("companyCity", e.target.value)} autoComplete="off" />
            </label>
            <label className="field">
              Low Stock Alert Threshold
              <input
                type="number"
                min="1"
                value={form.lowStockThreshold}
                onChange={(e) => handleChange("lowStockThreshold", Number(e.target.value))}
              />
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              Logo URL
              <input type="url" value={form.logoUrl} onChange={(e) => handleChange("logoUrl", e.target.value)} autoComplete="off" placeholder="https://example.com/logo.png" />
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              Signature Image URL
              <input type="url" value={form.signatureUrl} onChange={(e) => handleChange("signatureUrl", e.target.value)} autoComplete="off" placeholder="https://example.com/signature.png" />
            </label>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: "var(--space-4)" }}>
          <h3>Bank / Payment Details</h3>
          <p className="field-hint">Shown on invoices to help customers make payments.</p>
          <div className="form-grid">
            <label className="field">
              Bank Name
              <input type="text" value={form.bankName} onChange={(e) => handleChange("bankName", e.target.value)} autoComplete="off" placeholder="e.g. Public Bank" />
            </label>
            <label className="field">
              Account Name
              <input type="text" value={form.bankAccountName} onChange={(e) => handleChange("bankAccountName", e.target.value)} autoComplete="off" />
            </label>
            <label className="field">
              Account Number
              <input type="text" value={form.bankAccountNumber} onChange={(e) => handleChange("bankAccountNumber", e.target.value)} autoComplete="off" />
            </label>
          </div>
        </div>

        <button type="submit" className="secondary">{saved ? "Saved!" : "Save settings"}</button>
      </form>
    </section>
  );
}
