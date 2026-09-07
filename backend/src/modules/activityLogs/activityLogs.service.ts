import { prisma } from "../../db/prisma";

export async function listActivityLogs(
  filters: { entityType?: string; entityId?: number },
  page: { skip: number; take: number },
) {
  const where: Record<string, unknown> = {};
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId !== undefined) where.entityId = filters.entityId;

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page.skip,
      take: page.take,
    }),
    prisma.activityLog.count({ where }),
  ]);

  const formatted = logs.map((log) => ({
    ...log,
    metadata: log.metadata ? JSON.parse(log.metadata as string) : null,
  }));

  return { logs: formatted, total };
}
