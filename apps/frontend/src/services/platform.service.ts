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

  // 1. Attempt real authentication against backend
  try {
    const res = await backendFetch<any>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail, password }),
    });

    if (res && res.accessToken) {
      if (typeof window !== "undefined") {
        localStorage.setItem("pos_access_token", res.accessToken);
        localStorage.setItem("accessToken", res.accessToken);
      }

      const role = (res.user?.role?.toLowerCase() || "waiter") as RoleId;
      let user = USERS.find((u) => u.email.toLowerCase() === cleanEmail || u.id === res.user?.id);
      if (!user) {
        user = {
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
      }
      return user;
    }
  } catch (err: any) {
    // If backend rejected with 401 Invalid Credentials
    if (err instanceof ApiError && err.status === 401) {
      const demoUser = USERS.find((u) => u.email.toLowerCase() === cleanEmail);
      if (!demoUser || password !== DEMO_PASSWORD) {
        throw new ApiError(401, "Invalid email or password.");
      }
    }
  }

  // 2. Demo accounts fallback
  await latency(300, 600);
  const user = USERS.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user || password !== DEMO_PASSWORD) throw new ApiError(401, "Invalid email or password.");
  return user;
}

export async function getUser(userId: string): Promise<User> {
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


export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
  await latency(400, 700);
  void email;
  return { ok: true };
}

export async function listTenantsForUser(userId: string): Promise<Tenant[]> {
  await latency(80, 200);
  const user = USERS.find((u) => u.id === userId);
  if (!user) throw new ApiError(401, "Session expired.");
  return TENANTS.filter((t) => user.memberships.some((m) => m.tenantId === t.id));
}

export async function listBranches(tenantId: string, userId: string): Promise<Branch[]> {
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
    await latency(100, 250);
    const base = ACTIVATIONS[tenantId];
    if (!base) throw new ApiError(404, "Unknown restaurant.");
    const overrides = readJson<Record<string, ActivationStatus>>(overrideKey) ?? {};
    const status = overrides[tenantId] ?? base.status;
    const message =
      status === base.status
        ? base.message
        : status === "active"
          ? "Access active (simulated)."
          : status === "grace"
            ? "Access is in a grace period (simulated)."
            : "Access is not active (simulated).";
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
