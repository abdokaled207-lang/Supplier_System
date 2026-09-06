import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { OrderStatus } from "../api/types";
import { InlineError } from "../components/InlineError";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { getSetting } from "../utils/settings";

const LOW_STOCK_THRESHOLD = Number(getSetting("lowStockThreshold"));

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["product-detail", id],
    queryFn: () => api.get<{ data: { product: import("../api/types").Product; orders: ProductOrder[] } }>(`/products/${id}/orders`),
    enabled: !!id,
  });

  if (isLoading) return <LoadingSkeleton rows={6} columns={3} />;
  if (isError || !data?.data) return <InlineError message="Could not load product. It may have been deleted." />;

  const { product, orders } = data.data;

  return (
    <section>
      <div className="page-header">
        <Link className="secondary" to="/products">&larr; Back to Products</Link>
      </div>
      <h2 className="page-title">{product.productName}</h2>

      <div className="card">
        <table>
          <tbody>
            <tr>
              <th>Unit price</th>
              <td className="amount">RM{product.unitPrice}</td>
            </tr>
            <tr>
              <th>In stock</th>
              <td className="qty">
                {product.stockQuantity} units
                {product.stockQuantity <= LOW_STOCK_THRESHOLD && (
                  <span className="badge badge--amber" style={{ marginLeft: "0.5rem" }}>Low stock</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Recent orders containing "{product.productName}"</h3>
        {orders.length === 0 ? (
          <p className="text-muted">No orders yet for this product.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th className="qty">Qty</th>
                  <th className="amount">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.orderId}>
                    <td><Link to="/orders">#{o.orderId}</Link></td>
                    <td>{new Date(o.orderDate).toLocaleDateString()}</td>
                    <td>{o.customerName}</td>
                    <td>{o.status}</td>
                    <td className="qty">x{o.quantity}</td>
                    <td className="amount">RM{o.subtotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

interface ProductOrder {
  orderId: number;
  orderDate: string;
  status: OrderStatus;
  customerName: string;
  quantity: number;
  subtotal: string;
}
