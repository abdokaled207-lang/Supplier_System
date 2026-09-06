import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, downloadFile } from "../api/client";
import type { CustomerBalance, Product } from "../api/types";
import { EmptyState } from "../components/EmptyState";
import { InlineError } from "../components/InlineError";
import { LoadingSkeleton } from "../components/LoadingSkeleton";

type Range = "all" | "daily" | "weekly" | "monthly" | "custom";

function rangeLabel(r: Range): string {
  return { all: "All time", daily: "Today", weekly: "This week", monthly: "This month", custom: "Custom" }[r];
}

function buildRangeParams(r: Range, start: string, end: string): string {
  if (r === "all") return "";
  if (r === "custom") return `range=custom&start=${start}&end=${end}`;
  return `range=${r}`;
}

export function Reports() {
  const [range, setRange] = useState<Range>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const params = buildRangeParams(range, customStart, customEnd);
  const balances = useQuery({
    queryKey: ["report-balance", params],
    queryFn: () => api.get<{ data: CustomerBalance[] }>(`/reports/customer-balance${params ? `?${params}` : ""}`),
  });
  const stock = useQuery({ queryKey: ["report-stock"], queryFn: () => api.get<{ data: Product[] }>("/reports/product-stock") });

  function download(report: string, filename: string) {
    const q = report === "customer-balance" && params ? `?${params}` : "";
    void downloadFile(`/reports/${report}.csv${q}`, filename).catch(() => {
      /* downloadFile throws ApiError on failure; the toast is out of scope — surface silently. */
    });
  }

  function selectRange(r: Range) {
    setRange(r);
    setShowCustom(r === "custom");
    if (r !== "custom") setCustomStart("");
    setCustomEnd("");
  }

  return (
    <section>
      <h2 className="page-title">Reports</h2>

      <div className="range-bar">
        {(["all", "daily", "weekly", "monthly", "custom"] as Range[]).map((r) => (
          <button
            key={r}
            type="button"
            className={range === r ? "secondary" : "ghost"}
            onClick={() => selectRange(r)}
          >
            {rangeLabel(r)}
          </button>
        ))}
      </div>

      {showCustom && (
        <div className="range-custom">
          <label className="field">
            From
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
          </label>
          <label className="field">
            To
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </label>
        </div>
      )}

      {(balances.isError || stock.isError) && (
        <InlineError message="Could not load reports. Reload the page to try again." />
      )}

      <div className="card">
        <div className="card-head">
          <h3>Customer balances{range !== "all" && <span className="range-tag">{rangeLabel(range)}</span>}</h3>
          <button className="secondary" type="button" onClick={() => download("customer-balance", "customer-balance.csv")}>
            Download CSV
          </button>
        </div>
        {balances.isLoading && <LoadingSkeleton rows={4} columns={5} />}
        {!balances.isLoading && (balances.data?.data.length ?? 0) === 0 && (
          <EmptyState title="No customers yet">Customer balances will appear here once customers place orders.</EmptyState>
        )}
        {!balances.isLoading && (balances.data?.data.length ?? 0) > 0 && (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th className="amount">Total</th>
                <th className="amount">Paid</th>
                <th className="amount">Balance</th>
              </tr>
            </thead>
            <tbody>
              {balances.data?.data.map((b) => (
                <tr key={b.customerId}>
                  <td>{b.fullName}</td>
                  <td>{b.phone}</td>
                  <td className="amount">{b.total}</td>
                  <td className="amount">{b.paid}</td>
                  <td className="amount">{b.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Product stock</h3>
          <button className="secondary" type="button" onClick={() => download("product-stock", "product-stock.csv")}>
            Download CSV
          </button>
        </div>
        {stock.isLoading && <LoadingSkeleton rows={4} columns={3} />}
        {!stock.isLoading && (stock.data?.data.length ?? 0) === 0 && (
          <EmptyState title="No products yet">Product stock levels will appear here once products are added.</EmptyState>
        )}
        {!stock.isLoading && (stock.data?.data.length ?? 0) > 0 && (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th className="amount">Price</th>
                <th className="qty">Stock</th>
              </tr>
            </thead>
            <tbody>
              {stock.data?.data.map((p) => (
                <tr key={p.productId}>
                  <td>{p.productName}</td>
                  <td className="amount">{p.unitPrice}</td>
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
