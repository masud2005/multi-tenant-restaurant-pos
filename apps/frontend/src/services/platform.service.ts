import { ACTIVATIONS, DEMO_PASSWORD, TENANTS, USERS } from "@/mocks/platform";
import { ApiError, latency, tenantDb } from "@/mocks/db";
import { readJson, storageKey, writeJson } from "@/lib/persistence";
import { backendFetch } from "@/services/api-client";
import type { Activation, ActivationStatus, Branch, RoleId, Tenant, User } from "@/types/domain";

// Hydrate custom-registered / invited users from local persistence
if (typeof window !== "undefined") {
  const saved = readJson<User[]>(storageKey("custom-users"));
  if (saved && Array.isArray(saved)) {
    for (const u of saved) {
      if (!USERS.some((x) => x.id === u.id)) {
        USERS.push(u);
      }
    }
  }
}

export function registerUser(u: User) {
  const existingIdx = USERS.findIndex(
    (x) => x.id === u.id || (u.email && x.email.toLowerCase() === u.email.toLowerCase())
  );
  if (existingIdx >= 0) {
    USERS[existingIdx] = { ...USERS[existingIdx], ...u };
  } else {
    USERS.push(u);
  }

  const saved = readJson<User[]>(storageKey("custom-users")) || [];
  const sIdx = saved.findIndex(
    (x) => x.id === u.id || (u.email && x.email.toLowerCase() === u.email.toLowerCase())
  );
  if (sIdx >= 0) {
    saved[sIdx] = u;
  } else {
    saved.push(u);
  }
  writeJson(storageKey("custom-users"), saved);
}

export async function login(email: string, password: string): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();

  // 1. Real authentication against backend API
  const res = await backendFetch<any>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: cleanEmail, password }),
  });

  if (!res || !res.accessToken) {
    throw new ApiError(401, "Invalid credentials received from server.");
  }

  if (typeof window !== "undefined") {
    localStorage.setItem("pos_access_token", res.accessToken);
    localStorage.setItem("accessToken", res.accessToken);
  }

  try {
    const me = await backendFetch<any>("/auth/me");
    if (me && me.id) {
      const user: User = {
        id: me.id,
        name: me.name || cleanEmail.split("@")[0] || "User",
        email: me.email || cleanEmail,
        initials: me.initials || cleanEmail.slice(0, 2).toUpperCase(),
        memberships: Array.isArray(me.memberships) ? me.memberships : [],
      };
      registerUser(user);
      return user;
    }
  } catch {
    // If /auth/me fails, extract from login response
  }

  const role = (res.user?.role?.toLowerCase() || "waiter") as RoleId;
  const user: User = {
    id: res.user?.id || `u_${Date.now()}`,
    name: res.user?.name || cleanEmail.split("@")[0] || "Staff Member",
    email: res.user?.email || cleanEmail,
    initials: cleanEmail.slice(0, 2).toUpperCase(),
    memberships: [
      {
        tenantId: "t_saffron",
        role,
        branchIds: "all",
      },
    ],
  };
  registerUser(user);
  return user;
}

export async function getUser(userId: string): Promise<User> {
  try {
    const backendProfile = await backendFetch<any>("/auth/me");
    if (backendProfile && backendProfile.id) {
      const user: User = {
        id: backendProfile.id,
        name: backendProfile.name || "User",
        email: backendProfile.email,
        initials: backendProfile.initials || "US",
        memberships: Array.isArray(backendProfile.memberships) ? backendProfile.memberships : [],
      };
      const idx = USERS.findIndex((u) => u.id === user.id);
      if (idx >= 0) USERS[idx] = user;
      else USERS.push(user);
      return user;
    }
  } catch (err) {
    if (!(err instanceof ApiError && (err.status === 503 || err.status === 401))) {
      // ignore and fallback
    }
  }

  await latency(50, 120);
  let user = USERS.find((u) => u.id === userId);
  if (!user) {
    const saved = readJson<User[]>(storageKey("custom-users"));
    user = saved?.find((u) => u.id === userId);
    if (user && !USERS.some((x) => x.id === user!.id)) {
      USERS.push(user);
    }
  }
  if (!user) throw new ApiError(401, "Session expired.");
  return user;
}


export interface PasswordResetResponse {
  ok: boolean;
  message?: string | undefined;
  emailSent?: boolean | undefined;
  resetUrl?: string | undefined;
  token?: string | undefined;
}

export async function requestPasswordReset(email: string): Promise<PasswordResetResponse> {
  const res = await backendFetch<{
    message: string;
    emailSent?: boolean;
    resetUrl?: string;
    token?: string;
  }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: email.trim() }),
  });

  return {
    ok: true,
    message: res.message,
    emailSent: res.emailSent,
    resetUrl: res.resetUrl,
    token: res.token,
  };
}

export async function validateResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
  return await backendFetch<{ valid: boolean; email?: string }>(
    `/auth/reset-password/validate?token=${encodeURIComponent(token)}`
  );
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const res = await backendFetch<{ message?: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
  return {
    message: res?.message || "Password has been reset successfully. You can now sign in.",
  };
}

export async function listTenantsForUser(userId: string): Promise<Tenant[]> {
  try {
    const backendTenants = await backendFetch<any[]>("/auth/me/tenants");
    if (Array.isArray(backendTenants) && backendTenants.length > 0) {
      const user = USERS.find((u) => u.id === userId);
      const mapped: Tenant[] = backendTenants.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        tagline: t.tagline || "",
        initials: t.initials || (t.name ? t.name.slice(0, 2).toUpperCase() : "TW"),
        accent: t.accent || "oklch(0.6 0.2 240)",
        currency: t.currency || "BDT",
        locale: t.locale || "en-BD",
        taxRate: t.taxRate ?? 0.1,
        serviceChargeRate: t.serviceChargeRate ?? 0.0,
        receiptFooter: t.receiptFooter || "Thank you for dining with us!",
      }));

      // Sync user memberships in local cache with real accessible tenants
      if (user) {
        for (const t of backendTenants) {
          const role = (t.role?.toLowerCase() || user.memberships[0]?.role || "waiter") as RoleId;
          const existing = user.memberships.find((m) => m.tenantId === t.id);
          if (existing) {
            existing.role = role;
          } else {
            user.memberships.push({
              tenantId: t.id,
              role,
              branchIds: "all",
            });
          }
        }
        registerUser(user);
      }

      // Ensure TENANTS store holds the real tenants
      for (const m of mapped) {
        const idx = TENANTS.findIndex((x) => x.id === m.id || x.slug === m.slug);
        if (idx >= 0) {
          TENANTS[idx] = m;
        } else {
          TENANTS.push(m);
        }
      }

      return mapped;
    }
  } catch (err) {
    console.warn("Backend /auth/me/tenants unavailable, falling back to local tenant store", err);
  }

  await latency(80, 200);
  const user = USERS.find((u) => u.id === userId);
  if (!user) throw new ApiError(401, "Session expired.");
  return TENANTS.filter((t) => user.memberships.some((m) => m.tenantId === t.id));
}

export async function listBranches(tenantId: string, userId: string): Promise<Branch[]> {
  try {
    const res = await backendFetch<any[]>(`/tenants/${tenantId}/branches`);
    if (Array.isArray(res) && res.length > 0) {
      const branches: Branch[] = res.map((b) => ({
        id: b.id,
        tenantId: b.tenantId || tenantId,
        name: b.name,
        address: b.address || "",
        phone: b.phone || "",
      }));
      const db = tenantDb(tenantId);
      db.branches = branches;
      return branches;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for branches, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency(60, 150);
  const user = USERS.find((u) => u.id === userId);
  const m = user?.memberships.find((x) => x.tenantId === tenantId);
  if (!m) throw new ApiError(403, "No access to this restaurant.");
  return tenantDb(tenantId).branches.filter((b) => (m.branchIds === "all" || m.branchIds.includes(b.id)));
}

// ---- External subscription activation (integration abstraction) ----
// The real implementation will call the separate subscription application.
// Frontend only reads status; it never sells or manages subscriptions.

export interface ActivationProvider {
  check(tenantId: string): Promise<Activation>;
}

const overrideKey = storageKey("activation-simulation");

export const mockActivationProvider: ActivationProvider = {
  async check(tenantId) {
    try {
      const tenant = await backendFetch<any>(`/tenants/${tenantId}/settings`);
      if (tenant && tenant.id) {
        return {
          tenantId: tenant.id,
          status: "active",
          message: "Restaurant workspace is active and in good standing.",
          validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
          checkedAt: new Date().toISOString(),
        };
      }
    } catch {
      // fallback to simulated status
    }

    await latency(100, 250);
    const base = ACTIVATIONS[tenantId] ?? {
      tenantId,
      status: "active" as const,
      message: "Workspace active.",
      validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
    };
    const overrides = readJson<Record<string, ActivationStatus>>(overrideKey) ?? {};
    const status = overrides[tenantId] ?? base.status;
    const message =
      status === base.status
        ? base.message
        : status === "active"
          ? "Access active."
          : status === "grace"
            ? "Access is in a grace period."
            : "Access is not active.";
    return { ...base, status, message, checkedAt: new Date().toISOString() };
  },
};

/** Demo-only: lets testers flip a tenant's simulated activation status. */
export function simulateActivation(tenantId: string, status: ActivationStatus) {
  const overrides = readJson<Record<string, ActivationStatus>>(overrideKey) ?? {};
  overrides[tenantId] = status;
  writeJson(overrideKey, overrides);
}

export const getTenantBySlug = (slug: string) => TENANTS.find((t) => t.slug === slug) ?? null;
