import { readJson, removeKey, storageKey, writeJson } from "@/lib/persistence";
import { buildTenantSeed, DB_VERSION, type TenantDb } from "./seed";
import { buildBackoffice } from "./seed-backoffice";
import { buildPeople } from "./seed-people";
import { buildStage4 } from "./seed-stage4";
import { BRANCHES } from "./platform";

// In-memory, per-tenant mock database. Each tenant's data lives in its own
// storage key, so one restaurant can never read another's records.
const cache = new Map<string, TenantDb>();

export function tenantDb(tenantId: string): TenantDb {
  const hit = cache.get(tenantId);
  if (hit) return hit;
  const stored = readJson<TenantDb>(storageKey("db", tenantId));
  let db: TenantDb;
  const hasActiveOrders = stored?.orders?.some((o) => ["in_kitchen", "ready", "served"].includes(o.status));
  if (stored && stored.version === DB_VERSION && hasActiveOrders) {
    db = stored;
  } else {
    db = buildTenantSeed(tenantId);
    writeJson(storageKey("db", tenantId), db);
  }

  // Guarantee Stage 4 data and notifications exist even if an existing cache was loaded
  if (db) {
    db.notifications ??= [];
    if (!db.notifications.length) {
      const prefix = tenantId.replace(/^t_/, "").slice(0, 3);
      db.notifications = [
        {
          id: `${prefix}_n1`,
          tenantId,
          title: "Low stock",
          body: "Some ingredients are below reorder level.",
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          read: false,
        },
        {
          id: `${prefix}_n2`,
          tenantId,
          title: "Welcome",
          body: `Restaurant workspace is ready (demo data).`,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          read: true,
        },
      ];
    }
    const stage4Defaults = buildStage4(tenantId);
    db.auditLogs ??= stage4Defaults.auditLogs;
    db.integrations ??= stage4Defaults.integrations;
    if (stage4Defaults.tenantSettings) {
      db.tenantSettings ??= stage4Defaults.tenantSettings;
    }
    // Ensure all defined branches for this tenant exist in db.branches
    const defBranches = BRANCHES.filter((b) => b.tenantId === tenantId);
    db.branches ??= [];
    for (const b of defBranches) {
      if (!db.branches.some((x) => x.id === b.id)) {
        db.branches.push({ ...b });
      }
    }
  }

  cache.set(tenantId, db);
  return db;
}

export function commit(tenantId: string) {
  const db = cache.get(tenantId);
  if (db) writeJson(storageKey("db", tenantId), db);
}

export function resetTenantDb(tenantId: string) {
  cache.delete(tenantId);
  removeKey(storageKey("db", tenantId));
}

export const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

/** Simulated network latency. */
export const latency = (min = 120, max = 380) =>
  new Promise<void>((r) => setTimeout(r, min + Math.random() * (max - min)));

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
