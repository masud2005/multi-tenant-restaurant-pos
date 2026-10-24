import { baseApi, run } from "@/app/base-api";
import * as catalog from "@/services/catalog.service";
import * as stock from "@/services/stock.service";
import * as purchasing from "@/services/purchasing.service";
import type { Category, Combo, GoodsReceipt, Ingredient, MenuItem, ModifierGroup, PurchaseOrder, RecipeLine, StockCount, Supplier, SupplierReturn } from "@/types/domain";

type T<A> = { tenantId: string } & A;
const MENU = ["Menu", "Dashboard"] as const;
const STOCK = ["Inventory", "Dashboard"] as const;

const api2 = baseApi.enhanceEndpoints({ addTagTypes: ["MenuItem", "Supplier", "PurchaseOrder", "Recipe", "StockCount", "Receipt", "SupplierReturn"] });

export const backofficeApi = api2.injectEndpoints({
  endpoints: (b) => ({
    // ---- Menu ----
    saveCategory: b.mutation<Category, T<{ id?: string | undefined; name: string }>>({
      queryFn: ({ tenantId, ...i }) => run(() => catalog.saveCategory(tenantId, i)),
      invalidatesTags: [...MENU],
    }),
    moveCategory: b.mutation<Category[], T<{ id: string; dir: -1 | 1 }>>({
      queryFn: ({ tenantId, id, dir }) => run(() => catalog.moveCategory(tenantId, id, dir)),
      invalidatesTags: [...MENU],
    }),
    deleteCategory: b.mutation<{ ok: true }, T<{ id: string }>>({
      queryFn: ({ tenantId, id }) => run(() => catalog.deleteCategory(tenantId, id)),
      invalidatesTags: [...MENU],
    }),
    menuItems: b.query<MenuItem[], string | T<catalog.MenuItemFilters>>({
      queryFn: (arg) => {
        if (typeof arg === "string") return run(() => catalog.listMenuItems(arg));
        const { tenantId, ...filters } = arg;
        return run(() => catalog.listMenuItems(tenantId, filters));
      },
      providesTags: [...MENU],
    }),
    menuItem: b.query<MenuItem, T<{ id: string; branchId?: string }>>({
      queryFn: ({ tenantId, id, branchId }) => run(() => catalog.getMenuItem(tenantId, id, branchId)),
      providesTags: (_r, _e, a) => [{ type: "MenuItem" as const, id: a.id }],
    }),
    saveMenuItem: b.mutation<MenuItem, T<catalog.MenuItemInput>>({
      queryFn: ({ tenantId, ...i }) => run(() => catalog.saveMenuItem(tenantId, i)),
      invalidatesTags: [...MENU, "Recipe"],
    }),
    setItemAvailability: b.mutation<MenuItem, T<{ id: string; available: boolean }>>({
      queryFn: ({ tenantId, id, available }) => run(() => catalog.setItemAvailability(tenantId, id, available)),
      invalidatesTags: [...MENU],
    }),
    deleteMenuItem: b.mutation<{ ok: true }, T<{ id: string }>>({
      queryFn: ({ tenantId, id }) => run(() => catalog.deleteMenuItem(tenantId, id)),
      invalidatesTags: [...MENU, "Recipe"],
    }),
    modifierGroups: b.query<ModifierGroup[], string>({
      queryFn: (tenantId) => run(() => catalog.listModifierGroups(tenantId)),
      providesTags: [...MENU],
    }),
    saveModifierGroup: b.mutation<ModifierGroup, T<catalog.ModifierGroupInput>>({
      queryFn: ({ tenantId, ...i }) => run(() => catalog.saveModifierGroup(tenantId, i)),
      invalidatesTags: [...MENU],
    }),
    deleteModifierGroup: b.mutation<{ ok: true }, T<{ id: string }>>({
      queryFn: ({ tenantId, id }) => run(() => catalog.deleteModifierGroup(tenantId, id)),
      invalidatesTags: [...MENU],
    }),
    combos: b.query<Combo[], string>({
      queryFn: (tenantId) => run(() => catalog.listCombos(tenantId)),
      providesTags: [...MENU],
    }),
    saveCombo: b.mutation<Combo, T<catalog.ComboInput>>({
      queryFn: ({ tenantId, ...i }) => run(() => catalog.saveCombo(tenantId, i)),
      invalidatesTags: [...MENU],
    }),
    deleteCombo: b.mutation<{ ok: true }, T<{ id: string }>>({
      queryFn: ({ tenantId, id }) => run(() => catalog.deleteCombo(tenantId, id)),
      invalidatesTags: [...MENU],
    }),

    // ---- Recipes ----
    recipeCosts: b.query<catalog.RecipeCostRow[], T<{ branchId: string }>>({
      queryFn: ({ tenantId, branchId }) => run(() => catalog.listRecipeCosts(tenantId, branchId)),
      providesTags: ["Recipe"],
    }),
    saveRecipe: b.mutation<MenuItem, T<{ itemId: string; recipe: RecipeLine[] }>>({
      queryFn: ({ tenantId, itemId, recipe }) => run(() => catalog.saveRecipe(tenantId, itemId, recipe)),
      invalidatesTags: ["Recipe", "Menu"],
    }),

    // ---- Stock ----
    saveIngredient: b.mutation<Ingredient, T<stock.IngredientInput>>({
      queryFn: ({ tenantId, ...i }) => run(() => stock.saveIngredient(tenantId, i)),
      invalidatesTags: [...STOCK, "Recipe"],
    }),
    deleteIngredient: b.mutation<{ ok: true }, T<{ id: string; branchId?: string }>>({
      queryFn: ({ tenantId, id, branchId }) => run(() => stock.deleteIngredient(tenantId, id, branchId)),
      invalidatesTags: [...STOCK, "Recipe"],
    }),
    adjustStock: b.mutation<Ingredient, T<stock.AdjustmentInput>>({
      queryFn: ({ tenantId, ...i }) => run(() => stock.adjustStock(tenantId, i)),
      invalidatesTags: [...STOCK],
    }),
    stockCounts: b.query<StockCount[], T<{ branchId: string }>>({
      queryFn: ({ tenantId, branchId }) => run(() => stock.listStockCounts(tenantId, branchId)),
      providesTags: ["StockCount"],
    }),
    submitStockCount: b.mutation<StockCount, T<{ branchId: string; counts: { ingredientId: string; counted: number }[]; notes: string; createdBy: string }>>({
      queryFn: ({ tenantId, ...i }) => run(() => stock.submitStockCount(tenantId, i)),
      invalidatesTags: [...STOCK, "StockCount"],
    }),

    // ---- Purchasing ----
    suppliers: b.query<Supplier[], string | T<purchasing.SupplierFilters>>({
      queryFn: (arg) => {
        if (typeof arg === "string") return run(() => purchasing.listSuppliers(arg));
        const { tenantId, ...filters } = arg;
        return run(() => purchasing.listSuppliers(tenantId, filters));
      },
      providesTags: ["Supplier"],
    }),
    supplier: b.query<Supplier, T<{ id: string }>>({
      queryFn: ({ tenantId, id }) => run(() => purchasing.getSupplier(tenantId, id)),
      providesTags: (_r, _e, a) => [{ type: "Supplier" as const, id: a.id }],
    }),
    saveSupplier: b.mutation<Supplier, T<purchasing.SupplierInput>>({
      queryFn: ({ tenantId, ...i }) => run(() => purchasing.saveSupplier(tenantId, i)),
      invalidatesTags: ["Supplier"],
    }),
    deleteSupplier: b.mutation<{ ok: true }, T<{ id: string }>>({
      queryFn: ({ tenantId, id }) => run(() => purchasing.deleteSupplier(tenantId, id)),
      invalidatesTags: ["Supplier"],
    }),
    purchaseOrders: b.query<PurchaseOrder[], T<{ branchId?: string } & purchasing.PurchaseOrderFilters>>({
      queryFn: ({ tenantId, ...filters }) => run(() => purchasing.listPurchaseOrders(tenantId, filters)),
      providesTags: ["PurchaseOrder"],
    }),
    purchaseOrder: b.query<PurchaseOrder, T<{ id: string }>>({
      queryFn: ({ tenantId, id }) => run(() => purchasing.getPurchaseOrder(tenantId, id)),
      providesTags: (_r, _e, a) => [{ type: "PurchaseOrder" as const, id: a.id }],
    }),
    savePurchaseOrder: b.mutation<PurchaseOrder, T<purchasing.PurchaseOrderInput>>({
      queryFn: ({ tenantId, ...i }) => run(() => purchasing.savePurchaseOrder(tenantId, i)),
      invalidatesTags: ["PurchaseOrder"],
    }),
    setPurchaseOrderStatus: b.mutation<PurchaseOrder, T<{ id: string; status: "sent" | "cancelled" }>>({
      queryFn: ({ tenantId, id, status }) => run(() => purchasing.setPurchaseOrderStatus(tenantId, id, status)),
      invalidatesTags: ["PurchaseOrder"],
    }),
    deletePurchaseOrder: b.mutation<{ ok: true }, T<{ id: string }>>({
      queryFn: ({ tenantId, id }) => run(() => purchasing.deletePurchaseOrder(tenantId, id)),
      invalidatesTags: ["PurchaseOrder"],
    }),
    receipts: b.query<GoodsReceipt[], T<{ branchId?: string } & purchasing.GoodsReceiptFilters>>({
      queryFn: ({ tenantId, ...filters }) => run(() => purchasing.listReceipts(tenantId, filters)),
      providesTags: ["Receipt"],
    }),
    receipt: b.query<GoodsReceipt, T<{ id: string }>>({
      queryFn: ({ tenantId, id }) => run(() => purchasing.getGoodsReceipt(tenantId, id)),
      providesTags: (_r, _e, a) => [{ type: "Receipt" as const, id: a.id }],
    }),
    awaitingOrders: b.query<any[], T<{ branchId?: string }>>({
      queryFn: ({ tenantId, branchId }) => run(() => purchasing.listAwaitingOrders(tenantId, branchId)),
      providesTags: ["PurchaseOrder", "Receipt"],
    }),
    receiveGoods: b.mutation<GoodsReceipt, T<purchasing.ReceiveGoodsInput>>({
      queryFn: ({ tenantId, ...i }) => run(() => purchasing.receiveGoods(tenantId, i)),
      invalidatesTags: ["PurchaseOrder", "Receipt", "Recipe", ...STOCK],
    }),
    supplierReturns: b.query<SupplierReturn[], T<{ branchId?: string } & purchasing.SupplierReturnFilters>>({
      queryFn: ({ tenantId, ...filters }) => run(() => purchasing.listSupplierReturns(tenantId, filters)),
      providesTags: ["SupplierReturn"],
    }),
    supplierReturn: b.query<SupplierReturn, T<{ id: string }>>({
      queryFn: ({ tenantId, id }) => run(() => purchasing.getSupplierReturn(tenantId, id)),
      providesTags: ["SupplierReturn"],
    }),
    createSupplierReturn: b.mutation<SupplierReturn, T<purchasing.CreateSupplierReturnInput>>({
      queryFn: ({ tenantId, ...i }) => run(() => purchasing.createSupplierReturn(tenantId, i)),
      invalidatesTags: ["SupplierReturn", ...STOCK],
    }),
  }),
});

export const {
  useSaveCategoryMutation,
  useMoveCategoryMutation,
  useDeleteCategoryMutation,
  useMenuItemsQuery,
  useMenuItemQuery,
  useSaveMenuItemMutation,
  useSetItemAvailabilityMutation,
  useDeleteMenuItemMutation,
  useModifierGroupsQuery,
  useSaveModifierGroupMutation,
  useDeleteModifierGroupMutation,
  useCombosQuery,
  useSaveComboMutation,
  useDeleteComboMutation,
  useRecipeCostsQuery,
  useSaveRecipeMutation,
  useSaveIngredientMutation,
  useDeleteIngredientMutation,
  useAdjustStockMutation,
  useStockCountsQuery,
  useSubmitStockCountMutation,
  useSuppliersQuery,
  useSupplierQuery,
  useSaveSupplierMutation,
  useDeleteSupplierMutation,
  usePurchaseOrdersQuery,
  usePurchaseOrderQuery,
  useSavePurchaseOrderMutation,
  useSetPurchaseOrderStatusMutation,
  useDeletePurchaseOrderMutation,
  useReceiptsQuery,
  useReceiptQuery,
  useAwaitingOrdersQuery,
  useReceiveGoodsMutation,
  useSupplierReturnsQuery,
  useSupplierReturnQuery,
  useCreateSupplierReturnMutation,
} = backofficeApi;
