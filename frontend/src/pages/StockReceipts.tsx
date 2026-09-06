import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Product, StockReceipt } from "../api/types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EditReceiptModal } from "../components/EditReceiptModal";
import { EmptyState } from "../components/EmptyState";
import { InlineError } from "../components/InlineError";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { Pagination } from "../components/Pagination";
import { UndoToast } from "../components/UndoToast";

const PAGE_SIZE = 100;

export function StockReceipts() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const receipts = useQuery({
    queryKey: ["receipts", page],
    queryFn: () => api.get<{ data: StockReceipt[]; total: number; page: number; pageSize: number }>(`/stock-receipts?page=${page}&pageSize=${PAGE_SIZE}`),
  });
  const products = useQuery({ queryKey: ["products"], queryFn: () => api.get<{ data: Product[] }>("/products") });

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pendingDelete, setPendingDelete] = useState<StockReceipt | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<StockReceipt | null>(null);
  const [undoItems, setUndoItems] = useState<{ id: string; label: string; undoFn: () => void }[]>([]);

  const create = useMutation({
    mutationFn: (body: { productId: number; quantity: number }) => api.post("/stock-receipts", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setQuantity("1");
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/stock-receipts/${id}`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setPendingDelete(null);
      const receipt = receipts.data?.data.find((r) => r.receiptId === id);
      if (receipt) {
        setUndoItems((prev) => [
          ...prev,
          {
            id: `receipt-${id}`,
            label: `Receipt #${id} deleted`,
            undoFn: () => {
              api.post(`/stock-receipts/${id}/restore`, {}).then(() => {
                qc.invalidateQueries({ queryKey: ["receipts"] });
                qc.invalidateQueries({ queryKey: ["products"] });
              });
            },
          },
        ]);
      }
    },
    onError: () => setPendingDelete(null),
  });

  function dismissUndo(id: string) {
    setUndoItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <section>
      <UndoToast items={undoItems} onDismiss={dismissUndo} />

      <h2 className="page-title">Stock Receipts</h2>
      <div className="panel">
        <h3>Receive stock</h3>
        <form
          id="add-receipt-form"
          className={`inline-form${(receipts.data?.data.length ?? 0) === 0 ? " form-section--highlighted" : ""}`}
          onSubmit={(e) => {
            e.preventDefault();
            const qty = Number(quantity);
            if (!productId || isNaN(qty) || qty <= 0) return;
            create.mutate({ productId: Number(productId), quantity: qty });
          }}
        >
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
            <input
              name="quantity"
              type="number"
              min="1"
              step="1"
              autoComplete="off"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qty"
              required
            />
          </label>
          <button type="submit" disabled={!productId || !quantity || Number(quantity) <= 0 || create.isPending}>
            {create.isPending ? "Adding…" : "Add receipt"}
          </button>
        </form>
        {create.isError && <InlineError message="Could not record the stock receipt. The product may no longer exist." />}
      </div>

      {receipts.isLoading && <LoadingSkeleton rows={5} columns={4} />}
      {!receipts.isLoading && (receipts.data?.data.length ?? 0) === 0 && (
        <EmptyState
          title="No stock receipts yet"
          action={
            <button type="button" className="secondary" onClick={() => document.getElementById("add-receipt-form")?.scrollIntoView({ behavior: "smooth" })}>
              Record a stock receipt
            </button>
          }
        >
          Receive stock to see it listed here.
        </EmptyState>
      )}
      {!receipts.isLoading && (receipts.data?.data.length ?? 0) > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Date</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {receipts.data?.data.map((r) => (
                <tr key={r.receiptId}>
                  <td>{r.receiptId}</td>
                  <td>{r.product?.productName ?? r.productId}</td>
                  <td className="qty">+{r.quantity}</td>
                  <td>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(r.receiptDate))}</td>
                  <td>
                    <div className="row-actions">
                      <button className="secondary" onClick={() => setEditingReceipt(r)}>
                        Edit
                      </button>
                      <button className="danger" onClick={() => setPendingDelete(r)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={receipts.data?.page ?? 1} pageSize={PAGE_SIZE} total={receipts.data?.total ?? 0} onPage={setPage} />

      {editingReceipt && (
        <EditReceiptModal
          receipt={editingReceipt}
          onClose={() => setEditingReceipt(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["receipts"] });
            qc.invalidateQueries({ queryKey: ["products"] });
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete receipt #${pendingDelete.receiptId}?`}
          message="This will reverse the stock increment for this receipt. You can undo within 5 seconds."
          confirmLabel="Delete"
          onConfirm={() => remove.mutate(pendingDelete.receiptId)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </section>
  );
}
