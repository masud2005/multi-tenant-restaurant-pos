import { ApiError, commit, latency, tenantDb, uid } from "@/mocks/db";
import type { TenantDb } from "@/mocks/seed";
import { round2 } from "@/lib/pricing";
import { readJson, storageKey, writeJson } from "@/lib/persistence";
import { backendFetch } from "./api-client";
import {
  createPromotionApi,
  deletePromotionApi,
  getPromotionsApi,
  mapBackendPromotionToDomain,
  updatePromotionApi,
  validatePromotionApi,
} from "./promotion.service";
import { type Permission, ROLE_PERMISSIONS } from "@/config/permissions.config";

import type {
  AttendanceRecord,
  Branch,
  CustomRole,
  Customer,
  LoyaltyTier,
  Order,
  Promotion,
  Reservation,
  ReservationStatus,
  RoleId,
  Shift,
  StaffMember,
  StaffStatus,
  User,
} from "@/types/domain";
import { registerUser } from "./platform.service";


// Customers & loyalty, reservations, staff, shifts, attendance, branches, promotions.
// Future REST: /tenants/:tenantId/customers, /reservations, /staff, /shifts, /attendance, /branches, /promotions

export const normalisePhone = (p: string) => p.replace(/[^\d+]/g, "");

// ---------- Loyalty ----------
export const TIER_THRESHOLDS: Record<LoyaltyTier, number> = { bronze: 0, silver: 250, gold: 600 };

export function tierFor(lifetimePoints: number): LoyaltyTier {
  if (lifetimePoints >= TIER_THRESHOLDS.gold) return "gold";
  if (lifetimePoints >= TIER_THRESHOLDS.silver) return "silver";
  return "bronze";
}

/** Points earned for a fully paid order: one point per `spendPerPoint` of the total. */
export const pointsFor = (total: number, spendPerPoint: number) => Math.floor(total / spendPerPoint);

/** Called when an order becomes fully paid. Creates the customer if the phone is new. */
export function awardLoyalty(db: TenantDb, order: Order) {
  const phone = normalisePhone(order.customerPhone);
  if (phone.length < 6) return;
  let c = db.customers.find((x) => normalisePhone(x.phone) === phone);
  const now = new Date().toISOString();
  if (!c) {
    c = { id: uid("cus"), tenantId: db.customers[0]?.tenantId ?? order.tenantId, name: order.customerName.trim() || "Guest", phone, email: "", notes: "", points: 0, lifetimePoints: 0, visits: 0, totalSpent: 0, lastVisitAt: null, ledger: [], createdAt: now };
    db.customers.push(c);
  }
  if (c.ledger.some((l) => l.reference === order.number && l.reason === "Order")) return;
  const pts = pointsFor(order.totals.total, db.loyalty.spendPerPoint);
  c.visits += 1;
  c.totalSpent = round2(c.totalSpent + order.totals.total);
  c.lastVisitAt = now;
  if (pts > 0) {
    c.points += pts;
    c.lifetimePoints += pts;
    c.ledger.unshift({ id: uid("led"), points: pts, reason: "Order", reference: order.number, at: now });
  }
}

// ---------- Customers ----------
export async function listCustomers(tenantId: string): Promise<Customer[]> {
  await latency();
  return [...tenantDb(tenantId).customers].sort((a, b) => b.totalSpent - a.totalSpent);
}

export type CustomerInput = Pick<Customer, "name" | "phone" | "email" | "notes"> & { id?: string | undefined };

export async function saveCustomer(tenantId: string, input: CustomerInput): Promise<Customer> {
  await latency();
  const db = tenantDb(tenantId);
  const name = input.name.trim();
  const phone = normalisePhone(input.phone);
  if (!name) throw new ApiError(422, "Name is required.");
  if (phone.length < 6) throw new ApiError(422, "Enter a valid phone number.");
  if (db.customers.some((c) => normalisePhone(c.phone) === phone && c.id !== input.id)) throw new ApiError(409, "A customer with this phone already exists.");
  const data = { name, phone, email: input.email.trim(), notes: input.notes.trim() };
  if (input.id) {
    const c = db.customers.find((x) => x.id === input.id);
    if (!c) throw new ApiError(404, "Customer not found.");
    Object.assign(c, data);
    commit(tenantId);
    return c;
  }
  const c: Customer = { id: uid("cus"), tenantId, ...data, points: 0, lifetimePoints: 0, visits: 0, totalSpent: 0, lastVisitAt: null, ledger: [], createdAt: new Date().toISOString() };
  db.customers.push(c);
  commit(tenantId);
  return c;
}

export async function adjustPoints(tenantId: string, input: { customerId: string; points: number; reason: string }): Promise<Customer> {
  await latency();
  const db = tenantDb(tenantId);
  const c = db.customers.find((x) => x.id === input.customerId);
  if (!c) throw new ApiError(404, "Customer not found.");
  const pts = Math.trunc(input.points);
  if (pts === 0) throw new ApiError(422, "Enter a non-zero number of points.");
  if (!input.reason.trim()) throw new ApiError(422, "A reason is required.");
  if (c.points + pts < 0) throw new ApiError(422, `Only ${c.points} points available.`);
  c.points += pts;
  if (pts > 0) c.lifetimePoints += pts;
  c.ledger.unshift({ id: uid("led"), points: pts, reason: input.reason.trim(), reference: "", at: new Date().toISOString() });
  commit(tenantId);
  return c;
}

export async function getLoyaltySettings(tenantId: string) {
  await latency(60, 120);
  return tenantDb(tenantId).loyalty;
}

// ---------- Reservations ----------
function toFrontendReservation(r: any): Reservation {
  return {
    id: r.id,
    tenantId: r.tenantId,
    branchId: r.branchId,
    customerName: r.customerName,
    phone: r.phone ?? "",
    partySize: r.partySize ?? 2,
    at: typeof r.at === "string" ? r.at : new Date(r.at).toISOString(),
    durationMin: r.durationMin ?? 90,
    tableId: r.tableId ?? null,
    tableName: r.tableName ?? r.table?.name ?? null,
    status: (r.status?.toLowerCase() ?? "booked") as ReservationStatus,
    notes: r.notes ?? "",
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt).toISOString(),
  };
}

export async function listReservations(tenantId: string, branchId: string): Promise<Reservation[]> {
  try {
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    const res = await backendFetch<any[]>(`/tenants/${tenantId}/reservations${qs}`);
    if (Array.isArray(res)) {
      const mapped = res.map(toFrontendReservation).sort((a, b) => a.at.localeCompare(b.at));
      const db = tenantDb(tenantId);
      db.reservations = mapped;
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for reservations, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency();
  return tenantDb(tenantId).reservations.filter((r) => r.branchId === branchId).sort((a, b) => a.at.localeCompare(b.at));
}

export type ReservationInput = Pick<Reservation, "branchId" | "customerName" | "phone" | "partySize" | "at" | "durationMin" | "tableId" | "notes"> & { id?: string | undefined };

const overlaps = (a: Reservation | ReservationInput, b: Reservation) => {
  const s1 = Date.parse(a.at), e1 = s1 + a.durationMin * 60000;
  const s2 = Date.parse(b.at), e2 = s2 + b.durationMin * 60000;
  return s1 < e2 && s2 < e1;
};

export async function saveReservation(tenantId: string, input: ReservationInput): Promise<Reservation> {
  const customerName = input.customerName.trim();
  if (!customerName) throw new ApiError(422, "Guest name is required.");
  if (!Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > 40) throw new ApiError(422, "Party size must be 1–40.");
  if (Number.isNaN(Date.parse(input.at))) throw new ApiError(422, "Choose a date and time.");

  try {
    const body = {
      branchId: input.branchId,
      customerName,
      phone: input.phone?.trim() || "",
      partySize: input.partySize,
      at: new Date(input.at).toISOString(),
      durationMin: input.durationMin || 90,
      tableId: input.tableId && input.tableId !== "none" ? input.tableId : null,
      notes: input.notes?.trim() || "",
    };

    let backendRes: any;
    if (input.id) {
      backendRes = await backendFetch<any>(`/tenants/${tenantId}/reservations/${input.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      backendRes = await backendFetch<any>(`/tenants/${tenantId}/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    if (backendRes && backendRes.id) {
      const saved = toFrontendReservation(backendRes);
      const db = tenantDb(tenantId);
      const idx = db.reservations.findIndex((r) => r.id === saved.id);
      if (idx >= 0) {
        db.reservations[idx] = saved;
      } else {
        db.reservations.push(saved);
      }
      commit(tenantId);
      return saved;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for saving reservation, falling back to local DB");
    } else {
      throw err;
    }
  }

  // Fallback to local DB
  await latency();
  const db = tenantDb(tenantId);
  let tableName: string | null = null;
  if (input.tableId && input.tableId !== "none") {
    const t = db.tables.find((x) => (x.id === input.tableId || x.name === input.tableId) && x.branchId === input.branchId);
    if (!t) throw new ApiError(422, "Table not found in this branch.");
    if (t.seats < input.partySize) throw new ApiError(422, `${t.name} seats only ${t.seats}.`);
    const clash = db.reservations.find((r) => r.id !== input.id && r.tableId === t.id && (r.status === "booked" || r.status === "seated") && overlaps(input, r));
    if (clash) throw new ApiError(409, `${t.name} is already booked for ${clash.customerName} at that time.`);
    tableName = t.name;
  }
  const data = { ...input, customerName, phone: input.phone.trim(), notes: input.notes.trim(), tableName, tableId: input.tableId === "none" ? null : input.tableId };
  if (input.id) {
    const r = db.reservations.find((x) => x.id === input.id);
    if (!r) throw new ApiError(404, "Reservation not found.");
    if (r.status !== "booked") throw new ApiError(409, "Only booked reservations can be edited.");
    Object.assign(r, data);
    commit(tenantId);
    return r;
  }
  const { id: _id, ...rest } = data;
  void _id;
  const r: Reservation = { id: uid("res"), tenantId, ...rest, status: "booked", createdAt: new Date().toISOString() };
  db.reservations.push(r);
  commit(tenantId);
  return r;
}

const RES_FLOW: Record<ReservationStatus, ReservationStatus[]> = {
  booked: ["seated", "cancelled", "no_show"],
  seated: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export async function setReservationStatus(tenantId: string, id: string, status: ReservationStatus): Promise<Reservation> {
  try {
    const backendRes = await backendFetch<any>(`/tenants/${tenantId}/reservations/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: status.toUpperCase() }),
    });

    if (backendRes && backendRes.id) {
      const updated = toFrontendReservation(backendRes);
      const db = tenantDb(tenantId);
      const idx = db.reservations.findIndex((r) => r.id === updated.id);
      if (idx >= 0) {
        db.reservations[idx] = updated;
      }
      const t = updated.tableId ? db.tables.find((x) => x.id === updated.tableId) : undefined;
      if (t && status === "seated" && t.status === "available") t.status = "reserved";
      if (t && status !== "seated" && t.status === "reserved") t.status = "available";
      commit(tenantId);
      return updated;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for setting reservation status, falling back to local DB");
    } else {
      throw err;
    }
  }

  // Fallback to local DB
  await latency();
  const db = tenantDb(tenantId);
  const r = db.reservations.find((x) => x.id === id);
  if (!r) throw new ApiError(404, "Reservation not found.");
  if (!RES_FLOW[r.status].includes(status)) throw new ApiError(409, `Can't change a ${r.status.replace("_", " ")} reservation to ${status.replace("_", " ")}.`);
  r.status = status;
  const t = r.tableId ? db.tables.find((x) => x.id === r.tableId) : undefined;
  // Seating holds the table as reserved until the POS opens an order on it.
  if (t && status === "seated" && t.status === "available") t.status = "reserved";
  if (t && status !== "seated" && t.status === "reserved") t.status = "available";
  commit(tenantId);
  return r;
}

export async function deleteReservation(tenantId: string, id: string): Promise<{ success: boolean; message: string }> {
  try {
    const backendRes = await backendFetch<{ success?: boolean; message?: string }>(`/tenants/${tenantId}/reservations/${id}`, {
      method: "DELETE",
    });

    const db = tenantDb(tenantId);
    const target = db.reservations.find((r) => r.id === id);
    if (target?.tableId) {
      const t = db.tables.find((x) => x.id === target.tableId);
      if (t && t.status === "reserved") t.status = "available";
    }
    db.reservations = db.reservations.filter((r) => r.id !== id);
    commit(tenantId);

    return {
      success: true,
      message: backendRes?.message || "Reservation deleted successfully",
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for deleting reservation, falling back to local DB");
    } else {
      throw err;
    }
  }

  // Fallback to local DB
  await latency();
  const db = tenantDb(tenantId);
  const idx = db.reservations.findIndex((x) => x.id === id);
  const r = db.reservations[idx];
  if (idx < 0 || !r) throw new ApiError(404, "Reservation not found.");
  if (r.status === "seated") throw new ApiError(409, "Cannot delete an active seated reservation.");

  if (r.tableId) {
    const t = db.tables.find((x) => x.id === r.tableId);
    if (t && t.status === "reserved") t.status = "available";
  }
  db.reservations.splice(idx, 1);
  commit(tenantId);
  return { success: true, message: "Reservation deleted successfully" };
}

// ---------- Staff ----------
function toFrontendStaff(s: any): StaffMember {
  const status: StaffStatus = s.status
    ? (s.status.toLowerCase() as StaffStatus)
    : s.active
      ? "active"
      : "inactive";

  return {
    id: s.id,
    tenantId: s.tenantId,
    userId: s.userId ?? null,
    name: s.name,
    email: s.email ?? "",
    phone: s.phone ?? "",
    role: (s.role?.toLowerCase() ?? "waiter") as RoleId,
    branchIds: Array.isArray(s.branchIds)
      ? s.branchIds.includes("all")
        ? "all"
        : s.branchIds
      : "all",
    hourlyRate: typeof s.hourlyRate === "number" ? s.hourlyRate : Number(s.hourlyRate) || 0,
    active: s.active ?? (status === "active"),
    status,
    inviteToken: s.inviteToken ?? null,
    invitedAt: s.invitedAt ?? null,
    inviteUrl: s.inviteUrl || (s.inviteToken && typeof window !== "undefined" ? `${window.location.origin}/invite?token=${s.inviteToken}` : null),
    emailSent: s.emailSent ?? undefined,
  };
}

export async function listStaff(tenantId: string): Promise<StaffMember[]> {
  const customRoleMap = getStaffCustomRoles(tenantId);
  try {
    const res = await backendFetch<any[]>(`/tenants/${tenantId}/staff`);
    if (Array.isArray(res)) {
      const mapped: StaffMember[] = res.map((s) => {
        const item = toFrontendStaff(s);
        const customName = customRoleMap[item.id];
        if (customName) {
          item.customRoleName = customName;
        }
        return item;
      });
      const db = tenantDb(tenantId);
      db.staff = mapped;
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for staff list, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency();
  return tenantDb(tenantId).staff.map((s): StaffMember => {
    const customName = customRoleMap[s.id];
    if (customName) {
      return { ...s, customRoleName: customName };
    }
    return s;
  });
}

export type StaffInput = Omit<StaffMember, "id" | "tenantId" | "userId"> & {
  id?: string | undefined;
  status?: StaffStatus | undefined;
  sendInvite?: boolean | undefined;
};

export async function saveStaff(tenantId: string, input: StaffInput): Promise<StaffMember> {
  const name = input.name.trim();
  if (!name) throw new ApiError(422, "Name is required.");
  if (input.hourlyRate < 0) throw new ApiError(422, "Hourly rate can't be negative.");
  if (input.branchIds !== "all" && input.branchIds.length === 0) throw new ApiError(422, "Assign at least one branch.");

  const db = tenantDb(tenantId);
  const existing = input.id ? db.staff.find((s) => s.id === input.id) : undefined;
  if (existing?.role === "owner" && (input.role !== "owner" || !input.active)) {
    const owners = db.staff.filter((s) => s.role === "owner" && s.active && s.id !== existing.id);
    if (owners.length === 0) throw new ApiError(409, "The restaurant must keep at least one active owner.");
  }

  try {
    const isDraft = input.status === "draft";
    const body = {
      name,
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      role: input.role.toUpperCase(),
      hourlyRate: Number(input.hourlyRate) || 0,
      branchIds: input.branchIds === "all" ? ["all"] : input.branchIds,
      active: input.active,
      status: input.status ? input.status.toUpperCase() : undefined,
      sendInvite: isDraft ? false : (input.sendInvite ?? true),
    };

    let backendRes: any;
    if (input.id) {
      backendRes = await backendFetch<any>(`/tenants/${tenantId}/staff/${input.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      backendRes = await backendFetch<any>(`/tenants/${tenantId}/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    if (backendRes && backendRes.id) {
      const saved = toFrontendStaff(backendRes);
      if (input.customRoleName) {
        setStaffCustomRole(tenantId, saved.id, input.customRoleName);
        saved.customRoleName = input.customRoleName;
      } else if (input.id) {
        setStaffCustomRole(tenantId, saved.id, undefined);
      }
      const idx = db.staff.findIndex((s) => s.id === saved.id);
      if (idx >= 0) {
        db.staff[idx] = saved;
      } else {
        db.staff.unshift(saved);
      }
      commit(tenantId);
      return saved;
    }
  } catch (err) {
    if (err instanceof ApiError && (err.status === 503 || (input.id && err.status === 404))) {
      console.warn("Backend unavailable or record not found on backend, falling back to local DB");
    } else {
      throw err;
    }
  }

  // Fallback to local DB
  await latency();
  if (input.id && !existing) throw new ApiError(404, "Staff member not found.");
  const { id: _id, ...rest } = input;
  void _id;
  const data = { ...rest, name, email: input.email.trim(), phone: input.phone.trim() };
  if (existing) {
    Object.assign(existing, data);
    if (input.customRoleName) {
      setStaffCustomRole(tenantId, existing.id, input.customRoleName);
      existing.customRoleName = input.customRoleName;
    } else {
      setStaffCustomRole(tenantId, existing.id, undefined);
      delete existing.customRoleName;
    }
    for (const s of db.shifts) if (s.staffId === existing.id) s.staffName = existing.name;
    commit(tenantId);
    return existing;
  }
  const s: StaffMember = { id: uid("stf"), tenantId, userId: null, ...data };
  if (input.customRoleName) {
    setStaffCustomRole(tenantId, s.id, input.customRoleName);
    s.customRoleName = input.customRoleName;
  }
  db.staff.push(s);
  commit(tenantId);
  return s;
}

export async function deleteStaff(tenantId: string, id: string): Promise<{ success: boolean; message: string }> {
  const db = tenantDb(tenantId);
  const existing = db.staff.find((s) => s.id === id);
  if (existing?.role === "owner") {
    const activeOwners = db.staff.filter((s) => s.role === "owner" && s.active && s.id !== id);
    if (activeOwners.length === 0) {
      throw new ApiError(409, "The restaurant must keep at least one active owner.");
    }
  }

  setStaffCustomRole(tenantId, id, undefined);

  try {
    const res = await backendFetch<{ success?: boolean; message?: string }>(`/tenants/${tenantId}/staff/${id}`, {
      method: "DELETE",
    });

    db.staff = db.staff.filter((s) => s.id !== id);
    commit(tenantId);

    return {
      success: true,
      message: res?.message || "Staff member removed successfully",
    };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 503 || err.status === 404)) {
      console.warn("Backend unavailable or record not found on backend, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency();
  const idx = db.staff.findIndex((s) => s.id === id);
  if (idx < 0) throw new ApiError(404, "Staff member not found.");
  db.staff.splice(idx, 1);
  commit(tenantId);
  return { success: true, message: "Staff member removed successfully" };
}

export async function reinviteStaff(
  tenantId: string,
  staffId: string
): Promise<{ success: boolean; message: string; inviteToken?: string; inviteUrl?: string; emailSent?: boolean }> {
  try {
    const res = await backendFetch<any>(`/tenants/${tenantId}/staff/${staffId}/invite`, {
      method: "POST",
    });
    if (res?.staff) {
      const updated = toFrontendStaff(res.staff);
      const db = tenantDb(tenantId);
      const idx = db.staff.findIndex((s) => s.id === updated.id);
      if (idx >= 0) db.staff[idx] = updated;
      commit(tenantId);
    }
    return {
      success: true,
      message: res?.message || "Invitation sent successfully",
      inviteToken: res?.inviteToken,
      inviteUrl: res?.inviteUrl,
      emailSent: res?.emailSent,
    };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 503 || err.status === 404)) {
      console.warn("Backend unavailable, falling back to local simulation");
    } else {
      throw err;
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  const s = db.staff.find((x) => x.id === staffId);
  if (!s) throw new ApiError(404, "Staff member not found.");
  s.status = "invited";
  s.active = false;
  s.invitedAt = new Date().toISOString();
  s.inviteToken = uid("inv");
  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/invite?token=${s.inviteToken}` : `/invite?token=${s.inviteToken}`;
  s.inviteUrl = inviteUrl;
  commit(tenantId);
  return { success: true, message: `Invitation created for ${s.email || s.name}`, inviteToken: s.inviteToken, inviteUrl };
}

export interface InviteDetails {
  id: string;
  name: string;
  email: string;
  role: RoleId;
  tenantName: string;
  tenantSlug: string;
}

export async function getInviteDetails(token: string): Promise<InviteDetails> {
  try {
    const res = await backendFetch<any>(`/auth/invite/${token}`);
    if (res) {
      return {
        id: res.id,
        name: res.name,
        email: res.email,
        role: (res.role?.toLowerCase() ?? "waiter") as RoleId,
        tenantName: res.tenantName,
        tenantSlug: res.tenantSlug,
      };
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable, falling back to mock invite");
    } else {
      throw err;
    }
  }

  await latency();
  return {
    id: "mock_staff",
    name: "Team Member",
    email: "staff@example.com",
    role: "waiter",
    tenantName: "Saffron & Ember",
    tenantSlug: "saffron-ember",
  };
}

export interface AcceptInviteResponse {
  success: boolean;
  message: string;
  user?: User;
  tenantSlug?: string;
  staff?: any;
}

export async function acceptInvite(data: {
  token: string;
  password: string;
  name?: string;
}): Promise<AcceptInviteResponse> {
  try {
    const res = await backendFetch<any>(`/auth/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res?.tokens?.accessToken) {
      if (typeof window !== "undefined") {
        localStorage.setItem("pos_access_token", res.tokens.accessToken);
        localStorage.setItem("accessToken", res.tokens.accessToken);
      }
    }

    const role = (res?.user?.role?.toLowerCase() || res?.staff?.role?.toLowerCase() || "waiter") as RoleId;
    const tenantId = res?.tenant?.id || "t_saffron";
    const tenantSlug = res?.tenant?.slug || "saffron-ember";
    const staffBranch = res?.staff?.branchId;

    const userObj: User = {
      id: res?.user?.id || `u_${Date.now()}`,
      name: data.name?.trim() || res?.staff?.name || res?.user?.name || "Staff Member",
      email: res?.user?.email || res?.staff?.email || "",
      initials: (data.name || res?.staff?.name || "SM")
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      memberships: [
        {
          tenantId,
          role,
          branchIds: staffBranch ? [staffBranch] : "all",
        },
      ],
    };

    registerUser(userObj);

    return {
      success: true,
      message: res?.message || "Invitation accepted successfully",
      user: userObj,
      staff: res?.staff,
      tenantSlug,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable, simulated accept");
    } else {
      throw err;
    }
  }

  await latency();
  const mockUser: User = {
    id: `u_${Date.now()}`,
    name: data.name?.trim() || "Team Member",
    email: "staff@example.com",
    initials: "TM",
    memberships: [{ tenantId: "t_saffron", role: "waiter", branchIds: "all" }],
  };
  registerUser(mockUser);
  return {
    success: true,
    message: "Welcome aboard! Your account is activated.",
    user: mockUser,
    tenantSlug: "saffron-ember",
  };
}


// ---------- Shifts ----------
export async function listShifts(tenantId: string, branchId: string): Promise<Shift[]> {
  await latency();
  return tenantDb(tenantId).shifts.filter((s) => s.branchId === branchId).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
}

export type ShiftInput = Pick<Shift, "branchId" | "staffId" | "date" | "start" | "end" | "notes"> & { id?: string | undefined };

export async function saveShift(tenantId: string, input: ShiftInput): Promise<Shift> {
  await latency();
  const db = tenantDb(tenantId);
  const staff = db.staff.find((s) => s.id === input.staffId);
  if (!staff) throw new ApiError(422, "Choose a staff member.");
  if (!staff.active) throw new ApiError(422, `${staff.name} is inactive.`);
  if (staff.branchIds !== "all" && !staff.branchIds.includes(input.branchId)) throw new ApiError(422, `${staff.name} isn't assigned to this branch.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ApiError(422, "Choose a date.");
  if (!(input.end > input.start)) throw new ApiError(422, "Shift must end after it starts.");
  const clash = db.shifts.find((s) => s.id !== input.id && s.staffId === input.staffId && s.date === input.date && s.start < input.end && input.start < s.end);
  if (clash) throw new ApiError(409, `${staff.name} already works ${clash.start}–${clash.end} that day.`);
  if (input.id) {
    const s = db.shifts.find((x) => x.id === input.id);
    if (!s) throw new ApiError(404, "Shift not found.");
    Object.assign(s, { ...input, staffName: staff.name });
    commit(tenantId);
    return s;
  }
  const { id: _id, ...rest } = input;
  void _id;
  const s: Shift = { id: uid("sh"), tenantId, ...rest, staffName: staff.name };
  db.shifts.push(s);
  commit(tenantId);
  return s;
}

export async function deleteShift(tenantId: string, id: string): Promise<{ ok: true }> {
  await latency();
  const db = tenantDb(tenantId);
  db.shifts = db.shifts.filter((s) => s.id !== id);
  commit(tenantId);
  return { ok: true };
}

// ---------- Attendance ----------
export async function listAttendance(tenantId: string, branchId: string): Promise<AttendanceRecord[]> {
  await latency();
  return tenantDb(tenantId).attendance.filter((a) => a.branchId === branchId).sort((a, b) => b.clockIn.localeCompare(a.clockIn));
}

/** Clock the staff member linked to `userId` in or out at the given branch. */
export async function toggleClock(tenantId: string, input: { userId: string; branchId: string }): Promise<AttendanceRecord> {
  await latency();
  const db = tenantDb(tenantId);
  const staff = db.staff.find((s) => s.userId === input.userId);
  if (!staff || !staff.active) throw new ApiError(403, "You don't have an active staff profile here.");
  const open = db.attendance.find((a) => a.staffId === staff.id && a.clockOut === null);
  const now = new Date().toISOString();
  if (open) {
    open.clockOut = now;
    commit(tenantId);
    return open;
  }
  const rec: AttendanceRecord = { id: uid("att"), tenantId, branchId: input.branchId, staffId: staff.id, staffName: staff.name, clockIn: now, clockOut: null };
  db.attendance.push(rec);
  commit(tenantId);
  return rec;
}

export const hoursWorked = (a: AttendanceRecord, now = Date.now()) => round2(((a.clockOut ? Date.parse(a.clockOut) : now) - Date.parse(a.clockIn)) / 3600000);

// ---------- Branches ----------
export async function listAllBranches(tenantId: string): Promise<Branch[]> {
  try {
    const backendBranches = await backendFetch<Branch[]>(`/tenants/${tenantId}/branches`);
    if (Array.isArray(backendBranches) && backendBranches.length > 0) {
      const db = tenantDb(tenantId);
      db.branches = backendBranches.map((b) => ({
        id: b.id,
        tenantId: b.tenantId || tenantId,
        name: b.name,
        address: b.address || "",
        phone: b.phone || "",
      }));
      commit(tenantId);
      return db.branches;
    }
  } catch (err) {
    console.warn("Backend unavailable or unauthorized for branches, using local DB:", err);
  }

  await latency();
  return tenantDb(tenantId).branches;
}

export type BranchInput = Pick<Branch, "name" | "address" | "phone"> & { id?: string | undefined };

export async function saveBranch(tenantId: string, input: BranchInput): Promise<Branch> {
  const name = input.name.trim();
  if (!name) throw new ApiError(422, "Branch name is required.");

  try {
    let saved: Branch;
    if (input.id) {
      saved = await backendFetch<Branch>(`/tenants/${tenantId}/branches/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          address: input.address?.trim() || "",
          phone: input.phone?.trim() || "",
        }),
      });
    } else {
      saved = await backendFetch<Branch>(`/tenants/${tenantId}/branches`, {
        method: "POST",
        body: JSON.stringify({
          name,
          address: input.address?.trim() || "",
          phone: input.phone?.trim() || "",
        }),
      });
    }

    if (saved && saved.id) {
      const db = tenantDb(tenantId);
      const existing = db.branches.find((x) => x.id === saved.id);
      const mapped: Branch = {
        id: saved.id,
        tenantId: saved.tenantId || tenantId,
        name: saved.name,
        address: saved.address || "",
        phone: saved.phone || "",
      };

      if (existing) {
        Object.assign(existing, mapped);
      } else {
        db.branches.push(mapped);
        if (db.branches.length > 1 && db.ingredients.length > 0) {
          const template = db.ingredients.filter((i) => i.branchId === db.branches[0]!.id);
          for (const i of template) {
            db.ingredients.push({ ...i, id: `${mapped.id}_ing_${i.key}`, branchId: mapped.id, stock: 0 });
          }
        }
      }
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unreachable for saving branch, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  if (db.branches.some((b) => b.name.toLowerCase() === name.toLowerCase() && b.id !== input.id)) {
    throw new ApiError(409, "A branch with this name already exists.");
  }
  const data = { name, address: input.address.trim(), phone: input.phone.trim() };
  if (input.id) {
    const b = db.branches.find((x) => x.id === input.id);
    if (!b) throw new ApiError(404, "Branch not found.");
    Object.assign(b, data);
    commit(tenantId);
    return b;
  }
  const b: Branch = { id: uid("br"), tenantId, ...data };
  db.branches.push(b);
  // New branches start with the tenant's ingredient catalogue at zero stock.
  const template = db.ingredients.filter((i) => i.branchId === db.branches[0]!.id);
  for (const i of template) db.ingredients.push({ ...i, id: `${b.id}_ing_${i.key}`, branchId: b.id, stock: 0 });
  commit(tenantId);
  return b;
}

// ---------- Promotions ----------
export function todayIso(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Validates a promo code for a cart subtotal. Throws ApiError with a user-facing reason. */
export function checkPromotion(db: TenantDb, code: string, subtotal: number, today = todayIso()): Promotion {
  const promo = db.promotions.find((p) => p.code.toUpperCase() === code.trim().toUpperCase());
  if (!promo) throw new ApiError(404, "Promo code not found.");
  if (!promo.active) throw new ApiError(422, "This promotion is paused.");
  if (today < promo.startsAt) throw new ApiError(422, "This promotion hasn't started yet.");
  if (today > promo.endsAt) throw new ApiError(422, "This promotion has ended.");
  if (promo.maxUses !== null && promo.uses >= promo.maxUses) throw new ApiError(422, "This promotion has reached its usage limit.");
  if (subtotal < promo.minSpend) throw new ApiError(422, `Minimum spend for ${promo.code} is ${promo.minSpend}.`);
  return promo;
}

export async function validatePromotion(tenantId: string, code: string, subtotal: number): Promise<Promotion> {
  try {
    const res = await validatePromotionApi(tenantId, code, subtotal);
    if (res?.promotion) {
      return mapBackendPromotionToDomain(res.promotion);
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for validating promotion, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency(100, 200);
  return checkPromotion(tenantDb(tenantId), code, subtotal);
}

export async function listPromotions(tenantId: string): Promise<Promotion[]> {
  try {
    const backendPromos = await getPromotionsApi(tenantId);
    if (Array.isArray(backendPromos)) {
      const mapped = backendPromos.map(mapBackendPromotionToDomain);
      const db = tenantDb(tenantId);
      db.promotions = mapped;
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (err instanceof ApiError && (err.status === 503 || err.status === 404)) {
      console.warn("Backend unavailable for promotions, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency();
  return tenantDb(tenantId).promotions;
}

export type PromotionInput = Omit<Promotion, "id" | "tenantId" | "uses"> & { id?: string | undefined };

export async function savePromotion(tenantId: string, input: PromotionInput): Promise<Promotion> {
  const code = input.code.trim().toUpperCase();
  if (!input.name.trim()) throw new ApiError(422, "Name is required.");
  if (!/^[A-Z0-9]{3,16}$/.test(code)) throw new ApiError(422, "Code must be 3–16 letters or digits.");
  if (!(input.value > 0) || (input.kind === "percent" && input.value > 100)) throw new ApiError(422, "Enter a valid discount value.");
  if (input.endsAt < input.startsAt) throw new ApiError(422, "End date must be on or after the start date.");

  // If creating new promotion, call backend API
  if (!input.id) {
    try {
      const created = await createPromotionApi(tenantId, {
        name: input.name,
        code,
        kind: input.kind,
        value: input.value,
        minSpend: input.minSpend,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        maxUses: input.maxUses,
        active: input.active,
      });

      if (created && created.id) {
        const mapped = mapBackendPromotionToDomain(created);
        const db = tenantDb(tenantId);
        const existingIdx = db.promotions.findIndex((p) => p.id === mapped.id || p.code === mapped.code);
        if (existingIdx >= 0) {
          db.promotions[existingIdx] = mapped;
        } else {
          db.promotions.unshift(mapped);
        }
        commit(tenantId);
        return mapped;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        console.warn("Backend unavailable for creating promotion, falling back to local DB");
      } else {
        throw err;
      }
    }
  }

  // If updating existing promotion, call backend API
  if (input.id) {
    try {
      const updated = await updatePromotionApi(tenantId, input.id, {
        name: input.name,
        code,
        kind: input.kind,
        value: input.value,
        minSpend: input.minSpend,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        maxUses: input.maxUses,
        active: input.active,
      });

      if (updated && updated.id) {
        const mapped = mapBackendPromotionToDomain(updated);
        const db = tenantDb(tenantId);
        const existingIdx = db.promotions.findIndex((p) => p.id === mapped.id);
        if (existingIdx >= 0) {
          db.promotions[existingIdx] = mapped;
        } else {
          db.promotions.unshift(mapped);
        }
        commit(tenantId);
        return mapped;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        console.warn("Backend unavailable for updating promotion, falling back to local DB");
      } else {
        throw err;
      }
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  if (db.promotions.some((p) => p.code === code && p.id !== input.id)) throw new ApiError(409, "That code is already used.");
  const { id: _id, ...rest } = input;
  void _id;
  const data = { ...rest, name: input.name.trim(), code };
  if (input.id) {
    const p = db.promotions.find((x) => x.id === input.id);
    if (!p) throw new ApiError(404, "Promotion not found.");
    Object.assign(p, data);
    commit(tenantId);
    return p;
  }
  const p: Promotion = { id: uid("promo"), tenantId, ...data, uses: 0 };
  db.promotions.push(p);
  commit(tenantId);
  return p;
}

export async function deletePromotion(
  tenantId: string,
  id: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await deletePromotionApi(tenantId, id);
    const db = tenantDb(tenantId);
    db.promotions = db.promotions.filter((p) => p.id !== id);
    commit(tenantId);
    return res;
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn(
        "Backend unavailable for deleting promotion, falling back to local DB"
      );
      const db = tenantDb(tenantId);
      db.promotions = db.promotions.filter((p) => p.id !== id);
      commit(tenantId);
      return { success: true, message: "Promotion deleted locally" };
    }
    throw err;
  }
}

// ---------- Tenant Roles & Permissions ----------
export async function getTenantRolesApi(
  tenantSlug: string
): Promise<Record<RoleId, Permission[]>> {
  try {
    const res = await backendFetch<any[]>(`/tenants/${tenantSlug}/roles`);
    if (Array.isArray(res)) {
      const result: Partial<Record<RoleId, Permission[]>> = {};
      for (const r of res) {
        const roleKey = r.role?.toLowerCase() as RoleId;
        if (roleKey && Array.isArray(r.permissions)) {
          result[roleKey] = r.permissions as Permission[];
        }
      }
      return {
        ...ROLE_PERMISSIONS,
        ...result,
      } as Record<RoleId, Permission[]>;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for roles, falling back to local defaults");
    } else {
      console.warn("Could not fetch tenant roles, using defaults", err);
    }
  }
  return { ...ROLE_PERMISSIONS };
}

export async function updateRolePermissionsApi(
  tenantSlug: string,
  role: RoleId,
  permissions: Permission[]
): Promise<any> {
  try {
    return await backendFetch(`/tenants/${tenantSlug}/roles/${role}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions }),
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable, simulated role update");
      return { success: true };
    }
    throw err;
  }
}

// ---------- Tenant Custom Roles Management ----------
export function getCustomRoles(tenantSlug: string): CustomRole[] {
  const roles = readJson<CustomRole[]>(storageKey("custom-roles", tenantSlug));
  return Array.isArray(roles) ? roles : [];
}

export function saveCustomRole(
  tenantSlug: string,
  roleInput: Omit<CustomRole, "id" | "isCustom" | "createdAt"> & { id?: string | undefined }
): CustomRole {
  const roles = getCustomRoles(tenantSlug);
  const now = new Date().toISOString();
  if (roleInput.id) {
    const idx = roles.findIndex((r) => r.id === roleInput.id);
    const existing = idx >= 0 ? roles[idx] : undefined;
    if (existing) {
      const updated: CustomRole = {
        id: existing.id,
        isCustom: true,
        createdAt: existing.createdAt,
        name: roleInput.name,
        baseRole: roleInput.baseRole,
        permissions: roleInput.permissions,
        description: roleInput.description,
        color: roleInput.color,
      };
      roles[idx] = updated;
      writeJson(storageKey("custom-roles", tenantSlug), roles);
      return updated;
    }
  }
  const newRole: CustomRole = {
    id: `crole_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: roleInput.name.trim(),
    description: roleInput.description?.trim(),
    color: roleInput.color || "purple",
    baseRole: roleInput.baseRole,
    permissions: Array.isArray(roleInput.permissions) ? roleInput.permissions : [],
    isCustom: true,
    createdAt: now,
  };
  roles.push(newRole);
  writeJson(storageKey("custom-roles", tenantSlug), roles);
  return newRole;
}

export function updateCustomRolePermissions(
  tenantSlug: string,
  roleId: string,
  permissions: Permission[]
): void {
  const roles = getCustomRoles(tenantSlug);
  const idx = roles.findIndex((r) => r.id === roleId);
  const target = idx >= 0 ? roles[idx] : undefined;
  if (target) {
    target.permissions = permissions;
    writeJson(storageKey("custom-roles", tenantSlug), roles);
  }
}

export function deleteCustomRole(tenantSlug: string, roleId: string): void {
  const roles = getCustomRoles(tenantSlug);
  const filtered = roles.filter((r) => r.id !== roleId);
  writeJson(storageKey("custom-roles", tenantSlug), filtered);
}

export function getStaffCustomRoles(tenantSlug: string): Record<string, string> {
  return readJson<Record<string, string>>(storageKey("staff-custom-roles", tenantSlug)) || {};
}

export function setStaffCustomRole(tenantSlug: string, staffId: string, customRoleName?: string): void {
  const map = getStaffCustomRoles(tenantSlug);
  if (customRoleName) {
    map[staffId] = customRoleName;
  } else {
    delete map[staffId];
  }
  writeJson(storageKey("staff-custom-roles", tenantSlug), map);
}

