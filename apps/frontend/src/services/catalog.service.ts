import { ApiError, commit, latency, tenantDb, uid } from "@/mocks/db";
import { round2 } from "@/lib/pricing";
import { backendFetch } from "./api-client";
import type { Category, Combo, Ingredient, MenuItem, ModifierGroup, RecipeLine } from "@/types/domain";

// Menu catalog: categories, items (variants/modifiers), modifier groups, combos, recipes.
// Future REST: /tenants/:tenantId/menu/...

const nonEmpty = (s: string, field: string) => {
  if (!s.trim()) throw new ApiError(422, `${field} is required.`);
  return s.trim();
};
const nonNegative = (n: number, field: string) => {
  if (!Number.isFinite(n) || n < 0) throw new ApiError(422, `${field} must be zero or more.`);
  return round2(n);
};

// ---------- Categories ----------
export async function saveCategory(tenantId: string, input: { id?: string | undefined; name: string }): Promise<Category> {
  const name = nonEmpty(input.name, "Name");

  // Call backend API when creating a new category
  if (!input.id) {
    try {
      const saved = await backendFetch<Category>(`/tenants/${tenantId}/categories`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });

      if (saved && saved.id) {
        const db = tenantDb(tenantId);
        const mapped: Category = {
          id: saved.id,
          tenantId: saved.tenantId || tenantId,
          name: saved.name,
          sort: saved.sort ?? db.categories.length,
        };
        db.categories.push(mapped);
        commit(tenantId);
        return mapped;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        console.warn("Backend unavailable for saving category, falling back to local DB");
      } else {
        throw err;
      }
    }
  }

  // Call backend API when updating an existing category
  if (input.id) {
    try {
      const updated = await backendFetch<Category>(`/tenants/${tenantId}/categories/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      });

      if (updated) {
        const db = tenantDb(tenantId);
        const c = db.categories.find((x) => x.id === input.id);
        if (c) {
          c.name = updated.name || name;
          commit(tenantId);
          return c;
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        console.warn("Backend unavailable for updating category, falling back to local DB");
      } else {
        throw err;
      }
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  if (db.categories.some((c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== input.id)) throw new ApiError(409, "A category with this name already exists.");
  if (input.id) {
    const c = db.categories.find((x) => x.id === input.id);
    if (!c) throw new ApiError(404, "Category not found.");
    c.name = name;
    commit(tenantId);
    return c;
  }
  const c: Category = { id: uid("cat"), tenantId, name, sort: db.categories.length };
  db.categories.push(c);
  commit(tenantId);
  return c;
}

export async function moveCategory(tenantId: string, id: string, dir: -1 | 1): Promise<Category[]> {
  await latency(60, 150);
  const db = tenantDb(tenantId);
  const list = [...db.categories].sort((a, b) => a.sort - b.sort);
  const i = list.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  [list[i], list[j]] = [list[j]!, list[i]!];
  list.forEach((c, idx) => (c.sort = idx));
  commit(tenantId);
  return list;
}

export async function deleteCategory(tenantId: string, id: string): Promise<{ ok: true }> {
  try {
    await backendFetch<{ message: string }>(`/tenants/${tenantId}/categories/${id}`, {
      method: "DELETE",
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for deleting category, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  const count = db.menuItems.filter((m) => m.categoryId === id).length;
  if (count) throw new ApiError(409, `Move or delete its ${count} item${count > 1 ? "s" : ""} first.`);
  db.categories = db.categories.filter((c) => c.id !== id);
  commit(tenantId);
  return { ok: true };
}

// ---------- Items ----------
export type MenuItemInput = Omit<MenuItem, "id" | "tenantId" | "recipe"> & { id?: string | undefined };

export interface MenuItemFilters {
  categoryId?: string;
  search?: string;
  available?: boolean;
  branchId?: string;
}

export async function listMenuItems(tenantId: string, filters?: MenuItemFilters): Promise<MenuItem[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.categoryId && filters.categoryId !== "all") params.append("categoryId", filters.categoryId);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.available !== undefined) params.append("available", String(filters.available));
    if (filters?.branchId) params.append("branchId", filters.branchId);

    const queryStr = params.toString() ? `?${params.toString()}` : "";
    const backendItems = await backendFetch<any[]>(`/tenants/${tenantId}/menu-items${queryStr}`);
    if (Array.isArray(backendItems)) {
      const db = tenantDb(tenantId);
      const mappedList: MenuItem[] = backendItems.map((item) => ({
        id: item.id,
        tenantId: item.tenantId || tenantId,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description ?? "",
        price: Number(item.effectivePrice ?? item.price) || 0,
        available: item.effectiveAvailable ?? item.available ?? true,
        tags: item.tags ?? [],
        modifierGroupIds: item.modifierGroupIds ?? [],
        variants: (item.variants || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          priceDelta: Number(v.priceDelta) || 0,
        })),
        recipe: [],
      }));

      // Update local store if fetching all without filtering
      if (!filters?.search && !filters?.categoryId) {
        db.menuItems = mappedList;
        commit(tenantId);
      }
      return mappedList;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch menu items from backend, using local store:", err);
    }
  }

  await latency();
  let items = tenantDb(tenantId).menuItems;
  if (filters?.categoryId && filters.categoryId !== "all") {
    items = items.filter((i) => i.categoryId === filters.categoryId);
  }
  if (filters?.search) {
    const q = filters.search.trim().toLowerCase();
    items = items.filter((i) => i.name.toLowerCase().includes(q));
  }
  if (filters?.available !== undefined) {
    items = items.filter((i) => i.available === filters.available);
  }
  return items;
}

export async function getMenuItem(tenantId: string, id: string, branchId?: string): Promise<MenuItem> {
  try {
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    const item = await backendFetch<any>(`/tenants/${tenantId}/menu-items/${id}${qs}`);
    if (item && item.id) {
      const mapped: MenuItem = {
        id: item.id,
        tenantId: item.tenantId || tenantId,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description ?? "",
        price: Number(item.effectivePrice ?? item.price) || 0,
        available: item.effectiveAvailable ?? item.available ?? true,
        tags: item.tags ?? [],
        modifierGroupIds: item.modifierGroupIds ?? [],
        variants: (item.variants || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          priceDelta: Number(v.priceDelta) || 0,
        })),
        recipe: [],
      };
      const db = tenantDb(tenantId);
      const idx = db.menuItems.findIndex((x) => x.id === id);
      if (idx >= 0) db.menuItems[idx] = mapped;
      else db.menuItems.push(mapped);
      commit(tenantId);
      return mapped;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch menu item from backend, using local store:", err);
    }
  }

  await latency();
  const found = tenantDb(tenantId).menuItems.find((x) => x.id === id);
  if (!found) throw new ApiError(404, "Item not found.");
  return found;
}

export async function saveMenuItem(tenantId: string, input: MenuItemInput): Promise<MenuItem> {
  const db = tenantDb(tenantId);
  if (!db.categories.some((c) => c.id === input.categoryId)) throw new ApiError(422, "Choose a category.");
  const groups = input.modifierGroupIds.filter((g) => db.modifierGroups.some((m) => m.id === g));
  const data = {
    name: nonEmpty(input.name, "Name"),
    description: input.description.trim(),
    categoryId: input.categoryId,
    price: nonNegative(input.price, "Price"),
    variants: input.variants.map((v) => ({ id: v.id || uid("var"), name: nonEmpty(v.name, "Variant name"), priceDelta: round2(v.priceDelta) })),
    modifierGroupIds: groups,
    available: input.available,
    tags: input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean),
  };

  // Call backend API when creating a new menu item
  if (!input.id) {
    try {
      const saved = await backendFetch<any>(`/tenants/${tenantId}/menu-items`, {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          categoryId: data.categoryId,
          price: data.price,
          description: data.description,
          available: data.available,
          tags: data.tags,
          modifierGroupIds: data.modifierGroupIds,
          variants: data.variants.map((v) => ({
            name: v.name,
            priceDelta: v.priceDelta,
          })),
        }),
      });

      if (saved && saved.id) {
        const mapped: MenuItem = {
          id: saved.id,
          tenantId: saved.tenantId || tenantId,
          categoryId: saved.categoryId,
          name: saved.name,
          description: saved.description ?? data.description,
          price: Number(saved.price) || data.price,
          available: saved.available ?? data.available,
          tags: saved.tags ?? data.tags,
          modifierGroupIds: saved.modifierGroupIds ?? data.modifierGroupIds,
          variants: (saved.variants || []).map((v: any) => ({
            id: v.id,
            name: v.name,
            priceDelta: Number(v.priceDelta) || 0,
          })),
          recipe: [],
        };
        const idx = db.menuItems.findIndex((x) => x.id === saved.id);
        if (idx >= 0) {
          db.menuItems[idx] = mapped;
        } else {
          db.menuItems.push(mapped);
        }
        commit(tenantId);
        return mapped;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        console.warn("Backend unavailable for saving menu item, falling back to local DB");
      } else {
        throw err;
      }
    }
  }

  // Call backend API when updating an existing menu item
  if (input.id) {
    try {
      const updated = await backendFetch<any>(`/tenants/${tenantId}/menu-items/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: data.name,
          categoryId: data.categoryId,
          price: data.price,
          description: data.description,
          available: data.available,
          tags: data.tags,
          modifierGroupIds: data.modifierGroupIds,
          variants: data.variants.map((v) => ({
            id: v.id,
            name: v.name,
            priceDelta: v.priceDelta,
          })),
        }),
      });

      if (updated && updated.id) {
        const mapped: MenuItem = {
          id: updated.id,
          tenantId: updated.tenantId || tenantId,
          categoryId: updated.categoryId,
          name: updated.name || data.name,
          description: updated.description ?? data.description,
          price: Number(updated.effectivePrice ?? updated.price) || data.price,
          available: updated.effectiveAvailable ?? updated.available ?? data.available,
          tags: updated.tags ?? data.tags,
          modifierGroupIds: updated.modifierGroupIds ?? data.modifierGroupIds,
          variants: (updated.variants || []).map((v: any) => ({
            id: v.id,
            name: v.name,
            priceDelta: Number(v.priceDelta) || 0,
          })),
          recipe: [],
        };
        const idx = db.menuItems.findIndex((x) => x.id === input.id);
        if (idx >= 0) {
          db.menuItems[idx] = mapped;
        } else {
          db.menuItems.push(mapped);
        }
        commit(tenantId);
        return mapped;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        console.warn("Backend unavailable for updating menu item, falling back to local DB");
      } else {
        throw err;
      }
    }
  }

  await latency(200, 400);
  if (input.id) {
    const m = db.menuItems.find((x) => x.id === input.id);
    if (!m) throw new ApiError(404, "Item not found.");
    Object.assign(m, data);
    commit(tenantId);
    return m;
  }
  const m: MenuItem = { id: uid("item"), tenantId, recipe: [], ...data };
  db.menuItems.push(m);
  commit(tenantId);
  return m;
}

export async function setItemAvailability(tenantId: string, id: string, available: boolean): Promise<MenuItem> {
  try {
    const updated = await backendFetch<any>(`/tenants/${tenantId}/menu-items/${id}/availability`, {
      method: "PATCH",
      body: JSON.stringify({ available }),
    });

    if (updated && updated.id) {
      const db = tenantDb(tenantId);
      const m = db.menuItems.find((x) => x.id === id);
      if (m) {
        m.available = updated.available ?? available;
        commit(tenantId);
        return m;
      }
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for toggling item availability, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency(60, 150);
  const m = tenantDb(tenantId).menuItems.find((x) => x.id === id);
  if (!m) throw new ApiError(404, "Item not found.");
  m.available = available;
  commit(tenantId);
  return m;
}

export async function deleteMenuItem(tenantId: string, id: string): Promise<{ ok: true }> {
  try {
    await backendFetch<any>(`/tenants/${tenantId}/menu-items/${id}`, {
      method: "DELETE",
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for deleting menu item, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  const inCombo = db.combos.find((c) => c.components.some((x) => x.itemId === id));
  if (inCombo) throw new ApiError(409, `Remove it from the “${inCombo.name}” combo first.`);
  db.menuItems = db.menuItems.filter((m) => m.id !== id);
  commit(tenantId);
  return { ok: true };
}

// ---------- Modifier groups ----------
export type ModifierGroupInput = Omit<ModifierGroup, "id" | "tenantId"> & { id?: string | undefined };

export async function listModifierGroups(tenantId: string): Promise<ModifierGroup[]> {
  try {
    const backendGroups = await backendFetch<any[]>(`/tenants/${tenantId}/modifier-groups`);
    if (Array.isArray(backendGroups)) {
      const db = tenantDb(tenantId);
      db.modifierGroups = backendGroups.map((g) => ({
        id: g.id,
        tenantId: g.tenantId || tenantId,
        name: g.name,
        min: g.min ?? 0,
        max: g.max ?? 1,
        options: (g.options || []).map((o: any) => ({
          id: o.id,
          name: o.name,
          price: Number(o.price) || 0,
        })),
      }));
      commit(tenantId);
      return db.modifierGroups;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch modifier groups from backend, using local store:", err);
    }
  }

  await latency();
  return tenantDb(tenantId).modifierGroups;
}

export async function saveModifierGroup(tenantId: string, input: ModifierGroupInput): Promise<ModifierGroup> {
  const db = tenantDb(tenantId);
  if (input.options.length === 0) throw new ApiError(422, "Add at least one option.");
  if (input.min > input.max) throw new ApiError(422, "Minimum can't be more than maximum.");
  if (input.max > input.options.length) throw new ApiError(422, "Maximum can't exceed the number of options.");
  const data = {
    name: nonEmpty(input.name, "Name"),
    min: Math.max(0, Math.floor(input.min)),
    max: Math.max(1, Math.floor(input.max)),
    options: input.options.map((o) => ({ id: o.id || uid("opt"), name: nonEmpty(o.name, "Option name"), price: nonNegative(o.price, "Option price") })),
  };

  // Call backend API when creating a new modifier group
  if (!input.id) {
    try {
      const saved = await backendFetch<any>(`/tenants/${tenantId}/modifier-groups`, {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          min: data.min,
          max: data.max,
          options: data.options.map((o) => ({
            name: o.name,
            price: o.price,
          })),
        }),
      });

      if (saved && saved.id) {
        const mapped: ModifierGroup = {
          id: saved.id,
          tenantId: saved.tenantId || tenantId,
          name: saved.name,
          min: saved.min ?? data.min,
          max: saved.max ?? data.max,
          options: (saved.options || []).map((o: any) => ({
            id: o.id,
            name: o.name,
            price: Number(o.price) || 0,
          })),
        };
        const idx = db.modifierGroups.findIndex((x) => x.id === saved.id);
        if (idx >= 0) {
          db.modifierGroups[idx] = mapped;
        } else {
          db.modifierGroups.push(mapped);
        }
        commit(tenantId);
        return mapped;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        console.warn("Backend unavailable for saving modifier group, falling back to local DB");
      } else {
        throw err;
      }
    }
  }

  // Call backend API when updating an existing modifier group
  if (input.id) {
    try {
      const updated = await backendFetch<any>(`/tenants/${tenantId}/modifier-groups/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: data.name,
          min: data.min,
          max: data.max,
          options: data.options.map((o) => ({
            name: o.name,
            price: o.price,
          })),
        }),
      });

      if (updated && updated.id) {
        const mapped: ModifierGroup = {
          id: updated.id,
          tenantId: updated.tenantId || tenantId,
          name: updated.name || data.name,
          min: updated.min ?? data.min,
          max: updated.max ?? data.max,
          options: (updated.options || []).map((o: any) => ({
            id: o.id,
            name: o.name,
            price: Number(o.price) || 0,
          })),
        };
        const idx = db.modifierGroups.findIndex((x) => x.id === input.id);
        if (idx >= 0) {
          db.modifierGroups[idx] = mapped;
        } else {
          db.modifierGroups.push(mapped);
        }
        commit(tenantId);
        return mapped;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        console.warn("Backend unavailable for updating modifier group, falling back to local DB");
      } else {
        throw err;
      }
    }
  }

  await latency();
  if (input.id) {
    const g = db.modifierGroups.find((x) => x.id === input.id);
    if (!g) throw new ApiError(404, "Modifier group not found.");
    Object.assign(g, data);
    commit(tenantId);
    return g;
  }
  const g: ModifierGroup = { id: uid("mg"), tenantId, ...data };
  db.modifierGroups.push(g);
  commit(tenantId);
  return g;
}

export async function deleteModifierGroup(tenantId: string, id: string): Promise<{ ok: true }> {
  try {
    await backendFetch<any>(`/tenants/${tenantId}/modifier-groups/${id}`, {
      method: "DELETE",
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for deleting modifier group, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  db.modifierGroups = db.modifierGroups.filter((g) => g.id !== id);
  db.menuItems.forEach((m) => (m.modifierGroupIds = m.modifierGroupIds.filter((g) => g !== id)));
  commit(tenantId);
  return { ok: true };
}

// ---------- Combos ----------
export async function listCombos(tenantId: string): Promise<Combo[]> {
  try {
    const backendCombos = await backendFetch<any[]>(`/tenants/${tenantId}/combos`);
    if (Array.isArray(backendCombos)) {
      const db = tenantDb(tenantId);
      db.combos = backendCombos.map((c) => ({
        id: c.id,
        tenantId: c.tenantId || tenantId,
        name: c.name,
        description: c.description ?? "",
        price: Number(c.price) || 0,
        available: c.available ?? true,
        components: (c.components || c.items || []).map((x: any) => ({
          itemId: x.itemId || x.menuItemId,
          qty: x.qty ?? x.quantity ?? 1,
        })),
      }));
      commit(tenantId);
      return db.combos;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch combos from backend, using local store:", err);
    }
  }

  await latency();
  return tenantDb(tenantId).combos;
}

export type ComboInput = Omit<Combo, "id" | "tenantId"> & { id?: string | undefined };

export async function saveCombo(tenantId: string, input: ComboInput): Promise<Combo> {
  const db = tenantDb(tenantId);
  const components = input.components.filter((c) => c.qty > 0);
  if (components.length < 2) throw new ApiError(422, "A combo needs at least two items.");
  if (components.some((c) => !db.menuItems.some((m) => m.id === c.itemId))) throw new ApiError(422, "One of the items no longer exists.");
  const data = {
    name: nonEmpty(input.name, "Name"),
    description: input.description.trim(),
    price: nonNegative(input.price, "Price"),
    components,
    available: input.available,
  };

  // Call backend API when creating a new combo
  if (!input.id) {
    try {
      const saved = await backendFetch<any>(`/tenants/${tenantId}/combos`, {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          price: data.price,
          available: data.available,
          components: data.components.map((c) => ({
            itemId: c.itemId,
            qty: c.qty,
          })),
        }),
      });

      if (saved && saved.id) {
        const mapped: Combo = {
          id: saved.id,
          tenantId: saved.tenantId || tenantId,
          name: saved.name,
          description: saved.description ?? data.description,
          price: Number(saved.price) || data.price,
          available: saved.available ?? data.available,
          components: (saved.components || saved.items || data.components).map((x: any) => ({
            itemId: x.itemId || x.menuItemId,
            qty: x.qty ?? x.quantity ?? 1,
          })),
        };
        const idx = db.combos.findIndex((x) => x.id === saved.id);
        if (idx >= 0) {
          db.combos[idx] = mapped;
        } else {
          db.combos.push(mapped);
        }
        commit(tenantId);
        return mapped;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        console.warn("Backend unavailable for saving combo, falling back to local DB");
      } else {
        throw err;
      }
    }
  }

  // Call backend API when updating an existing combo
  if (input.id) {
    try {
      const updated = await backendFetch<any>(`/tenants/${tenantId}/combos/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          price: data.price,
          available: data.available,
          components: data.components.map((c) => ({
            itemId: c.itemId,
            qty: c.qty,
          })),
        }),
      });

      if (updated && updated.id) {
        const mapped: Combo = {
          id: updated.id,
          tenantId: updated.tenantId || tenantId,
          name: updated.name || data.name,
          description: updated.description ?? data.description,
          price: Number(updated.price) || data.price,
          available: updated.available ?? data.available,
          components: (updated.components || updated.items || data.components).map((x: any) => ({
            itemId: x.itemId || x.menuItemId,
            qty: x.qty ?? x.quantity ?? 1,
          })),
        };
        const idx = db.combos.findIndex((x) => x.id === input.id);
        if (idx >= 0) {
          db.combos[idx] = mapped;
        } else {
          db.combos.push(mapped);
        }
        commit(tenantId);
        return mapped;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        console.warn("Backend unavailable for updating combo, falling back to local DB");
      } else {
        throw err;
      }
    }
  }

  await latency();
  if (input.id) {
    const c = db.combos.find((x) => x.id === input.id);
    if (!c) throw new ApiError(404, "Combo not found.");
    Object.assign(c, data);
    commit(tenantId);
    return c;
  }
  const c: Combo = { id: uid("combo"), tenantId, ...data };
  db.combos.push(c);
  commit(tenantId);
  return c;
}

export async function deleteCombo(tenantId: string, id: string): Promise<{ ok: true }> {
  try {
    await backendFetch<any>(`/tenants/${tenantId}/combos/${id}`, {
      method: "DELETE",
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for deleting combo, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  db.combos = db.combos.filter((c) => c.id !== id);
  commit(tenantId);
  return { ok: true };
}

// ---------- Recipes & food cost ----------
export interface RecipeCostRow {
  itemId: string;
  name: string;
  categoryId: string;
  price: number;
  cost: number;
  margin: number;
  costPct: number;
  recipe: (RecipeLine & { name: string; unit: string; unitCost: number; lineCost: number; missing: boolean })[];
}

/** Food cost uses the selected branch's ingredient unit costs. */
export function costRecipe(recipe: RecipeLine[], ingredients: Ingredient[]) {
  const lines = recipe.map((r) => {
    const ing = ingredients.find((i) => i.key === r.ingredientKey);
    const unitCost = ing?.unitCost ?? 0;
    return { ...r, name: ing?.name ?? r.ingredientKey, unit: ing?.unit ?? "", unitCost, lineCost: round2(unitCost * r.qty), missing: !ing };
  });
  return { lines, cost: round2(lines.reduce((s, l) => s + l.lineCost, 0)) };
}

export async function listRecipeCosts(tenantId: string, branchId: string): Promise<RecipeCostRow[]> {
  try {
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    const backendCosts = await backendFetch<any[]>(`/tenants/${tenantId}/recipes${qs}`);
    if (Array.isArray(backendCosts)) {
      return backendCosts.map((item) => ({
        itemId: item.itemId,
        name: item.name,
        categoryId: item.categoryId,
        price: Number(item.price) || 0,
        cost: Number(item.cost) || 0,
        margin: Number(item.margin) || 0,
        costPct: Number(item.costPct) || 0,
        recipe: (item.recipe || []).map((r: any) => ({
          ingredientKey: r.ingredientKey || r.ingredientId,
          qty: Number(r.qty ?? r.quantity) || 0,
          name: r.name || r.ingredientKey || "",
          unit: r.unit || "",
          unitCost: Number(r.unitCost) || 0,
          lineCost: Number(r.lineCost) || 0,
          missing: Boolean(r.missing),
        })),
      }));
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 503)) {
      console.warn("Could not fetch recipe costs from backend, using local store:", err);
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  const ings = db.ingredients.filter((i) => i.branchId === branchId);
  return db.menuItems.map((m) => {
    const { lines, cost } = costRecipe(m.recipe, ings);
    return {
      itemId: m.id,
      name: m.name,
      categoryId: m.categoryId,
      price: m.price,
      cost,
      margin: round2(m.price - cost),
      costPct: m.price > 0 ? round2((cost / m.price) * 100) : 0,
      recipe: lines,
    };
  });
}

export async function saveRecipe(tenantId: string, itemId: string, recipe: RecipeLine[]): Promise<MenuItem> {
  const clean = recipe.filter((r) => r.qty > 0);

  // Call backend API to save recipe
  try {
    const saved = await backendFetch<any>(`/tenants/${tenantId}/recipes/${itemId}`, {
      method: "PUT",
      body: JSON.stringify({
        recipe: clean.map((r) => ({
          ingredientId: r.ingredientKey,
          ingredientKey: r.ingredientKey,
          qty: r.qty,
          quantity: r.qty,
        })),
      }),
    });

    if (saved) {
      const db = tenantDb(tenantId);
      const m = db.menuItems.find((x) => x.id === itemId);
      if (m) {
        m.recipe = clean.map((r) => ({ ingredientKey: r.ingredientKey, qty: Math.round(r.qty * 1000) / 1000 }));
        commit(tenantId);
        return m;
      }
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      console.warn("Backend unavailable for saving recipe, falling back to local DB");
    } else {
      throw err;
    }
  }

  await latency();
  const db = tenantDb(tenantId);
  const m = db.menuItems.find((x) => x.id === itemId);
  if (!m) throw new ApiError(404, "Item not found.");
  const keys = new Set(db.ingredients.map((i) => i.key));
  if (clean.some((r) => !keys.has(r.ingredientKey))) throw new ApiError(422, "Unknown ingredient in recipe.");
  if (new Set(clean.map((r) => r.ingredientKey)).size !== clean.length) throw new ApiError(422, "Each ingredient can appear only once.");
  m.recipe = clean.map((r) => ({ ingredientKey: r.ingredientKey, qty: Math.round(r.qty * 1000) / 1000 }));
  commit(tenantId);
  return m;
}
