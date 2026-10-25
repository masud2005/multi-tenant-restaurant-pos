import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  Award,
  Check,
  CheckCircle2,
  ChevronRight,
  Coins,
  Crown,
  Gift,
  HelpCircle,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { RequirePermission } from "@/features/tenant/require-permission";
import { useTenant } from "@/features/tenant/tenant-context";
import { useMoney } from "@/features/tenant/use-money";
import { PageHeader } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  getCustomersApi,
  getCustomerByIdApi,
  createCustomerApi,
  updateCustomerApi,
  deleteCustomerApi,
  type BackendCustomer,
} from "@/services/customer.service";
import {
  getLoyaltySettingsApi,
  updateLoyaltySettingsApi,
  getLoyaltyTiersApi,
  getTierByIdApi,
  createLoyaltyTierApi,
  updateLoyaltyTierApi,
  deleteLoyaltyTierApi,
  type BackendLoyaltySettings,
  type BackendLoyaltyTier,
} from "@/services/loyalty.service";

export const Route = createFileRoute("/app/$tenantSlug/customers")({
  head: () => ({
    meta: [
      { title: "Customers & Loyalty Program — Tablewise POS" },
      {
        name: "description",
        content:
          "Manage guest profiles, tier hierarchy, reward rules, and point balances.",
      },
    ],
  }),
  component: () => (
    <RequirePermission perm="customers.manage">
      <CustomersAndLoyaltyPage />
    </RequirePermission>
  ),
});

function CustomersAndLoyaltyPage() {
  const { tenant } = useTenant();
  const money = useMoney();

  // Active Tab State
  const [activeTab, setActiveTab] = useState<"customers" | "tiers" | "settings">("customers");

  // Live Backend Customers State
  const [customers, setCustomers] = useState<BackendCustomer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Live Loyalty Settings & Tiers
  const [settings, setSettings] = useState<BackendLoyaltySettings>({
    id: "",
    tenantId: "",
    isEnabled: true,
    spendAmountPerPoint: 100,
    pointValue: 1.0,
    minPointsToRedeem: 20,
    maxPointsPerOrder: 500,
    expireAfterDays: 365,
    createdAt: "",
    updatedAt: "",
  });
  const [settingsFormData, setSettingsFormData] = useState({
    isEnabled: true,
    spendAmountPerPoint: "100",
    pointValue: "1.0",
    minPointsToRedeem: "20",
    maxPointsPerOrder: "500",
    expireAfterDays: "365",
  });
  const [tiers, setTiers] = useState<BackendLoyaltyTier[]>([]);
  const [isLoadingTiers, setIsLoadingTiers] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("ALL");

  // Customer Detail Drawer & Modals
  const [selectedCustomer, setSelectedCustomer] = useState<BackendCustomer | null>(null);
  const [isLoadingCustomerDetail, setIsLoadingCustomerDetail] = useState(false);

  // Add / Edit Customer Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<BackendCustomer | null>(null);
  const [customerFormData, setCustomerFormData] = useState({
    name: "",
    phone: "",
    address: "",
    notes: "",
    tierId: "",
    initialPoints: 50,
  });
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

  // Delete Customer Confirmation Dialog
  const [customerToDelete, setCustomerToDelete] = useState<BackendCustomer | null>(null);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);

  // Loyalty Tier Modal
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<BackendLoyaltyTier | null>(null);
  const [tierFormData, setTierFormData] = useState({
    name: "",
    minSpend: 0,
    pointMultiplier: 1.0,
    discountPercent: 0,
    color: "#B45309",
    description: "",
  });
  const [isSubmittingTier, setIsSubmittingTier] = useState(false);
  const [tierToDelete, setTierToDelete] = useState<BackendLoyaltyTier | null>(null);
  const [isDeletingTier, setIsDeletingTier] = useState(false);

  // Point Adjustment in Drawer
  const [adjustPts, setAdjustPts] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [isAdjustingPoints, setIsAdjustingPoints] = useState(false);

  // ==========================================
  // API INTEGRATION: FETCH CUSTOMERS
  // ==========================================
  const loadCustomers = useCallback(async () => {
    if (!tenant?.slug) return;
    try {
      setIsLoadingCustomers(true);
      const res = await getCustomersApi(tenant.slug, {
        search: searchQuery.trim() || undefined,
      });
      setCustomers(res.items || []);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      console.warn("Could not load customers from backend API:", err);
      toast.error(err.message || "Failed to load customers from backend");
    } finally {
      setIsLoadingCustomers(false);
    }
  }, [tenant?.slug, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadCustomers]);

  // ==========================================
  // API INTEGRATION: FETCH LOYALTY DATA
  // ==========================================
  const loadLoyaltyData = useCallback(async () => {
    if (!tenant?.slug) return;
    try {
      setIsLoadingTiers(true);
      const [fetchedSettings, fetchedTiers] = await Promise.all([
        getLoyaltySettingsApi(tenant.slug).catch(() => null),
        getLoyaltyTiersApi(tenant.slug).catch(() => []),
      ]);
      if (fetchedSettings) {
        setSettings(fetchedSettings);
        setSettingsFormData({
          isEnabled: fetchedSettings.isEnabled,
          spendAmountPerPoint: String(fetchedSettings.spendAmountPerPoint),
          pointValue: String(fetchedSettings.pointValue),
          minPointsToRedeem: String(fetchedSettings.minPointsToRedeem),
          maxPointsPerOrder:
            fetchedSettings.maxPointsPerOrder != null
              ? String(fetchedSettings.maxPointsPerOrder)
              : "",
          expireAfterDays:
            fetchedSettings.expireAfterDays != null
              ? String(fetchedSettings.expireAfterDays)
              : "",
        });
      }
      if (fetchedTiers) setTiers(fetchedTiers.sort((a, b) => a.minSpend - b.minSpend));
    } catch (err) {
      console.warn("Could not load loyalty settings or tiers:", err);
    } finally {
      setIsLoadingTiers(false);
    }
  }, [tenant?.slug]);

  useEffect(() => {
    loadLoyaltyData();
  }, [loadLoyaltyData]);

  // ==========================================
  // VIEW CUSTOMER DETAILS
  // ==========================================
  const handleSelectCustomer = async (c: BackendCustomer) => {
    setSelectedCustomer(c);
    if (!tenant?.slug) return;
    try {
      setIsLoadingCustomerDetail(true);
      const full = await getCustomerByIdApi(tenant.slug, c.id);
      setSelectedCustomer(full);
    } catch (err) {
      console.error("Could not fetch full customer details:", err);
    } finally {
      setIsLoadingCustomerDetail(false);
    }
  };

  // Filter customers locally by tier if requested
  const displayedCustomers = customers.filter((c) => {
    if (tierFilter === "ALL") return true;
    return c.tierId === tierFilter;
  });

  // Calculate high-level KPIs
  const totalPointsInCirculation = customers.reduce((sum, c) => sum + (c.loyaltyPoints || 0), 0);
  const totalValueInCurrency = totalPointsInCirculation * (settings.pointValue || 1.0);
  const totalLifetimeSpent = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);

  // ==========================================
  // OPEN ADD / EDIT CUSTOMER MODAL
  // ==========================================
  const openCreateCustomerModal = () => {
    setEditingCustomer(null);
    setCustomerFormData({
      name: "",
      phone: "",
      address: "",
      notes: "",
      tierId: tiers[0]?.id || "",
      initialPoints: 50,
    });
    setIsCustomerModalOpen(true);
  };

  const openEditCustomerModal = (c: BackendCustomer) => {
    setEditingCustomer(c);
    setCustomerFormData({
      name: c.name || "",
      phone: c.phone || "",
      address: c.address || "",
      notes: c.notes || "",
      tierId: c.tierId || "",
      initialPoints: 0,
    });
    setIsCustomerModalOpen(true);
  };

  // ==========================================
  // API INTEGRATION: SAVE CUSTOMER (CREATE / UPDATE)
  // ==========================================
  const handleSaveCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tenant?.slug) {
      toast.error("Restaurant tenant not active");
      return;
    }

    const name = customerFormData.name.trim();
    const phone = customerFormData.phone.trim();
    const address = customerFormData.address.trim();
    const notes = customerFormData.notes.trim();
    const tierId = customerFormData.tierId || undefined;

    if (!name) {
      toast.error("Customer name is required");
      return;
    }
    if (!phone) {
      toast.error("Customer phone number is required");
      return;
    }

    try {
      setIsSubmittingCustomer(true);

      if (editingCustomer) {
        // UPDATE API
        const updated = await updateCustomerApi(tenant.slug, editingCustomer.id, {
          name,
          phone,
          address: address || undefined,
          notes: notes || undefined,
          tierId,
        });

        setCustomers((prev) =>
          prev.map((c) => (c.id === editingCustomer.id ? { ...c, ...updated } : c)),
        );
        if (selectedCustomer?.id === editingCustomer.id) {
          setSelectedCustomer((prev) => (prev ? { ...prev, ...updated } : null));
        }

        toast.success(`Customer "${name}" updated successfully!`);
      } else {
        // CREATE API
        const created = await createCustomerApi(tenant.slug, {
          name,
          phone,
          address: address || undefined,
          notes: notes || undefined,
          tierId,
          initialPoints: customerFormData.initialPoints > 0 ? customerFormData.initialPoints : undefined,
        });

        setCustomers((prev) => [created, ...prev]);
        setTotalCount((prev) => prev + 1);

        toast.success(`Customer "${name}" registered successfully!`, {
          description: customerFormData.initialPoints > 0
            ? `Awarded +${customerFormData.initialPoints} Welcome Bonus points automatically.`
            : undefined,
        });
      }

      setIsCustomerModalOpen(false);
      setEditingCustomer(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to save customer");
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  // ==========================================
  // API INTEGRATION: DELETE CUSTOMER
  // ==========================================
  const confirmDeleteCustomer = async () => {
    if (!customerToDelete || !tenant?.slug) return;

    try {
      setIsDeletingCustomer(true);
      await deleteCustomerApi(tenant.slug, customerToDelete.id);

      setCustomers((prev) => prev.filter((c) => c.id !== customerToDelete.id));
      setTotalCount((prev) => Math.max(0, prev - 1));

      if (selectedCustomer?.id === customerToDelete.id) {
        setSelectedCustomer(null);
      }

      toast.success(`Customer "${customerToDelete.name}" deleted successfully.`);
      setCustomerToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete customer");
    } finally {
      setIsDeletingCustomer(false);
    }
  };

  // ==========================================
  // API INTEGRATION: QUICK POINT ADJUSTMENT
  // ==========================================
  const handlePointAdjustment = async (customer: BackendCustomer, isAdd: boolean) => {
    if (!tenant?.slug) return;
    const pointsNum = parseInt(adjustPts, 10);
    if (!pointsNum || pointsNum <= 0) {
      toast.error("Please enter a valid positive points number");
      return;
    }
    if (!isAdd && (customer.loyaltyPoints || 0) < pointsNum) {
      toast.error(`Customer only has ${customer.loyaltyPoints || 0} points available`);
      return;
    }

    const signedPoints = isAdd ? pointsNum : -pointsNum;
    const newPoints = Math.max(0, (customer.loyaltyPoints || 0) + signedPoints);

    try {
      setIsAdjustingPoints(true);
      const updated = await updateCustomerApi(tenant.slug, customer.id, {
        loyaltyPoints: newPoints,
      });

      // Refetch full customer to include newly generated LoyaltyTransaction ledger entry
      const full = await getCustomerByIdApi(tenant.slug, customer.id).catch(() => updated);
      setSelectedCustomer(full);
      setCustomers((prev) =>
        prev.map((c) => (c.id === customer.id ? { ...c, ...updated } : c)),
      );
      setAdjustPts("");
      setAdjustReason("");

      toast.success(
        isAdd
          ? `Added +${pointsNum} bonus points to ${customer.name}`
          : `Redeemed -${pointsNum} points for ${customer.name}`,
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to adjust points balance");
    } finally {
      setIsAdjustingPoints(false);
    }
  };

  // ==========================================
  // API INTEGRATION: LOYALTY SETTINGS SAVE
  // ==========================================
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.slug) return;

    const spendAmount = Number(settingsFormData.spendAmountPerPoint);
    if (isNaN(spendAmount) || spendAmount <= 0) {
      toast.error("Spend amount per point must be greater than 0");
      return;
    }

    const pointVal = Number(settingsFormData.pointValue);
    if (isNaN(pointVal) || pointVal <= 0) {
      toast.error("Point redemption value must be greater than 0");
      return;
    }

    const minRedeem = Number(settingsFormData.minPointsToRedeem);
    if (isNaN(minRedeem) || minRedeem < 0) {
      toast.error("Minimum points to redeem must be 0 or greater");
      return;
    }

    const maxOrder = settingsFormData.maxPointsPerOrder.trim()
      ? Number(settingsFormData.maxPointsPerOrder)
      : null;
    if (maxOrder !== null && (isNaN(maxOrder) || maxOrder <= 0)) {
      toast.error("Max points per order must be greater than 0");
      return;
    }

    const expireDays = settingsFormData.expireAfterDays.trim()
      ? Number(settingsFormData.expireAfterDays)
      : null;
    if (expireDays !== null && (isNaN(expireDays) || expireDays < 1)) {
      toast.error("Expiry duration must be at least 1 day");
      return;
    }

    try {
      setIsSavingSettings(true);
      const saved = await updateLoyaltySettingsApi(tenant.slug, {
        isEnabled: settingsFormData.isEnabled,
        spendAmountPerPoint: spendAmount,
        pointValue: pointVal,
        minPointsToRedeem: Math.round(minRedeem),
        maxPointsPerOrder: maxOrder !== null ? Math.round(maxOrder) : null,
        expireAfterDays: expireDays !== null ? Math.round(expireDays) : null,
      });

      setSettings(saved);
      setSettingsFormData({
        isEnabled: saved.isEnabled,
        spendAmountPerPoint: String(saved.spendAmountPerPoint),
        pointValue: String(saved.pointValue),
        minPointsToRedeem: String(saved.minPointsToRedeem),
        maxPointsPerOrder:
          saved.maxPointsPerOrder != null ? String(saved.maxPointsPerOrder) : "",
        expireAfterDays:
          saved.expireAfterDays != null ? String(saved.expireAfterDays) : "",
      });

      toast.success("Loyalty settings updated successfully!", {
        description: `Guests earn 1 pt per ${money(saved.spendAmountPerPoint)} spent. Redemption value: ${money(saved.pointValue)}/pt.`,
      });
    } catch (err: any) {
      console.error("Failed to update loyalty settings:", err);
      toast.error(err.message || "Failed to update loyalty settings");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // ==========================================
  // API INTEGRATION: CREATE / UPDATE TIER
  // ==========================================
  const openCreateTierModal = () => {
    setEditingTier(null);
    setTierFormData({
      name: "",
      minSpend: 0,
      pointMultiplier: 1.0,
      discountPercent: 0,
      color: "#B45309",
      description: "",
    });
    setIsTierModalOpen(true);
  };

  const openEditTierModal = (tier: BackendLoyaltyTier) => {
    setEditingTier(tier);
    setTierFormData({
      name: tier.name,
      minSpend: tier.minSpend,
      pointMultiplier: tier.pointMultiplier,
      discountPercent: tier.discountPercent,
      color: tier.color,
      description: tier.description || "",
    });
    setIsTierModalOpen(true);
  };

  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.slug) return;

    if (!tierFormData.name.trim()) {
      toast.error("Tier name is required");
      return;
    }

    try {
      setIsSubmittingTier(true);
      if (editingTier) {
        const updated = await updateLoyaltyTierApi(tenant.slug, editingTier.id, {
          name: tierFormData.name.trim(),
          minSpend: Number(tierFormData.minSpend) || 0,
          pointMultiplier: Number(tierFormData.pointMultiplier) || 1.0,
          discountPercent: Number(tierFormData.discountPercent) || 0,
          color: tierFormData.color,
          description: tierFormData.description.trim() || undefined,
        });
        setTiers((prev) =>
          prev
            .map((t) => (t.id === editingTier.id ? updated : t))
            .sort((a, b) => a.minSpend - b.minSpend),
        );
        toast.success(`Tier "${updated.name}" updated successfully!`);
      } else {
        const created = await createLoyaltyTierApi(tenant.slug, {
          name: tierFormData.name.trim(),
          minSpend: Number(tierFormData.minSpend) || 0,
          pointMultiplier: Number(tierFormData.pointMultiplier) || 1.0,
          discountPercent: Number(tierFormData.discountPercent) || 0,
          color: tierFormData.color,
          description: tierFormData.description.trim() || undefined,
          sortOrder: tiers.length,
        });
        setTiers((prev) =>
          [...prev, created].sort((a, b) => a.minSpend - b.minSpend),
        );
        toast.success(`Loyalty tier "${created.name}" created successfully!`);
      }
      setIsTierModalOpen(false);
      setEditingTier(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to save loyalty tier");
    } finally {
      setIsSubmittingTier(false);
    }
  };

  const confirmDeleteTier = async () => {
    if (!tierToDelete || !tenant?.slug) return;
    try {
      setIsDeletingTier(true);
      await deleteLoyaltyTierApi(tenant.slug, tierToDelete.id);
      setTiers((prev) => prev.filter((t) => t.id !== tierToDelete.id));
      toast.success(`Tier "${tierToDelete.name}" deleted successfully.`);
      setTierToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete tier");
    } finally {
      setIsDeletingTier(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ========================================================================= */}
      {/* 1. PAGE HEADER                                                            */}
      {/* ========================================================================= */}
      <PageHeader
        title="Customers & Loyalty Program"
        description="Grow repeat visits with automated loyalty tiers, point earnings, and guest relationship management."
        actions={
          <div className="flex items-center gap-2">
            {activeTab === "customers" && (
              <Button
                onClick={openCreateCustomerModal}
                className="gap-2 shadow-sm"
              >
                <Plus className="size-4" /> Add Customer
              </Button>
            )}
            {activeTab === "tiers" && (
              <Button
                onClick={openCreateTierModal}
                className="gap-2 shadow-sm"
              >
                <Plus className="size-4" /> Create New Tier
              </Button>
            )}
            {activeTab === "settings" && (
              <Badge
                variant="outline"
                className={`gap-1.5 py-1 px-3 text-xs ${
                  settings.isEnabled
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                <CheckCircle2 className="size-3.5" />
                {settings.isEnabled ? "Program Active" : "Program Disabled"}
              </Badge>
            )}
          </div>
        }
      />

      {/* ========================================================================= */}
      {/* 2. STATS KPI CARDS                                                        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Registered Guests</p>
              <h3 className="text-2xl font-bold tracking-tight mt-1">{totalCount}</h3>
              <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                <TrendingUp className="size-3" /> Live from Backend API
              </p>
            </div>
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Users className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Tiers</p>
              <h3 className="text-2xl font-bold tracking-tight mt-1">{tiers.length} Tiers</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Automated Progression</p>
            </div>
            <div className="size-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Crown className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Points in Balance</p>
              <h3 className="text-2xl font-bold tracking-tight mt-1 tabular-nums">
                {totalPointsInCirculation.toLocaleString()} pts
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Value: {money(totalValueInCurrency)}
              </p>
            </div>
            <div className="size-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
              <Coins className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Guest Spend</p>
              <h3 className="text-2xl font-bold tracking-tight mt-1">
                {money(totalLifetimeSpent)}
              </h3>
              <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                <Sparkles className="size-3" /> High customer retention
              </p>
            </div>
            <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Wallet className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* 3. TABS CONTAINER                                                         */}
      {/* ========================================================================= */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "customers" | "tiers" | "settings")}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
          <TabsList className="bg-muted/80 p-1 rounded-lg">
            <TabsTrigger value="customers" className="gap-2 px-4 py-2 text-sm">
              <Users className="size-4" />
              <span>Guests & Customers</span>
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0 h-5">
                {displayedCustomers.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="tiers" className="gap-2 px-4 py-2 text-sm">
              <Crown className="size-4 text-amber-500" />
              <span>Loyalty Tiers</span>
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0 h-5">
                {tiers.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 px-4 py-2 text-sm">
              <Sliders className="size-4" />
              <span>Point Rules & Settings</span>
            </TabsTrigger>
          </TabsList>

          {activeTab === "customers" && (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadCustomers}
                className="size-8 p-0 text-muted-foreground hover:text-foreground"
                title="Refresh from Backend"
              >
                <RefreshCw className={`size-3.5 ${isLoadingCustomers ? "animate-spin" : ""}`} />
              </Button>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <HelpCircle className="size-3.5" />
                Click any guest row to view history & points.
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: GUESTS & CUSTOMERS TABLE                                           */}
        {/* ========================================================================= */}
        <TabsContent value="customers" className="space-y-4 m-0 focus-visible:outline-none">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search guest by name or phone number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-background"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Tier:</span>
              <Button
                variant={tierFilter === "ALL" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setTierFilter("ALL")}
                className="text-xs h-8"
              >
                All
              </Button>
              {tiers.map((t) => (
                <Button
                  key={t.id}
                  variant={tierFilter === t.id ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setTierFilter(t.id)}
                  className="text-xs h-8 flex items-center gap-1.5"
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: t.color }} />
                  {t.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Customers Data Table */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Guest Profile</th>
                    <th className="px-4 py-3">Phone Number</th>
                    <th className="px-4 py-3 text-center">Membership Tier</th>
                    <th className="px-4 py-3 text-right">Points Balance</th>
                    <th className="px-4 py-3 text-right">Total Spent</th>
                    <th className="px-4 py-3 text-right">Created Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoadingCustomers ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                        <Loader2 className="size-6 animate-spin mx-auto text-primary mb-2" />
                        <p className="font-medium text-xs">Loading customers from backend...</p>
                      </td>
                    </tr>
                  ) : displayedCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                        <Users className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="font-medium">No customers found</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Click &quot;Add Customer&quot; above to register your first guest!
                        </p>
                      </td>
                    </tr>
                  ) : (
                    displayedCustomers.map((c) => {
                      const tierName = c.tier?.name || "Bronze Member";
                      const tierColor = c.tier?.color || "#B45309";

                      return (
                        <tr
                          key={c.id}
                          onClick={() => handleSelectCustomer(c)}
                          className="cursor-pointer hover:bg-muted/40 transition-colors group"
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="size-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs ring-2 ring-primary/20">
                                {c.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                                  {c.name}
                                </p>
                                {c.address ? (
                                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                    {c.address}
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">No address</p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-xs text-foreground/90 font-medium">
                            {c.phone}
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <Badge
                              variant="outline"
                              className="font-medium text-xs border"
                              style={{
                                borderColor: `${tierColor}40`,
                                backgroundColor: `${tierColor}15`,
                                color: tierColor,
                              }}
                            >
                              <Crown className="size-3 mr-1" />
                              {tierName}
                            </Badge>
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <span className="font-bold text-base text-foreground tabular-nums">
                              {c.loyaltyPoints || 0}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">pts</span>
                            <p className="text-[11px] text-emerald-600 font-medium">
                              ≈ {money((c.loyaltyPoints || 0) * (settings.pointValue || 1.0))}
                            </p>
                          </td>

                          <td className="px-4 py-3.5 text-right font-medium">
                            {money(c.totalSpent || 0)}
                          </td>

                          <td className="px-4 py-3.5 text-right text-xs text-muted-foreground">
                            {c.createdAt ? format(new Date(c.createdAt), "dd MMM yyyy") : "—"}
                          </td>

                          <td
                            className="px-4 py-3.5 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditCustomerModal(c)}
                                className="size-8 p-0"
                                title="Edit Customer"
                              >
                                <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setCustomerToDelete(c)}
                                className="size-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="Delete Customer"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSelectCustomer(c)}
                                className="size-8 p-0 text-muted-foreground group-hover:text-primary"
                                title="View History"
                              >
                                <ChevronRight className="size-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: LOYALTY TIERS GRID                                                 */}
        {/* ========================================================================= */}
        <TabsContent value="tiers" className="space-y-6 m-0 focus-visible:outline-none">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/30 p-4 rounded-xl border">
            <div>
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Crown className="size-5 text-amber-500" />
                Membership Tier Hierarchy
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Guests automatically advance tiers when their spending reaches the threshold.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadLoyaltyData}
                disabled={isLoadingTiers}
                className="gap-1.5 h-9"
                title="Refresh Tiers from Backend"
              >
                <RefreshCw className={`size-3.5 ${isLoadingTiers ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </Button>
              <Button
                onClick={openCreateTierModal}
                size="sm"
                className="gap-1.5 h-9 shadow-sm"
              >
                <Plus className="size-4" /> Add New Tier
              </Button>
            </div>
          </div>

          {/* Tier Cards Grid / Loading State / Empty State */}
          {isLoadingTiers ? (
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="size-8 animate-spin mx-auto text-primary mb-3" />
              <p className="text-sm font-medium">Loading loyalty tiers from backend...</p>
            </div>
          ) : tiers.length === 0 ? (
            <div className="py-16 text-center border rounded-xl bg-card p-6">
              <Crown className="size-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-semibold text-base">No loyalty tiers configured yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Create membership tiers like Bronze, Silver, or Gold to reward frequent diners.
              </p>
              <Button onClick={openCreateTierModal} size="sm" className="gap-1.5">
                <Plus className="size-4" /> Create Your First Tier
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {tiers.map((tier, idx) => (
              <Card
                key={tier.id}
                className="relative overflow-hidden border shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
              >
                <div className="h-2 w-full" style={{ backgroundColor: tier.color }} />

                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className="font-bold text-xs"
                      style={{
                        borderColor: `${tier.color}40`,
                        backgroundColor: `${tier.color}15`,
                        color: tier.color,
                      }}
                    >
                      <Crown className="size-3 mr-1" />
                      Level {idx + 1}
                    </Badge>

                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => openEditTierModal(tier)}
                        title="Edit Tier"
                      >
                        <Pencil className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setTierToDelete(tier)}
                        title="Delete Tier"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <CardTitle className="text-lg font-bold mt-2">{tier.name}</CardTitle>
                  <CardDescription className="text-xs line-clamp-2 min-h-[32px]">
                    {tier.description || `Special perks and ${tier.discountPercent}% discount for ${tier.name} members.`}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 pb-4">
                  <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                      Qualification Threshold
                    </p>
                    <p className="text-base font-bold text-foreground">
                      {tier.minSpend === 0 ? "Entry Free (৳0)" : `${money(tier.minSpend)} spend`}
                    </p>
                    {tier.minSpend > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Accumulated spend required
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded-md bg-muted/20 border">
                      <p className="text-[10px] text-muted-foreground">Earn Multiplier</p>
                      <p className="text-base font-bold text-primary">{tier.pointMultiplier}x</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted/20 border">
                      <p className="text-[10px] text-muted-foreground">Order Discount</p>
                      <p className="text-base font-bold text-emerald-600">
                        {tier.discountPercent > 0 ? `${tier.discountPercent}%` : "0%"}
                      </p>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Users className="size-3.5 text-muted-foreground" />
                    {tier._count?.customers ?? 0} Members
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {tier.isActive ? "Active" : "Inactive"}
                  </Badge>
                </CardFooter>
              </Card>
            ))}
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: LOYALTY SETTINGS & POLICY FORM                                     */}
        {/* ========================================================================= */}
        <TabsContent value="settings" className="space-y-6 m-0 focus-visible:outline-none max-w-4xl">
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <Card className="border shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="program-active" className="text-base font-semibold">
                    Enable Loyalty Program
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When active, guests earn reward points on eligible paid dine-in and delivery orders.
                  </p>
                </div>
                <Switch
                  id="program-active"
                  checked={settingsFormData.isEnabled}
                  onCheckedChange={(checked) =>
                    setSettingsFormData((prev) => ({ ...prev, isEnabled: checked }))
                  }
                />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Coins className="size-4 text-amber-500" />
                    Point Earning Rules
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Define how much money a guest must spend to accumulate points.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="spend-per-point">Spend Amount per 1 Point (৳)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">
                        ৳
                      </span>
                      <Input
                        id="spend-per-point"
                        type="number"
                        min={1}
                        step="any"
                        className="pl-8"
                        value={settingsFormData.spendAmountPerPoint}
                        placeholder="100"
                        required
                        onChange={(e) =>
                          setSettingsFormData((prev) => ({
                            ...prev,
                            spendAmountPerPoint: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      e.g., At ৳100 per point, a ৳1,500 bill awards 15 points.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Gift className="size-4 text-emerald-500" />
                    Point Redemption Rules
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Specify the conversion value when customers redeem points on bill.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="point-value">Value of 1 Point in Currency (৳)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">
                        ৳
                      </span>
                      <Input
                        id="point-value"
                        type="number"
                        step="any"
                        min={0.01}
                        className="pl-8"
                        value={settingsFormData.pointValue}
                        placeholder="1.0"
                        required
                        onChange={(e) =>
                          setSettingsFormData((prev) => ({
                            ...prev,
                            pointValue: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      e.g., At ৳1.00 per point, 50 points give ৳50 bill discount.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  Limits & Validity Restrictions
                </CardTitle>
                <CardDescription className="text-xs">
                  Guardrails to prevent abuse and manage loyalty liabilities.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min-redeem">Minimum Points to Redeem</Label>
                    <Input
                      id="min-redeem"
                      type="number"
                      min={0}
                      value={settingsFormData.minPointsToRedeem}
                      placeholder="0"
                      onChange={(e) =>
                        setSettingsFormData((prev) => ({
                          ...prev,
                          minPointsToRedeem: e.target.value,
                        }))
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Guest must reach this threshold before redeeming.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-order">Max Points per Order</Label>
                    <Input
                      id="max-order"
                      type="number"
                      min={1}
                      value={settingsFormData.maxPointsPerOrder}
                      placeholder="No limit"
                      onChange={(e) =>
                        setSettingsFormData((prev) => ({
                          ...prev,
                          maxPointsPerOrder: e.target.value,
                        }))
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Caps maximum discount allowable per invoice.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expiry-days">Expiry Duration (Days)</Label>
                    <Input
                      id="expiry-days"
                      type="number"
                      min={1}
                      value={settingsFormData.expireAfterDays}
                      placeholder="Never expires"
                      onChange={(e) =>
                        setSettingsFormData((prev) => ({
                          ...prev,
                          expireAfterDays: e.target.value,
                        }))
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Points expire if unused within this duration.
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/20 border-t flex justify-end py-3">
                <Button type="submit" disabled={isSavingSettings} className="gap-2">
                  {isSavingSettings ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Save Loyalty Settings
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* 4. CUSTOMER DETAIL SHEET / DRAWER (SPACIOUS, NO OVERFLOW, POLISHED UI)    */}
      {/* ========================================================================= */}
      <Sheet open={!!selectedCustomer} onOpenChange={(o) => !o && setSelectedCustomer(null)}>
        <SheetContent className="w-full sm:max-w-xl p-0 overflow-hidden flex flex-col bg-background">
          {selectedCustomer && (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="p-6 pb-4 border-b bg-gradient-to-br from-muted/50 to-muted/20">
                <div className="flex items-start justify-between gap-3 pr-6">
                  <div className="flex items-center gap-3">
                    <div
                      className="size-12 rounded-2xl flex items-center justify-center font-bold text-sm shadow-sm"
                      style={{
                        backgroundColor: `${selectedCustomer.tier?.color || "#B45309"}20`,
                        color: selectedCustomer.tier?.color || "#B45309",
                        border: `1.5px solid ${selectedCustomer.tier?.color || "#B45309"}40`,
                      }}
                    >
                      {selectedCustomer.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-foreground">
                          {selectedCustomer.name}
                        </h2>
                        <Badge
                          variant="outline"
                          className="text-[11px] font-bold px-2 py-0.5"
                          style={{
                            borderColor: `${selectedCustomer.tier?.color || "#B45309"}50`,
                            backgroundColor: `${selectedCustomer.tier?.color || "#B45309"}15`,
                            color: selectedCustomer.tier?.color || "#B45309",
                          }}
                        >
                          <Crown className="size-3 mr-1" />
                          {selectedCustomer.tier?.name || "Bronze Member"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        {selectedCustomer.phone}
                        {selectedCustomer.address && ` • ${selectedCustomer.address}`}
                      </p>
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs font-medium"
                      onClick={() => openEditCustomerModal(selectedCustomer)}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                      onClick={() => setCustomerToDelete(selectedCustomer)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>

                {/* 2-Column Metric Cards */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="p-3.5 rounded-xl bg-card border shadow-xs space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span>Points Balance</span>
                      <Coins className="size-3.5 text-amber-500" />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black tracking-tight text-primary tabular-nums">
                        {selectedCustomer.loyaltyPoints || 0}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">pts</span>
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-[11px] font-medium text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/10 border-0"
                    >
                      ≈ {money((selectedCustomer.loyaltyPoints || 0) * (settings.pointValue || 1.0))} value
                    </Badge>
                  </div>

                  <div className="p-3.5 rounded-xl bg-card border shadow-xs space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span>Lifetime Spend</span>
                      <Wallet className="size-3.5 text-emerald-500" />
                    </div>
                    <div className="text-xl font-bold tracking-tight text-foreground truncate">
                      {money(selectedCustomer.totalSpent || 0)}
                    </div>
                    <span className="text-[11px] text-muted-foreground block">
                      Registered customer
                    </span>
                  </div>
                </div>
              </div>

              {/* Scrollable Content Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {selectedCustomer.notes && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
                    <span className="font-semibold block mb-0.5">Guest Notes:</span>
                    {selectedCustomer.notes}
                  </div>
                )}

                {/* Quick Point Adjustment Card */}
                <Card className="border shadow-xs">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Award className="size-4 text-primary" />
                      Adjust or Redeem Points
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Manually reward points or deduct redeemed points for this guest.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label htmlFor="adj-pts" className="text-xs">
                          Points
                        </Label>
                        <Input
                          id="adj-pts"
                          type="number"
                          placeholder="e.g. 50"
                          value={adjustPts}
                          onChange={(e) => setAdjustPts(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="adj-reason" className="text-xs">
                          Reason (Optional)
                        </Label>
                        <Input
                          id="adj-reason"
                          placeholder="e.g. Birthday reward"
                          value={adjustReason}
                          onChange={(e) => setAdjustReason(e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isAdjustingPoints}
                        className="text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/70 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
                        onClick={() => handlePointAdjustment(selectedCustomer, true)}
                      >
                        {isAdjustingPoints ? <Loader2 className="size-3 animate-spin mr-1" /> : "+"} Add Bonus
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isAdjustingPoints}
                        className="text-rose-700 bg-rose-50/50 hover:bg-rose-100/70 border-rose-300 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800"
                        onClick={() => handlePointAdjustment(selectedCustomer, false)}
                      >
                        {isAdjustingPoints ? <Loader2 className="size-3 animate-spin mr-1" /> : "−"} Redeem Points
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Points Activity History (Ledger) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                      Points Activity History
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {(selectedCustomer.loyaltyTransactions || []).length} entries
                    </span>
                  </div>

                  <div className="rounded-xl border divide-y bg-card overflow-hidden">
                    {isLoadingCustomerDetail ? (
                      <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="size-4 animate-spin text-primary" />
                        Loading activity ledger...
                      </div>
                    ) : !(selectedCustomer.loyaltyTransactions?.length) ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        No points activity recorded for this customer yet.
                      </div>
                    ) : (
                      selectedCustomer.loyaltyTransactions.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors"
                        >
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-foreground">
                              {item.reason || item.type}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {format(new Date(item.createdAt), "dd MMM yyyy, hh:mm a")}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`font-semibold text-xs px-2 py-0.5 tabular-nums ${
                              item.points > 0
                                ? "text-emerald-700 bg-emerald-500/10 border-emerald-500/20"
                                : "text-rose-700 bg-rose-500/10 border-rose-500/20"
                            }`}
                          >
                            {item.points > 0 ? `+${item.points}` : item.points} pts
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Orders Section */}
                {selectedCustomer.orders && selectedCustomer.orders.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <UtensilsCrossed className="size-4 text-muted-foreground" />
                        Recent Orders
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {selectedCustomer.orders.length} orders
                      </span>
                    </div>

                    <div className="rounded-xl border divide-y bg-card overflow-hidden">
                      {selectedCustomer.orders.map((ord) => (
                        <div
                          key={ord.id}
                          className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                        >
                          <div>
                            <p className="text-xs font-semibold text-foreground">
                              #{ord.orderNumber}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {format(new Date(ord.createdAt), "dd MMM yyyy, hh:mm a")} • {ord.type}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-foreground">
                              {money(ord.total)}
                            </p>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                              {ord.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ========================================================================= */}
      {/* 5. ADD / EDIT CUSTOMER DIALOG (BACKEND API INTEGRATED, NO EMAIL)           */}
      {/* ========================================================================= */}
      <Dialog open={isCustomerModalOpen} onOpenChange={setIsCustomerModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? "Edit Customer Profile" : "Register New Customer"}
            </DialogTitle>
            <DialogDescription>
              Name and phone number are required to create a loyalty profile.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCustomer} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cust-name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cust-name"
                value={customerFormData.name}
                onChange={(e) =>
                  setCustomerFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g. Tanvir Hossain"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cust-phone">
                Phone Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cust-phone"
                type="tel"
                value={customerFormData.phone}
                onChange={(e) =>
                  setCustomerFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="e.g. +8801712345678"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cust-tier">Membership Tier</Label>
              <select
                id="cust-tier"
                value={customerFormData.tierId}
                onChange={(e) =>
                  setCustomerFormData((prev) => ({ ...prev, tierId: e.target.value }))
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Default Tier (Bronze)</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (Min spend: {money(t.minSpend)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cust-address">Delivery Address (Optional)</Label>
              <Input
                id="cust-address"
                value={customerFormData.address}
                onChange={(e) =>
                  setCustomerFormData((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder="House, Road, Area, City"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cust-notes">Guest Preferences & Notes (Optional)</Label>
              <Textarea
                id="cust-notes"
                value={customerFormData.notes}
                onChange={(e) =>
                  setCustomerFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Allergies, favorite table, spice tolerance..."
                rows={2}
              />
            </div>

            {!editingCustomer && (
              <div className="space-y-2 pt-1">
                <Label htmlFor="cust-initial-points">Welcome Signup Points Bonus</Label>
                <Input
                  id="cust-initial-points"
                  type="number"
                  min={0}
                  value={customerFormData.initialPoints}
                  onChange={(e) =>
                    setCustomerFormData((prev) => ({
                      ...prev,
                      initialPoints: Number(e.target.value) || 0,
                    }))
                  }
                  placeholder="50"
                />
                <p className="text-[11px] text-muted-foreground">
                  Awarded automatically upon registration as a welcome reward.
                </p>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingCustomer}
                onClick={() => setIsCustomerModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingCustomer} className="gap-2">
                {isSubmittingCustomer && <Loader2 className="size-4 animate-spin" />}
                {editingCustomer ? "Save Changes" : "Create Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 6. DELETE CUSTOMER CONFIRMATION DIALOG                                    */}
      {/* ========================================================================= */}
      <Dialog
        open={!!customerToDelete}
        onOpenChange={(open) => !open && setCustomerToDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="size-5" />
              Delete Customer Profile
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {customerToDelete?.name}
              </span>{" "}
              ({customerToDelete?.phone})? Their profile and point balance will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={isDeletingCustomer}
              onClick={() => setCustomerToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeletingCustomer}
              onClick={confirmDeleteCustomer}
              className="gap-2"
            >
              {isDeletingCustomer && <Loader2 className="size-4 animate-spin" />}
              Yes, Delete Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 7. ADD / EDIT LOYALTY TIER DIALOG                                         */}
      {/* ========================================================================= */}
      <Dialog open={isTierModalOpen} onOpenChange={setIsTierModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTier ? "Edit Loyalty Tier" : "Create Membership Tier"}
            </DialogTitle>
            <DialogDescription>
              Set spending thresholds, point multipliers, and order discounts for this tier.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveTier} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tier-name">Tier Name</Label>
              <Input
                id="tier-name"
                value={tierFormData.name}
                onChange={(e) =>
                  setTierFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g. Diamond VIP"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tier-spend">Min Spend (৳)</Label>
                <Input
                  id="tier-spend"
                  type="number"
                  min={0}
                  value={tierFormData.minSpend}
                  onChange={(e) =>
                    setTierFormData((prev) => ({
                      ...prev,
                      minSpend: Number(e.target.value) || 0,
                    }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tier-mult">Multiplier (x)</Label>
                <Input
                  id="tier-mult"
                  type="number"
                  step="0.05"
                  min={1.0}
                  value={tierFormData.pointMultiplier}
                  onChange={(e) =>
                    setTierFormData((prev) => ({
                      ...prev,
                      pointMultiplier: Number(e.target.value) || 1.0,
                    }))
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tier-disc">Discount (%)</Label>
                <Input
                  id="tier-disc"
                  type="number"
                  min={0}
                  max={100}
                  value={tierFormData.discountPercent}
                  onChange={(e) =>
                    setTierFormData((prev) => ({
                      ...prev,
                      discountPercent: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tier-color">Badge Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="tier-color"
                    type="color"
                    value={tierFormData.color}
                    onChange={(e) =>
                      setTierFormData((prev) => ({ ...prev, color: e.target.value }))
                    }
                    className="size-9 rounded-md border cursor-pointer p-0.5 bg-background shrink-0"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {["#B45309", "#94A3B8", "#EAB308", "#8B5CF6", "#06B6D4", "#10B981", "#F43F5E"].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setTierFormData((prev) => ({ ...prev, color: col }))}
                        className={`size-6 rounded-full border transition-transform ${
                          tierFormData.color.toLowerCase() === col.toLowerCase()
                            ? "scale-110 ring-2 ring-primary ring-offset-1"
                            : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: col }}
                        title={col}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tier-desc">Benefits Description</Label>
              <Input
                id="tier-desc"
                value={tierFormData.description}
                onChange={(e) =>
                  setTierFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Special perks for members of this tier..."
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingTier}
                onClick={() => setIsTierModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingTier} className="gap-2">
                {isSubmittingTier && <Loader2 className="size-4 animate-spin" />}
                {editingTier ? "Save Tier" : "Create Tier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 8. DELETE TIER CONFIRMATION DIALOG                                        */}
      {/* ========================================================================= */}
      <Dialog
        open={!!tierToDelete}
        onOpenChange={(open) => !open && setTierToDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="size-5" />
              Delete Loyalty Tier
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to delete tier{" "}
              <span className="font-semibold text-foreground">
                {tierToDelete?.name}
              </span>
              ? This tier will be safely archived (soft deleted) and any assigned guests will fallback to default membership.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={isDeletingTier}
              onClick={() => setTierToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeletingTier}
              onClick={confirmDeleteTier}
              className="gap-2"
            >
              {isDeletingTier && <Loader2 className="size-4 animate-spin" />}
              Yes, Delete Tier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
