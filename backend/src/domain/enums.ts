import type { OrderStatus, PaymentType } from "@prisma/client";
import { errors } from "../utils/http";

// Single home for wire-string <-> DB-enum vocabulary. Replaces the per-route
// STATUS_MAP / TYPE_MAP constants so the mapping lives in exactly one place.

export const WIRE_ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;
export type WireOrderStatus = (typeof WIRE_ORDER_STATUSES)[number];

export const WIRE_PAYMENT_TYPES = ["cash", "bank_transfer", "card", "online"] as const;
export type WirePaymentType = (typeof WIRE_PAYMENT_TYPES)[number];

const ORDER_STATUS: Record<WireOrderStatus, OrderStatus> = {
  pending: "PENDING",
  processing: "PROCESSING",
  shipped: "SHIPPED",
  delivered: "DELIVERED",
  cancelled: "CANCELLED",
};

const PAYMENT_TYPE: Record<WirePaymentType, PaymentType> = {
  cash: "CASH",
  bank_transfer: "BANK_TRANSFER",
  card: "CARD",
  online: "ONLINE",
};

export function toOrderStatus(wire: WireOrderStatus): OrderStatus {
  const enumValue = ORDER_STATUS[wire];
  if (!enumValue) throw errors.badRequest(`Unknown order status: ${wire}`);
  return enumValue;
}

export function toPaymentType(wire: WirePaymentType): PaymentType {
  const enumValue = PAYMENT_TYPE[wire];
  if (!enumValue) throw errors.badRequest(`Unknown payment type: ${wire}`);
  return enumValue;
}
