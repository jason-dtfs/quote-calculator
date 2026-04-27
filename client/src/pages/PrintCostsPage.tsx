import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useCreatePrintPreset,
  useDeletePrintPreset,
  useForkSystemPreset,
  useHideSystemPreset,
  usePrintPresetsList,
  useReorderPrintPresets,
  useRestoreSystemPreset,
  useUpdatePrintPreset,
} from "@/_core/hooks/usePrintPresets";
import { useNotifyMutationError, useNotifySaved } from "@/_core/hooks/useNotifySaved";
import { CatalogPreset } from "@shared/constants";
import { ChevronDown, ChevronUp, DollarSign, Edit2, Plus, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
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
  const [showHidden, setShowHidden] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<CatalogPreset | null>(null);
  const [form, setForm] = useState<PresetForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<CatalogPreset | null>(null);

  const notifySaved = useNotifySaved();
  const notifyError = useNotifyMutationError();

  function closeForm() {
    setShowForm(false);
    setEditingPreset(null);
    setForm(emptyForm);
  }

  const { data: presets, isLoading, refetch } = usePrintPresetsList({ includeHidden: showHidden });

  const createMutation = useCreatePrintPreset();
  const updateMutation = useUpdatePrintPreset();
  const forkSystemMutation = useForkSystemPreset();
  const hideSystemMutation = useHideSystemPreset();
  const restoreSystemMutation = useRestoreSystemPreset();
  const deleteMutation = useDeletePrintPreset();
  const reorderMutation = useReorderPrintPresets();

  function moveByOffset(index: number, offset: -1 | 1) {
    if (!presets) return;
    const sortable = presets.filter((p) => !p.isHidden);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= sortable.length) return;

    const reordered = sortable.slice();
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const payload = reordered.map((p, i) => ({ id: p.id, sortOrder: i }));
    reorderMutation.mutate(payload, {
      onSuccess: () => refetch(),
      onError: (err) => { notifyError(err, "Failed to reorder"); refetch(); },
    });
  }

  function openAdd() {
    setEditingPreset(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(preset: CatalogPreset) {
    if (preset.isHidden) return;
    setEditingPreset(preset);
    setForm({
      name: preset.name,
      inkCost: preset.inkCost ?? "",
      setupFee: preset.setupFee ?? "",
      perPrintCost: preset.perPrintCost ?? "",
    });
    setShowForm(true);
  }

  function openDelete(preset: CatalogPreset) {
    setDeleteTarget(preset);
  }

  function handleReset(preset: CatalogPreset) {
    if (!preset.overridesSystemId) return;
    restoreSystemMutation.mutate(
      { systemId: preset.overridesSystemId },
      {
        onSuccess: () => { notifySaved("Reset to default"); refetch(); },
        onError: (err) => notifyError(err, "Failed to reset"),
      }
    );
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    if (typeof target.id === "string") {
      hideSystemMutation.mutate(
        { systemId: target.id },
        {
          onSuccess: () => { notifySaved("Hidden from your list"); refetch(); },
          onError: (err) => notifyError(err, "Failed to hide preset"),
        }
      );
    } else if (target.overridesSystemId) {
      hideSystemMutation.mutate(
        { systemId: target.overridesSystemId },
        {
          onSuccess: () => { notifySaved("Hidden from your list"); refetch(); },
          onError: (err) => notifyError(err, "Failed to hide preset"),
        }
      );
    } else {
      deleteMutation.mutate(
        { id: target.id },
        {
          onSuccess: () => { notifySaved("Preset deleted"); refetch(); },
          onError: (err) => notifyError(err, "Failed to delete preset"),
        }
      );
    }
  }

  function handleSubmit() {
    if (!form.name) { notifyError(new Error("validation"), "Name is required"); return; }
    const data = {
      name: form.name,
      inkCost: form.inkCost || "0",
      setupFee: form.setupFee || "0",
      perPrintCost: form.perPrintCost || "0",
    };
    if (!editingPreset) {
      createMutation.mutate(data, {
        onSuccess: () => { notifySaved("Print preset added"); refetch(); closeForm(); },
        onError: (err) => notifyError(err, "Failed to add preset"),
      });
    } else if (typeof editingPreset.id === "string") {
      forkSystemMutation.mutate(
        { systemId: editingPreset.id, ...data },
        {
          onSuccess: () => { notifySaved("Customized for your shop"); refetch(); closeForm(); },
          onError: (err) => notifyError(err, "Failed to save customization"),
        }
      );
    } else {
      updateMutation.mutate(
        { id: editingPreset.id, ...data },
        {
          onSuccess: () => { notifySaved("Preset updated"); refetch(); closeForm(); },
          onError: (err) => notifyError(err, "Failed to update preset"),
        }
      );
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

      <div className="flex items-center gap-2 mb-4">
        <Switch
          id="show-hidden-presets"
          checked={showHidden}
          onCheckedChange={setShowHidden}
          className="data-[state=checked]:bg-primary"
        />
        <Label htmlFor="show-hidden-presets" className="text-xs text-muted-foreground cursor-pointer">
          Show hidden defaults
        </Label>
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
      {!isLoading && (presets?.length ?? 0) > 0 && (() => {
        const sortable = presets!.filter((p) => !p.isHidden);
        const hidden = presets!.filter((p) => p.isHidden);
        const renderCard = (preset: CatalogPreset) => {
          const isHidden = !!preset.isHidden;
          const isSystemRow = preset.isSystem && !preset.overridesSystemId;
          const isCustomized = !!preset.overridesSystemId && !isHidden;
          return (
            <Card
              className={`border-border/60 hover:border-primary/30 hover:shadow-sm transition-all group ${isHidden ? "opacity-60" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-foreground">{preset.name}</p>
                      {isHidden ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                          Hidden default
                        </Badge>
                      ) : isCustomized ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
                          Customized
                        </Badge>
                      ) : isSystemRow ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                          System
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        Ink cost: <span className="text-foreground font-medium">${parseFloat(preset.inkCost ?? "0").toFixed(2)}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Per print: <span className="text-foreground font-medium">${parseFloat(preset.perPrintCost ?? "0").toFixed(2)}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Setup fee: <span className="text-foreground font-medium">${parseFloat(preset.setupFee ?? "0").toFixed(2)}</span>
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      ~<span className="text-foreground font-medium">${totalPerUnit(preset)}</span> per unit (ink + per print)
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isHidden ? (
                      <Button
                        variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"
                        onClick={() => handleReset(preset)}
                        title="Restore this default to your list"
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Restore
                      </Button>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(preset)} title="Edit">
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        {isCustomized && (
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => handleReset(preset)}
                            title="Reset to default"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => openDelete(preset)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        };
        return (
          <div className="space-y-2">
            {sortable.map((preset, index) => (
              <div key={String(preset.id)} className="flex items-stretch gap-1.5">
                <div className="flex flex-col items-center justify-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => moveByOffset(index, -1)}
                    disabled={index === 0 || reorderMutation.isPending}
                    aria-label="Move up"
                    title="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => moveByOffset(index, 1)}
                    disabled={index === sortable.length - 1 || reorderMutation.isPending}
                    aria-label="Move down"
                    title="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">{renderCard(preset)}</div>
              </div>
            ))}
            {hidden.length > 0 && (
              <div className="space-y-2 pt-1">
                {hidden.map((preset) => (
                  <div key={String(preset.id)} className="pl-[30px]">
                    {renderCard(preset)}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) closeForm(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {!editingPreset
                ? "Add Print Preset"
                : typeof editingPreset.id === "string"
                  ? "Customize System Preset"
                  : "Edit Print Preset"}
            </DialogTitle>
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
                <Label className="text-xs font-medium">Per Print</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input value={form.perPrintCost} onChange={(e) => setForm({ ...form, perPrintCost: e.target.value })} placeholder="0.00" className="h-9 pl-5" type="number" step="0.01" min="0" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Setup Fee</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input value={form.setupFee} onChange={(e) => setForm({ ...form, setupFee: e.target.value })} placeholder="0.00" className="h-9 pl-5" type="number" step="0.01" min="0" />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              Cost per unit = ink cost + per print cost. Setup fee is charged once per item.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || forkSystemMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {!editingPreset ? "Add Preset" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget && (typeof deleteTarget.id === "string" || deleteTarget.overridesSystemId)
                ? "Hide this default?"
                : "Delete preset?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (typeof deleteTarget.id === "string" || deleteTarget.overridesSystemId)
                ? "We'll hide this default from your list. Toggle \"Show hidden defaults\" to bring it back."
                : "This print preset will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={confirmDelete}
            >
              {deleteTarget && (typeof deleteTarget.id === "string" || deleteTarget.overridesSystemId) ? "Hide" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
