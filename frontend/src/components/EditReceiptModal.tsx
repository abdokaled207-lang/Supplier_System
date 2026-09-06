import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api/client";
import type { StockReceipt } from "../api/types";

interface Props {
  receipt: StockReceipt;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditReceiptModal({ receipt, onClose, onSuccess }: Props) {
  const [quantity, setQuantity] = useState(String(receipt.quantity));
  const [notes, setNotes] = useState(receipt.notes ?? "");
  const [errors, setErrors] = useState<{ quantity?: string }>({});

  const update = useMutation({
    mutationFn: (body: { quantity: number; notes?: string }) =>
      api.put(`/stock-receipts/${receipt.receiptId}`, body),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  function validate(): boolean {
    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
      setErrors({ quantity: "Quantity must be a positive whole number" });
      return false;
    }
    setErrors({});
    return true;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    update.mutate({ quantity: Number(quantity), notes: notes.trim() || undefined });
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Edit Stock Receipt</h3>
        <p className="text-muted" style={{ fontSize: "0.875rem" }}>
          Product: <strong>{receipt.product?.productName ?? `Product #${receipt.productId}`}</strong>
        </p>
        <form id="edit-receipt-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Quantity</span>
            <input
              autoFocus
              name="quantity"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            {errors.quantity && <span className="field-error">{errors.quantity}</span>}
          </label>
          <label className="field">
            <span>Notes (optional)</span>
            <input name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {update.isError && <p className="field-error">Could not update the receipt.</p>}
        </form>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="edit-receipt-form" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
