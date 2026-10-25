import { createFileRoute } from "@tanstack/react-router";
import { Palette, Percent, ShieldCheck } from "lucide-react";
import { RequirePermission } from "@/features/tenant/require-permission";
import { PageHeader } from "@/components/common/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandAmbienceTab } from "@/features/settings/brand-ambience-tab";
import { TaxesChargesTab } from "@/features/settings/taxes-charges-tab";
import { ReceiptSecurityTab } from "@/features/settings/receipt-security-tab";

export const Route = createFileRoute("/app/$tenantSlug/settings")({
  head: () => ({
    meta: [
      { title: "Settings & Ambience — Tablewise POS" },
      {
        name: "description",
        content:
          "Configure restaurant identity, curated atmospheric themes, tax calculation rules, receipt slips, and account security.",
      },
    ],
  }),
  component: () => (
    <RequirePermission perm="settings.manage">
      <SettingsPage />
    </RequirePermission>
  ),
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Ambience"
        description="Customize restaurant identity, curated atmospheric themes, tax calculation rules, receipt slips, and account security."
      />

      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="size-4" /> Brand & Ambience
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <Percent className="size-4" /> Taxes & Charges
          </TabsTrigger>
          <TabsTrigger value="receipt-security" className="gap-2">
            <ShieldCheck className="size-4" /> Receipt & Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <BrandAmbienceTab />
        </TabsContent>

        <TabsContent value="billing">
          <TaxesChargesTab />
        </TabsContent>

        <TabsContent value="receipt-security">
          <ReceiptSecurityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
