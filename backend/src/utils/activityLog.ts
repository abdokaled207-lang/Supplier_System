import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";

export type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "restored"
  | "status_changed"
  | "payment_recorded"
  | "edited";

export interface LogEntry {
  entityType: string;
  entityId: number;
  action: ActivityAction;
  description: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(entry: LogEntry, tx?: Prisma.TransactionClient): Promise<void> {
  try {
    const client = tx ?? prisma;
    await client.activityLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        description: entry.description,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      },
    });
  } catch {
    // Activity logging should never break the main operation
  }
}
