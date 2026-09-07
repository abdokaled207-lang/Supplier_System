import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { formatMoney } from "../utils/money";
import { fieldClass } from "../utils/forms";
import type { Product } from "../api/types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EditProductModal } from "../components/EditProductModal";
import { EmptyState } from "../components/EmptyState";
import { InlineError } from "../components/InlineError";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { Pagination } from "../components/Pagination";
import { ProductImage } from "../components/ProductImage";
import { SearchInput } from "../components/SearchInput";
import { UndoToast } from "../components/UndoToast";
import { getSetting } from "../utils/settings";

const LOW_STOCK_THRESHOLD = Number(getSetting("lowStockThreshold"));
const PAGE_SIZE = 100;

export function Products() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["products", page],
    queryFn: () => api.get<{ data: Product[]; total: number; page: number; pageSize: number }>(`/products?page=${page}&pageSize=${PAGE_SIZE}`),
  });
  const [productName, setProductName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [search, setSearch] = useState("");
  const [showOutOfStockOnly, setShowOutOfStockOnly] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [undoItems, setUndoItems] = useState<{ id: string; label: string; undoFn: () => void }[]>([]);

  const create = useMutation({
    mutationFn: (body: { productName: string; unitPrice: number; imageUrl?: string }) => api.post("/products", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setProductName("");
      setUnitPrice("");
      setImageUrl("");
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/products/${id}`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setPendingDelete(null);
      const product = data?.data.find((p) => p.productId === id);
      if (product) {
        setUndoItems((prev) => [
          ...prev,
          {
            id: `product-${id}`,
            label: `Product "${product.productName}" deleted`,
            undoFn: () => {
              api.post(`/products/${id}/restore`, {}).then(() => qc.invalidateQueries({ queryKey: ["products"] }));
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

  const products = (data?.data ?? []).filter(
    (p) => {
      if (showOutOfStockOnly && p.stockQuantity > 0) return false;
      if (search && !p.productName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    },
  );

  function onSearch(term: string) {
    setSearch(term);
    setPage(1);
  }

  function stockBadge(p: Product) {
    if (p.stockQuantity === 0) return <span className="badge badge--red">out of stock</span>;
    if (p.stockQuantity <= LOW_STOCK_THRESHOLD) return <span className="badge badge--amber">low stock</span>;
    return <span className="badge badge--green">in stock</span>;
  }

  return (
    <section>
      <UndoToast items={undoItems} onDismiss={dismissUndo} />

      <h2 className="page-title">Products</h2>
      <form
        id="add-product-form"
        className={`inline-form${products.length === 0 ? " form-section--highlighted" : ""}`}
        onSubmit={(e) => {
          e.preventDefault();
          const price = Number(unitPrice);
          if (!productName.trim() || isNaN(price) || price < 0) return;
          create.mutate({ productName: productName.trim(), unitPrice: price, imageUrl: imageUrl || undefined });
        }}
      >
        <label className="field">
          <span className="visually-hidden">Product name</span>
          <input
            name="productName"
            placeholder="Product name"
            autoComplete="off"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            required
            className={fieldClass(productName, { required: true })}
          />
        </label>
          <label className="field">
            <span className="visually-hidden">Unit price</span>
            <input
              name="unitPrice"
              placeholder="Unit price (RM)"
              autoComplete="off"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              required
              className={fieldClass(unitPrice, { required: true })}
            />
          </label>
          <label className="field">
            <span className="visually-hidden">Image path</span>
            <input
              name="imageUrl"
              placeholder="/product-images/Roti%20Chani.jpg"
              autoComplete="off"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className={fieldClass(imageUrl)}
            />
          </label>
        <button type="submit" disabled={create.isPending}>
          {create.isPending ? "Adding…" : "Add"}
        </button>
      </form>

      {create.isError && (
        <InlineError message="Could not add product. A product with that name may already exist." />
      )}

      <div className="inline-form">
        <SearchInput label="Search products" onSearch={onSearch} />
        <button
          type="button"
          className={showOutOfStockOnly ? "" : "secondary"}
          onClick={() => setShowOutOfStockOnly((v) => !v)}
        >
          {showOutOfStockOnly ? "Show all" : "Out of stock only"}
        </button>
      </div>

      {isLoading && <LoadingSkeleton rows={4} columns={5} />}
      {!isLoading && products.length === 0 && (
        <EmptyState
          title={showOutOfStockOnly ? "No out-of-stock products" : "No products yet"}
          action={
            showOutOfStockOnly ? (
              <button type="button" className="secondary" onClick={() => setShowOutOfStockOnly(false)}>
                Show all products
              </button>
            ) : (
              <button
                type="button"
                className="secondary"
                onClick={() => document.getElementById("add-product-form")?.scrollIntoView({ behavior: "smooth" })}
              >
                Add your first product
              </button>
            )
          }
        >
          {showOutOfStockOnly ? "All products have stock." : search ? `No products match "${search}".` : "Add your first product to get started."}
        </EmptyState>
      )}
      {!isLoading && products.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.productId}>
                  <td>{p.productId}</td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                      <ProductImage imageUrl={p.imageUrl} productName={p.productName} size={24} />
                      {p.productName}
                    </span>
                  </td>
                  <td className="amount">{formatMoney(p.unitPrice)}</td>
                  <td className="qty">{p.stockQuantity}</td>
                  <td>{stockBadge(p)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="secondary" onClick={() => setEditingProduct(p)}>
                        Edit
                      </button>
                      <button className="danger" onClick={() => setPendingDelete(p)}>
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

      <Pagination page={data?.page ?? 1} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["products"] })}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.productName}?`}
          message="This will soft-delete the product. You can undo within 5 seconds."
          confirmLabel="Delete"
          onConfirm={() => remove.mutate(pendingDelete.productId)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </section>
  );
}
