import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { DollarSign, Edit2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PresetForm {
  name: string;
  inkCost: string;
  setupFee: string;
  perPrintCost: string;
}

const emptyForm: PresetForm = { name: "", inkCost: "", setupFee: "", perPrintCost: "" };

export default function PrintCostsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<PresetForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: presets, isLoading, refetch } = trpc.printPresets.list.useQuery();

  const createMutation = trpc.printPresets.create.useMutation({
    onSuccess: () => { toast.success("Print preset added"); refetch(); setShowForm(false); setForm(emptyForm); },
    onError: () => toast.error("Failed to add preset"),
  });
  const updateMutation = trpc.printPresets.update.useMutation({
    onSuccess: () => { toast.success("Preset updated"); refetch(); setShowForm(false); setEditId(null); setForm(emptyForm); },
    onError: () => toast.error("Failed to update preset"),
  });
  const deleteMutation = trpc.printPresets.delete.useMutation({
    onSuccess: () => { toast.success("Preset deleted"); refetch(); },
    onError: () => toast.error("Failed to delete preset"),
  });

  function openAdd() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(preset: NonNullable<typeof presets>[number]) {
    setEditId(preset.id);
    setForm({
      name: preset.name,
      inkCost: preset.inkCost ?? "",
      setupFee: preset.setupFee ?? "",
      perPrintCost: preset.perPrintCost ?? "",
    });
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.name) { toast.error("Name is required"); return; }
    const data = {
      name: form.name,
      inkCost: form.inkCost || "0",
      setupFee: form.setupFee || "0",
      perPrintCost: form.perPrintCost || "0",
    };
    if (editId) {
      updateMutation.mutate({ id: editId, ...data });
    } else {
      createMutation.mutate(data);
    }
  }

  function totalPerUnit(preset: NonNullable<typeof presets>[number]): string {
    const ink = parseFloat(preset.inkCost ?? "0");
    const per = parseFloat(preset.perPrintCost ?? "0");
    return (ink + per).toFixed(2);
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Print Costs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Reusable print location presets for your quotes
          </p>
        </div>
        <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 text-white gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Preset</span>
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && (presets?.length ?? 0) === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <DollarSign className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold mb-2">No print presets yet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Create reusable print location presets to quickly add costs to your quotes.
          </p>
          <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 text-white gap-2">
            <Plus className="h-4 w-4" /> Add your first preset
          </Button>
        </div>
      )}

      {/* List */}
      {!isLoading && (presets?.length ?? 0) > 0 && (
        <div className="space-y-2">
          {presets!.map((preset) => (
            <Card key={preset.id} className="border-border/60 hover:border-primary/30 hover:shadow-sm transition-all group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{preset.name}</p>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        Ink cost: <span className="text-foreground font-medium">${parseFloat(preset.inkCost ?? "0").toFixed(2)}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Setup fee: <span className="text-foreground font-medium">${parseFloat(preset.setupFee ?? "0").toFixed(2)}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Per print: <span className="text-foreground font-medium">${parseFloat(preset.perPrintCost ?? "0").toFixed(2)}</span>
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      ~<span className="text-foreground font-medium">${totalPerUnit(preset)}</span> per unit (ink + per print)
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(preset)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(preset.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) { setEditId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Print Preset" : "Add Print Preset"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Full front print" className="h-9" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Ink Cost</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input value={form.inkCost} onChange={(e) => setForm({ ...form, inkCost: e.target.value })} placeholder="0.00" className="h-9 pl-5" type="number" step="0.01" min="0" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Setup Fee</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input value={form.setupFee} onChange={(e) => setForm({ ...form, setupFee: e.target.value })} placeholder="0.00" className="h-9 pl-5" type="number" step="0.01" min="0" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Per Print</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input value={form.perPrintCost} onChange={(e) => setForm({ ...form, perPrintCost: e.target.value })} placeholder="0.00" className="h-9 pl-5" type="number" step="0.01" min="0" />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              Cost per unit = ink cost + per print cost. Setup fee is charged once per item.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {editId ? "Save Changes" : "Add Preset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete preset?</AlertDialogTitle>
            <AlertDialogDescription>
              This print preset will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => { if (deleteId) deleteMutation.mutate({ id: deleteId }); setDeleteId(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
