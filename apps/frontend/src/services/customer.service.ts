import { backendFetch } from "./api-client";

export interface BackendCustomer {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  address?: string | null;
  notes?: string | null;
  loyaltyPoints: number;
  totalSpent: number;
  tierId?: string | null;
  tier?: {
    id: string;
    name: string;
    pointMultiplier: number;
    discountPercent: number;
    color: string;
  } | null;
  orders?: {
    id: string;
    orderNumber: string;
    type: string;
    status: string;
    total: number;
    paid: number;
    createdAt: string;
  }[];
  loyaltyTransactions?: {
    id: string;
    points: number;
    type: "EARNED" | "REDEEMED" | "ADJUSTED" | "EXPIRED" | "REFUNDED";
    reason?: string | null;
    balanceAfter?: number | null;
    createdAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomersListResponse {
  items: BackendCustomer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  address?: string | undefined;
  notes?: string | undefined;
  initialPoints?: number | undefined;
  tierId?: string | undefined;
}

export interface UpdateCustomerInput {
  name?: string | undefined;
  phone?: string | undefined;
  address?: string | undefined;
  notes?: string | undefined;
  loyaltyPoints?: number | undefined;
  tierId?: string | undefined;
  isActive?: boolean | undefined;
}

/**
 * Fetch customers list with search and pagination from backend API
 */
export async function getCustomersApi(
  tenantSlug: string,
  params?: {
    search?: string | undefined;
    name?: string | undefined;
    phone?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  } | undefined,
): Promise<CustomersListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.append("search", params.search);
  if (params?.name) query.append("name", params.name);
  if (params?.phone) query.append("phone", params.phone);
  if (params?.page) query.append("page", String(params.page));
  if (params?.limit) query.append("limit", String(params.limit));
  const qs = query.toString() ? `?${query.toString()}` : "";

  return backendFetch<CustomersListResponse>(
    `/tenants/${tenantSlug}/customers${qs}`,
  );
}

/**
 * Fetch detailed customer profile by ID from backend API
 */
export async function getCustomerByIdApi(
  tenantSlug: string,
  id: string,
): Promise<BackendCustomer> {
  return backendFetch<BackendCustomer>(
    `/tenants/${tenantSlug}/customers/${id}`,
  );
}

/**
 * Create a new customer via backend API
 */
export async function createCustomerApi(
  tenantSlug: string,
  input: CreateCustomerInput,
): Promise<BackendCustomer> {
  return backendFetch<BackendCustomer>(`/tenants/${tenantSlug}/customers`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Update an existing customer profile via backend API
 */
export async function updateCustomerApi(
  tenantSlug: string,
  id: string,
  input: UpdateCustomerInput,
): Promise<BackendCustomer> {
  return backendFetch<BackendCustomer>(
    `/tenants/${tenantSlug}/customers/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

/**
 * Delete a customer via backend API
 */
export async function deleteCustomerApi(
  tenantSlug: string,
  id: string,
): Promise<{ success: boolean; message: string }> {
  return backendFetch<{ success: boolean; message: string }>(
    `/tenants/${tenantSlug}/customers/${id}`,
    {
      method: "DELETE",
    },
  );
}
