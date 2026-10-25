import { useState, useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle2, DollarSign, Percent, Save } from "lucide-react";
import { useTenant } from "@/features/tenant/tenant-context";
import { useUpdateSettingsMutation } from "@/features/stage4/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCurrencySymbol, calculateOrderBreakdown } from "./settings.utils";

export function TaxesChargesTab() {
  const { tenant } = useTenant();
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation();

  const [currency, setCurrency] = useState(tenant.currency);
  const [locale, setLocale] = useState(tenant.locale);
  const [taxRate, setTaxRate] = useState((tenant.taxRate * 100).toString());
  const [serviceChargeRate, setServiceChargeRate] = useState(
    (tenant.serviceChargeRate * 100).toString()
  );
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [roundCurrency, setRoundCurrency] = useState(false);

  useEffect(() => {
    setCurrency(tenant.currency);
    setLocale(tenant.locale);
    setTaxRate((tenant.taxRate * 100).toString());
    setServiceChargeRate((tenant.serviceChargeRate * 100).toString());
  }, [tenant]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const parsedTax = parseFloat(taxRate) / 100 || 0;
      const parsedService = parseFloat(serviceChargeRate) / 100 || 0;

      await updateSettings({
        tenantId: tenant.id,
        name: tenant.name,
        tagline: tenant.tagline ?? "",
        initials: tenant.initials ?? "",
        accent: tenant.accent,
        currency,
        locale,
        taxRate: parsedTax,
        serviceChargeRate: parsedService,
        receiptFooter: tenant.receiptFooter ?? "",
      }).unwrap();

      toast.success("Taxes and localization settings updated.");
    } catch {
      toast.error("Failed to update tax settings.");
    }
  };

  const currSym = getCurrencySymbol(currency);
  const parsedTaxNum = parseFloat(taxRate) || 0;
  const parsedServiceNum = parseFloat(serviceChargeRate) || 0;
  const sampleBase = 50.0;
  const { vatAmount, serviceAmount, grandTotal } = calculateOrderBreakdown(
    sampleBase,
    parsedTaxNum,
    parsedServiceNum,
    taxInclusive,
    roundCurrency
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Currency & Regional Localization */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="size-4 text-primary" /> Currency & Regional Locale
            </CardTitle>
            <CardDescription>
              Defines default price formatting on order pads, receipts, and revenue reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency Code</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($ - US Dollar)</SelectItem>
                  <SelectItem value="BDT">BDT (৳ - Bangladeshi Taka)</SelectItem>
                  <SelectItem value="EUR">EUR (€ - Euro)</SelectItem>
                  <SelectItem value="GBP">GBP (£ - British Pound)</SelectItem>
                  <SelectItem value="CAD">CAD (CA$ - Canadian Dollar)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="locale">Locale Number Formatting</Label>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger id="locale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-US">en-US (United States - $1,234.56)</SelectItem>
                  <SelectItem value="en-BD">en-BD (Bangladesh - ৳1,234.56)</SelectItem>
                  <SelectItem value="en-GB">en-GB (United Kingdom - £1,234.56)</SelectItem>
                  <SelectItem value="de-DE">de-DE (Germany / EU - 1.234,56 €)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Rates & Calculations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Percent className="size-4 text-primary" /> Tax & Service Rates
            </CardTitle>
            <CardDescription>
              Applied automatically to order totals during cashier checkout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tax-rate">Value Added Tax (VAT %)</Label>
                <div className="relative">
                  <Input
                    id="tax-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="service-charge">Service Charge (%)</Label>
                <div className="relative">
                  <Input
                    id="service-charge"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={serviceChargeRate}
                    onChange={(e) => setServiceChargeRate(e.target.value)}
                  />
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-3 border-t">
              {/* Tax Mode Switch */}
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="tax-inclusive" className="cursor-pointer font-medium text-sm">
                    Tax-Inclusive Pricing
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {taxInclusive
                      ? "Menu prices already include VAT (tax extracted on receipt)"
                      : "VAT is added on top of the menu price at checkout"}
                  </p>
                </div>
                <Switch
                  id="tax-inclusive"
                  checked={taxInclusive}
                  onCheckedChange={setTaxInclusive}
                />
              </div>

              {/* Cash Rounding Switch */}
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="round-currency" className="cursor-pointer font-medium text-sm">
                    Round Grand Total to Whole Number
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {roundCurrency
                      ? "Totals rounded to the nearest integer for simpler cash payment"
                      : "Standard two-decimal exact fractional settlement"}
                  </p>
                </div>
                <Switch
                  id="round-currency"
                  checked={roundCurrency}
                  onCheckedChange={setRoundCurrency}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Order Calculation Example (Visual Feedback) */}
      <Card className="bg-muted/30 border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <CardTitle className="text-sm font-semibold">
                Live Calculation Preview (Sample Order)
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-xs font-normal">
              {taxInclusive ? "Inclusive Tax Mode" : "Exclusive Tax Mode"} •{" "}
              {roundCurrency ? "Rounded Total" : "Exact Decimals"}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Visual demonstration of how a customer bill is calculated under your current settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4 p-3.5 rounded-lg bg-card border text-sm">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Food Items (Subtotal)</span>
              <div className="font-semibold text-base">
                {currSym}
                {sampleBase.toFixed(2)}
              </div>
              <span className="text-[11px] text-muted-foreground block">
                {taxInclusive ? "Tax included in items" : "Net food amount"}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                VAT ({parsedTaxNum}%)
              </span>
              <div className="font-semibold text-base text-amber-600 dark:text-amber-400">
                {taxInclusive ? "(Incl.) " : "+"}
                {currSym}
                {vatAmount.toFixed(2)}
              </div>
              <span className="text-[11px] text-muted-foreground block">
                {taxInclusive ? "Extracted for compliance" : "Added to bill"}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                Service Charge ({parsedServiceNum}%)
              </span>
              <div className="font-semibold text-base text-blue-600 dark:text-blue-400">
                +{currSym}
                {serviceAmount.toFixed(2)}
              </div>
              <span className="text-[11px] text-muted-foreground block">
                Staff gratuity / facility fee
              </span>
            </div>

            <div className="space-y-1 sm:border-l sm:pl-4">
              <span className="text-xs text-muted-foreground font-medium">Customer Grand Total</span>
              <div className="font-bold text-lg text-primary">
                {currSym}
                {roundCurrency ? grandTotal.toFixed(0) : grandTotal.toFixed(2)}
              </div>
              <span className="text-[11px] text-muted-foreground block">
                Final payable amount
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={() => handleSave()} disabled={saving} className="gap-2">
          <Save className="size-4" /> {saving ? "Saving Changes..." : "Save Taxes & Charges"}
        </Button>
      </div>
    </div>
  );
}
