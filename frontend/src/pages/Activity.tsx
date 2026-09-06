import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { ActivityLog } from "../api/types";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { Pagination } from "../components/Pagination";

const PAGE_SIZE = 50;

const ENTITY_LABELS: Record<string, string> = {
  customer: "Customer",
  product: "Product",
  order: "Order",
  payment: "Payment",
  stockReceipt: "Stock Receipt",
};

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  restored: "Restored",
  status_changed: "Status changed",
  payment_recorded: "Payment recorded",
};

function actionBadge(action: string): string {
  if (action === "deleted") return "badge--red";
  if (action === "restored") return "badge--green";
  if (action === "status_changed" || action === "payment_recorded") return "badge--indigo";
  return "badge--amber";
}

export function Activity() {
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["activity-logs", page, entityFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (entityFilter) params.set("entityType", entityFilter);
      return api.get<{ data: ActivityLog[]; total: number; page: number; pageSize: number }>(`/activity-logs?${params}`);
    },
  });

  return (
    <section>
      <div className="page-header">
        <h2 className="page-title">Activity Log</h2>
        <div className="page-header-actions">
          <label className="field" style={{ marginBottom: 0 }}>
            <select value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}>
              <option value="">All entities</option>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {isLoading && <LoadingSkeleton rows={6} columns={4} />}

      {!isLoading && (data?.data.length ?? 0) === 0 && (
        <p className="text-muted">No activity recorded yet.</p>
      )}

      {!isLoading && (data?.data.length ?? 0) > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Entity</th>
                <th>Action</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((log) => (
                <tr key={log.id}>
                  <td className="text-muted" style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                    {new Date(log.createdAt).toLocaleString("en-MY", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>
                    {ENTITY_LABELS[log.entityType] ?? log.entityType} #{log.entityId}
                  </td>
                  <td>
                    <span className={`badge ${actionBadge(log.action)}`}>{ACTION_LABELS[log.action] ?? log.action}</span>
                  </td>
                  <td>{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
    </section>
  );
}
