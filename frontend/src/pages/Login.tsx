import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/auth";
import { COMPANY_NAME } from "../utils/constants";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("admin@roti.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordChanged = searchParams.get("reason") === "password_changed";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Check your credentials and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>{COMPANY_NAME}</h1>
        {passwordChanged && (
          <p className="success-text" role="status">Password updated successfully. Please log in again.</p>
        )}
        <label className="field">
          Email
          <input name="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" spellCheck={false} required />
        </label>
        <label className="field">
          Password
          <input name="password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required />
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <button className={submitting ? "spinner" : ""} type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Login"}
        </button>
      </form>
    </div>
  );
}