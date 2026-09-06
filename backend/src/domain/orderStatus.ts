import type { OrderStatus } from "@prisma/client";
import { errors } from "../utils/http";

// Deep module: the order state machine. The table + the guard live here, not in a
// route file. Routes just ask "is this move legal?" and get a typed error back.

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["CANCELLED"],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (from === to) return;
  if (!canTransition(from, to)) {
    throw errors.conflict(`Cannot transition from ${from} to ${to}`);
  }
}

export function isTerminal(status: OrderStatus): boolean {
  return status === "DELIVERED" || status === "CANCELLED";
}
