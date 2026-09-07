import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Mail, Phone } from "lucide-react";
import { api } from "../api/client";
import type { CustomerProfile, Order } from "../api/types";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { InlineError } from "../components/InlineError";
import { WhatsAppIcon } from "../components/WhatsAppIcon";
import { getAllSettings, invoiceNumber } from "../utils/settings";
import { formatShortDate } from "../utils/datetime";
import { formatMoney } from "../utils/money";
import { waMeLink } from "../utils/phone";

export function Invoice() {
  const { id } = useParams<{ id: string }>();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

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

  const order = orderQuery.data?.data;
  const settings = getAllSettings();
  const customerPhone = order?.customer?.phone ?? customerQuery.data?.data?.phone ?? "";
  const messageText = order
    ? [
        `*INVOICE ${invoiceNumber(order.orderId)}*`,
        settings.companyName || "ROTI CHANI KING",
        `Date: ${formatShortDate(order.orderDate)}`,
        `Customer: ${order.customer?.fullName ?? "—"}`,
        `Sub Total: ${formatMoney(order.total)}`,
        `Baki Tertunggak: ${formatMoney(customerQuery.data?.data?.outstandingBalance ?? order.balance)}`,
        "Thank you for your support!",
      ].join("\n")
    : "";
  const sendLink = order && customerPhone ? waMeLink(customerPhone, messageText) : null;
  const pdfFilename = order ? `${invoiceNumber(order.orderId)}.pdf` : "invoice.pdf";

  // Render the visible invoice sheet to a single-page A4 PDF.
  async function generatePdf(): Promise<Blob> {
    const el = sheetRef.current;
    if (!el) throw new Error("Invoice not ready");
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 5;
    let imgW = pageW - margin * 2;
    let imgH = (canvas.height / canvas.width) * imgW;
    if (imgH > pageH - margin * 2) {
      imgH = pageH - margin * 2;
      imgW = (canvas.width / canvas.height) * imgH;
    }
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", (pageW - imgW) / 2, margin, imgW, imgH);
    return pdf.output("blob");
  }

  async function sendToCustomer() {
    if (!order || !sendLink) return;
    setSending(true);
    setSendError(null);
    try {
      const pdf = await generatePdf();
      const file = new File([pdf], pdfFilename, { type: "application/pdf" });

      // Native share sheet (Windows/Android/iOS): pick WhatsApp and it goes
      // straight to the current chat with the PDF attached.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: pdfFilename, text: messageText });
        return;
      }

      // Fallback: download the PDF and open the customer's WhatsApp chat —
      // attach the downloaded file to the opened chat.
      const url = URL.createObjectURL(pdf);
      const a = document.createElement("a");
      a.href = url;
      a.download = pdfFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      window.open(sendLink, "_blank", "noopener,noreferrer");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        setSendError("Could not generate the PDF. Try again, or use Ctrl+P to print.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="invoice-page">
      <div className="invoice-toolbar">
        <a href="/orders" className="secondary">← Back to Orders</a>
        {sendLink ? (
          <button className="inv-send-btn" onClick={sendToCustomer} disabled={sending}>
            <WhatsAppIcon size={16} /> {sending ? "Preparing PDF…" : "Send to Customer"}
          </button>
        ) : (
          <button className="inv-send-btn inv-send-btn--disabled" disabled title="This customer has no phone number on file">
            <WhatsAppIcon size={16} /> Send to Customer
          </button>
        )}
      </div>

      {sendError && <InlineError message={sendError} />}
      {orderQuery.isLoading && <LoadingSkeleton rows={8} columns={4} />}
      {orderQuery.isError && <InlineError message={(orderQuery.error as Error)?.message ?? "Failed to load invoice"} />}

      {order && (
        <div ref={sheetRef}>
          <InvoiceSheet
            order={order}
            outstandingBalance={customerQuery.data?.data?.outstandingBalance}
          />
        </div>
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
      {/* Clear-invoice layout: logo left, company block centered, INVOICE title right */}
      <div className="inv-header-row">
        <div className="inv-header-logo">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Company logo" className="inv-logo" />
          ) : (
            <div className="inv-logo-placeholder" aria-hidden="true">
              <span>{settings.companyName ? settings.companyName.charAt(0) : "R"}</span>
            </div>
          )}
        </div>

        <div className="inv-company-info">
          <p className="inv-company-name">{settings.companyName || "ROTI CHANI KING"}</p>
          {settings.companyAddress && <p>{settings.companyAddress}</p>}
          {settings.companyCity && <p>{settings.companyCity}</p>}
          {(settings.companyPhone || settings.companyEmail) && (
            <p className="inv-company-contact">
              {settings.companyPhone && (
                <span className="inv-contact-item">
                  <Phone size={10} aria-hidden="true" /> {settings.companyPhone}
                </span>
              )}
              {settings.companyEmail && (
                <span className="inv-contact-item">
                  <Mail size={10} aria-hidden="true" /> {settings.companyEmail}
                </span>
              )}
            </p>
          )}
        </div>

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
