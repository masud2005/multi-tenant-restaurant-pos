import { baseApi, run } from "./base-api";
import * as platform from "@/services/platform.service";
import * as ops from "@/services/operations.service";
import type { Activation, Branch, DiningTable, Ingredient, KitchenStatus, Notification, Order, OrderLine, StockMovement, TableStatus, Tenant, User } from "@/types/domain";

type T<A> = { tenantId: string } & A;

export const api = baseApi.injectEndpoints({
  endpoints: (b) => ({
    // ---- Platform ----
    login: b.mutation<User, { email: string; password: string }>({
      queryFn: ({ email, password }) => run(() => platform.login(email, password)),
    }),
    requestReset: b.mutation<{ ok: true }, { email: string }>({
      queryFn: ({ email }) => run(() => platform.requestPasswordReset(email)),
    }),
    me: b.query<User, string>({
      queryFn: (userId) => run(() => platform.getUser(userId)),
      providesTags: ["Session"],
    }),
    myTenants: b.query<Tenant[], string>({
      queryFn: (userId) => run(() => platform.listTenantsForUser(userId)),
      providesTags: ["Tenant"],
    }),
    branches: b.query<Branch[], { tenantId: string; userId: string }>({
      queryFn: ({ tenantId, userId }) => run(() => platform.listBranches(tenantId, userId)),
      providesTags: ["Branch"],
    }),
    activation: b.query<Activation, string>({
      queryFn: (tenantId) => run(() => platform.mockActivationProvider.check(tenantId)),
      providesTags: (_r, _e, id) => [{ type: "Activation", id }],
    }),

    // ---- Menu ----
    menu: b.query<ops.MenuBundle, string>({
      queryFn: (tenantId) => run(() => ops.getMenu(tenantId)),
      providesTags: ["Menu"],
    }),

    // ---- Orders ----
    orders: b.query<Order[], T<ops.OrderFilters>>({
      queryFn: ({ tenantId, ...f }) => run(() => ops.listOrders(tenantId, f)),
      providesTags: (r) => [{ type: "Order", id: "LIST" }, ...(r ?? []).map((o) => ({ type: "Order" as const, id: o.id }))],
    }),
    order: b.query<Order, T<{ orderId: string }>>({
      queryFn: ({ tenantId, orderId }) => run(() => ops.getOrder(tenantId, orderId)),
      providesTags: (_r, _e, a) => [{ type: "Order", id: a.orderId }],
    }),
    createOrder: b.mutation<Order, T<ops.CreateOrderInput>>({
      queryFn: ({ tenantId, ...input }) => run(() => ops.createOrder(tenantId, input)),
      invalidatesTags: [{ type: "Order", id: "LIST" }, "Table", "Dashboard"],
    }),
    addOrderLines: b.mutation<Order, T<{ orderId: string; lines: OrderLine[] }>>({
      queryFn: ({ tenantId, orderId, lines }) => run(() => ops.addOrderLines(tenantId, orderId, lines)),
      invalidatesTags: (_r, _e, a) => [{ type: "Order", id: a.orderId }, { type: "Order", id: "LIST" }, "Table", "Dashboard"],
    }),
    advanceKitchen: b.mutation<Order, T<{ orderId: string; status?: KitchenStatus }>>({
      queryFn: ({ tenantId, orderId, status }) => run(() => ops.advanceKitchen(tenantId, orderId, status)),
      invalidatesTags: (_r, _e, a) => [{ type: "Order", id: a.orderId }, { type: "Order", id: "LIST" }, "Dashboard"],
    }),
    markServed: b.mutation<Order, T<{ orderId: string }>>({
      queryFn: ({ tenantId, orderId }) => run(() => ops.markServed(tenantId, orderId)),
      invalidatesTags: (_r, _e, a) => [{ type: "Order", id: a.orderId }, { type: "Order", id: "LIST" }, "Table", "Dashboard"],
    }),
    addPayment: b.mutation<Order, T<{ orderId: string } & ops.PaymentInput>>({
      queryFn: ({ tenantId, orderId, ...p }) => run(() => ops.addPayment(tenantId, orderId, p)),
      invalidatesTags: (_r, _e, a) => [{ type: "Order", id: a.orderId }, { type: "Order", id: "LIST" }, "Table", "Inventory", "Dashboard", "Notification"],
    }),
    cancelOrder: b.mutation<Order, T<{ orderId: string; reason: string }>>({
      queryFn: ({ tenantId, orderId, reason }) => run(() => ops.cancelOrder(tenantId, orderId, reason)),
      invalidatesTags: (_r, _e, a) => [{ type: "Order", id: a.orderId }, { type: "Order", id: "LIST" }, "Table", "Dashboard"],
    }),

    // ---- Tables ----
    tables: b.query<DiningTable[], T<{ branchId: string }>>({
      queryFn: ({ tenantId, branchId }) => run(() => ops.listTables(tenantId, branchId)),
      providesTags: ["Table"],
    }),
    table: b.query<DiningTable, T<{ tableId: string }>>({
      queryFn: ({ tenantId, tableId }) => run(() => ops.getTable(tenantId, tableId)),
      providesTags: (_r, _e, a) => [{ type: "Table", id: a.tableId }],
    }),
    createTable: b.mutation<DiningTable, T<ops.CreateTableInput>>({
      queryFn: ({ tenantId, ...input }) => run(() => ops.createTable(tenantId, input)),
      invalidatesTags: ["Table", "Dashboard"],
    }),
    setTableStatus: b.mutation<DiningTable, T<{ tableId: string; status: TableStatus }>>({
      queryFn: ({ tenantId, tableId, status }) => run(() => ops.setTableStatus(tenantId, tableId, status)),
      invalidatesTags: ["Table", "Dashboard"],
    }),
    updateTable: b.mutation<DiningTable, T<{ tableId: string } & ops.UpdateTableInput>>({
      queryFn: ({ tenantId, tableId, ...input }) => run(() => ops.updateTable(tenantId, tableId, input)),
      invalidatesTags: ["Table", "Dashboard"],
    }),
    deleteTable: b.mutation<{ ok: boolean; message: string }, T<{ tableId: string }>>({
      queryFn: ({ tenantId, tableId }) => run(() => ops.deleteTable(tenantId, tableId)),
      invalidatesTags: ["Table", "Dashboard"],
    }),

    // ---- Inventory ----
    ingredients: b.query<Ingredient[], T<{ branchId: string }>>({
      queryFn: ({ tenantId, branchId }) => run(() => ops.listIngredients(tenantId, branchId)),
      providesTags: ["Inventory"],
    }),
    movements: b.query<StockMovement[], T<{ branchId: string }>>({
      queryFn: ({ tenantId, branchId }) => run(() => ops.listMovements(tenantId, branchId)),
      providesTags: ["Inventory"],
    }),

    // ---- Notifications & dashboard ----
    notifications: b.query<Notification[], string>({
      queryFn: (tenantId) => run(() => ops.listNotifications(tenantId)),
      providesTags: ["Notification"],
    }),
    markNotificationsRead: b.mutation<{ ok: true }, string>({
      queryFn: (tenantId) => run(() => ops.markNotificationsRead(tenantId)),
      invalidatesTags: ["Notification"],
    }),
    markSingleNotificationRead: b.mutation<{ ok: true }, { tenantId: string; notificationId: string }>({
      queryFn: ({ tenantId, notificationId }) => run(() => ops.markSingleNotificationRead(tenantId, notificationId)),
      invalidatesTags: ["Notification"],
    }),
    deleteNotification: b.mutation<{ ok: true }, { tenantId: string; notificationId: string }>({
      queryFn: ({ tenantId, notificationId }) => run(() => ops.deleteNotification(tenantId, notificationId)),
      invalidatesTags: ["Notification"],
    }),
    dashboard: b.query<ops.DashboardSummary, T<{ branchId: string }>>({
      queryFn: ({ tenantId, branchId }) => run(() => ops.getDashboard(tenantId, branchId)),
      providesTags: ["Dashboard"],
    }),
  }),
});

export const {
  useLoginMutation,
  useRequestResetMutation,
  useMeQuery,
  useMyTenantsQuery,
  useBranchesQuery,
  useActivationQuery,
  useMenuQuery,
  useOrdersQuery,
  useOrderQuery,
  useCreateOrderMutation,
  useAddOrderLinesMutation,
  useAdvanceKitchenMutation,
  useMarkServedMutation,
  useAddPaymentMutation,
  useCancelOrderMutation,
  useTablesQuery,
  useTableQuery,
  useCreateTableMutation,
  useSetTableStatusMutation,
  useUpdateTableMutation,
  useDeleteTableMutation,
  useIngredientsQuery,
  useMovementsQuery,
  useNotificationsQuery,
  useMarkNotificationsReadMutation,
  useMarkSingleNotificationReadMutation,
  useDeleteNotificationMutation,
  useDashboardQuery,
} = api;
