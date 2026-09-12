import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { formatMoney } from "../utils/money";
import type { CustomerProfile } from "../api/types";
import { useAuth } from "../auth/auth";
import { InlineError } from "../components/InlineError";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { WhatsAppIcon } from "../components/WhatsAppIcon";
import { StatusBadge } from "../components/StatusBadge";
import { waMeLink } from "../utils/phone";

export function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editGpsLink, setEditGpsLink] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["customer-profile", id],
    queryFn: () => api.get<{ data: CustomerProfile }>(`/customers/${id}`),
  });

  const update = useMutation({
    mutationFn: (body: { fullName: string; phone: string; gpsLink?: string; address?: string }) =>
      api.put(`/customers/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-profile", id] });
      setIsEditing(false);
    },
  });

  function startEdit() {
    if (!data?.data) return;
    const c = data.data;
    setEditFullName(c.fullName);
    setEditPhone(c.phone);
    setEditGpsLink(c.gpsLink ?? "");
    setEditAddress(c.address ?? "");
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({
      fullName: editFullName,
      phone: editPhone,
      ...(editGpsLink.trim() ? { gpsLink: editGpsLink.trim() } : {}),
      ...(editAddress.trim() ? { address: editAddress.trim() } : {}),
    });
  }

  return (
    <section>
      <div className="page-header">
        <h2 className="page-title">Customer Profile</h2>
        {isAdmin && !isEditing && (
          <button type="button" className="secondary" onClick={startEdit}>
            Edit
          </button>
        )}
        {isEditing && (
          <div className="page-header-actions">
            <button type="button" className="secondary" onClick={cancelEdit}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={submitEdit} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      {isLoading && <LoadingSkeleton rows={6} columns={4} />}
      {isError && <InlineError message={(error as Error)?.message ?? "Failed to load customer"} />}
      {update.isError && <InlineError message="Could not update customer. Check the phone number is unique." />}

      {data?.data && (
        isEditing ? (
          <form className="panel form-grid" onSubmit={submitEdit}>
            <label className="field">
              <span>Full name</span>
              <input
                name="fullName"
                autoComplete="off"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Phone</span>
              <input
                name="phone"
                inputMode="tel"
                autoComplete="off"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>GPS (optional)</span>
              <input
                name="gpsLink"
                type="url"
                autoComplete="off"
                placeholder="https://..."
                value={editGpsLink}
                onChange={(e) => setEditGpsLink(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Address (optional)</span>
              <input
                name="address"
                autoComplete="off"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
              />
            </label>
          </form>
        ) : (
          <ProfileContent customer={data.data} />
        )
      )}
    </section>
  );
}

function ProfileContent({ customer }: { customer: CustomerProfile }) {
  const balanceCents = Math.round(Number(customer.outstandingBalance) * 100);

  return (
    <>
      <div className="panel">
        <div className="profile-header">
          <div className="profile-info">
            <h3>{customer.fullName}</h3>
            <p>
              {waMeLink(customer.phone) ? (
                <a href={waMeLink(customer.phone)!} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon size={16} /> {customer.phone}
                </a>
              ) : (
                customer.phone
              )}
            </p>
            {customer.address && <p>{customer.address}</p>}
            {customer.gpsLink && (
              <p>
                <a href={customer.gpsLink} target="_blank" rel="noopener noreferrer">
                  📍 View location
                </a>
              </p>
            )}
          </div>
          <div className={`profile-balance${balanceCents > 0 ? " profile-balance--overdue" : ""}`}>
            <span className="profile-balance-label">Outstanding</span>
            <span className="profile-balance-value">{formatMoney(customer.outstandingBalance)}</span>
          </div>
        </div>
      </div>

      <h3 className="section-title">Order History</h3>
      {customer.orders.length === 0 ? (
        <p className="text-muted">No orders yet.</p>
      ) : (
        <div className="table-wrap">
          {customer.orders.map((o) => (
            <div className={`card${Number(o.balance) > 0 ? " card--overdue" : ""}`} key={o.orderId}>
              <header>
                <strong>#{o.orderId}</strong> — {new Date(o.orderDate).toLocaleDateString("en-MY")} <StatusBadge status={o.status} />
              </header>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((it) => (
                    <tr key={it.orderItemId}>
                      <td>{it.product?.productName ?? it.productId}</td>
                      <td className="qty">x{it.quantity}</td>
                      <td className="amount">{it.subtotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Total: <span className="amount">{o.total}</span> · Paid: <span className="amount">{o.paid}</span> · Balance:{" "}
                <span className="amount">{o.balance}</span>
              </p>
              <a href={`/orders/${o.orderId}/invoice`} target="_blank" rel="noreferrer" className="secondary">
                Print Invoice
              </a>
            </div>
          ))}
        </div>
      )}
    </>
  );
}