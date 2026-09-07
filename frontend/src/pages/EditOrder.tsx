import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "../api/client";
import { useCustomers, useProducts } from "../api/hooks";
import { formatMoney } from "../utils/money";
import type { Order } from "../api/types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { InlineError } from "../components/InlineError";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { formatExpected, toDatetimeLocal, toInputDate } from "../utils/datetime";

function parseDdMmYy(str: string): Date | null {
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (isNaN(d.getTime())) return null;
  return d;
}

export function EditOrder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const orderId = Number(id);

  const orderQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => api.get<{ data: Order }>(`/orders/${orderId}`),
    enabled: Number.isFinite(orderId) && orderId > 0,
  });
  const products = useProducts();
  const customers = useCustomers();

  const order = orderQuery.data?.data;
  const [customerId, setCustomerId] = useState("");
  const [originalCustomerId, setOriginalCustomerId] = useState("");
  const [pendingCustomer, setPendingCustomer] = useState<string | null>(null);
  const [orderDateInput, setOrderDateInput] = useState("");
  const [orderDateManual, setOrderDateManual] = useState("");
  const [dateError, setDateError] = useState("");
  const [expectedInput, setExpectedInput] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ productId: number; quantity: number }[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pendingSave, setPendingSave] = useState<"customer" | "underTotal" | null>(null);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!order) return;
    const cid = String(order.customerId);
    setCustomerId(cid);
    setOriginalCustomerId(cid);
    setOrderDateInput(toInputDate(order.orderDate));
    const d = new Date(order.orderDate);
    setOrderDateManual(`${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`);
    setExpectedInput(order.expectedDeliveryAt ? toDatetimeLocal(order.expectedDeliveryAt) : "");
    setNotes(order.notes ?? "");
    setItems(order.items.map((it) => ({ productId: it.productId, quantity: it.quantity })));
  }, [order]);

  const save = useMutation({
    mutationFn: (body: {
      customerId: number;
      items: { productId: number; quantity: number }[];
      orderDate?: string;
      expectedDeliveryAt?: string | null;
      notes?: string | null;
      acknowledgeUnderTotal?: boolean;
    }) => api.put<{ data: Order }>(`/orders/${orderId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders-page"] });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["products"] });
      navigate("/orders");
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "PAID_EXCEEDS_TOTAL") {
        setPendingSave("underTotal");
        return;
      }
      setSaveError(err instanceof Error ? err.message : "Could not save the order.");
    },
  });

  function handleCalendarChange(value: string) {
    setOrderDateInput(value);
    if (value) {
      const d = new Date(value);
      setOrderDateManual(`${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`);
      setDateError("");
    }
  }

  function handleManualChange(value: string) {
    setOrderDateManual(value);
    const parsed = parseDdMmYy(value);
    if (value && !parsed) {
      setDateError("Invalid date. Use DD/MM/YYYY");
    } else if (parsed) {
      setOrderDateInput(toInputDate(parsed.toISOString()));
      setDateError("");
    }
  }

  function addItem() {
    if (!productId || !quantity || Number(quantity) <= 0) return;
    setItems((prev) => [...prev, { productId: Number(productId), quantity: Number(quantity) }]);
    setProductId("");
    setQuantity("");
  }

  function estimatedTotal(): number {
    return items.reduce((sum, i) => {
      const p = products.data?.data.find((x) => x.productId === i.productId);
      return sum + i.quantity * Number(p?.unitPrice ?? 0);
    }, 0);
  }

  function buildBody(acknowledgeUnderTotal?: boolean) {
    return {
      customerId: Number(customerId),
      items,
      orderDate: orderDateInput ? new Date(orderDateInput).toISOString() : undefined,
      expectedDeliveryAt: expectedInput ? new Date(expectedInput).toISOString() : null,
      notes: notes || null,
      acknowledgeUnderTotal,
    };
  }

  function trySave() {
    setSaveError("");
    if (customerId !== originalCustomerId) {
      setPendingSave("customer");
      return;
    }
    const paid = Number(order?.paid ?? 0);
    if (estimatedTotal() < paid) {
      setPendingSave("underTotal");
      return;
    }
    save.mutate(buildBody());
  }

  if (orderQuery.isLoading) return <LoadingSkeleton rows={6} columns={3} />;
  if (orderQuery.isError || !order) return <InlineError message="Could not load this order." />;

  const paid = Number(order.paid);
  const newTotal = estimatedTotal();

  return (
    <section>
      <p>
        <Link to="/orders">← Orders</Link>
      </p>
      <h2 className="page-title">Edit order #{order.orderId}</h2>

      <div className="panel">
        <label className="field">
          <span>Customer</span>
          <select
            value={customerId}
            onChange={(e) => {
              const next = e.target.value;
              if (next !== originalCustomerId && next !== customerId) {
                setPendingCustomer(next);
              } else {
                setCustomerId(next);
              }
            }}
          >
            {customers.data?.data.map((c) => (
              <option key={c.customerId} value={c.customerId}>
                {c.fullName}
              </option>
            ))}
          </select>
        </label>

        <div className="inline-form date-row">
          <label className="field">
            <span>Order date</span>
            <input type="date" value={orderDateInput} onChange={(e) => handleCalendarChange(e.target.value)} />
          </label>
          <label className="field">
            <span className="visually-hidden">Or type date (DD/MM/YYYY)</span>
            <input
              type="text"
              placeholder="DD/MM/YYYY"
              value={orderDateManual}
              onChange={(e) => handleManualChange(e.target.value)}
              inputMode="numeric"
              maxLength={10}
              style={{ width: "120px" }}
            />
          </label>
          {dateError && <span className="field-error">{dateError}</span>}
        </div>

        <label className="field">
          <span>Expected delivery</span>
          <input type="datetime-local" value={expectedInput} onChange={(e) => setExpectedInput(e.target.value)} />
        </label>
        {expectedInput && (
          <p className="text-muted">Will show as Expected: {formatExpected(new Date(expectedInput).toISOString())}</p>
        )}

        <label className="field">
          <span>Notes</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <h3>Line items</h3>
        <div className="inline-form">
          <label className="field">
            <span className="visually-hidden">Product</span>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Select product</option>
              {products.data?.data.map((p) => (
                <option key={p.productId} value={p.productId}>
                  {p.productName} ({p.stockQuantity})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="visually-hidden">Quantity</span>
            <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Qty" />
          </label>
          <button className="secondary" type="button" onClick={addItem} disabled={!productId || !quantity || Number(quantity) <= 0}>
            Add item
          </button>
        </div>

        {items.length > 0 && (
          <ul className="cart">
            {items.map((i, idx) => {
              const p = products.data?.data.find((x) => x.productId === i.productId);
              return (
                <li key={idx}>
                  <span>
                    {p?.productName ?? `Product #${i.productId}`} × {i.quantity}
                    <input
                      type="number"
                      min="1"
                      className="qty-edit"
                      value={i.quantity}
                      onChange={(e) => {
                        const q = Number(e.target.value);
                        setItems((prev) => prev.map((row, j) => (j === idx ? { ...row, quantity: q } : row)));
                      }}
                    />
                  </span>
                  <button className="danger" type="button" aria-label={`Remove item ${idx + 1}`} onClick={() => setItems((prev) => prev.filter((_, j) => j !== idx))}>
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p>
          New total: <span className="amount">{formatMoney(newTotal)}</span> · Already paid: <span className="amount">{formatMoney(order.paid)}</span> · Balance:{" "}
          <span className="amount">{formatMoney(newTotal - paid)}</span>
        </p>

        <div className="inline-form">
          <button type="button" disabled={!customerId || items.length === 0 || save.isPending || !!dateError} onClick={trySave}>
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
          <Link to="/orders" className="secondary">
            Cancel
          </Link>
        </div>
        {saveError && <InlineError message={saveError} />}
      </div>

      {pendingCustomer !== null && (
        <ConfirmDialog
          title="Reassign this order?"
          message="Changing the customer moves this order (and its balance) to someone else's history. This affects outstanding balances for both customers."
          confirmLabel="Yes, change customer"
          variant="warning"
          onConfirm={() => {
            setCustomerId(pendingCustomer);
            setPendingCustomer(null);
          }}
          onCancel={() => setPendingCustomer(null)}
        />
      )}

      {pendingSave === "customer" && (
        <ConfirmDialog
          title="Reassign this order?"
          message="Saving will move this order to a different customer. Their order history and outstanding balance will change."
          confirmLabel="Save with new customer"
          variant="warning"
          onConfirm={() => {
            setPendingSave(null);
            const paidAmt = Number(order.paid);
            if (estimatedTotal() < paidAmt) setPendingSave("underTotal");
            else save.mutate(buildBody());
          }}
          onCancel={() => setPendingSave(null)}
        />
      )}

      {pendingSave === "underTotal" && (
        <ConfirmDialog
          title="Paid amount exceeds the new total"
          message={`This order has ${formatMoney(order.paid)} already paid, but the edited total is ${formatMoney(newTotal)}. Saving will leave a negative balance. Proceed anyway?`}
          confirmLabel="Save anyway"
          variant="warning"
          onConfirm={() => {
            setPendingSave(null);
            save.mutate(buildBody(true));
          }}
          onCancel={() => setPendingSave(null)}
        />
      )}
    </section>
  );
}
