import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertEtf } from "@shared/schema";
import { z } from "zod";

// ============================================
// ETF HOOKS
// ============================================

export interface EtfFilters {
  search?: string;
  mainCategory?: string;
  subCategory?: string;
  country?: string;
}

export function useEtfs(filters?: EtfFilters) {
  const queryParams = new URLSearchParams();
  if (filters?.search) queryParams.append("search", filters.search);
  if (filters?.mainCategory && filters.mainCategory !== "ALL") queryParams.append("mainCategory", filters.mainCategory);
  if (filters?.subCategory && filters.subCategory !== "ALL") queryParams.append("subCategory", filters.subCategory);
  if (filters?.country && filters.country !== "ALL") queryParams.append("country", filters.country);

  return useQuery({
    queryKey: [api.etfs.list.path, filters],
    queryFn: async () => {
      try {
        const url = `${api.etfs.list.path}?${queryParams.toString()}`;
        const res = await fetch(url, { credentials: "include" });
        
        if (!res.ok) {
          const errorText = await res.text();
          let errorMessage = `Failed to fetch ETFs (${res.status})`;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorMessage;
          } catch {
            if (errorText) errorMessage = errorText;
          }
          throw new Error(errorMessage);
        }
        
        const data = await res.json();
        return api.etfs.list.responses[200].parse(data);
      } catch (error: any) {
        console.error("Error fetching ETFs:", error);
        if (error.name === "TypeError" && error.message.includes("fetch")) {
          throw new Error("Network error: Unable to connect to server");
        }
        throw error;
      }
    },
  });
}

export function useEtf(id: number) {
  return useQuery({
    queryKey: [api.etfs.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.etfs.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch ETF");
      return api.etfs.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateEtf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertEtf) => {
      const validated = api.etfs.create.input.parse(data);
      const res = await fetch(api.etfs.create.path, {
        method: api.etfs.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.etfs.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create ETF");
      }
      return api.etfs.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.etfs.list.path] }),
  });
}

export function useUpdateEtf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<InsertEtf> }) => {
      let validated;
      try {
        validated = api.etfs.update.input.parse(data);
      } catch (e) {
        console.error("Validation error:", e);
        throw new Error("Validation failed");
      }
      const url = buildUrl(api.etfs.update.path, { id });
      
      const res = await fetch(url, {
        method: api.etfs.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Server error:", res.status, errorText);
        if (res.status === 400) {
          try {
            const error = api.etfs.update.responses[400].parse(JSON.parse(errorText));
            throw new Error(error.message);
          } catch {
            throw new Error(errorText || "Validation error");
          }
        }
        throw new Error(`Failed to update ETF: ${res.status}`);
      }
      const result = await res.json();
      return result;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [api.etfs.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.etfs.get.path, id] });
    },
  });
}

export function useDeleteEtf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.etfs.delete.path, { id });
      const res = await fetch(url, { method: api.etfs.delete.method, credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete ETF");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.etfs.list.path] }),
  });
}
