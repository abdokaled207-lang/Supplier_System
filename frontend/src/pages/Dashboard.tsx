// import { type ReactElement, cloneElement } from "react";
import { type ReactElement, cloneElement } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { BestSeller, CustomerBalance, Order, Product, TodaySales } from "../api/types";
import { EmptyState } from "../components/EmptyState";
import { InlineError } from "../components/InlineError";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { getSetting } from "../utils/settings";
// import { Clock, Settings, Truck, CheckCircle, XCircle } from "lucide-react";
import { Clock, Settings, Truck, CheckCircle, XCircle } from "lucide-react";
import { ProductImage } from "../components/ProductImage";

const LOW_STOCK_THRESHOLD = Number(getSetting("lowStockThreshold"));

const STATUS_CONFIG: Record<string, { icon: ReactElement; badge: string }> = {
  pending:   { icon: cloneElement(<Clock size={13} />,        { "aria-hidden": true }), badge: "badge badge--amber" },
  processing:{ icon: cloneElement(<Settings size={13} />,     { "aria-hidden": true }), badge: "badge badge--indigo" },
  shipped:   { icon: cloneElement(<Truck size={13} />,       { "aria-hidden": true }), badge: "badge badge--purple" },
  delivered: { icon: cloneElement(<CheckCircle size={13} />, { "aria-hidden": true }), badge: "badge badge--green" },
  cancelled: { icon: cloneElement(<XCircle size={13} />,     { "aria-hidden": true }), badge: "badge badge--red" },
};

const money = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function cell(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function Dashboard() {
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => api.get<{ data: Order[] }>("/orders") });
  const products = useQuery({ queryKey: ["products"], queryFn: () => api.get<{ data: Product[] }>("/products") });
  const balances = useQuery({
    queryKey: ["report-balance"],
    queryFn: () => api.get<{ data: CustomerBalance[] }>("/reports/customer-balance"),
  });
  const todaySales = useQuery({
    queryKey: ["report-today-sales"],
    queryFn: () => api.get<{ data: TodaySales }>("/reports/today-sales"),
  });
  const bestSellers = useQuery({
    queryKey: ["report-best-sellers"],
    queryFn: () => api.get<{ data: BestSeller[] }>("/reports/best-sellers"),
  });

  const isLoading = orders.isLoading || products.isLoading || balances.isLoading || todaySales.isLoading || bestSellers.isLoading;
  const isError = orders.isError || products.isError || balances.isError || todaySales.isError || bestSellers.isError;

  if (isLoading) return <LoadingSkeleton rows={4} columns={3} />;
  if (isError) return <InlineError message="Could not load the dashboard. Reload the page to try again." />;

  const orderList = orders.data?.data ?? [];
  const productList = products.data?.data ?? [];
  const balanceList = balances.data?.data ?? [];
  const today = todaySales.data?.data;
  const sellers = bestSellers.data?.data ?? [];

  const openStatuses = new Set(["pending", "processing", "shipped"]);
  const openOrders = orderList.filter((o) => openStatuses.has(o.status));
  const revenue = orderList
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + cell(o.total), 0);
  const outstanding = balanceList.reduce((sum, b) => sum + cell(b.balance), 0);
  const lowStock = productList.filter((p) => p.stockQuantity <= LOW_STOCK_THRESHOLD);

  const stats = [
    { label: "Today's sales", value: today ? money.format(cell(today.total)) : "—", to: "/orders?date=today" },
    { label: "Today's orders", value: today ? String(today.count) : "—", to: "/orders?date=today" },
    { label: "Total orders", value: String(orderList.length), to: "/orders" },
    { label: "Open orders", value: String(openOrders.length), to: "/orders" },
    { label: "Revenue (non-cancelled)", value: money.format(revenue), to: "/orders" },
    { label: "Outstanding balance", value: money.format(outstanding), to: "/orders?balance=positive" },
  ];

  return (
    <section>
      <h2 className="page-title">Dashboard</h2>

      <div className="dashboard-grid">
        {stats.map((s) => (
          <Link className="stat-card stat-card--link" key={s.label} to={s.to}>
            <p className="stat-label">{s.label}</p>
            <p className="stat-value">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="card">
        <h3>Orders by status</h3>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {["pending", "processing", "shipped", "delivered", "cancelled"].map((status) => {
              const count = orderList.filter((o) => o.status === status).length;
              const cfg = STATUS_CONFIG[status];
              return (
                <tr key={status} className="clickable-row">
                  <td>
                    <Link className="status-badge-link" to={`/orders?status=${status}`}>
                      <span className={cfg.badge}>
                        {cfg.icon}
                        {status}
                      </span>
                    </Link>
                  </td>
                  <td className="qty">{count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sellers.length > 0 && (
        <div className="card">
          <h3>Best sellers (all time)</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th className="qty">Units sold</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((s, i) => (
                <tr key={s.productId} className="clickable-row">
                  <td>{i + 1}</td>
                  <td>
                    <Link className="product-link" to={`/products/${s.productId}`}>
                      <ProductImage imageUrl={s.imageUrl} productName={s.productName} size={20} />
                      {s.productName}
                    </Link>
                  </td>
                  <td className="qty">{s.quantitySold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h3>Low stock</h3>
        {lowStock.length === 0 ? (
          <EmptyState title="All stock healthy">No products at or below {LOW_STOCK_THRESHOLD} units.</EmptyState>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>In stock</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((p) => (
                <tr key={p.productId} className="clickable-row">
                  <td>
                    <Link className="product-link" to={`/products/${p.productId}`}>
                      <ProductImage imageUrl={p.imageUrl} productName={p.productName} size={20} />
                      {p.productName}
                    </Link>
                  </td>
                  <td className="qty">{p.stockQuantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

