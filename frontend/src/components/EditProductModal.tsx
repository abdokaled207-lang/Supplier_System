import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Product } from "../api/types";

interface Props {
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditProductModal({ product, onClose, onSuccess }: Props) {
  const [name, setName] = useState(product.productName);
  const [price, setPrice] = useState(product.unitPrice);
  const [imageUrl, setImageUrl] = useState(product.imageUrl ?? "");
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});

  const update = useMutation({
    mutationFn: (body: { productName: string; unitPrice: number; imageUrl?: string }) =>
      api.put(`/products/${product.productId}`, body),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  function validate(): boolean {
    const e: { name?: string; price?: string } = {};
    if (!name.trim()) e.name = "Product name is required";
    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum < 0) e.price = "Price must be a non-negative number";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const body: { productName: string; unitPrice: number; imageUrl?: string } = {
      productName: name.trim(),
      unitPrice: Number(price),
    };
    const currentImage = product.imageUrl ?? "";
    if (imageUrl !== currentImage) {
      body.imageUrl = imageUrl || "";
    }
    update.mutate(body);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Edit Product</h3>
        <form id="edit-product-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Product name</span>
            <input autoFocus name="productName" value={name} onChange={(e) => setName(e.target.value)} required />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </label>
          <label className="field">
            <span>Unit price (RM)</span>
            <input
              name="unitPrice"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
            {errors.price && <span className="field-error">{errors.price}</span>}
          </label>
          <label className="field">
            <span>Image</span>
            <input
              name="imageUrl"
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              autoComplete="off"
              placeholder="/product-images/Roti%20Chani.jpg"
            />
            <span className="field-hint">Relative path, e.g. /product-images/Roti%20Chani.jpg</span>
          </label>
          {update.isError && <p className="field-error">Could not update product. A product with that name may already exist.</p>}
        </form>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="edit-product-form" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
