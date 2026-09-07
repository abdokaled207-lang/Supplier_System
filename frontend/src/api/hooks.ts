import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { Customer, Product } from "./types";

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
