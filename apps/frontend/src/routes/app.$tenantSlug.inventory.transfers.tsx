import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { ArrowRight, CheckCircle2, PackageCheck, Plus, Truck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/features/tenant/tenant-context";
import {
  useStockTransfersQuery,
  useCreateStockTransferMutation,
  useReceiveStockTransferMutation,
  useCancelStockTransferMutation,
} from "@/features/backoffice/api";
import { useIngredientsQuery, useBranchesQuery } from "@/app/api";
import { EmptyState, ErrorState } from "@/components/common/states";
import { DataTable, td } from "@/components/common/confirm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TransferStatus } from "@/types/domain";

export const Route = createFileRoute("/app/$tenantSlug/inventory/transfers")({
  head: () => ({
    meta: [
      { title: "Stock Transfers — Tablewise POS" },
      { name: "description", content: "Inter-branch stock transfer and dispatch." },
    ],
  }),
  component: TransfersPage,
});

const STATUS_VARIANTS: Record<TransferStatus, "warning" | "info" | "success" | "danger"> = {
  PENDING: "warning",
  IN_TRANSIT: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export function TransfersPage() {
  const { tenant, branch, user } = useTenant();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState<string | null>(null);
  const [receiveNotes, setReceiveNotes] = useState("");

  const transfersQuery = useStockTransfersQuery({
    tenantId: tenant.slug,
    branchId: branch.id,
    status: statusFilter,
  });

  const branchesQuery = useBranchesQuery({ tenantId: tenant.id, userId: user.id });
  const ingredientsQuery = useIngredientsQuery({ tenantId: tenant.id, branchId: branch.id });

  const [createTransfer, { isLoading: isCreating }] = useCreateStockTransferMutation();
  const [receiveTransfer, { isLoading: isReceiving }] = useReceiveStockTransferMutation();
  const [cancelTransfer, { isLoading: isCancelling }] = useCancelStockTransferMutation();

  // Form state
  const [toBranchId, setToBranchId] = useState<string>("");
  const [transferNotes, setTransferNotes] = useState("");
  const [lines, setLines] = useState<Array<{ ingredientId: string; quantity: number }>>([
    { ingredientId: "", quantity: 1 },
  ]);

  const targetBranches = (branchesQuery.data ?? []).filter((b) => b.id !== branch.id);
  const ingredients = ingredientsQuery.data ?? [];

  const handleAddLine = () => {
    setLines([...lines, { ingredientId: "", quantity: 1 }]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: "ingredientId" | "quantity", val: any) => {
    const updated = [...lines];
    if (field === "ingredientId") {
      updated[idx] = { ...updated[idx]!, ingredientId: val };
    } else {
      updated[idx] = { ...updated[idx]!, quantity: Math.max(0.01, Number(val) || 0) };
    }
    setLines(updated);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toBranchId) {
      toast.error("Please select a destination branch");
      return;
    }

    const validLines = lines.filter((l) => l.ingredientId && l.quantity > 0);
    if (validLines.length === 0) {
      toast.error("Please add at least one ingredient with a quantity");
      return;
    }

    try {
      await createTransfer({
        tenantId: tenant.slug,
        fromBranchId: branch.id,
        toBranchId,
        notes: transferNotes.trim() || undefined,
        lines: validLines,
      }).unwrap();

      toast.success("Stock transfer dispatched successfully");
      setCreateOpen(false);
      setToBranchId("");
      setTransferNotes("");
      setLines([{ ingredientId: "", quantity: 1 }]);
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch stock transfer");
    }
  };

  const handleReceive = async (transferId: string) => {
    try {
      await receiveTransfer({
        tenantId: tenant.slug,
        id: transferId,
        notes: receiveNotes.trim() || undefined,
      }).unwrap();

      toast.success("Stock received and inventory updated");
      setReceiveDialogOpen(null);
      setReceiveNotes("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to receive transfer");
    }
  };

  const handleCancel = async (transferId: string) => {
    if (!confirm("Are you sure you want to cancel this transfer and return stock to origin?")) return;
    try {
      await cancelTransfer({
        tenantId: tenant.slug,
        id: transferId,
      }).unwrap();
      toast.success("Stock transfer cancelled");
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel transfer");
    }
  };

  const transfers = transfersQuery.data ?? [];

  return (
    <div className="space-y-4">
      {/* Top action bar & status filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", "PENDING", "IN_TRANSIT", "COMPLETED", "CANCELLED"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-accent"
              )}
            >
              {s === "all" ? "All transfers" : s.replace("_", " ")}
            </button>
          ))}
        </div>

        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Truck className="size-4" />
          <span>New branch transfer</span>
        </Button>
      </div>

      {transfersQuery.isLoading && <Skeleton className="h-64 rounded-xl" />}

      {transfersQuery.isError && (
        <ErrorState
          message="Couldn't load stock transfers from server."
          onRetry={transfersQuery.refetch}
        />
      )}

      {transfersQuery.data && transfers.length === 0 && (
        <EmptyState
          title="No stock transfers found"
          body="Dispatch stock to other branches or receive transfers here."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4 mr-1.5" /> Start transfer
            </Button>
          }
        />
      )}

      {transfers.length > 0 && (
        <DataTable head={["Number", "Route", "Items", "Status", "Date", "Actions"]}>
          {transfers.map((t) => {
            const isDestination = t.toBranchId === branch.id;
            const isSource = t.fromBranchId === branch.id;
            const canReceive = isDestination && (t.status === "IN_TRANSIT" || t.status === "PENDING");
            const canCancel = (isSource || !isDestination) && (t.status === "IN_TRANSIT" || t.status === "PENDING");

            return (
              <tr key={t.id} className="hover:bg-muted/40 transition-colors">
                <td className={cn(td, "font-mono font-medium text-foreground")}>
                  {t.number}
                </td>
                <td className={td}>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={cn("font-medium", isSource ? "text-primary font-semibold" : "text-foreground")}>
                      {t.fromBranchName || t.fromBranch?.name || "Origin"}
                    </span>
                    <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                    <span className={cn("font-medium", isDestination ? "text-primary font-semibold" : "text-foreground")}>
                      {t.toBranchName || t.toBranch?.name || "Destination"}
                    </span>
                  </div>
                </td>
                <td className={td}>
                  <div className="text-xs space-y-0.5">
                    {t.lines.map((l) => (
                      <div key={l.id} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{l.ingredientName || "Item"}:</span>{" "}
                        <span className="font-mono">{l.quantity} {l.unit}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className={td}>
                  <Badge variant={STATUS_VARIANTS[t.status] || "info"}>
                    {t.status.replace("_", " ")}
                  </Badge>
                </td>
                <td className={cn(td, "text-xs text-muted-foreground")}>
                  {format(new Date(t.createdAt), "MMM d, yyyy HH:mm")}
                </td>
                <td className={td}>
                  <div className="flex items-center gap-1.5">
                    {canReceive && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => {
                          setReceiveDialogOpen(t.id);
                          setReceiveNotes("");
                        }}
                      >
                        <PackageCheck className="size-3.5" /> Receive
                      </Button>
                    )}
                    {canCancel && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10"
                        disabled={isCancelling}
                        onClick={() => handleCancel(t.id)}
                      >
                        <XCircle className="size-3.5" /> Cancel
                      </Button>
                    )}
                    {!canReceive && !canCancel && (
                      <span className="text-xs text-muted-foreground italic">—</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}

      {/* New Transfer Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Dispatch Inter-Branch Stock Transfer</DialogTitle>
            <DialogDescription>
              Transfer inventory items from {branch.name} to another active branch.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Destination branch *
              </label>
              <Select value={toBranchId} onValueChange={setToBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination branch..." />
                </SelectTrigger>
                <SelectContent>
                  {targetBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-foreground">
                  Transfer items & quantities *
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-primary"
                  onClick={handleAddLine}
                >
                  <Plus className="size-3 mr-1" /> Add item
                </Button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {lines.map((l, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select
                        value={l.ingredientId}
                        onValueChange={(val) => handleLineChange(idx, "ingredientId", val)}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Select ingredient..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ingredients.map((ing) => (
                            <SelectItem key={ing.id} value={ing.id}>
                              {ing.name} ({ing.stock} {ing.unit} in stock)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-28">
                      <Input
                        type="number"
                        min="0.01"
                        step="any"
                        placeholder="Qty"
                        value={l.quantity}
                        onChange={(e) => handleLineChange(idx, "quantity", e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>

                    {lines.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveLine(idx)}
                      >
                        <XCircle className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Dispatch notes / Transit reference
              </label>
              <Input
                placeholder="e.g. Sent via internal delivery van with driver Karim"
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isCreating}>
                {isCreating ? "Dispatching..." : "Dispatch transfer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receive Confirmation Dialog */}
      <Dialog
        open={Boolean(receiveDialogOpen)}
        onOpenChange={(open) => !open && setReceiveDialogOpen(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Confirm Stock Receipt</DialogTitle>
            <DialogDescription>
              Confirming this transfer will automatically add the items to {branch.name}&apos;s inventory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Receiving notes (optional)
              </label>
              <Input
                placeholder="e.g. All goods received intact and verified"
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReceiveDialogOpen(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isReceiving}
              onClick={() => receiveDialogOpen && handleReceive(receiveDialogOpen)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isReceiving ? "Receiving..." : "Confirm & update stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
