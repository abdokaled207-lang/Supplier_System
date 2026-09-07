export interface ReportsAdapter {
  ordersByStatus(): Promise<{ status: string; count: number }[]>;
  customerBalances(range?: DateRange): Promise<{ customerId: number; fullName: string; phone: string; total: string; paid: string; balance: string }[]>;
  productStock(): Promise<{ productId: number; productName: string; unitPrice: string; stockQuantity: number }[]>;
  bestSellers(range?: DateRange): Promise<{ productId: number; productName: string; imageUrl: string; quantitySold: number }[]>;
  todaySales(): Promise<{ total: string; count: number }>;
}

export interface DateRange {
  start: Date;
  end: Date;
}

function buildDateRange(range?: string): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86_400_000);

  if (range === "daily") {
    return { start: today, end: tomorrow };
  }
  if (range === "weekly") {
    const dayOfWeek = today.getDay();
    const monday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 86_400_000);
    return { start: monday, end: tomorrow };
  }
  if (range === "monthly") {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: firstOfMonth, end: tomorrow };
  }
  return { start: new Date(0), end: tomorrow };
}

export function parseRangeParams(query: Record<string, unknown>): DateRange | undefined {
  const range = String(query.range ?? "");
  if (range === "custom") {
    const start = String(query.start ?? "");
    const end = String(query.end ?? "");
    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        return { start: s, end: new Date(e.getTime() + 86_400_000) };
      }
    }
    return undefined;
  }
  if (["daily", "weekly", "monthly"].includes(range)) {
    return buildDateRange(range);
  }
  return undefined;
}
