import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { CustomerProfile, Order } from "../api/types";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { InlineError } from "../components/InlineError";
import { getAllSettings, invoiceNumber } from "../utils/settings";
import { formatShortDate } from "../utils/datetime";
import { formatMoney } from "../utils/money";

export function Invoice() {
  const { id } = useParams<{ id: string }>();

  const orderQuery = useQuery({
    queryKey: ["order-invoice", id],
    queryFn: () => api.get<{ data: Order }>(`/orders/${id}/invoice`),
    enabled: !!id,
  });

  const customerQuery = useQuery({
    queryKey: ["customer-profile", orderQuery.data?.data.customerId],
    queryFn: () => api.get<{ data: CustomerProfile }>(`/customers/${orderQuery.data?.data.customerId}`),
    enabled: !!orderQuery.data?.data?.customerId,
  });

  return (
    <div className="invoice-page">
      <div className="invoice-toolbar">
        <a href="/orders" className="secondary">← Back to Orders</a>
        <button onClick={() => window.print()}>Print Invoice</button>
      </div>

      {orderQuery.isLoading && <LoadingSkeleton rows={8} columns={4} />}
      {orderQuery.isError && <InlineError message={(orderQuery.error as Error)?.message ?? "Failed to load invoice"} />}

      {orderQuery.data?.data && (
        <InvoiceSheet
          order={orderQuery.data.data}
          outstandingBalance={customerQuery.data?.data?.outstandingBalance}
        />
      )}
    </div>
  );
}

function InvoiceSheet({ order, outstandingBalance }: { order: Order; outstandingBalance?: string }) {
  const settings = getAllSettings();
  const invNum = invoiceNumber(order.orderId);
  const invDate = formatShortDate(order.orderDate);
  const customer = order.customer;

  const currentBalance = Number(order.balance);
  const outstanding = outstandingBalance !== undefined ? Number(outstandingBalance) : currentBalance;
  const bakiTertunggak = Math.max(outstanding - (Number(order.paid) - currentBalance), 0);
  const grandTotal = Number(order.total) + bakiTertunggak;

  return (
    <div className="inv-sheet">
      {/* ===== HEADER ===== */}
      {/* Top header row: logo + company name | INVOICE title */}
      <div className="inv-header-row">
        {/* Left: logo + company info */}
        <div className="inv-header-left">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Company logo" className="inv-logo" />
          ) : (
            <div className="inv-logo-placeholder" aria-hidden="true">
              <span>{settings.companyName ? settings.companyName.charAt(0) : "R"}</span>
            </div>
          )}
          <div className="inv-company-info">
            <p className="inv-company-name">{settings.companyName || "ROTI CHANI KING"}</p>
            {settings.companyAddress && <p>{settings.companyAddress}</p>}
            {settings.companyCity && <p>{settings.companyCity}</p>}
            {settings.companyPhone && <p>{settings.companyPhone}</p>}
            {settings.companyEmail && <p>{settings.companyEmail}</p>}
          </div>
        </div>

        {/* Right: INVOICE title */}
        <div className="inv-header-right">
          <p className="inv-title-word">INVOICE</p>
        </div>
      </div>

      {/* ===== BILL TO + INVOICE DETAILS ===== */}
      <div className="inv-info-section">
        {/* Left: BILL TO */}
        <div className="inv-bill-to">
          <p className="inv-label-small">BILL TO</p>
          <p className="inv-customer-name">{customer?.fullName ?? "—"}</p>
          {customer?.address && <p>{customer.address}</p>}
          {customer?.phone && <p>{customer.phone}</p>}
        </div>

        {/* Right: Invoice metadata */}
        <div className="inv-meta-block">
          <div className="inv-meta-row">
            <span className="inv-label-small">Invoice #</span>
            <span className="inv-meta-value">{invNum}</span>
          </div>
          <div className="inv-meta-row">
            <span className="inv-label-small">Invoice Date:</span>
            <span className="inv-meta-value">{invDate}</span>
          </div>
        </div>
      </div>

      {/* ===== ITEMS TABLE ===== */}
      <table className="inv-table">
        <thead>
          <tr>
            <th className="inv-th-num">#</th>
            <th className="inv-th-desc">DESCRIPTION</th>
            <th className="inv-th-qty">QTY</th>
            <th className="inv-th-price">PRICE</th>
            <th className="inv-th-total">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, i) => (
            <tr key={item.orderItemId}>
              <td className="inv-td-num">{i + 1}</td>
              <td className="inv-td-desc">{item.product?.productName ?? `Product #${item.productId}`}</td>
              <td className="inv-td-qty">
                {item.quantity}
                {item.product?.productName && (
                  <span className="inv-unit-label"> unit</span>
                )}
              </td>
              <td className="inv-td-price">{formatMoney(item.unitPrice)}</td>
              <td className="inv-td-total">{formatMoney(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ===== TOTALS ===== */}
      <div className="inv-totals-section">
        <div className="inv-totals-right">
          <div className="inv-totals-row">
            <span>SUB TOTAL</span>
            <span className="inv-amount">{formatMoney(order.total)}</span>
          </div>
          {bakiTertunggak > 0 && (
            <div className="inv-totals-row">
              <span>BAKI TERTUNGGAK</span>
              <span className="inv-amount">{formatMoney(bakiTertunggak)}</span>
            </div>
          )}
          <div className="inv-grand-total-row">
            <span className="inv-grand-label">GRAND TOTAL</span>
            <span className="inv-grand-amount">{formatMoney(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* ===== PAYMENT INSTRUCTIONS + SIGNATURE ===== */}
      <div className="inv-lower-section">
        {/* Left: Payment Instructions */}
        <div className="inv-payment-col">
          {(settings.bankName || settings.bankAccountName || settings.bankAccountNumber) && (
            <div className="inv-payment-box">
              <p className="inv-label-small">PAYMENT INSTRUCTIONS</p>
              {settings.bankAccountName && <p>Account name: {settings.bankAccountName}</p>}
              {settings.bankAccountNumber && <p>Account number: {settings.bankAccountNumber}</p>}
              {settings.bankName && <p>Bank Name: {settings.bankName}</p>}
            </div>
          )}
        </div>

        {/* Right: Signature */}
        <div className="inv-signature-col">
          <div className="inv-signature-block">
            <p>For, {settings.companyName || "ROTI CHANI KING"}</p>
            {settings.signatureUrl ? (
              <img src={settings.signatureUrl} alt="Authorized signature" className="inv-signature-img" />
            ) : (
              <div className="inv-sig-line">
                <p>AUTHORIZED SIGNATURE</p>
              </div>
            )}
          </div>
        </div>
      </div>

     
      <div className="inv-footer">
        {/* <img src={settings.logoUrl} alt="" className="inv-footer-logo" aria-hidden="true" />
        <span className="inv-footer-url">www.quotationmaker.app</span>
        <span className="inv-footer-page">Page 1 of 1</span> */}
      </div>
    </div>
  );
}
