import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { ApiError } from "@/services/api-client";

export interface ApiErrorShape {
  status: number;
  message: string;
}

/**
 * Centralised RTK Query API. Endpoints call mock services through `run()`.
 * To connect a real REST backend, replace fakeBaseQuery with fetchBaseQuery
 * and turn each `queryFn` into a `query` describing the HTTP request.
 */
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fakeBaseQuery<ApiErrorShape>(),
  tagTypes: ["Session", "Tenant", "Branch", "Activation", "Menu", "Order", "Table", "Inventory", "Dashboard", "Notification"],
  endpoints: () => ({}),
});

export async function run<T>(fn: () => Promise<T>): Promise<{ data: T } | { error: ApiErrorShape }> {
  try {
    // Clone to mimic JSON over the wire: cached (frozen) data never aliases mock records.
    return { data: structuredClone(await fn()) };
  } catch (e) {
    if (e instanceof ApiError) return { error: { status: e.status, message: e.message } };
    return { error: { status: 500, message: e instanceof Error ? e.message : "Unexpected error" } };
  }
}

export function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return "Something went wrong.";
}
