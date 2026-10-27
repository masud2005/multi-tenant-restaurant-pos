import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  DollarSign,
  Download,
  Package,
  Receipt,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import {
  useSalesReportQuery,
  useFinancialReportQuery,
  useInventoryReportQuery,
  useOperationsReportQuery,
} from "@/features/stage4/api";
import { PageHeader, SkeletonCard } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/$tenantSlug/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Analytics — Tablewise POS" },
      { name: "description", content: "Comprehensive restaurant sales, financial, inventory, and operations reports." },
    ],
  }),
  component: () => (
    <RequirePermission perm="reports.view">
      <ReportsPage />
    </RequirePermission>
  ),
});

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#6366f1"];

function ReportsPage() {
  const { tenant, branch, branches } = useTenant();
  const money = useMoney();
  const [activeTab, setActiveTab] = useState("sales");
  const [range, setRange] = useState("7d");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const branchParam = selectedBranch === "all" ? undefined : selectedBranch;

  const sales = useSalesReportQuery(
    { tenantId: tenant.id, branchId: branchParam, range },
    { pollingInterval: 5000 },
  );
  const financial = useFinancialReportQuery({ tenantId: tenant.id, branchId: branchParam, range });
  const inventory = useInventoryReportQuery({ tenantId: tenant.id, branchId: branchParam });
  const operations = useOperationsReportQuery({ tenantId: tenant.id, branchId: branchParam, range });

  const exportCsv = () => {
    let csv = "data:text/csv;charset=utf-8,";
    if (activeTab === "sales" && sales.data) {
      csv += "Top Items Report\nItem Name,Quantity Sold,Revenue\n";
      sales.data.topItems.forEach((i) => {
        csv += `"${i.name}",${i.qty},${i.revenue}\n`;
      });
    } else if (activeTab === "financial" && financial.data) {
      csv += "Financial Breakdown\nMetric,Amount\n";
      csv += `Gross Sales,${financial.data.grossSales}\n`;
      csv += `Discounts,${financial.data.discounts}\n`;
      csv += `Taxes,${financial.data.taxes}\n`;
      csv += `Refunds,${financial.data.refunds}\n`;
      csv += `Net Revenue,${financial.data.netRevenue}\n`;
      csv += `Total Expenses,${financial.data.expensesTotal}\n`;
      csv += `Net Profit,${financial.data.netProfit}\n`;
    } else if (activeTab === "inventory" && inventory.data) {
      csv += "Low Stock Alert\nIngredient,Current Stock,Reorder Level,Unit Cost\n";
      inventory.data.lowStockList.forEach((i) => {
        csv += `"${i.name}",${i.stock} ${i.unit},${i.reorderLevel} ${i.unit},${i.unitCost}\n`;
      });
    } else {
      csv += "Daily Operations\nStatus,Orders Count\n";
      operations.data?.ordersByStatus.forEach((o) => {
        csv += `${o.status},${o.count}\n`;
      });
    }

    const encodedUri = encodeURI(csv);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${tenant.slug}-${activeTab}-report-${range}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Monitor sales performance, profit margins, inventory health, and kitchen velocity."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-[140px] bg-background">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
              <Download className="size-4" /> Export CSV
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="sales" className="gap-2">
            <TrendingUp className="size-4" /> Sales
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-2">
            <DollarSign className="size-4" /> Financial & Profit
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="size-4" /> Inventory & Waste
          </TabsTrigger>
          <TabsTrigger value="operations" className="gap-2">
            <UtensilsCrossed className="size-4" /> Operations & Kitchen
          </TabsTrigger>
        </TabsList>

        {/* ==================== TAB 1: SALES ==================== */}
        <TabsContent value="sales" className="space-y-6">
          {sales.isLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : sales.data ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                    <DollarSign className="size-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{money(sales.data.totalRevenue)}</div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <ArrowUpRight className="size-3 text-emerald-500" />
                      <span>+12.5% from previous period</span>
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Net Sales</CardTitle>
                    <TrendingUp className="size-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{money(sales.data.netSales)}</div>
                    <p className="text-xs text-muted-foreground mt-1">After item discounts</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
                    <ShoppingCart className="size-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{sales.data.totalOrders}</div>
                    <p className="text-xs text-muted-foreground mt-1">Completed orders</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Average Order Value</CardTitle>
                    <Receipt className="size-4 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{money(sales.data.avgOrderValue)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Avg spend per guest</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid gap-6 lg:grid-cols-7">
                <Card className="lg:col-span-4 border-border/80 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <CardTitle className="text-base font-semibold">Sales Trend</CardTitle>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold tracking-wide uppercase">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          Live Real-Time
                        </span>
                      </div>
                      <CardDescription className="text-xs mt-0.5">
                        Daily revenue and order volume (auto-synced)
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                      onClick={() => sales.refetch()}
                      disabled={sales.isFetching}
                      title="Sync latest live orders"
                    >
                      <RefreshCw className={`size-3.5 ${sales.isFetching ? "animate-spin" : ""}`} />
                      <span className="hidden sm:inline">Sync</span>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={sales.data.dailySales} margin={{ top: 10, right: 10, left: 5, bottom: 0 }}>
                          <defs>
                            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.15} stroke="var(--border)" vertical={false} />
                          <XAxis
                            dataKey="date"
                            stroke="var(--muted-foreground)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            yAxisId="revenue"
                            width={92}
                            stroke="var(--muted-foreground)"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => (val === 0 ? "0" : money(val))}
                          />
                          <YAxis
                            yAxisId="orders"
                            width={35}
                            orientation="right"
                            stroke="var(--muted-foreground)"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                            tickFormatter={(val) => `${val}`}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload || !payload.length) return null;
                              const data = payload[0].payload;
                              const revenue = Number(data.sales || 0);
                              const ordersCount = Number(data.orders || 0);
                              const avg = ordersCount > 0 ? Math.round(revenue / ordersCount) : 0;
                              return (
                                <div className="rounded-lg border border-border bg-popover/95 p-3 shadow-xl backdrop-blur-md text-xs space-y-2 min-w-[170px]">
                                  <div className="font-semibold text-foreground border-b border-border/50 pb-1 flex justify-between items-center">
                                    <span>{data.fullDate || label}</span>
                                    {label === "Today" && (
                                      <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-500 font-mono text-[10px] rounded">
                                        Today
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between text-muted-foreground">
                                    <span className="flex items-center gap-1.5">
                                      <span className="size-2 rounded-full bg-primary inline-block"></span>
                                      Revenue:
                                    </span>
                                    <span className="font-bold text-foreground font-mono">{money(revenue)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-muted-foreground">
                                    <span className="flex items-center gap-1.5">
                                      <span className="size-2 rounded-full bg-blue-500 inline-block"></span>
                                      Orders:
                                    </span>
                                    <span className="font-bold text-blue-500 font-mono">{ordersCount} orders</span>
                                  </div>
                                  {ordersCount > 0 && (
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 pt-1 border-t border-border/30">
                                      <span>Avg / Order:</span>
                                      <span className="font-medium text-foreground font-mono">{money(avg)}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            }}
                          />
                          <Legend
                            verticalAlign="top"
                            height={32}
                            formatter={(value) => <span className="text-xs text-muted-foreground font-medium">{value}</span>}
                          />
                          <Area
                            yAxisId="revenue"
                            type="monotone"
                            dataKey="sales"
                            name="Revenue"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2.5}
                            fill="url(#salesGrad)"
                          />
                          <Line
                            yAxisId="orders"
                            type="monotone"
                            dataKey="orders"
                            name="Order Volume"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: "#3b82f6", strokeWidth: 1.5, stroke: "#ffffff" }}
                            activeDot={{ r: 6, fill: "#2563eb", stroke: "#ffffff", strokeWidth: 2 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-3 border-border/80 shadow-sm flex flex-col justify-between">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-semibold">Hourly Rush Times</CardTitle>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold tracking-wide uppercase">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          Live Rush
                        </span>
                      </div>
                      <CardDescription className="text-xs mt-0.5">
                        {range === "today"
                          ? "Today's live traffic & rush distribution"
                          : `Peak order density (${range === "30d" ? "last 30 days" : "last 7 days"})`}
                      </CardDescription>
                    </div>
                    {/* Peak Rush Badge */}
                    {(() => {
                      const peak = sales.data.hourlySales.reduce(
                        (prev, curr) => (curr.orders > prev.orders ? curr : prev),
                        sales.data.hourlySales[0] || { orders: 0, hour: "", label: "", sales: 0 },
                      );
                      if (peak && peak.orders > 0) {
                        return (
                          <div className="hidden sm:flex flex-col items-end text-right">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                              Peak: {peak.hour}
                            </span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              {peak.orders} orders • {money(peak.sales)}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={sales.data.hourlySales}
                          margin={{ top: 10, right: 8, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} stroke="var(--border)" vertical={false} />
                          <XAxis
                            dataKey="hour"
                            stroke="var(--muted-foreground)"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            stroke="var(--muted-foreground)"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                            tickFormatter={(val) => `${val}`}
                          />
                          <Tooltip
                            cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload.length) return null;
                              const d = payload[0].payload;
                              const ordersCount = Number(d.orders || 0);
                              const salesVal = Number(d.sales || 0);
                              const avgVal = ordersCount > 0 ? Math.round(salesVal / ordersCount) : 0;
                              return (
                                <div className="rounded-lg border border-border bg-popover/95 p-3 shadow-xl backdrop-blur-md text-xs space-y-2 min-w-[185px]">
                                  <div className="font-semibold text-foreground border-b border-border/50 pb-1 flex items-center justify-between">
                                    <div>
                                      <div className="font-bold text-foreground text-xs">{d.label || d.hour}</div>
                                      {d.period && <div className="text-[10px] text-muted-foreground font-normal">{d.period}</div>}
                                    </div>
                                    {d.isPeak && ordersCount > 0 && (
                                      <span className="px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 font-semibold text-[10px] rounded">
                                        Peak
                                      </span>
                                    )}
                                  </div>

                                  <div className="space-y-1 pt-0.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground flex items-center gap-1.5">
                                        <span className="size-2 rounded-full bg-primary inline-block"></span>
                                        Orders Volume:
                                      </span>
                                      <span className="font-bold text-foreground font-mono">{ordersCount} orders</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground flex items-center gap-1.5">
                                        <span className="size-2 rounded-full bg-muted-foreground/50 inline-block"></span>
                                        Rush Revenue:
                                      </span>
                                      <span className="font-bold text-foreground font-mono">
                                        {money(salesVal)}
                                      </span>
                                    </div>
                                    {ordersCount > 0 && (
                                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                                        <span>Avg / Order:</span>
                                        <span className="font-mono text-foreground">{money(avgVal)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="orders" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Footer KPI bar */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 text-center">
                      <div className="p-1.5 rounded-md bg-muted/40">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Rush Orders</p>
                        <p className="text-xs font-bold font-mono text-foreground">
                          {sales.data.hourlySales.reduce((sum, h) => sum + h.orders, 0)}
                        </p>
                      </div>
                      <div className="p-1.5 rounded-md bg-muted/40">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Rush Sales</p>
                        <p className="text-xs font-bold font-mono text-foreground">
                          {money(sales.data.hourlySales.reduce((sum, h) => sum + h.sales, 0))}
                        </p>
                      </div>
                      <div className="p-1.5 rounded-md bg-muted/40">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Sync State</p>
                        <p className="text-xs font-semibold text-emerald-500 flex items-center justify-center gap-1">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Real-time
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Selling Items & Categories */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-border/80 shadow-sm flex flex-col justify-between">
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-semibold">Top Selling Food Items</CardTitle>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold tracking-wide uppercase">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          Live Items
                        </span>
                      </div>
                      <CardDescription className="text-xs mt-0.5">
                        {range === "today"
                          ? "Today's highest volume & revenue dishes"
                          : `Top dishes ranked by revenue (${range === "30d" ? "last 30 days" : "last 7 days"})`}
                      </CardDescription>
                    </div>
                    {sales.data.topItems.length > 0 && (
                      <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full font-mono">
                        {sales.data.topItems.reduce((acc, i) => acc + i.qty, 0)} items sold
                      </span>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {sales.data.topItems.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        <p className="text-sm">No food items sold in this period yet.</p>
                        <p className="text-xs mt-1 text-muted-foreground/70">
                          New orders placed in the POS will appear here live in real time.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {sales.data.topItems.map((item, idx) => {
                          const percentage = item.percentage ?? 0;
                          return (
                            <div key={item.itemId} className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span
                                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                      idx === 0
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : idx === 1
                                        ? "bg-muted text-foreground font-semibold"
                                        : idx === 2
                                        ? "bg-muted/80 text-muted-foreground font-semibold"
                                        : "bg-muted/50 text-muted-foreground"
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm text-foreground truncate" title={item.name}>
                                      {item.name}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      <span className="font-semibold text-foreground">{item.qty} units</span> sold
                                      {item.avgPrice ? ` • Avg: ${money(item.avgPrice)}` : ""}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-bold text-sm font-mono text-foreground">{money(item.revenue)}</p>
                                  {percentage > 0 && (
                                    <p className="text-[10px] text-muted-foreground font-medium">
                                      {percentage}% of sales
                                    </p>
                                  )}
                                </div>
                              </div>
                              {/* Visual Progress Bar */}
                              <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                                  style={{ width: `${Math.max(percentage, 4)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/80 shadow-sm flex flex-col justify-between">
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                      <CardTitle className="text-base font-semibold">Sales by Menu Category</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Category contribution to food revenue
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={sales.data.salesByCategory}
                            dataKey="revenue"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name }) => name}
                          >
                            {sales.data.salesByCategory.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "var(--popover)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              fontSize: 12,
                              color: "var(--foreground)",
                            }}
                            formatter={(val: any) => [money(Number(val)), "Revenue"]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* ==================== TAB 2: FINANCIAL ==================== */}
        <TabsContent value="financial" className="space-y-6">
          {financial.data && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Gross Sales</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{money(financial.data.grossSales)}</div>
                    <span className="text-xs text-muted-foreground">Before deductions</span>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Refunds Issued</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">-{money(financial.data.refunds)}</div>
                    <span className="text-xs text-muted-foreground">Processed returns</span>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Total Expenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-500">-{money(financial.data.expensesTotal)}</div>
                    <span className="text-xs text-muted-foreground">Operational overhead</span>
                  </CardContent>
                </Card>

                <Card className="border-primary/50 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-primary font-bold">Estimated Net Profit</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{money(financial.data.netProfit)}</div>
                    <span className="text-xs text-muted-foreground">Net revenue minus expenses</span>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Tax & Duty Summary</CardTitle>
                    <CardDescription>Collected regulatory fees</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between py-2 border-b">
                      <span>Value Added Tax (VAT / Sales Tax)</span>
                      <span className="font-semibold">{money(financial.data.taxes)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span>Service Charges Collected</span>
                      <span className="font-semibold">{money(financial.data.serviceCharges)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span>Discounts & Promotions Given</span>
                      <span className="font-semibold text-destructive">-{money(financial.data.discounts)}</span>
                    </div>
                    <div className="flex justify-between pt-2 text-base font-bold">
                      <span>Net Settled Revenue</span>
                      <span className="text-primary">{money(financial.data.netRevenue)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Payment Method Breakdown</CardTitle>
                    <CardDescription>Cash, Card, and Digital QR shares</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {financial.data.byPaymentMethod.map((p) => (
                        <div key={p.method} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {p.method}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{p.count} transactions</span>
                          </div>
                          <span className="font-semibold">{money(p.total)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ==================== TAB 3: INVENTORY ==================== */}
        <TabsContent value="inventory" className="space-y-6">
          {inventory.data && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Total Stock Valuation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{money(inventory.data.totalValuation)}</div>
                    <span className="text-xs text-muted-foreground">Across {inventory.data.totalItems} ingredients</span>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Low Stock Warnings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{inventory.data.lowStockCount} items</div>
                    <span className="text-xs text-muted-foreground">At or below reorder threshold</span>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Wastage / Spoilage Cost</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-500">{money(inventory.data.wastageCost)}</div>
                    <span className="text-xs text-muted-foreground">Recorded kitchen waste</span>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Ingredients Requiring Reorder</CardTitle>
                    <CardDescription>Critical inventory to replenish soon</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {inventory.data.lowStockList.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">All ingredients have healthy stock levels.</p>
                    ) : (
                      <div className="space-y-3">
                        {inventory.data.lowStockList.map((i) => (
                          <div key={i.id} className="flex items-center justify-between border-b pb-2">
                            <div>
                              <p className="font-medium text-sm">{i.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Reorder trigger: {i.reorderLevel} {i.unit}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge variant="destructive">
                                {i.stock} {i.unit} left
                              </Badge>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{money(i.unitCost)} / unit</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Stock Movements</CardTitle>
                    <CardDescription>Sales, purchases, waste, and adjustments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {inventory.data.topMovements.map((m, idx) => (
                        <div key={idx} className="flex items-center justify-between border-b pb-2">
                          <div>
                            <p className="font-medium text-sm">{m.name}</p>
                            <span className="text-xs capitalize text-muted-foreground">{m.reason}</span>
                          </div>
                          <span className={m.qty > 0 ? "text-emerald-500 font-semibold" : "text-destructive font-semibold"}>
                            {m.qty > 0 ? `+${m.qty}` : m.qty}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ==================== TAB 4: OPERATIONS ==================== */}
        <TabsContent value="operations" className="space-y-6">
          {operations.data && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Avg Kitchen Prep Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{operations.data.avgPrepTimeMinutes} mins</div>
                    <span className="text-xs text-muted-foreground">From ticket sent to kitchen bump</span>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Kitchen Bumps (Fulfilled)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-500">{operations.data.kitchenBumpsCount} orders</div>
                    <span className="text-xs text-muted-foreground">Delivered from line</span>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Active Staff Roster</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{operations.data.staffShiftsSummary.length} scheduled</div>
                    <span className="text-xs text-muted-foreground">Across assigned branches</span>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Order Distribution by Type</CardTitle>
                    <CardDescription>Dine-in, takeaway, and delivery shares</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {operations.data.ordersByType.map((t) => (
                        <div key={t.type} className="flex items-center justify-between border-b pb-2">
                          <span className="capitalize font-medium text-sm">{t.type.replace("_", " ")}</span>
                          <div className="text-right">
                            <span className="font-semibold text-sm">{money(t.revenue)}</span>
                            <p className="text-xs text-muted-foreground">{t.count} orders</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Table Turnover & Productivity</CardTitle>
                    <CardDescription>Revenue contribution by dining table</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {operations.data.tableTurnover.map((tbl) => (
                        <div key={tbl.tableId} className="flex items-center justify-between border-b pb-2">
                          <div>
                            <p className="font-medium text-sm">{tbl.name}</p>
                            <p className="text-xs text-muted-foreground">{tbl.orderCount} parties seated</p>
                          </div>
                          <span className="font-semibold text-sm">{money(tbl.totalRevenue)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
