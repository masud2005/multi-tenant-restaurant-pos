import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Info, Receipt, Save } from "lucide-react";
import { useTenant } from "@/features/tenant/tenant-context";
import { useUpdateSettingsMutation } from "@/features/stage4/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ThermalReceiptPreview } from "./thermal-receipt-preview";
import { PasswordChangeCard } from "./password-change-card";

export function ReceiptSecurityTab() {
  const { tenant, branch, user } = useTenant();
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation();

  const [receiptFooter, setReceiptFooter] = useState(tenant.receiptFooter ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`tenant_logo_${tenant.id}`) ?? null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    setReceiptFooter(tenant.receiptFooter ?? "");
  }, [tenant.receiptFooter]);

  useEffect(() => {
    const handler = () => {
      try {
        setLogoUrl(localStorage.getItem(`tenant_logo_${tenant.id}`) ?? null);
      } catch {
        // ignore
      }
    };
    window.addEventListener("tenant_logo_changed", handler);
    return () => window.removeEventListener("tenant_logo_changed", handler);
  }, [tenant.id]);

  const handleSaveFooter = async () => {
    try {
      await updateSettings({
        tenantId: tenant.id,
        name: tenant.name,
        tagline: tenant.tagline ?? "",
        initials: tenant.initials ?? "",
        accent: tenant.accent,
        currency: tenant.currency,
        locale: tenant.locale,
        taxRate: tenant.taxRate,
        serviceChargeRate: tenant.serviceChargeRate,
        receiptFooter,
      }).unwrap();
      toast.success("Receipt footer message updated.");
    } catch {
      toast.error("Failed to update receipt footer.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Thermal Receipt Slip & Footer Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="size-4 text-primary" /> Printed Thermal Receipt Slip
          </CardTitle>
          <CardDescription>
            Customize customer receipts for standard 80mm and 58mm thermal POS printers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left side: Footer message input & quick templates */}
            <div className="lg:col-span-7 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receipt-footer">Receipt Footer Message</Label>
                <Textarea
                  id="receipt-footer"
                  rows={4}
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  placeholder="e.g. Thank you for dining with us! Follow us on Instagram @ourrestaurant"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Appears at the very bottom of customer bills.</span>
                  <span className="font-mono">{receiptFooter.length} characters</span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Quick Suggestions
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() =>
                      setReceiptFooter("Thank you for dining with us! Please visit again soon.")
                    }
                  >
                    Warm Thank You
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() =>
                      setReceiptFooter("Follow us on Instagram @restaurant | Free WiFi: TablewiseGuest")
                    }
                  >
                    Social & WiFi
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() =>
                      setReceiptFooter("Please review us on Google & TripAdvisor! We value your feedback.")
                    }
                  >
                    Review Prompt
                  </Button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Info className="size-3.5 text-primary" /> Thermal Printer Compatibility
                </div>
                <p>
                  Compatible with Epson, Star Micronics, Rongta, and ESC/POS thermal printers via USB, LAN, or Bluetooth.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  onClick={handleSaveFooter}
                  disabled={saving}
                  size="sm"
                  className="gap-2"
                >
                  <Save className="size-4" /> {saving ? "Saving..." : "Save Receipt Footer"}
                </Button>
              </div>
            </div>

            {/* Right side: Realistic 80mm Thermal Slip Preview */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <ThermalReceiptPreview
                name={tenant.name}
                tagline={tenant.tagline}
                initials={tenant.initials}
                logoUrl={logoUrl}
                address={branch?.address ?? ""}
                cashierName={user.name.split(" ")[0] ?? user.name}
                receiptFooter={receiptFooter}
                currency={tenant.currency}
                taxRate={tenant.taxRate * 100}
                serviceRate={tenant.serviceChargeRate * 100}
                taxInclusive={false}
                roundCurrency={false}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Security & Password Change */}
      <PasswordChangeCard />
    </div>
  );
}
