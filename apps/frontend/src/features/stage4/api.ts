import { baseApi, run } from "@/app/base-api";
import * as stage4 from "@/services/stage4.service";
import type {
  AuditEntity,
  AuditLog,
  AuditLogQueryParams,
  AuditLogStats,
  PaginatedAuditLogs,
  FinancialReport,
  Integration,
  InventoryReport,
  OperationsReport,
  SalesReport,
  Tenant,
  TenantSettingsInput,
} from "@/types/domain";

type T<A = Record<string, never>> = { tenantId: string } & A;

const apiWithTags = baseApi.enhanceEndpoints({
  addTagTypes: ["Reports", "Audit", "Integrations", "Settings"],
});

export const stage4Api = apiWithTags.injectEndpoints({
  endpoints: (b) => ({
    // ---- Reports ----
    salesReport: b.query<SalesReport, T<{ branchId?: string | undefined; range?: string | undefined }>>({
      queryFn: ({ tenantId, branchId, range }) => run(() => stage4.getSalesReport(tenantId, branchId, range)),
      providesTags: ["Reports", { type: "Order", id: "LIST" }, "Order"],
    }),
    financialReport: b.query<FinancialReport, T<{ branchId?: string | undefined; range?: string | undefined }>>({
      queryFn: ({ tenantId, branchId, range }) => run(() => stage4.getFinancialReport(tenantId, branchId, range)),
      providesTags: ["Reports", { type: "Order", id: "LIST" }, "Order"],
    }),
    inventoryReport: b.query<InventoryReport, T<{ branchId?: string | undefined }>>({
      queryFn: ({ tenantId, branchId }) => run(() => stage4.getInventoryReport(tenantId, branchId)),
      providesTags: ["Reports", "Inventory"],
    }),
    operationsReport: b.query<OperationsReport, T<{ branchId?: string | undefined; range?: string | undefined }>>({
      queryFn: ({ tenantId, branchId, range }) => run(() => stage4.getOperationsReport(tenantId, branchId, range)),
      providesTags: ["Reports", { type: "Order", id: "LIST" }, "Order"],
    }),

    // ---- Audit Logs ----
    auditLogs: b.query<PaginatedAuditLogs, T<AuditLogQueryParams>>({
      queryFn: ({ tenantId, ...params }) => run(() => stage4.listAuditLogs(tenantId, params)),
      providesTags: ["Audit"],
    }),
    auditLogStats: b.query<AuditLogStats, string>({
      queryFn: (tenantId) => run(() => stage4.getAuditLogStats(tenantId)),
      providesTags: ["Audit"],
    }),
    recordAuditLog: b.mutation<
      AuditLog,
      T<{
        actorId?: string;
        actorName: string;
        actorRole?: string;
        action: string;
        entity: AuditEntity | string;
        entityId?: string;
        summary: string;
        details?: string;
        branchId?: string;
        metadata?: Record<string, unknown>;
      }>
    >({
      queryFn: ({ tenantId, ...input }) => run(() => stage4.recordAuditLog(tenantId, input)),
      invalidatesTags: ["Audit"],
    }),

    // ---- Integrations ----
    integrations: b.query<Integration[], string>({
      queryFn: (tenantId) => run(() => stage4.listIntegrations(tenantId)),
      providesTags: ["Integrations"],
    }),
    toggleIntegration: b.mutation<Integration, T<{ integrationId: string; enabled: boolean; config?: Record<string, string> }>>({
      queryFn: ({ tenantId, integrationId, enabled, config }) =>
        run(() => stage4.toggleIntegration(tenantId, integrationId, enabled, config)),
      invalidatesTags: ["Integrations", "Audit"],
    }),

    // ---- Tenant Settings ----
    updateSettings: b.mutation<Tenant, T<TenantSettingsInput>>({
      queryFn: ({ tenantId, ...input }) => run(() => stage4.updateTenantSettings(tenantId, input)),
      invalidatesTags: ["Tenant", "Settings", "Audit"],
    }),
  }),
});

export const {
  useSalesReportQuery,
  useFinancialReportQuery,
  useInventoryReportQuery,
  useOperationsReportQuery,
  useAuditLogsQuery,
  useAuditLogStatsQuery,
  useRecordAuditLogMutation,
  useIntegrationsQuery,
  useToggleIntegrationMutation,
  useUpdateSettingsMutation,
} = stage4Api;
