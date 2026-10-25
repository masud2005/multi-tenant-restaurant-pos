import { backendFetch } from "./api-client";
import type { PaymentMethod } from "@/types/domain";

export interface BackendLedgerRow {
  id: string;
  kind: "payment" | "refund";
  orderId: string;
  orderNumber: string;
  method: PaymentMethod;
  rawMethod: string;
  amount: number;
  tendered?: number;
  change?: number;
  reference: string;
  at: string;
  branchId: string;
  branchName?: string;
}

export interface BackendLedgerSummary {
  takenToday: number;
  cashToday: number;
  cardMobileToday: number;
  refundedToday: number;
  totalPaymentsCount: number;
  totalRefundsCount: number;
  totalCount: number;
}

export interface BackendLedgerResponse {
  items: BackendLedgerRow[];
  summary: BackendLedgerSummary;
  total: number;
}

export interface GetLedgerQueryOptions {
  branchId?: string | undefined;
  kind?: "all" | "payment" | "refund" | undefined;
  method?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  search?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

/**
 * Fetch restaurant payments & refunds ledger from backend PostgreSQL
 */
export async function getFinanceLedgerApi(
  tenantSlug: string,
  query?: GetLedgerQueryOptions,
): Promise<BackendLedgerResponse> {
  const params = new URLSearchParams();
  if (query?.branchId) params.set("branchId", query.branchId);
  if (query?.kind && query.kind !== "all") params.set("kind", query.kind);
  if (query?.method) params.set("method", query.method);
  if (query?.startDate) params.set("startDate", query.startDate);
  if (query?.endDate) params.set("endDate", query.endDate);
  if (query?.search?.trim()) params.set("search", query.search.trim());
  if (query?.limit) params.set("limit", String(query.limit));
  if (query?.offset) params.set("offset", String(query.offset));

  const qs = params.toString();
  const endpoint = `/tenants/${tenantSlug}/finance/ledger${qs ? `?${qs}` : ""}`;
  return backendFetch<BackendLedgerResponse>(endpoint);
}

export interface CreatePaymentInput {
  method: "CASH" | "CARD" | "MOBILE" | "cash" | "card" | "mobile";
  amount: number;
  tendered?: number;
  change?: number;
  reference?: string;
}

/**
 * Record a payment for an existing order in backend PostgreSQL (CREATE Payment)
 */
export async function createOrderPaymentApi(
  tenantSlug: string,
  orderId: string,
  input: CreatePaymentInput,
) {
  return backendFetch<{ payment: BackendLedgerRow; order: any }>(
    `/tenants/${tenantSlug}/orders/${orderId}/payments`,
    {
      method: "POST",
      body: JSON.stringify({
        ...input,
        method: String(input.method).toUpperCase(),
      }),
    },
  );
}

