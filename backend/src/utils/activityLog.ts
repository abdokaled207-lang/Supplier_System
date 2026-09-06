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

export async function logActivity(entry: LogEntry): Promise<void> {
  try {
    await prisma.activityLog.create({
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
