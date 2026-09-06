import { z } from "zod";

// Offset/limit pagination shared by list endpoints.
// Accepts ?page=1&pageSize=50 (both coerced ints); returns { skip, take, page, pageSize }
// and the response envelope { data, total, page, pageSize }.

const pageSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
});

export function parsePagination(query: unknown) {
  const { page, pageSize } = pageSchema.parse(query);
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

export function paginated<T>(data: T[], total: number, page: number, pageSize: number): { data: T[]; total: number; page: number; pageSize: number } {
  return { data, total, page, pageSize };
}