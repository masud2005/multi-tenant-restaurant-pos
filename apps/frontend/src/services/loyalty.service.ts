import { backendFetch } from "./api-client";

export interface BackendLoyaltySettings {
  id: string;
  tenantId: string;
  isEnabled: boolean;
  spendAmountPerPoint: number;
  pointValue: number;
  minPointsToRedeem: number;
  maxPointsPerOrder?: number | null;
  expireAfterDays?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackendLoyaltyTier {
  id: string;
  tenantId: string;
  name: string;
  minSpend: number;
  pointMultiplier: number;
  discountPercent: number;
  color: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  _count?: {
    customers: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UpdateLoyaltySettingsInput {
  isEnabled?: boolean;
  spendAmountPerPoint?: number;
  pointValue?: number;
  minPointsToRedeem?: number;
  maxPointsPerOrder?: number | null;
  expireAfterDays?: number | null;
}

export interface CreateLoyaltyTierInput {
  name: string;
  minSpend: number;
  pointMultiplier?: number | undefined;
  discountPercent?: number | undefined;
  color?: string | undefined;
  description?: string | undefined;
  isActive?: boolean | undefined;
  sortOrder?: number | undefined;
}

export interface UpdateLoyaltyTierInput extends Partial<CreateLoyaltyTierInput> {}

/**
 * Fetch restaurant loyalty settings
 */
export async function getLoyaltySettingsApi(
  tenantSlug: string,
): Promise<BackendLoyaltySettings> {
  return backendFetch<BackendLoyaltySettings>(
    `/tenants/${tenantSlug}/loyalty/settings`,
  );
}

/**
 * Update restaurant loyalty settings
 */
export async function updateLoyaltySettingsApi(
  tenantSlug: string,
  input: UpdateLoyaltySettingsInput,
): Promise<BackendLoyaltySettings> {
  return backendFetch<BackendLoyaltySettings>(
    `/tenants/${tenantSlug}/loyalty/settings`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

/**
 * Fetch all loyalty tiers for restaurant tenant
 */
export async function getLoyaltyTiersApi(
  tenantSlug: string,
): Promise<BackendLoyaltyTier[]> {
  return backendFetch<BackendLoyaltyTier[]>(
    `/tenants/${tenantSlug}/loyalty/tiers`,
  );
}

/**
 * Fetch a single loyalty tier by ID
 */
export async function getTierByIdApi(
  tenantSlug: string,
  tierId: string,
): Promise<BackendLoyaltyTier> {
  return backendFetch<BackendLoyaltyTier>(
    `/tenants/${tenantSlug}/loyalty/tiers/${tierId}`,
  );
}

/**
 * Create a new loyalty tier
 */
export async function createLoyaltyTierApi(
  tenantSlug: string,
  input: CreateLoyaltyTierInput,
): Promise<BackendLoyaltyTier> {
  return backendFetch<BackendLoyaltyTier>(
    `/tenants/${tenantSlug}/loyalty/tiers`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

/**
 * Update a loyalty tier
 */
export async function updateLoyaltyTierApi(
  tenantSlug: string,
  tierId: string,
  input: UpdateLoyaltyTierInput,
): Promise<BackendLoyaltyTier> {
  return backendFetch<BackendLoyaltyTier>(
    `/tenants/${tenantSlug}/loyalty/tiers/${tierId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

/**
 * Delete a loyalty tier
 */
export async function deleteLoyaltyTierApi(
  tenantSlug: string,
  tierId: string,
): Promise<{ success: boolean; message: string }> {
  return backendFetch<{ success: boolean; message: string }>(
    `/tenants/${tenantSlug}/loyalty/tiers/${tierId}`,
    {
      method: "DELETE",
    },
  );
}
