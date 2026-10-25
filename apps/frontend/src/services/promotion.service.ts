import { backendFetch } from "./api-client";
import type { Promotion } from "@/types/domain";

export interface BackendPromotion {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  kind: "PERCENT" | "AMOUNT";
  value: number;
  minSpend: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
  uses: number;
  maxUses: number | null;
  computedStatus?: "LIVE" | "SCHEDULED" | "ENDED" | "PAUSED" | "USED_UP";
  remainingUses?: number | null;
  isAvailable?: boolean;
  usagePercent?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromotionInput {
  name: string;
  code: string;
  kind: "percent" | "amount" | "PERCENT" | "AMOUNT";
  value: number;
  minSpend?: number;
  startsAt?: string;
  endsAt: string;
  maxUses?: number | null;
  active?: boolean;
}

export interface GetPromotionsQuery {
  search?: string;
  code?: string;
  status?: "ALL" | "LIVE" | "SCHEDULED" | "ENDED" | "PAUSED" | "USED_UP";
  kind?: "PERCENT" | "AMOUNT";
  page?: number;
  limit?: number;
}

export interface PaginatedPromotionsResponse {
  items: BackendPromotion[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CheckPromotionResult {
  promotion: BackendPromotion;
  discountAmount?: number;
  finalTotal?: number;
  isValid: boolean;
}

/**
 * Maps backend Prisma promotion record to frontend domain model
 */
export function mapBackendPromotionToDomain(
  promo: BackendPromotion
): Promotion {
  return {
    id: promo.id,
    tenantId: promo.tenantId,
    name: promo.name,
    code: promo.code,
    kind: promo.kind.toLowerCase() as "percent" | "amount",
    value: promo.value,
    minSpend: promo.minSpend,
    startsAt: promo.startsAt.slice(0, 10),
    endsAt: promo.endsAt.slice(0, 10),
    active: promo.active,
    uses: promo.uses,
    maxUses: promo.maxUses,
  };
}

/**
 * Create a new promotional discount via backend API
 */
export async function createPromotionApi(
  tenantSlug: string,
  input: CreatePromotionInput
): Promise<BackendPromotion> {
  return backendFetch<BackendPromotion>(`/tenants/${tenantSlug}/promotions`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      kind: input.kind.toUpperCase(),
      value: input.value,
      minSpend: input.minSpend ?? 0,
      startsAt: input.startsAt
        ? new Date(input.startsAt).toISOString()
        : undefined,
      endsAt: new Date(input.endsAt).toISOString(),
      maxUses: input.maxUses ?? null,
      active: input.active ?? true,
    }),
  });
}

/**
 * Fetch all promotions for a tenant with optional search, status filtering, and pagination
 */
export async function getPromotionsApi(
  tenantSlug: string,
  query?: GetPromotionsQuery
): Promise<BackendPromotion[]> {
  const qs = new URLSearchParams();
  if (query?.search) qs.append("search", query.search);
  if (query?.code) qs.append("code", query.code);
  if (query?.status) qs.append("status", query.status);
  if (query?.kind) qs.append("kind", query.kind);
  if (query?.page) qs.append("page", String(query.page));
  if (query?.limit !== undefined) qs.append("limit", String(query.limit));

  const queryStr = qs.toString() ? `?${qs.toString()}` : "";
  const res = await backendFetch<
    PaginatedPromotionsResponse | BackendPromotion[]
  >(`/tenants/${tenantSlug}/promotions${queryStr}`);

  if (Array.isArray(res)) return res;
  return res.items ?? [];
}

/**
 * Fetch a single promotion by ID from backend API
 */
export async function getPromotionByIdApi(
  tenantSlug: string,
  id: string
): Promise<BackendPromotion> {
  return backendFetch<BackendPromotion>(
    `/tenants/${tenantSlug}/promotions/${id}`
  );
}

/**
 * Look up a promotion by exact code from backend API
 */
export async function getPromotionByCodeApi(
  tenantSlug: string,
  code: string
): Promise<BackendPromotion> {
  return backendFetch<BackendPromotion>(
    `/tenants/${tenantSlug}/promotions/by-code/${encodeURIComponent(code)}`
  );
}

/**
 * Real-time POS promotion check & discount calculation from backend API
 */
export async function validatePromotionApi(
  tenantSlug: string,
  code: string,
  subtotal?: number
): Promise<CheckPromotionResult> {
  const qs = new URLSearchParams({ code });
  if (subtotal !== undefined) qs.append("subtotal", String(subtotal));

  return backendFetch<CheckPromotionResult>(
    `/tenants/${tenantSlug}/promotions/validate?${qs.toString()}`
  );
}

/**
 * Update an existing promotion via backend API
 */
export async function updatePromotionApi(
  tenantSlug: string,
  id: string,
  input: Partial<CreatePromotionInput>
): Promise<BackendPromotion> {
  return backendFetch<BackendPromotion>(
    `/tenants/${tenantSlug}/promotions/${id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.code !== undefined && {
          code: input.code.trim().toUpperCase(),
        }),
        ...(input.kind !== undefined && { kind: input.kind.toUpperCase() }),
        ...(input.value !== undefined && { value: input.value }),
        ...(input.minSpend !== undefined && { minSpend: input.minSpend }),
        ...(input.startsAt !== undefined && {
          startsAt: input.startsAt
            ? new Date(input.startsAt).toISOString()
            : undefined,
        }),
        ...(input.endsAt !== undefined && {
          endsAt: input.endsAt
            ? new Date(input.endsAt).toISOString()
            : undefined,
        }),
        ...(input.maxUses !== undefined && { maxUses: input.maxUses }),
        ...(input.active !== undefined && { active: input.active }),
      }),
    }
  );
}

/**
 * Soft delete a promotion via backend API
 */
export async function deletePromotionApi(
  tenantSlug: string,
  id: string
): Promise<{ success: boolean; message: string }> {
  return backendFetch<{ success: boolean; message: string }>(
    `/tenants/${tenantSlug}/promotions/${id}`,
    {
      method: "DELETE",
    }
  );
}


