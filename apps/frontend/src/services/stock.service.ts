import { ApiError, commit, latency, tenantDb, uid } from "@/mocks/db";
import { round2 } from "@/lib/pricing";
import { backendFetch } from "./api-client";
import type { Ingredient, MovementReason, StockCount, StockMovement } from "@/types/domain";
import type { TenantDb } from "@/mocks/seed";

// Stock operations. Future REST: /tenants/:tenantId/branches/:branchId/inventory/...

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Applies a stock change and records the movement. Shared by all stock-changing flows. */
export function applyMovement(db: TenantDb, ing: Ingredient, qty: number, reason: MovementReason, reference: string): StockMovement {
  ing.stock = r3(ing.stock + qty);
  const mv: StockMovement = {
    id: uid("mv"),
    tenantId: ing.tenantId,
    branchId: ing.branchId,
    ingredientId: ing.id,
    ingredientName: ing.name,
    qty: r3(qty),
    unit: ing.unit,
    reason,
    reference,
    createdAt: new Date().toISOString(),
  };
  db.movements.unshift(mv);
  return mv;
}

const findIng = (db: TenantDb, branchId: string, id: string) => {
  const ing = db.ingredients.find((i) => i.id === id && i.branchId === branchId);
  if (!ing) throw new ApiError(404, "Ingredient not found at this branch.");
  return ing;
};

export interface IngredientInput {
  id?: string | undefined;
  branchId: string;
  name: string;
  unit: string;
  reorderLevel: number;
  unitCost: number;
  openingStock?: number;
}

export async function saveIngredient(tenantId: string, input: IngredientInput): Promise<Ingredient> {
  const name = input.name.trim();
  if (!name || !input.unit.trim()) throw new ApiError(422, "Name and unit are required.");
  if (input.reorderLevel < 0 || input.unitCost < 0) throw new ApiError(422, "Values must be zero or more.");

  // Call backend API when creating a new ingredient
  if (!input.id) {
    try {
      const saved = await backendFetch<any>(`/tenants/${tenantId}/inventory/ingredients`, {
        method: "POST",
        body: JSON.stringify({
          name,
          unit: input.unit.trim(),
          costPerUnit: round2(input.unitCost),
          unitCost: round2(input.unitCost),
          branchId: input.branchId,
          openingStock: input.openingStock ? Number(input.openingStock) : 0,
          reorderLevel: Number(input.reorderLevel) || 0,
        }),
      });

      if (saved && saved.id) {
        const bStock = saved.branchStocks?.find((b: any) => b.branchId === input.branchId) ?? saved.branchStocks?.[0];
        const stock = bStock?.currentStock ?? input.openingStock ?? 0;
        const reorderLevel = bStock?.reorderLevel ?? input.reorderLevel ?? 0;
        const unitCost = bStock?.unitCost ?? saved.costPerUnit ?? input.unitCost ?? 0;

        const mapped: Ingredient = {
          id: saved.id,
          tenantId: saved.tenantId || tenantId,
          branchId: input.branchId,
          key: saved.id,
          name: saved.name,
          unit: saved.unit,
          stock: Number(stock) || 0,
          reorderLevel: Number(reorderLevel) || 0,
          unitCost: Number(unitCost) || 0,
        };

        const db = tenantDb(tenantId);
        const idx = db.ingredients.findIndex((x) => x.id === saved.id && x.branchId === input.branchId);
        if (idx >= 0) db.ingredients[idx] = mapped;
        else db.ingredients.push(mapped);
        commit(tenantId);
        return mapped;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        console.warn("Backend unavailable for creating ingredient, falling back to local DB");
      } else {
        throw err;
      }
    }
  }

  // Call backend API when updating an existing ingredient
  if (input.id) {
    try {
      const updated = await backendFetch<any>(`/tenants/${tenantId}/inventory/ingredients/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          unit: input.unit.trim(),
          costPerUnit: round2(input.unitCost),
          unitCost: round2(input.unitCost),
          branchId: input.branchId,
          reorderLevel: Number(input.reorderLevel) || 0,
        }),
      });

      if (updated && updated.id) {
        const db = tenantDb(tenantId);
        const bStock = updated.branchStocks?.find((b: any) => b.branchId === input.branchId) ?? updated.branchStocks?.[0];
        const stock = bStock?.currentStock ?? 0;
        const reorderLevel = bStock?.reorderLevel ?? input.reorderLevel ?? 0;
        const unitCost = bStock?.unitCost ?? updated.costPerUnit ?? input.unitCost ?? 0;

        const mapped: Ingredient = {
          id: updated.id,
          tenantId: updated.tenantId || tenantId,
          branchId: input.branchId,
          key: updated.id,
          name: updated.name || name,
          unit: updated.unit || input.unit.trim(),
          stock: Number(stock) || 0,
          reorderLevel: Number(reorderLevel) || 0,
          unitCost: Number(unitCost) || 0,
        };

        const idx = db.ingredients.findIndex((i) => i.id === input.id && i.branchId === input.branchId);
        if (idx >= 0) db.ingredients[idx] = mapped;
        else db.ingredients.push(mapped);
        commit(tenantId);
        return mapped;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        console.warn("Backend unavailable for updating ingredient, falling back to local DB");
      } else {
        throw err;
      }
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  if (input.id) {
    const ing = findIng(db, input.branchId, input.id);
    Object.assign(ing, { name, unit: input.unit.trim(), reorderLevel: input.reorderLevel, unitCost: round2(input.unitCost) });
    commit(tenantId);
    return ing;
  }
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (db.ingredients.some((i) => i.branchId === input.branchId && i.key === key)) throw new ApiError(409, "This ingredient already exists at this branch.");
  const ing: Ingredient = { id: uid("ing"), tenantId, branchId: input.branchId, key, name, unit: input.unit.trim(), stock: 0, reorderLevel: input.reorderLevel, unitCost: round2(input.unitCost) };
  db.ingredients.push(ing);
  if (input.openingStock && input.openingStock > 0) applyMovement(db, ing, input.openingStock, "adjustment", "Opening stock");
  commit(tenantId);
  return ing;
}

export async function deleteIngredient(tenantId: string, id: string, branchId?: string): Promise<{ ok: true }> {
  try {
    await backendFetch<any>(`/tenants/${tenantId}/inventory/ingredients/${id}`, {
      method: "DELETE",
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for deleting ingredient, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  db.ingredients = db.ingredients.filter((i) => !(i.id === id && (!branchId || i.branchId === branchId)));
  commit(tenantId);
  return { ok: true };
}

export interface AdjustmentInput {
  branchId: string;
  ingredientId: string;
  direction: "add" | "remove";
  reason: "adjustment" | "waste";
  qty: number;
  note: string;
}

export async function adjustStock(tenantId: string, input: AdjustmentInput): Promise<Ingredient> {
  await latency();
  const db = tenantDb(tenantId);
  const ing = findIng(db, input.branchId, input.ingredientId);
  if (!(input.qty > 0)) throw new ApiError(422, "Enter a quantity greater than zero.");
  const signed = input.direction === "add" && input.reason !== "waste" ? input.qty : -input.qty;
  if (ing.stock + signed < 0) throw new ApiError(422, `Only ${ing.stock} ${ing.unit} on hand.`);
  applyMovement(db, ing, signed, input.reason, input.note.trim() || (input.reason === "waste" ? "Waste" : "Manual adjustment"));
  commit(tenantId);
  return ing;
}

export async function listStockCounts(tenantId: string, branchId: string): Promise<StockCount[]> {
  await latency();
  return tenantDb(tenantId).stockCounts.filter((c) => c.branchId === branchId);
}

export async function submitStockCount(
  tenantId: string,
  input: { branchId: string; counts: { ingredientId: string; counted: number }[]; notes: string; createdBy: string },
): Promise<StockCount> {
  await latency(300, 600);
  const db = tenantDb(tenantId);
  if (!input.counts.length) throw new ApiError(422, "Count at least one ingredient.");
  if (input.counts.some((c) => !Number.isFinite(c.counted) || c.counted < 0)) throw new ApiError(422, "Counts must be zero or more.");
  db.docSeq += 1;
  const number = `SC-${db.docSeq}`;
  const lines = input.counts.map((c) => {
    const ing = findIng(db, input.branchId, c.ingredientId);
    const expected = ing.stock;
    const variance = r3(c.counted - expected);
    if (variance !== 0) applyMovement(db, ing, variance, "count", number);
    return { ingredientId: ing.id, name: ing.name, unit: ing.unit, expected, counted: c.counted, variance };
  });
  const count: StockCount = { id: uid("sc"), tenantId, branchId: input.branchId, number, lines, notes: input.notes.trim(), createdBy: input.createdBy, createdAt: new Date().toISOString() };
  db.stockCounts.unshift(count);
  commit(tenantId);
  return count;
}
