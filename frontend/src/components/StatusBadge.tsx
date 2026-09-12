import type { OrderStatus } from "../api/types";

export function StatusBadge({ status }: { status: OrderStatus }) {
  const tone =
    status === "delivered" ? "badge--green" : status === "cancelled" ? "badge--red" : status === "pending" ? "badge--amber" : "badge--indigo";
  return <span className={`badge ${tone}`}>{status}</span>;
}