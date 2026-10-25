import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Check, ImagePlus, Palette, Save, Trash2, Upload, X } from "lucide-react";
import { useTenant } from "@/features/tenant/tenant-context";
import { useUpdateSettingsMutation } from "@/features/stage4/api";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  RESTAURANT_THEMES,
  type RestaurantThemePreset,
  getThemePreset,
  applyRestaurantTheme,
} from "@/features/theme/restaurant-themes";
import { RestaurantThemeModal } from "@/features/theme/restaurant-theme-modal";
import { setThemePreset } from "@/features/ui/ui.slice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function BrandAmbienceTab() {
  const { tenant } = useTenant();
  const dispatch = useAppDispatch();
  const themePresetId = useAppSelector((s) => s.ui.themePresetId);
  const themeStyle = useAppSelector((s) => s.ui.themeStyle);
  const activePreset = getThemePreset(themePresetId);

  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation();

  const [name, setName] = useState(tenant.name);
  const [tagline, setTagline] = useState(tenant.tagline ?? "");
  const [accent, setAccent] = useState(tenant.accent ?? activePreset.colors.accent);
  const [themeModalOpen, setThemeModalOpen] = useState(false);

  // Logo upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`tenant_logo_${tenant.id}`) ?? null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    setName(tenant.name);
    setTagline(tenant.tagline ?? "");
    setAccent(tenant.accent ?? activePreset.colors.accent);
  }, [tenant, activePreset.colors.accent]);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, SVG, WEBP).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo file size must be less than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setLogoUrl(result);
      try {
        localStorage.setItem(`tenant_logo_${tenant.id}`, result);
        window.dispatchEvent(new Event("tenant_logo_changed"));
      } catch {
        // quota exceeded fallback
      }
      toast.success("Restaurant logo uploaded successfully.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    try {
      localStorage.removeItem(`tenant_logo_${tenant.id}`);
      window.dispatchEvent(new Event("tenant_logo_changed"));
    } catch {
      // ignore
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.success("Logo removed.");
  };

  const handleSelectPreset = (preset: RestaurantThemePreset) => {
    dispatch(setThemePreset(preset.id));
    setAccent(preset.colors.accent);
    applyRestaurantTheme(preset, preset.style);
    toast.success(`Switched ambience to ${preset.name}`);
  };

  const handleThemeModalSaved = (preset: RestaurantThemePreset) => {
    setAccent(preset.colors.accent);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      // Auto-compute compact initials from restaurant name for system monograms
      const computedInitials =
        name
          .trim()
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 3)
          .toUpperCase() ||
        tenant.initials ||
        "POS";

      await updateSettings({
        tenantId: tenant.id,
        name,
        tagline,
        initials: computedInitials,
        accent,
        currency: tenant.currency,
        locale: tenant.locale,
        taxRate: tenant.taxRate,
        serviceChargeRate: tenant.serviceChargeRate,
        receiptFooter: tenant.receiptFooter ?? "",
      }).unwrap();

      document.documentElement.style.setProperty("--primary", accent);
      toast.success("Restaurant identity settings saved.");
    } catch {
      toast.error("Failed to update identity settings.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Restaurant Identity */}
      <Card>
        <CardHeader>
          <CardTitle>Restaurant Identity</CardTitle>
          <CardDescription>
            Brand name, logo, and tagline displayed on receipts, order tickets, and customer screens.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Logo Upload Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-xl border bg-muted/20">
            <div className="relative group shrink-0">
              <div className="size-20 sm:size-24 rounded-2xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-background shadow-xs">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Restaurant Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground p-2 text-center">
                    <ImagePlus className="size-6 mb-1 text-primary/70" />
                    <span className="text-[10px] font-medium leading-tight">Add Logo</span>
                  </div>
                )}
              </div>
              {logoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="absolute -top-2 -right-2 size-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
                  title="Remove logo"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-2 flex-1">
              <div>
                <h4 className="text-sm font-semibold">Restaurant Brand Logo</h4>
                <p className="text-xs text-muted-foreground">
                  Displayed on customer receipts, customer displays, and workspace headers.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2 text-xs h-8"
                >
                  <Upload className="size-3.5" /> {logoUrl ? "Replace Logo" : "Upload Logo"}
                </Button>
                {logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5 mr-1.5" /> Remove
                  </Button>
                )}
                <span className="text-[11px] text-muted-foreground">
                  PNG, JPG, WEBP, or SVG (Max 2MB)
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tenant-name">Restaurant Name</Label>
              <Input
                id="tenant-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-tagline">Tagline or Concept</Label>
              <Input
                id="tenant-tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Specialty coffee & artisanal bakery"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme Studio Card */}
      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Restaurant Ambience & Theme Studio</CardTitle>
              <Badge variant="secondary" className="font-mono text-xs">
                POS Curated
              </Badge>
            </div>
            <CardDescription className="mt-1">
              Harmonized atmospheric palettes designed specifically for restaurant concepts, dining rooms, and service shifts.
            </CardDescription>
          </div>
          <Button
            type="button"
            onClick={() => setThemeModalOpen(true)}
            className="gap-2 shrink-0 self-start sm:self-auto shadow-sm"
          >
            <Palette className="size-4" /> Open Theme Studio
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Active Concept Banner */}
          <div
            className="rounded-xl border p-4.5 transition-all relative overflow-hidden"
            style={{
              background:
                themeStyle === "gradient"
                  ? activePreset.previewGradient
                  : activePreset.colors.card,
              borderColor: activePreset.colors.border,
            }}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className="size-3.5 rounded-full shadow-sm ring-2 ring-black/30 shrink-0"
                    style={{ backgroundColor: activePreset.accentDot }}
                  />
                  <h4
                    className="font-bold text-base tracking-tight"
                    style={{ color: activePreset.colors.foreground }}
                  >
                    {activePreset.name}
                  </h4>
                  <Badge
                    variant="outline"
                    className="text-[11px] font-semibold uppercase px-2 py-0.5 border"
                    style={{
                      borderColor: activePreset.colors.border,
                      color: activePreset.colors.foreground,
                      backgroundColor: "rgba(0, 0, 0, 0.2)",
                    }}
                  >
                    {activePreset.mode === "dark" ? "Night Shift" : "Day Shift"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[11px] font-semibold uppercase px-2 py-0.5 border"
                    style={{
                      borderColor: activePreset.colors.border,
                      color: activePreset.colors.foreground,
                      backgroundColor: "rgba(0, 0, 0, 0.2)",
                    }}
                  >
                    {themeStyle === "gradient" ? "Gradient Ambient" : "Solid High-Contrast"}
                  </Badge>
                </div>
                <p
                  className="text-xs max-w-lg"
                  style={{ color: activePreset.colors.mutedForeground }}
                >
                  {activePreset.concept}
                </p>
              </div>

              {/* Active colors swatch strip */}
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.25)",
                    borderColor: activePreset.colors.border,
                    color: activePreset.colors.foreground,
                  }}
                >
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ backgroundColor: activePreset.colors.accent }}
                  />
                  <span className="font-mono text-[11px]">Primary</span>
                </div>
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.25)",
                    borderColor: activePreset.colors.border,
                    color: activePreset.colors.foreground,
                  }}
                >
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ backgroundColor: activePreset.colors.background }}
                  />
                  <span className="font-mono text-[11px]">Canvas</span>
                </div>
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.25)",
                    borderColor: activePreset.colors.border,
                    color: activePreset.colors.foreground,
                  }}
                >
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ backgroundColor: activePreset.colors.card }}
                  />
                  <span className="font-mono text-[11px]">Cards</span>
                </div>
              </div>
            </div>
          </div>

          {/* Restaurant Presets Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">
                Curated Restaurant Atmospheres ({activePreset.mode === "dark" ? "Night Shift" : "Day Shift"})
              </Label>
              <span className="text-xs text-muted-foreground">
                Click any concept to instantly adapt the POS
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {RESTAURANT_THEMES.filter((p) => p.mode === activePreset.mode).map((preset) => {
                const isSelected = preset.id === activePreset.id;
                return (
                  <button
                    type="button"
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`flex flex-col gap-2 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-2 ring-primary/40 shadow-sm font-semibold"
                        : "border-border/70 hover:bg-muted/40 hover:border-border"
                    }`}
                  >
                    <div
                      className="w-full h-8 rounded-lg relative overflow-hidden flex items-center justify-between px-2.5 shadow-inner"
                      style={{ background: preset.previewGradient }}
                    >
                      {isSelected ? (
                        <div className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                          <Check className="size-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div />
                      )}
                      <span
                        className="size-3 rounded-full shadow-sm ring-2 ring-black/20 shrink-0"
                        style={{ backgroundColor: preset.accentDot }}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{preset.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{preset.concept}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <RestaurantThemeModal
        open={themeModalOpen}
        onOpenChange={setThemeModalOpen}
        onSaved={handleThemeModalSaved}
      />

      <div className="flex justify-end">
        <Button type="button" onClick={() => handleSave()} disabled={saving} className="gap-2">
          <Save className="size-4" /> {saving ? "Saving Changes..." : "Save Brand Settings"}
        </Button>
      </div>
    </div>
  );
}
