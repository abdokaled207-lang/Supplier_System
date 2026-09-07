import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { SystemUser } from "../api/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { InlineError } from "./InlineError";
import { fieldClass } from "../utils/forms";

// Admin-only user management: who can log in, and what they may modify
// (role gates the admin-only actions across the system).
export function UsersPanel() {
  const qc = useQueryClient();
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<{ data: SystemUser[] }>("/users"),
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "employee">("employee");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<SystemUser | null>(null);

  const create = useMutation({
    mutationFn: (body: { email: string; password: string; role: string }) => api.post("/users", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setEmail("");
      setPassword("");
      setRole("employee");
      setFormError(null);
    },
    onError: (err: { message?: string }) => setFormError(err?.message ?? "Could not add the user."),
  });
  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => api.patch(`/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (err: { message?: string }) => setFormError(err?.message ?? "Could not change the role."),
  });
  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => api.patch(`/users/${id}/password`, { password }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setFormError(null);
    },
    onError: (err: { message?: string }) => setFormError(err?.message ?? "Could not reset the password."),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setPendingRemove(null);
    },
    onError: (err: { message?: string }) => {
      setPendingRemove(null);
      setFormError(err?.message ?? "Could not deactivate the user.");
    },
  });

  function addUser(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 8) {
      setFormError("Email is required and the password needs at least 8 characters.");
      return;
    }
    create.mutate({ email: email.trim(), password, role });
  }

  return (
    <div className="panel" style={{ marginBottom: "var(--space-4)" }}>
      <h3>Users &amp; Access</h3>
      <p className="field-hint">
        Admins can modify everything (delete records, manage products and users). Employees can create orders,
        customers and payments but cannot delete or manage users.
      </p>

      <form onSubmit={addUser} className="inline-form">
        <label className="field">
          <span className="visually-hidden">Email</span>
          <input
            type="email"
            placeholder="Email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass(email, { required: true })}
          />
        </label>
        <label className="field">
          <span className="visually-hidden">Password</span>
          <input
            type="password"
            placeholder="Password (min. 8 characters)"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass(password, { required: true })}
          />
        </label>
        <label className="field">
          <span className="visually-hidden">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "employee")}>
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button type="submit" disabled={create.isPending}>
          {create.isPending ? "Adding…" : "Add user"}
        </button>
      </form>

      {formError && <InlineError message={formError} />}
      {users.isError && <InlineError message="Could not load users. Only admins can view this list." />}

      {users.data?.data && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.data.data.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    <select
                      aria-label={`Role for ${u.email}`}
                      value={u.role}
                      onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value })}
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="secondary"
                        onClick={() => {
                          const password = window.prompt(`New password for ${u.email} (min. 8 characters):`);
                          if (password) resetPassword.mutate({ id: u.id, password });
                        }}
                      >
                        Reset password
                      </button>
                      <button className="danger" onClick={() => setPendingRemove(u)}>
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingRemove && (
        <ConfirmDialog
          title={`Deactivate ${pendingRemove.email}?`}
          message="They will no longer be able to log in. Create a user with the same email to restore access."
          confirmLabel="Deactivate"
          onConfirm={() => remove.mutate(pendingRemove.id)}
          onCancel={() => setPendingRemove(null)}
        />
      )}
    </div>
  );
}
