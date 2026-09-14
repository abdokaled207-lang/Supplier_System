import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { Customer, Product } from "./types";
import { getAllSettings, type SystemSettings } from "../utils/settings";

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<{ data: Product[] }>("/products"),
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<{ data: Customer[] }>("/customers"),
  });
}

// Server is the shared source of truth so every device/origin sees the same
// settings. localStorage seeds `initialData` so the first paint is instant and
// the invoice still renders offline; `staleTime: Infinity` avoids refetch
// churn on the invoice screen.
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ data: SystemSettings }>("/settings"),
    initialData: () => ({ data: getAllSettings() }),
    staleTime: Infinity,
  });
}
