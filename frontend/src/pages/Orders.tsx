import { Link, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Customer, Order, OrderStatus, PaymentType, Product } from "../api/types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { InlineError } from "../components/InlineError";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { Pagination } from "../components/Pagination";
import { WhatsAppIcon } from "../components/WhatsAppIcon";
import { waMeLink } from "../utils/phone";
import { formatExpected, formatExact, formatRelative, toInputDate } from "../utils/datetime";

const STATUS_OPTIONS: OrderStatus[] = ["pending", "processing", "shipped", "delivered", "cancelled"];
const PAGE_SIZE = 100;

function statusBadge(status: OrderStatus) {
  const tone =
    status === "delivered" ? "badge--green" : status === "cancelled" ? "badge--red" : status === "pending" ? "badge--amber" : "badge--indigo";
  return <span className={`badge ${tone}`}>{status}</span>;
}

function parseDdMmYy(str: string): Date | null {
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (isNaN(d.getTime())) return null;
  return d;
}

export function Orders() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);

  // Initialize filter state from URL params
  const urlStatus = searchParams.get("status");
  const urlDate = searchParams.get("date");
  const urlBalance = searchParams.get("balance");

  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>(
    urlStatus ? (urlStatus as OrderStatus) : "all"
  );
  const [dateFilter, setDateFilter] = useState<"all" | "today">(urlDate === "today" ? "today" : "all");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "positive">(urlBalance === "positive" ? "positive" : "all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [pendingCancel, setPendingCancel] = useState<{ id: number; currentStatus: OrderStatus } | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ id: number; status: OrderStatus } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const orders = useQuery({
    queryKey: ["orders-page", page],
    queryFn: () => api.get<{ data: Order[]; total: number; page: number; pageSize: number }>(`/orders?page=${page}&pageSize=${PAGE_SIZE}`),
  });
  const products = useQuery({ queryKey: ["products"], queryFn: () => api.get<{ data: Product[] }>("/products") });
  const customers = useQuery({ queryKey: ["customers"], queryFn: () => api.get<{ data: Customer[] }>("/customers") });

  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [items, setItems] = useState<{ productId: number; quantity: number }[]>([]);

  const today = new Date();
  const [orderDateInput, setOrderDateInput] = useState(toInputDate(today.toISOString()));
  const [orderDateManual, setOrderDateManual] = useState(
    `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`
  );
  const [dateError, setDateError] = useState("");
  const [expectedInput, setExpectedInput] = useState("");

  const create = useMutation({
    mutationFn: (body: { customerId: number; items: { productId: number; quantity: number }[]; orderDate?: string; expectedDeliveryAt?: string }) =>
      api.post("/orders", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders-page"] });
      setItems([]);
      setCustomerId("");
      setExpectedInput("");
    },
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) => api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders-page"] }),
  });
const deleteOrder = useMutation({
  mutationFn: (id: number) => api.delete(`/orders/${id}`),
  onSuccess: () => qc.invalidateQueries({ queryKey: ["orders-page"] }),
});
  const addPayment = useMutation({
    mutationFn: ({ orderId, amount, paymentType }: { orderId: number; amount: number; paymentType: PaymentType }) =>
      api.post("/payments", { orderId, amount, paymentType }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders-page"] }),
  });

  const fetchLastOrder = useMutation({
    mutationFn: (cid: number) => api.get<{ data: Order }>(`/orders/last/${cid}`),
    onSuccess: ({ data }) => {
      setItems(data.items.map((it) => ({ productId: it.productId, quantity: it.quantity })));
    },
  });

  function addItem() {
    if (!productId || !quantity || Number(quantity) <= 0) return;
    setItems((prev) => [...prev, { productId: Number(productId), quantity: Number(quantity) }]);
    setProductId("");
    setQuantity("");
  }

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

  const hasActiveFilters = statusFilter !== "all" || dateFilter !== "all" || balanceFilter !== "all";

  const visibleOrders = (orders.data?.data ?? [])
    .filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (dateFilter === "today") {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (o.orderDate.slice(0, 10) !== todayStr) return false;
      }
      if (balanceFilter === "positive" && Number(o.balance) <= 0) return false;
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.orderDate).getTime();
      const dateB = new Date(b.orderDate).getTime();
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });

  function handleStatusFilterChange(val: "all" | OrderStatus) {
    setStatusFilter(val);
    const p = new URLSearchParams(searchParams);
    if (val === "all") p.delete("status");
    else p.set("status", val);
    setSearchParams(p, { replace: true });
  }

  function handleDateFilterChange(val: "all" | "today") {
    setDateFilter(val);
    const p = new URLSearchParams(searchParams);
    if (val === "all") p.delete("date");
    else p.set("date", "today");
    setSearchParams(p, { replace: true });
  }

  function handleBalanceFilterChange(val: "all" | "positive") {
    setBalanceFilter(val);
    const p = new URLSearchParams(searchParams);
    if (val === "all") p.delete("balance");
    else p.set("balance", "positive");
    setSearchParams(p, { replace: true });
  }

  function clearFilters() {
    setStatusFilter("all");
    setDateFilter("all");
    setBalanceFilter("all");
    setSearchParams({}, { replace: true });
  }

  function handleCreate() {
    const body: { customerId: number; items: { productId: number; quantity: number }[]; orderDate?: string; expectedDeliveryAt?: string } = {
      customerId: Number(customerId),
      items,
    };
    if (orderDateInput) {
      body.orderDate = new Date(orderDateInput).toISOString();
    }
    if (expectedInput) {
      body.expectedDeliveryAt = new Date(expectedInput).toISOString();
    }
    create.mutate(body);
  }

  return (
    <section>
      <h2 className="page-title">Orders</h2>
      <div className="panel" id="new-order-form">
        <h3>New order</h3>
        <div className="inline-form">
          <label className="field">
            <span className="visually-hidden">Customer</span>
            <select name="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select customer</option>
              {customers.data?.data.map((c) => (
                <option key={c.customerId} value={c.customerId}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary"
            disabled={!customerId || fetchLastOrder.isPending}
            onClick={() => fetchLastOrder.mutate(Number(customerId))}
          >
            {fetchLastOrder.isPending ? "Loading…" : "Repeat last order"}
          </button>
          <label className="field">
            <span className="visually-hidden">Product</span>
            <select name="productId" value={productId} onChange={(e) => setProductId(e.target.value)}>
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
            <input name="quantity" type="number" min="1" autoComplete="off" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Qty" required />
          </label>
          <button className="secondary" onClick={addItem} disabled={!productId || !quantity || Number(quantity) <= 0}>
            Add item
          </button>
        </div>

        {items.length > 0 && (
          <ul className="cart">
            {items.map((i, idx) => (
              <li key={idx}>
                <span>
                  {products.data?.data.find((p) => p.productId === i.productId)?.productName ?? `Product #${i.productId}`} x {i.quantity}
                </span>
                <button className="danger" aria-label={`Remove item ${idx + 1}`} onClick={() => setItems((prev) => prev.filter((_, j) => j !== idx))}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="inline-form date-row">
          <label className="field">
            <span>Order date</span>
            <input
              type="date"
              value={orderDateInput}
              onChange={(e) => handleCalendarChange(e.target.value)}
              max={toInputDate(new Date().toISOString())}
            />
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

        <div className="inline-form date-row">
          <label className="field">
            <span>Expected delivery</span>
            <input type="datetime-local" value={expectedInput} onChange={(e) => setExpectedInput(e.target.value)} />
          </label>
        </div>

        <button
          disabled={!customerId || items.length === 0 || create.isPending || !!dateError}
          onClick={handleCreate}
        >
          {create.isPending ? "Creating…" : "Create order"}
        </button>
        {create.isError && <InlineError message="Could not create the order." />}
        {addPayment.isError && <InlineError message="Could not record the payment." />}
        {fetchLastOrder.isError && <InlineError message="No previous order found for this customer." />}
      </div>

      <div className="inline-form">
        <label className="field">
          Filter by status
          <select name="statusFilter" value={statusFilter} onChange={(e) => handleStatusFilterChange(e.target.value as "all" | OrderStatus)}>
            <option value="all">All orders</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Filter by date
          <select name="dateFilter" value={dateFilter} onChange={(e) => handleDateFilterChange(e.target.value as "all" | "today")}>
            <option value="all">Any date</option>
            <option value="today">Today only</option>
          </select>
        </label>
        <label className="field">
          Balance
          <select name="balanceFilter" value={balanceFilter} onChange={(e) => handleBalanceFilterChange(e.target.value as "all" | "positive")}>
            <option value="all">Any</option>
            <option value="positive">Outstanding only</option>
          </select>
        </label>
        {hasActiveFilters && (
          <button type="button" className="secondary" onClick={clearFilters}>
            Clear filters
          </button>
        )}
        <label className="field">
          Sort by
          <select name="sortBy" value={sortBy} onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

      {orders.isLoading && <LoadingSkeleton rows={3} columns={4} />}
      {!orders.isLoading && visibleOrders.length === 0 && (
        <EmptyState
          title="No orders yet"
          action={
            <button type="button" className="secondary" onClick={() => document.getElementById("new-order-form")?.scrollIntoView({ behavior: "smooth" })}>
              Create your first order
            </button>
          }
        >
          {statusFilter !== "all" ? `No orders with status "${statusFilter}".` : "Create your first order to get started."}
        </EmptyState>
      )}
      {!orders.isLoading && visibleOrders.length > 0 && (
        <div className="table-wrap">
          {visibleOrders.map((o) => (
            <div className={`card${Number(o.balance) > 0 ? " card--overdue" : ""}`} key={o.orderId}>
              <header>
                <strong>#{o.orderId}</strong> —{" "}
                <Link to={`/customers/${o.customerId}`}>{o.customer?.fullName}</Link>
                {o.customer?.phone && waMeLink(o.customer.phone) && (
                  <a href={waMeLink(o.customer.phone)!} target="_blank" rel="noopener noreferrer" className="wa-icon" aria-label="Chat on WhatsApp">
                    <WhatsAppIcon size={14} />
                  </a>
                )}{" "}
                {statusBadge(o.status)}
                {o.expectedDeliveryAt && (
                  <span className="order-expected">Expected: {formatExpected(o.expectedDeliveryAt)}</span>
                )}
              </header>
              {o.statusUpdatedAt && (
                <p className="order-status-updated" title={formatExact(o.statusUpdatedAt)}>
                  Updated {formatRelative(o.statusUpdatedAt)}
                </p>
              )}
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
                      <td>{it.productName ?? it.product?.productName ?? it.productId}</td>
                      <td className="qty">x{it.quantity}</td>
                      <td className="amount">{it.subtotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Total: <span className="amount">{o.total}</span> · Paid: <span className="amount">{o.paid}</span> · Balance: {""}
                <span className="amount">{o.balance}</span>
              </p>
              <div className="inline-form">
                <label className="field">
                  <span className="visually-hidden">Order status</span>
                  <select name="status" value={o.status} onChange={(e) => {
                  const newStatus = e.target.value as OrderStatus;
                  if (newStatus === "cancelled" && o.status !== "cancelled") {
                    setPendingCancel({ id: o.orderId, currentStatus: o.status });
                  } else if (newStatus !== o.status) {
                    setPendingStatusChange({ id: o.orderId, status: newStatus });
                  }
                }}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <InputPayment orderId={o.orderId} onSubmit={addPayment.mutate} balance={o.balance} />
              
                <Link to={`/orders/${o.orderId}/edit`} className="secondary edit-action">
                  Edit
                </Link>
               {/* <Link to={`/orders/${o.orderId}/edit`} className="secondary">
               Edit
               </Link> */}
                    <button type="button" className="danger" onClick={() => setPendingDelete(o.orderId)}>
                    Delete
                    </button>
                   <a href={`/orders/${o.orderId}/invoice`} target="_blank" rel="noreferrer" className="secondary invoice-action">
                   Print Invoice
                    </a>
                    
                    {/* <a href={`/orders/${o.orderId}/invoice`} target="_blank" rel="noreferrer" className="secondary">
                    Print Invoice
                    </a> */}
                {/* <Link to={`/orders/${o.orderId}/edit`} className="secondary">
                  Edit
                </Link>
                <a href={`/orders/${o.orderId}/invoice`} target="_blank" rel="noreferrer" className="secondary">
                  Print Invoice
                </a> */}
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={orders.data?.page ?? 1} pageSize={PAGE_SIZE} total={orders.data?.total ?? 0} onPage={setPage} />

      {pendingCancel && (
        <ConfirmDialog
          title="Cancel this order?"
          message="Cancelling will restore stock for delivered items and mark the order as cancelled. This cannot be easily undone."
          confirmLabel="Yes, cancel order"
          variant="warning"
          onConfirm={() => {
            setStatus.mutate({ id: pendingCancel.id, status: "cancelled" });
            setPendingCancel(null);
          }}
          onCancel={() => setPendingCancel(null)}
        />
      )}

       {pendingStatusChange && (
        <ConfirmDialog
          title={`Change order status to "${pendingStatusChange.status}"?`}
          message="This will update the order status."
          confirmLabel="Change"
          variant="info"
          onConfirm={() => {
            setStatus.mutate({ id: pendingStatusChange.id, status: pendingStatusChange.status });
            setPendingStatusChange(null);
          }}
          onCancel={() => setPendingStatusChange(null)}
        />
      )}

      {pendingDelete !== null && (
        <ConfirmDialog
          title="Delete this order?"
          message="This will remove the order from the list. It can be restored later if needed."
          confirmLabel="Yes, delete order"
          variant="danger"
          onConfirm={() => {
            deleteOrder.mutate(pendingDelete);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </section>
  );
      {/* {pendingStatusChange && (
        <ConfirmDialog
          title={`Change order status to "${pendingStatusChange.status}"?`}
          message="This will update the order status."
          confirmLabel="Change"
          variant="info"
          onConfirm={() => {
            setStatus.mutate({ id: pendingStatusChange.id, status: pendingStatusChange.status });
            setPendingStatusChange(null);
          }}
          onCancel={() => setPendingStatusChange(null)}
        />
      )}
    </section>
  ); */}
}

function InputPayment({ orderId, onSubmit, balance }: { orderId: number; onSubmit: (p: { orderId: number; amount: number; paymentType: PaymentType }) => void; balance: string }) {
  const [amount, setAmount] = useState("");
  return (
    <>
      <label className="field">
        <span className="visually-hidden">Payment amount (balance {balance})</span>
        <input
          name="paymentAmount"
          placeholder={`Balance ${balance} RM`}
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <button
        onClick={() => {
          const amt = Number(amount);
          if (!amt || amt <= 0) return;
          onSubmit({ orderId, amount: amt, paymentType: "cash" });
          setAmount("");
        }}
        disabled={!amount || Number(amount) <= 0}
      >
        Add payment
      </button>
    </>
  );
}
