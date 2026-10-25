import { ApiError, commit, latency, tenantDb, uid } from "@/mocks/db";
import { round2 } from "@/lib/pricing";
import { backendFetch } from "./api-client";
import { applyMovement } from "./stock.service";
import type { GoodsReceipt, PurchaseOrder, PurchaseOrderStatus, Supplier, SupplierReturn } from "@/types/domain";

// Suppliers, purchase orders, goods receiving and supplier returns.
// Future REST: /tenants/:tenantId/suppliers, /purchase-orders, /goods-receipts, /supplier-returns

// ---------- Suppliers ----------
export interface SupplierFilters {
  search?: string;
  activeOnly?: boolean;
}

export async function listSuppliers(tenantId: string, filters?: SupplierFilters): Promise<Supplier[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.activeOnly !== undefined) params.append("activeOnly", String(filters.activeOnly));
    const qs = params.toString() ? `?${params.toString()}` : "";

    const backendSuppliers = await backendFetch<any[]>(`/tenants/${tenantId}/suppliers${qs}`);
    if (Array.isArray(backendSuppliers)) {
      const mappedList: Supplier[] = backendSuppliers.map((s) => ({
        id: s.id,
        tenantId: s.tenantId || tenantId,
        name: s.name,
        contact: s.contact ?? "",
        phone: s.phone ?? "",
        email: s.email ?? "",
        supplies: s.supplies ?? "",
        paymentTerms: s.paymentTerms ?? "Net 14",
        active: s.active ?? true,
      }));
      const db = tenantDb(tenantId);
      db.suppliers = mappedList;
      commit(tenantId);
      return mappedList;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch suppliers from backend, using local store:", err);
    }
  }

  await latency();
  let suppliers = tenantDb(tenantId).suppliers;
  if (filters?.search) {
    const q = filters.search.trim().toLowerCase();
    suppliers = suppliers.filter((s) => `${s.name} ${s.contact} ${s.supplies}`.toLowerCase().includes(q));
  }
  if (filters?.activeOnly !== undefined) {
    suppliers = suppliers.filter((s) => s.active === filters.activeOnly);
  }
  return suppliers;
}

export async function getSupplier(tenantId: string, id: string): Promise<Supplier> {
  try {
    const backendSupplier = await backendFetch<any>(`/tenants/${tenantId}/suppliers/${id}`);
    if (backendSupplier && backendSupplier.id) {
      const mapped: Supplier = {
        id: backendSupplier.id,
        tenantId: backendSupplier.tenantId || tenantId,
        name: backendSupplier.name,
        contact: backendSupplier.contact ?? "",
        phone: backendSupplier.phone ?? "",
        email: backendSupplier.email ?? "",
        supplies: backendSupplier.supplies ?? "",
        paymentTerms: backendSupplier.paymentTerms ?? "Net 14",
        active: backendSupplier.active ?? true,
      };
      const db = tenantDb(tenantId);
      const idx = db.suppliers.findIndex((x) => x.id === id);
      if (idx >= 0) db.suppliers[idx] = mapped;
      else db.suppliers.push(mapped);
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch supplier from backend, using local store:", err);
    }
  }

  await latency();
  const s = tenantDb(tenantId).suppliers.find((x) => x.id === id);
  if (!s) throw new ApiError(404, "Supplier not found.");
  return s;
}

export type SupplierInput = Omit<Supplier, "id" | "tenantId"> & { id?: string | undefined };

export async function saveSupplier(tenantId: string, input: SupplierInput): Promise<Supplier> {
  const name = input.name.trim();
  if (!name) throw new ApiError(422, "Name is required.");

  // Call backend API when creating a new supplier
  if (!input.id) {
    try {
      const saved = await backendFetch<any>(`/tenants/${tenantId}/suppliers`, {
        method: "POST",
        body: JSON.stringify({
          name,
          contact: input.contact?.trim() || "",
          phone: input.phone?.trim() || "",
          email: input.email?.trim() || undefined,
          supplies: input.supplies?.trim() || "",
          paymentTerms: input.paymentTerms?.trim() || "Net 14",
          active: input.active !== undefined ? input.active : true,
        }),
      });

      if (saved && saved.id) {
        const mapped: Supplier = {
          id: saved.id,
          tenantId: saved.tenantId || tenantId,
          name: saved.name,
          contact: saved.contact ?? "",
          phone: saved.phone ?? "",
          email: saved.email ?? "",
          supplies: saved.supplies ?? "",
          paymentTerms: saved.paymentTerms ?? "Net 14",
          active: saved.active ?? true,
        };

        const db = tenantDb(tenantId);
        const idx = db.suppliers.findIndex((x) => x.id === saved.id);
        if (idx >= 0) db.suppliers[idx] = mapped;
        else db.suppliers.push(mapped);
        commit(tenantId);
        return mapped;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        console.warn("Backend unavailable for creating supplier, falling back to local DB");
      } else {
        throw err;
      }
    }
  }

  // Call backend API when updating an existing supplier
  if (input.id) {
    try {
      const updated = await backendFetch<any>(`/tenants/${tenantId}/suppliers/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          contact: input.contact?.trim() || "",
          phone: input.phone?.trim() || "",
          email: input.email?.trim() || undefined,
          supplies: input.supplies?.trim() || "",
          paymentTerms: input.paymentTerms?.trim() || "Net 14",
          active: input.active !== undefined ? input.active : true,
        }),
      });

      if (updated && updated.id) {
        const mapped: Supplier = {
          id: updated.id,
          tenantId: updated.tenantId || tenantId,
          name: updated.name || name,
          contact: updated.contact ?? "",
          phone: updated.phone ?? "",
          email: updated.email ?? "",
          supplies: updated.supplies ?? "",
          paymentTerms: updated.paymentTerms ?? "Net 14",
          active: updated.active ?? true,
        };

        const db = tenantDb(tenantId);
        const idx = db.suppliers.findIndex((x) => x.id === input.id);
        if (idx >= 0) db.suppliers[idx] = mapped;
        else db.suppliers.push(mapped);
        commit(tenantId);
        return mapped;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        console.warn("Backend unavailable for updating supplier, falling back to local DB");
      } else {
        throw err;
      }
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  if (db.suppliers.some((s) => s.name.toLowerCase() === name.toLowerCase() && s.id !== input.id)) throw new ApiError(409, "A supplier with this name already exists.");
  const { id: _id, ...rest } = input;
  void _id;
  const data = { ...rest, name, contact: input.contact.trim(), phone: input.phone.trim(), email: input.email.trim(), supplies: input.supplies.trim(), paymentTerms: input.paymentTerms.trim() };
  if (input.id) {
    const s = db.suppliers.find((x) => x.id === input.id);
    if (!s) throw new ApiError(404, "Supplier not found.");
    Object.assign(s, data);
    commit(tenantId);
    return s;
  }
  const s: Supplier = { id: uid("sup"), tenantId, ...data };
  db.suppliers.push(s);
  commit(tenantId);
  return s;
}

export async function deleteSupplier(tenantId: string, id: string): Promise<{ ok: true }> {
  try {
    await backendFetch(`/tenants/${tenantId}/suppliers/${id}`, {
      method: "DELETE",
    });
    const db = tenantDb(tenantId);
    db.suppliers = db.suppliers.filter((s) => s.id !== id);
    commit(tenantId);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for deleting supplier, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  const idx = db.suppliers.findIndex((s) => s.id === id);
  if (idx === -1) throw new ApiError(404, "Supplier not found.");
  db.suppliers.splice(idx, 1);
  commit(tenantId);
  return { ok: true };
}

// ---------- Purchase orders ----------
export interface PurchaseOrderFilters {
  branchId?: string;
  supplierId?: string;
  status?: string;
  search?: string;
}

function mapBackendPurchaseOrder(p: any, tenantId: string, fallbackBranchId = ""): PurchaseOrder {
  return {
    id: p.id,
    tenantId: p.tenantId || p.restaurantId || tenantId,
    branchId: p.branchId || fallbackBranchId,
    number: p.number || p.poNumber || "",
    supplierId: p.supplierId || p.supplier?.id || "",
    supplierName: p.supplierName || p.supplier?.name || "",
    status: (p.status || "draft").toLowerCase() as PurchaseOrderStatus,
    lines: (p.lines || p.items || []).map((l: any) => ({
      ingredientId: l.ingredientId,
      name: l.name || l.ingredient?.name || "",
      unit: l.unit || l.ingredient?.unit || "",
      qty: Number(l.qty ?? l.quantity ?? 0),
      unitCost: Number(l.unitCost ?? 0),
      receivedQty: Number(l.receivedQty ?? 0),
    })),
    notes: p.notes || "",
    expectedDate: p.expectedDate || (p.expectedAt ? new Date(p.expectedAt).toISOString().slice(0, 10) : ""),
    total: Number(p.total ?? p.totalAmount ?? 0),
    createdBy: p.createdBy || p.createdById || "",
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
    sentAt: p.sentAt ? new Date(p.sentAt).toISOString() : null,
  };
}

export async function listPurchaseOrders(
  tenantId: string,
  branchIdOrFilters?: string | PurchaseOrderFilters,
): Promise<PurchaseOrder[]> {
  const filters: PurchaseOrderFilters =
    typeof branchIdOrFilters === "string"
      ? { branchId: branchIdOrFilters }
      : (branchIdOrFilters ?? {});

  try {
    const params = new URLSearchParams();
    if (filters.branchId) params.append("branchId", filters.branchId);
    if (filters.supplierId) params.append("supplierId", filters.supplierId);
    if (filters.status && filters.status !== "all") params.append("status", filters.status.toUpperCase());
    if (filters.search) params.append("search", filters.search);
    const qs = params.toString() ? `?${params.toString()}` : "";

    const backendPOs = await backendFetch<any[]>(`/tenants/${tenantId}/purchase-orders${qs}`);
    if (Array.isArray(backendPOs)) {
      const mappedList = backendPOs.map((p) => mapBackendPurchaseOrder(p, tenantId, filters.branchId));
      const db = tenantDb(tenantId);
      for (const po of mappedList) {
        const idx = db.purchaseOrders.findIndex((x) => x.id === po.id);
        if (idx >= 0) db.purchaseOrders[idx] = po;
        else db.purchaseOrders.push(po);
      }
      commit(tenantId);
      return mappedList;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch purchase orders from backend, using local store:", err);
    }
  }

  await latency();
  return tenantDb(tenantId)
    .purchaseOrders.filter((p) => !filters.branchId || p.branchId === filters.branchId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPurchaseOrder(tenantId: string, id: string): Promise<PurchaseOrder> {
  try {
    const p = await backendFetch<any>(`/tenants/${tenantId}/purchase-orders/${id}`);
    if (p && p.id) {
      const mapped = mapBackendPurchaseOrder(p, tenantId);
      const db = tenantDb(tenantId);
      const idx = db.purchaseOrders.findIndex((x) => x.id === id);
      if (idx >= 0) db.purchaseOrders[idx] = mapped;
      else db.purchaseOrders.push(mapped);
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch purchase order from backend, using local store:", err);
    }
  }

  await latency();
  const po = tenantDb(tenantId).purchaseOrders.find((x) => x.id === id);
  if (!po) throw new ApiError(404, "Purchase order not found.");
  return po;
}

export interface PurchaseOrderInput {
  id?: string | undefined;
  branchId: string;
  supplierId: string;
  expectedDate: string;
  notes: string;
  lines: { ingredientId: string; qty: number; unitCost: number }[];
  createdBy: string;
}

export async function savePurchaseOrder(tenantId: string, input: PurchaseOrderInput): Promise<PurchaseOrder> {
  const validLines = input.lines.filter((l) => l.qty > 0);

  // Call backend API when creating a new purchase order
  if (!input.id) {
    try {
      const created = await backendFetch<any>(`/tenants/${tenantId}/purchase-orders`, {
        method: "POST",
        body: JSON.stringify({
          branchId: input.branchId,
          supplierId: input.supplierId,
          expectedDate: input.expectedDate ? new Date(input.expectedDate).toISOString() : undefined,
          notes: input.notes?.trim() || undefined,
          lines: validLines.map((l) => ({
            ingredientId: l.ingredientId,
            quantity: Number(l.qty),
            unitCost: Number(l.unitCost),
          })),
        }),
      });

      if (created && created.id) {
        const mapped = mapBackendPurchaseOrder(created, tenantId, input.branchId);
        const db = tenantDb(tenantId);
        const idx = db.purchaseOrders.findIndex((x) => x.id === created.id);
        if (idx >= 0) db.purchaseOrders[idx] = mapped;
        else db.purchaseOrders.push(mapped);
        commit(tenantId);
        return mapped;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        console.warn("Backend unavailable for creating purchase order, falling back to local DB");
      } else {
        throw err;
      }
    }
  }

  // Call backend API when updating an existing purchase order
  if (input.id) {
    try {
      const updated = await backendFetch<any>(`/tenants/${tenantId}/purchase-orders/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({
          branchId: input.branchId,
          supplierId: input.supplierId,
          expectedDate: input.expectedDate ? new Date(input.expectedDate).toISOString() : undefined,
          notes: input.notes?.trim() || undefined,
          lines: validLines.map((l) => ({
            ingredientId: l.ingredientId,
            quantity: Number(l.qty),
            unitCost: Number(l.unitCost),
          })),
        }),
      });

      if (updated && updated.id) {
        const mapped = mapBackendPurchaseOrder(updated, tenantId, input.branchId);
        const db = tenantDb(tenantId);
        const idx = db.purchaseOrders.findIndex((x) => x.id === input.id);
        if (idx >= 0) db.purchaseOrders[idx] = mapped;
        else db.purchaseOrders.push(mapped);
        commit(tenantId);
        return mapped;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        console.warn("Backend unavailable for updating purchase order, falling back to local DB");
      } else {
        throw err;
      }
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  const sup = db.suppliers.find((s) => s.id === input.supplierId);
  if (!sup) throw new ApiError(422, "Choose a supplier.");
  if (!sup.active) throw new ApiError(422, "This supplier is inactive.");
  const lines = input.lines
    .filter((l) => l.qty > 0)
    .map((l) => {
      const ing = db.ingredients.find((i) => i.id === l.ingredientId && i.branchId === input.branchId);
      if (!ing) throw new ApiError(422, "Unknown ingredient on this order.");
      if (l.unitCost < 0) throw new ApiError(422, "Unit cost must be zero or more.");
      return { ingredientId: ing.id, name: ing.name, unit: ing.unit, qty: l.qty, unitCost: round2(l.unitCost), receivedQty: 0 };
    });
  if (!lines.length) throw new ApiError(422, "Add at least one line with a quantity.");
  if (new Set(lines.map((l) => l.ingredientId)).size !== lines.length) throw new ApiError(422, "Each ingredient can appear only once.");
  const total = round2(lines.reduce((s, l) => s + l.qty * l.unitCost, 0));
  if (input.id) {
    const po = db.purchaseOrders.find((p) => p.id === input.id);
    if (!po) throw new ApiError(404, "Purchase order not found.");
    if (po.status !== "draft") throw new ApiError(409, "Only draft orders can be edited.");
    Object.assign(po, { supplierId: sup.id, supplierName: sup.name, lines, total, expectedDate: input.expectedDate, notes: input.notes.trim() });
    commit(tenantId);
    return po;
  }
  db.docSeq += 1;
  const po: PurchaseOrder = {
    id: uid("po"),
    tenantId,
    branchId: input.branchId,
    number: `PO-${db.docSeq}`,
    supplierId: sup.id,
    supplierName: sup.name,
    status: "draft",
    lines,
    notes: input.notes.trim(),
    expectedDate: input.expectedDate,
    total,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    sentAt: null,
  };
  db.purchaseOrders.push(po);
  commit(tenantId);
  return po;
}

export async function setPurchaseOrderStatus(tenantId: string, id: string, status: "sent" | "cancelled"): Promise<PurchaseOrder> {
  try {
    const updated = await backendFetch<any>(`/tenants/${tenantId}/purchase-orders/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        status: status.toUpperCase(),
      }),
    });
    if (updated && updated.id) {
      const mapped = mapBackendPurchaseOrder(updated, tenantId);
      const db = tenantDb(tenantId);
      const idx = db.purchaseOrders.findIndex((x) => x.id === id);
      if (idx >= 0) db.purchaseOrders[idx] = mapped;
      else db.purchaseOrders.push(mapped);
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for setting purchase order status, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency();
  const po = tenantDb(tenantId).purchaseOrders.find((x) => x.id === id);
  if (!po) throw new ApiError(404, "Purchase order not found.");
  if (status === "sent" && po.status !== "draft") throw new ApiError(409, "Only drafts can be sent.");
  if (status === "cancelled" && !["draft", "sent"].includes(po.status)) throw new ApiError(409, "Orders with received goods can't be cancelled.");
  po.status = status;
  if (status === "sent") po.sentAt = new Date().toISOString();
  commit(tenantId);
  return po;
}

export async function deletePurchaseOrder(tenantId: string, id: string): Promise<{ ok: true }> {
  try {
    await backendFetch(`/tenants/${tenantId}/purchase-orders/${id}`, {
      method: "DELETE",
    });
    const db = tenantDb(tenantId);
    const po = db.purchaseOrders.find((p) => p.id === id);
    if (po) po.status = "cancelled";
    commit(tenantId);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for deleting purchase order, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  const po = db.purchaseOrders.find((p) => p.id === id);
  if (!po) throw new ApiError(404, "Purchase order not found.");
  if (!["draft", "sent"].includes(po.status)) throw new ApiError(409, "Orders with received goods can't be cancelled.");
  po.status = "cancelled";
  commit(tenantId);
  return { ok: true };
}

// ---------- Receiving ----------
export interface GoodsReceiptFilters {
  branchId?: string;
  supplierId?: string;
  poId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface ReceiveGoodsInput {
  poId: string;
  lines: { ingredientId: string; qty: number; unitCost: number }[];
  receivedBy: string;
  notes?: string;
}

function mapBackendGoodsReceipt(r: any, tenantId: string, fallbackBranchId = ""): GoodsReceipt {
  return {
    id: r.id,
    tenantId: r.tenantId || tenantId,
    branchId: r.branchId || fallbackBranchId,
    number: r.number || "",
    poId: r.poId || "",
    poNumber: r.poNumber || r.purchaseOrder?.poNumber || "",
    supplierName: r.supplierName || r.supplier?.name || "",
    lines: (r.lines || []).map((l: any) => ({
      ingredientId: l.ingredientId,
      name: l.name || l.ingredient?.name || "",
      unit: l.unit || l.ingredient?.unit || "",
      qty: Number(l.qty ?? 0),
      unitCost: Number(l.unitCost ?? 0),
    })),
    receivedBy: r.receivedBy || "Staff",
    receivedAt: r.receivedAt ? new Date(r.receivedAt).toISOString() : new Date().toISOString(),
  };
}

export async function listReceipts(
  tenantId: string,
  branchIdOrFilters?: string | GoodsReceiptFilters,
): Promise<GoodsReceipt[]> {
  const filters: GoodsReceiptFilters =
    typeof branchIdOrFilters === "string"
      ? { branchId: branchIdOrFilters }
      : (branchIdOrFilters ?? {});

  try {
    const params = new URLSearchParams();
    if (filters.branchId) params.append("branchId", filters.branchId);
    if (filters.supplierId) params.append("supplierId", filters.supplierId);
    if (filters.poId) params.append("poId", filters.poId);
    if (filters.search) params.append("search", filters.search);
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);
    const qs = params.toString() ? `?${params.toString()}` : "";

    const backendReceipts = await backendFetch<any[]>(`/tenants/${tenantId}/goods-receipts${qs}`);
    if (Array.isArray(backendReceipts)) {
      const mappedList = backendReceipts.map((r) => mapBackendGoodsReceipt(r, tenantId, filters.branchId));
      const db = tenantDb(tenantId);
      for (const grn of mappedList) {
        const idx = db.receipts.findIndex((x) => x.id === grn.id);
        if (idx >= 0) db.receipts[idx] = grn;
        else db.receipts.unshift(grn);
      }
      commit(tenantId);
      return mappedList;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch goods receipts from backend, using local store:", err);
    }
  }

  await latency();
  return tenantDb(tenantId).receipts.filter((r) => !filters.branchId || r.branchId === filters.branchId);
}

export async function getGoodsReceipt(tenantId: string, id: string): Promise<GoodsReceipt> {
  try {
    const r = await backendFetch<any>(`/tenants/${tenantId}/goods-receipts/${id}`);
    if (r && r.id) {
      const mapped = mapBackendGoodsReceipt(r, tenantId);
      const db = tenantDb(tenantId);
      const idx = db.receipts.findIndex((x) => x.id === id);
      if (idx >= 0) db.receipts[idx] = mapped;
      else db.receipts.unshift(mapped);
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch goods receipt from backend, using local store:", err);
    }
  }

  await latency();
  const receipt = tenantDb(tenantId).receipts.find((r) => r.id === id);
  if (!receipt) throw new ApiError(404, "Goods receipt not found.");
  return receipt;
}

export async function listAwaitingOrders(tenantId: string, branchId?: string): Promise<any[]> {
  try {
    const qs = branchId ? `?branchId=${branchId}` : "";
    const backendAwaiting = await backendFetch<any[]>(`/tenants/${tenantId}/goods-receipts/awaiting-orders${qs}`);
    if (Array.isArray(backendAwaiting)) {
      return backendAwaiting;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch awaiting orders from backend, using local store:", err);
    }
  }

  await latency();
  return tenantDb(tenantId)
    .purchaseOrders.filter((p) => (!branchId || p.branchId === branchId) && ["sent", "partial"].includes(p.status));
}

export async function receiveGoods(
  tenantId: string,
  input: ReceiveGoodsInput,
): Promise<GoodsReceipt> {
  const lines = input.lines.filter((l) => l.qty > 0);
  if (!lines.length) throw new ApiError(422, "Enter a received quantity for at least one line.");

  try {
    const created = await backendFetch<any>(`/tenants/${tenantId}/goods-receipts`, {
      method: "POST",
      body: JSON.stringify({
        poId: input.poId,
        receivedBy: input.receivedBy,
        notes: input.notes?.trim() || undefined,
        lines: lines.map((l) => ({
          ingredientId: l.ingredientId,
          qty: Number(l.qty),
          unitCost: Number(l.unitCost),
        })),
      }),
    });

    if (created && created.id) {
      const mapped = mapBackendGoodsReceipt(created, tenantId);
      const db = tenantDb(tenantId);
      const idx = db.receipts.findIndex((x) => x.id === created.id);
      if (idx >= 0) db.receipts[idx] = mapped;
      else db.receipts.unshift(mapped);

      // Also update local purchase order state if cached in db
      const localPo = db.purchaseOrders.find((p) => p.id === input.poId);
      if (localPo) {
        for (const line of lines) {
          const pl = localPo.lines.find((x) => x.ingredientId === line.ingredientId);
          if (pl) pl.receivedQty = Math.round((pl.receivedQty + line.qty) * 1000) / 1000;
        }
        localPo.status = localPo.lines.every((l) => l.receivedQty >= l.qty) ? "received" : "partial";
      }

      // Also sync local ingredient unitCost & movement
      for (const line of lines) {
        const ing = db.ingredients.find((i) => i.id === line.ingredientId && (!localPo || i.branchId === localPo.branchId));
        if (ing) {
          ing.unitCost = round2(line.unitCost);
          applyMovement(db, ing, line.qty, "purchase", `${mapped.number} / ${mapped.poNumber}`);
        }
      }

      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for receiving goods, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency(300, 600);
  const db = tenantDb(tenantId);
  const po = db.purchaseOrders.find((p) => p.id === input.poId);
  if (!po) throw new ApiError(404, "Purchase order not found.");
  if (!["sent", "partial"].includes(po.status)) throw new ApiError(409, "Only sent orders can be received.");
  db.docSeq += 1;
  const number = `GRN-${db.docSeq}`;
  const received = lines.map((l) => {
    const pl = po.lines.find((x) => x.ingredientId === l.ingredientId);
    if (!pl) throw new ApiError(422, "Line isn't on this purchase order.");
    const remaining = pl.qty - pl.receivedQty;
    if (l.qty > remaining + 1e-9) throw new ApiError(422, `${pl.name}: only ${remaining} ${pl.unit} left to receive.`);
    const ing = db.ingredients.find((i) => i.id === l.ingredientId && i.branchId === po.branchId);
    if (!ing) throw new ApiError(422, `${pl.name} no longer exists at this branch.`);
    pl.receivedQty = Math.round((pl.receivedQty + l.qty) * 1000) / 1000;
    ing.unitCost = round2(l.unitCost);
    applyMovement(db, ing, l.qty, "purchase", `${number} / ${po.number}`);
    return { ingredientId: ing.id, name: ing.name, unit: ing.unit, qty: l.qty, unitCost: round2(l.unitCost) };
  });
  po.status = po.lines.every((l) => l.receivedQty >= l.qty) ? "received" : "partial";
  const grn: GoodsReceipt = { id: uid("grn"), tenantId, branchId: po.branchId, number, poId: po.id, poNumber: po.number, supplierName: po.supplierName, lines: received, receivedBy: input.receivedBy, receivedAt: new Date().toISOString() };
  db.receipts.unshift(grn);
  commit(tenantId);
  return grn;
}

// ---------- Supplier returns ----------
export interface SupplierReturnFilters {
  branchId?: string;
  supplierId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface CreateSupplierReturnInput {
  branchId: string;
  supplierId: string;
  reason: string;
  lines: { ingredientId: string; qty: number; unitCost?: number }[];
  createdBy?: string;
}

function mapBackendSupplierReturn(backend: any, tenantId: string): SupplierReturn {
  return {
    id: backend.id,
    tenantId: backend.tenantId || tenantId,
    branchId: backend.branchId,
    number: backend.number,
    supplierId: backend.supplierId,
    supplierName: backend.supplierName || backend.supplier?.name || "Supplier",
    reason: backend.reason || "",
    credit: Number(backend.credit) || 0,
    createdBy: backend.createdBy || "Staff",
    createdAt: backend.createdAt ? new Date(backend.createdAt).toISOString() : new Date().toISOString(),
    lines: Array.isArray(backend.lines)
      ? backend.lines.map((l: any) => ({
          id: l.id,
          ingredientId: l.ingredientId,
          name: l.name || l.ingredient?.name || "",
          unit: l.unit || l.ingredient?.unit || "",
          qty: Number(l.qty) || 0,
          unitCost: Number(l.unitCost) || 0,
        }))
      : [],
  };
}

export async function listSupplierReturns(
  tenantId: string,
  branchIdOrFilters?: string | SupplierReturnFilters,
): Promise<SupplierReturn[]> {
  const filters: SupplierReturnFilters =
    typeof branchIdOrFilters === "string"
      ? { branchId: branchIdOrFilters }
      : branchIdOrFilters || {};

  try {
    const params = new URLSearchParams();
    if (filters.branchId) params.append("branchId", filters.branchId);
    if (filters.supplierId) params.append("supplierId", filters.supplierId);
    if (filters.search) params.append("search", filters.search);
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);

    const qs = params.toString() ? `?${params.toString()}` : "";
    const backendReturns = await backendFetch<any[]>(`/tenants/${tenantId}/supplier-returns${qs}`);
    if (Array.isArray(backendReturns)) {
      const mappedList = backendReturns.map((r) => mapBackendSupplierReturn(r, tenantId));
      const db = tenantDb(tenantId);
      for (const rtn of mappedList) {
        const idx = db.supplierReturns.findIndex((x) => x.id === rtn.id);
        if (idx >= 0) db.supplierReturns[idx] = rtn;
        else db.supplierReturns.unshift(rtn);
      }
      commit(tenantId);
      return mappedList;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch supplier returns from backend, using local store:", err);
    }
  }

  await latency();
  return tenantDb(tenantId).supplierReturns.filter((r) => {
    if (filters.branchId && r.branchId !== filters.branchId) return false;
    if (filters.supplierId && r.supplierId !== filters.supplierId) return false;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const match =
        r.number.toLowerCase().includes(s) ||
        r.reason.toLowerCase().includes(s) ||
        r.supplierName.toLowerCase().includes(s) ||
        r.createdBy.toLowerCase().includes(s);
      if (!match) return false;
    }
    return true;
  });
}

export async function getSupplierReturn(tenantId: string, id: string): Promise<SupplierReturn> {
  try {
    const r = await backendFetch<any>(`/tenants/${tenantId}/supplier-returns/${id}`);
    if (r && r.id) {
      const mapped = mapBackendSupplierReturn(r, tenantId);
      const db = tenantDb(tenantId);
      const idx = db.supplierReturns.findIndex((x) => x.id === id);
      if (idx >= 0) db.supplierReturns[idx] = mapped;
      else db.supplierReturns.unshift(mapped);
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch supplier return from backend, using local store:", err);
    }
  }

  await latency();
  const rtn = tenantDb(tenantId).supplierReturns.find((r) => r.id === id);
  if (!rtn) throw new ApiError(404, "Supplier return not found.");
  return rtn;
}

export async function createSupplierReturn(
  tenantId: string,
  input: CreateSupplierReturnInput,
): Promise<SupplierReturn> {
  const lines = input.lines.filter((l) => l.qty > 0);
  if (!lines.length) throw new ApiError(422, "Add at least one item to return.");
  if (!input.reason.trim()) throw new ApiError(422, "Give a reason for the return.");
  if (!input.supplierId) throw new ApiError(422, "Choose a supplier.");

  try {
    const created = await backendFetch<any>(`/tenants/${tenantId}/supplier-returns`, {
      method: "POST",
      body: JSON.stringify({
        branchId: input.branchId,
        supplierId: input.supplierId,
        reason: input.reason.trim(),
        createdBy: input.createdBy || undefined,
        lines: lines.map((l) => ({
          ingredientId: l.ingredientId,
          qty: Number(l.qty),
          unitCost: l.unitCost !== undefined ? Number(l.unitCost) : undefined,
        })),
      }),
    });

    if (created && created.id) {
      const mapped = mapBackendSupplierReturn(created, tenantId);
      const db = tenantDb(tenantId);
      const idx = db.supplierReturns.findIndex((x) => x.id === created.id);
      if (idx >= 0) db.supplierReturns[idx] = mapped;
      else db.supplierReturns.unshift(mapped);

      // Deduct local ingredient stock & log movement in local db
      const sup = db.suppliers.find((s) => s.id === input.supplierId);
      const supName = sup ? sup.name : mapped.supplierName;
      for (const line of mapped.lines) {
        const ing = db.ingredients.find((i) => i.id === line.ingredientId && i.branchId === input.branchId);
        if (ing) {
          applyMovement(db, ing, -line.qty, "return", `${mapped.number} → ${supName}`);
        }
      }

      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for supplier return, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency(300, 600);
  const db = tenantDb(tenantId);
  const sup = db.suppliers.find((s) => s.id === input.supplierId);
  if (!sup) throw new ApiError(422, "Choose a supplier.");
  const ings = lines.map((l) => {
    const ing = db.ingredients.find((i) => i.id === l.ingredientId && i.branchId === input.branchId);
    if (!ing) throw new ApiError(422, "Unknown ingredient.");
    if (l.qty > ing.stock) throw new ApiError(422, `${ing.name}: only ${ing.stock} ${ing.unit} on hand.`);
    return { ing, qty: l.qty };
  });
  db.docSeq += 1;
  const number = `RTN-${db.docSeq}`;
  const out = ings.map(({ ing, qty }) => {
    applyMovement(db, ing, -qty, "return", `${number} → ${sup.name}`);
    return { ingredientId: ing.id, name: ing.name, unit: ing.unit, qty, unitCost: ing.unitCost };
  });
  const rtn: SupplierReturn = {
    id: uid("rtn"),
    tenantId,
    branchId: input.branchId,
    number,
    supplierId: sup.id,
    supplierName: sup.name,
    lines: out,
    reason: input.reason.trim(),
    credit: round2(out.reduce((s, l) => s + l.qty * l.unitCost, 0)),
    createdBy: input.createdBy || "Staff",
    createdAt: new Date().toISOString(),
  };
  db.supplierReturns.unshift(rtn);
  commit(tenantId);
  return rtn;
}
