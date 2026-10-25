import { baseApi, run } from "@/app/base-api";
import * as people from "@/services/people.service";
import * as money from "@/services/money.service";
import type { AttendanceRecord, Branch, CashSession, Customer, DeliveryStatus, Expense, LoyaltySettings, Order, Promotion, Reservation, ReservationStatus, Rider, Shift, StaffMember } from "@/types/domain";

type T<A> = { tenantId: string } & A;
const ORDER = [{ type: "Order" as const, id: "LIST" }, "Dashboard" as const];

const api3 = baseApi.enhanceEndpoints({
  addTagTypes: ["Customer", "Reservation", "Delivery", "Ledger", "Cash", "Expense", "Staff", "Shift", "Attendance", "Promotion"],
});

export const peopleApi = api3.injectEndpoints({
  endpoints: (b) => ({
    // ---- Customers & loyalty ----
    customers: b.query<Customer[], string>({ queryFn: (t) => run(() => people.listCustomers(t)), providesTags: ["Customer"] }),
    saveCustomer: b.mutation<Customer, T<people.CustomerInput>>({ queryFn: ({ tenantId, ...i }) => run(() => people.saveCustomer(tenantId, i)), invalidatesTags: ["Customer"] }),
    adjustPoints: b.mutation<Customer, T<{ customerId: string; points: number; reason: string }>>({ queryFn: ({ tenantId, ...i }) => run(() => people.adjustPoints(tenantId, i)), invalidatesTags: ["Customer"] }),
    loyaltySettings: b.query<LoyaltySettings, string>({ queryFn: (t) => run(() => people.getLoyaltySettings(t)) }),

    // ---- Reservations ----
    reservations: b.query<Reservation[], T<{ branchId: string }>>({ queryFn: ({ tenantId, branchId }) => run(() => people.listReservations(tenantId, branchId)), providesTags: ["Reservation"] }),
    saveReservation: b.mutation<Reservation, T<people.ReservationInput>>({ queryFn: ({ tenantId, ...i }) => run(() => people.saveReservation(tenantId, i)), invalidatesTags: ["Reservation", "Table", "Dashboard"] }),
    setReservationStatus: b.mutation<Reservation, T<{ id: string; status: ReservationStatus }>>({ queryFn: ({ tenantId, id, status }) => run(() => people.setReservationStatus(tenantId, id, status)), invalidatesTags: ["Reservation", "Table", "Dashboard"] }),
    deleteReservation: b.mutation<{ success: boolean; message: string }, T<{ id: string }>>({ queryFn: ({ tenantId, id }) => run(() => people.deleteReservation(tenantId, id)), invalidatesTags: ["Reservation", "Table", "Dashboard"] }),

    // ---- Delivery ----
    deliveries: b.query<Order[], T<{ branchId: string }>>({ queryFn: ({ tenantId, branchId }) => run(() => money.listDeliveries(tenantId, branchId)), providesTags: ["Delivery", { type: "Order", id: "LIST" }] }),
    riders: b.query<Rider[], T<{ branchId: string }>>({ queryFn: ({ tenantId, branchId }) => run(() => money.listRiders(tenantId, branchId)), providesTags: ["Delivery"] }),
    saveRider: b.mutation<Rider, T<{ branchId: string; name: string; phone: string }>>({ queryFn: ({ tenantId, ...i }) => run(() => money.saveRider(tenantId, i)), invalidatesTags: ["Delivery"] }),
    updateDelivery: b.mutation<Order, T<{ orderId: string; status: DeliveryStatus; riderId?: string | undefined }>>({
      queryFn: ({ tenantId, ...i }) => run(() => money.updateDelivery(tenantId, i)),
      invalidatesTags: (_r, _e, a) => ["Delivery", { type: "Order", id: a.orderId }, ...ORDER],
    }),

    // ---- Payments, refunds, cash, expenses ----
    ledger: b.query<money.LedgerRow[], T<{ branchId: string }>>({ queryFn: ({ tenantId, branchId }) => run(() => money.listLedger(tenantId, branchId)), providesTags: ["Ledger", { type: "Order", id: "LIST" }] }),
    refundOrder: b.mutation<Order, T<money.RefundInput>>({
      queryFn: ({ tenantId, ...i }) => run(() => money.refundOrder(tenantId, i)),
      invalidatesTags: (_r, _e, a) => ["Ledger", "Cash", "Customer", { type: "Order", id: a.orderId }, ...ORDER],
    }),
    cashSessions: b.query<money.CashSessionView[], T<{ branchId: string }>>({ queryFn: ({ tenantId, branchId }) => run(() => money.listCashSessions(tenantId, branchId)), providesTags: ["Cash", { type: "Order", id: "LIST" }] }),
    openCashSession: b.mutation<CashSession, T<{ branchId: string; openingFloat: number; by: string }>>({ queryFn: ({ tenantId, ...i }) => run(() => money.openCashSession(tenantId, i)), invalidatesTags: ["Cash"] }),
    addCashEntry: b.mutation<CashSession, T<{ branchId: string; kind: "in" | "out"; amount: number; reason: string; by: string }>>({ queryFn: ({ tenantId, ...i }) => run(() => money.addCashEntry(tenantId, i)), invalidatesTags: ["Cash"] }),
    closeCashSession: b.mutation<CashSession, T<{ branchId: string; countedCash: number; notes: string; by: string }>>({ queryFn: ({ tenantId, ...i }) => run(() => money.closeCashSession(tenantId, i)), invalidatesTags: ["Cash", "Notification"] }),
    expenses: b.query<Expense[], T<{ branchId: string }>>({ queryFn: ({ tenantId, branchId }) => run(() => money.listExpenses(tenantId, branchId)), providesTags: ["Expense"] }),
    createExpense: b.mutation<Expense, T<money.ExpenseInput>>({ queryFn: ({ tenantId, ...i }) => run(() => money.createExpense(tenantId, i)), invalidatesTags: ["Expense", "Cash"] }),
    deleteExpense: b.mutation<{ ok: true }, T<{ id: string }>>({ queryFn: ({ tenantId, id }) => run(() => money.deleteExpense(tenantId, id)), invalidatesTags: ["Expense", "Cash"] }),

    // ---- Staff, shifts, attendance ----
    staff: b.query<StaffMember[], string>({ queryFn: (t) => run(() => people.listStaff(t)), providesTags: ["Staff"] }),
    saveStaff: b.mutation<StaffMember, T<people.StaffInput>>({ queryFn: ({ tenantId, ...i }) => run(() => people.saveStaff(tenantId, i)), invalidatesTags: ["Staff", "Shift"] }),
    deleteStaff: b.mutation<{ success: boolean; message: string }, T<{ id: string }>>({ queryFn: ({ tenantId, id }) => run(() => people.deleteStaff(tenantId, id)), invalidatesTags: ["Staff", "Shift"] }),
    reinviteStaff: b.mutation<{ success: boolean; message: string; inviteToken?: string; inviteUrl?: string; emailSent?: boolean }, T<{ id: string }>>({ queryFn: ({ tenantId, id }) => run(() => people.reinviteStaff(tenantId, id)), invalidatesTags: ["Staff"] }),
    shifts: b.query<Shift[], T<{ branchId: string }>>({ queryFn: ({ tenantId, branchId }) => run(() => people.listShifts(tenantId, branchId)), providesTags: ["Shift"] }),
    saveShift: b.mutation<Shift, T<people.ShiftInput>>({ queryFn: ({ tenantId, ...i }) => run(() => people.saveShift(tenantId, i)), invalidatesTags: ["Shift"] }),
    deleteShift: b.mutation<{ ok: true }, T<{ id: string }>>({ queryFn: ({ tenantId, id }) => run(() => people.deleteShift(tenantId, id)), invalidatesTags: ["Shift"] }),
    attendance: b.query<AttendanceRecord[], T<{ branchId: string }>>({ queryFn: ({ tenantId, branchId }) => run(() => people.listAttendance(tenantId, branchId)), providesTags: ["Attendance"] }),
    toggleClock: b.mutation<AttendanceRecord, T<{ userId: string; branchId: string }>>({ queryFn: ({ tenantId, ...i }) => run(() => people.toggleClock(tenantId, i)), invalidatesTags: ["Attendance"] }),

    // ---- Branches & promotions ----
    allBranches: b.query<Branch[], string>({ queryFn: (t) => run(() => people.listAllBranches(t)), providesTags: ["Branch"] }),
    saveBranch: b.mutation<Branch, T<people.BranchInput>>({ queryFn: ({ tenantId, ...i }) => run(() => people.saveBranch(tenantId, i)), invalidatesTags: ["Branch", "Inventory"] }),
    promotions: b.query<Promotion[], string>({ queryFn: (t) => run(() => people.listPromotions(t)), providesTags: ["Promotion"] }),
    savePromotion: b.mutation<Promotion, T<people.PromotionInput>>({ queryFn: ({ tenantId, ...i }) => run(() => people.savePromotion(tenantId, i)), invalidatesTags: ["Promotion"] }),
    deletePromotion: b.mutation<{ success: boolean; message: string }, T<{ id: string }>>({ queryFn: ({ tenantId, id }) => run(() => people.deletePromotion(tenantId, id)), invalidatesTags: ["Promotion"] }),
    validatePromotion: b.mutation<Promotion, T<{ code: string; subtotal: number }>>({ queryFn: ({ tenantId, code, subtotal }) => run(() => people.validatePromotion(tenantId, code, subtotal)) }),
  }),
});

export const {
  useCustomersQuery,
  useSaveCustomerMutation,
  useAdjustPointsMutation,
  useLoyaltySettingsQuery,
  useReservationsQuery,
  useSaveReservationMutation,
  useSetReservationStatusMutation,
  useDeleteReservationMutation,
  useDeliveriesQuery,
  useRidersQuery,
  useSaveRiderMutation,
  useUpdateDeliveryMutation,
  useLedgerQuery,
  useRefundOrderMutation,
  useCashSessionsQuery,
  useOpenCashSessionMutation,
  useAddCashEntryMutation,
  useCloseCashSessionMutation,
  useExpensesQuery,
  useCreateExpenseMutation,
  useDeleteExpenseMutation,
  useStaffQuery,
  useSaveStaffMutation,
  useDeleteStaffMutation,
  useReinviteStaffMutation,
  useShiftsQuery,
  useSaveShiftMutation,
  useDeleteShiftMutation,
  useAttendanceQuery,
  useToggleClockMutation,
  useAllBranchesQuery,
  useSaveBranchMutation,
  usePromotionsQuery,
  useSavePromotionMutation,
  useDeletePromotionMutation,
  useValidatePromotionMutation,
} = peopleApi;
