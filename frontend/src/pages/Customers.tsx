import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Customer } from "../api/types";
import { useAuth } from "../auth/auth";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { InlineError } from "../components/InlineError";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { Pagination } from "../components/Pagination";
import { SearchInput } from "../components/SearchInput";
import { WhatsAppIcon } from "../components/WhatsAppIcon";
import { waMeLink } from "../utils/phone";
import { fieldClass } from "../utils/forms";
import { ALL_DELIVERY_AREAS } from "../data/deliveryAreas";

const PAGE_SIZE = 100;

export function Customers() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["customers", page],
    queryFn: () => api.get<{ data: Customer[]; total: number; page: number; pageSize: number }>(`/customers?page=${page}&pageSize=${PAGE_SIZE}`),
  });
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gpsLink, setGpsLink] = useState("");
  const [area, setArea] = useState("");
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editGpsLink, setEditGpsLink] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editArea, setEditArea] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const create = useMutation({
    mutationFn: (body: { fullName: string; phone: string; gpsLink?: string; address?: string; area?: string | null }) =>
      api.post("/customers", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setFullName("");
      setPhone("");
      setGpsLink("");
      setArea("");
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { fullName: string; phone: string; gpsLink?: string; address?: string; area?: string | null } }) =>
      api.put(`/customers/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-profile"] });
      setEditingCustomer(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setPendingDelete(null);
    },
    onError: () => setPendingDelete(null),
  });

  const customers = (data?.data ?? []).filter(
    (c) =>
      !search ||
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.toLowerCase().includes(search.toLowerCase()),
  );

  function onSearch(term: string) {
    setSearch(term);
    setPage(1);
  }

  function startEdit(c: Customer) {
    setEditingCustomer(c);
    setEditFullName(c.fullName);
    setEditPhone(c.phone);
    setEditGpsLink(c.gpsLink ?? "");
    setEditAddress(c.address ?? "");
    setEditArea(c.area ?? "");
  }

  function cancelEdit() {
    setEditingCustomer(null);
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCustomer) return;
    update.mutate({
      id: editingCustomer.customerId,
      body: {
        fullName: editFullName,
        phone: editPhone,
        ...(editGpsLink.trim() ? { gpsLink: editGpsLink.trim() } : {}),
        ...(editAddress.trim() ? { address: editAddress.trim() } : {}),
        area: editArea || null,
      },
    });
  }

  return (
    <section>
      <h2 className="page-title">Customers</h2>
      <form
        id="add-customer-form"
        className={`inline-form${customers.length === 0 ? " form-section--highlighted" : ""}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!fullName.trim()) return;
          if (!phone.trim()) { setPhoneError("Phone number is required"); return; }
          if (!/^\d[\d\s-]{6,}$/.test(phone.trim())) { setPhoneError("Enter a valid phone number"); return; }
          create.mutate({ fullName: fullName.trim(), phone: phone.trim(), ...(gpsLink.trim() ? { gpsLink: gpsLink.trim() } : {}), area: area || null });
        }}
      >
        <label className="field">
          <span className="visually-hidden">Full name</span>
          <input name="fullName" placeholder="Full name" autoComplete="off" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={fieldClass(fullName, { required: true })} />
        </label>
          <label className="field">
          <span className="visually-hidden">Phone</span>
          <input
            name="phone"
            placeholder="Phone (e.g. 0123456789)"
            inputMode="tel"
            autoComplete="off"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (phoneError) {
                const v = e.target.value;
                if (!v.trim()) setPhoneError("Phone number is required");
                else if (!/^\d[\d\s-]{6,}$/.test(v.trim())) setPhoneError("Enter a valid phone number");
                else setPhoneError("");
              }
            }}
            onBlur={() => {
              if (!phone.trim()) setPhoneError("Phone number is required");
              else if (!/^\d[\d\s-]{6,}$/.test(phone.trim())) setPhoneError("Enter a valid phone number");
              else setPhoneError("");
            }}
            required
            className={`${fieldClass(phone, { required: true })}${phoneError ? " field-invalid" : ""}`}
          />
          {phoneError && <span className="field-error">{phoneError}</span>}
        </label>
        <label className="field">
          <span className="visually-hidden">GPS Location (Google Maps link)</span>
          <input name="gpsLink" placeholder="GPS (optional)" type="url" autoComplete="off" value={gpsLink} onChange={(e) => setGpsLink(e.target.value)} />
        </label>
        <label className="field">
          <span className="visually-hidden">Region (optional)</span>
          <input
            name="area"
            list="delivery-area-options"
            placeholder="Region (optional)"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className={fieldClass(area)}
          />
        </label>
        <datalist id="delivery-area-options">
          {ALL_DELIVERY_AREAS.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <button type="submit" disabled={create.isPending}>
          {create.isPending ? "Adding…" : "Add"}
        </button>
      </form>

      <div className="inline-form">
        <SearchInput label="Search customers" onSearch={onSearch} />
      </div>

      {create.isError && <InlineError message="Could not add customer. Check the phone number is unique." />}
      {isLoading && <LoadingSkeleton rows={5} columns={5} />}
      {!isLoading && customers.length === 0 && (
        <EmptyState
          title="No customers yet"
          action={
            <button type="button" className="secondary" onClick={() => document.getElementById("add-customer-form")?.scrollIntoView({ behavior: "smooth" })}>
              Add your first customer
            </button>
          }
        >
          {search ? `No customers match "${search}".` : "Add your first customer to get started."}
        </EmptyState>
      )}
      {!isLoading && customers.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Region</th>
                <th>
                  <span className="visually-hidden">Location</span>
                </th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.customerId}>
                  <td>{c.customerId}</td>
                  <td>
                    <Link to={`/customers/${c.customerId}`} className="customer-name-link">{c.fullName}</Link>
                  </td>
                  <td>
                    {waMeLink(c.phone) ? (
                      <a href={waMeLink(c.phone)!} target="_blank" rel="noopener noreferrer" aria-label={`Chat on WhatsApp with ${c.fullName}`}>
                        <WhatsAppIcon size={18} />
                      </a>
                    ) : (
                      c.phone
                    )}
                  </td>
                  <td>{c.area ?? "—"}</td>
                  <td>
                    {c.gpsLink ? (
                      <a href={c.gpsLink} target="_blank" rel="noopener noreferrer" aria-label={`Open GPS location for ${c.fullName}`}>
                        📌
                      </a>
                    ) : null}
                  </td>
                  <td>
                    <div className="row-actions">
                      {isAdmin && (
                        <button className="edit-action" onClick={() => startEdit(c)}>
                          Edit
                        </button>
                      )}
                      {isAdmin && (
                        <button className="danger" onClick={() => setPendingDelete(c)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={data?.page ?? 1} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />

      {editingCustomer && (
        <ConfirmDialog
          title={`Edit ${editingCustomer.fullName}`}
          message={
            <form id="edit-customer-form" onSubmit={submitEdit}>
              <div className="form-grid">
                <label className="field">
                  <span>Full name</span>
                  <input
                    name="editFullName"
                    autoComplete="off"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    required
                    className={fieldClass(editFullName, { required: true })}
                  />
                </label>
                <label className="field">
                  <span>Phone</span>
                  <input
                    name="editPhone"
                    inputMode="tel"
                    autoComplete="off"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    required
                    className={fieldClass(editPhone, { required: true })}
                  />
                </label>
                <label className="field">
                  <span>GPS (optional)</span>
                  <input
                    name="editGpsLink"
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
                    name="editAddress"
                    autoComplete="off"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className={fieldClass(editAddress)}
                  />
                </label>
                <label className="field">
                  <span>Region</span>
                  <input
                    name="editArea"
                    list="delivery-area-options"
                    placeholder="Region (optional)"
                    value={editArea}
                    onChange={(e) => setEditArea(e.target.value)}
                    className={fieldClass(editArea)}
                  />
                </label>
              </div>
              {update.isError && <InlineError message="Could not update customer. Check the phone number is unique." />}
            </form>
          }
          confirmLabel="Save"
          onConfirm={() => {
            const form = document.getElementById("edit-customer-form") as HTMLFormElement;
            if (form?.reportValidity()) {
              submitEdit(new Event("submit") as unknown as React.FormEvent);
            }
          }}
          onCancel={cancelEdit}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.fullName}?`}
          message="This will remove the customer. Customers with orders cannot be deleted."
          confirmLabel="Delete"
          onConfirm={() => remove.mutate(pendingDelete.customerId)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </section>
  );
}