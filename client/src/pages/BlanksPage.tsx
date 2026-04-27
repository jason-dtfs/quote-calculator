import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useBlanksBrands,
  useBlanksGarmentTypes,
  useBlanksList,
  useBulkImportBlanks,
  useCreateBlank,
  useDeleteBlank,
  useForkSystemBlank,
  useHideSystemBlank,
  useReorderBlanks,
  useRestoreSystemBlank,
  useUpdateBlank,
} from "@/_core/hooks/useBlanks";
import { useNotifyMutationError, useNotifySaved } from "@/_core/hooks/useNotifySaved";
import { DEFAULT_GARMENT_TYPES } from "@/lib/pricing";
import { CatalogBlank } from "@shared/constants";
import { BookOpen, ChevronDown, ChevronUp, Download, Edit2, Plus, RotateCcw, Search, Trash2, Undo2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import Papa from "papaparse";
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

interface BlankForm {
  brand: string;
  garmentType: string;
  modelName: string;
  variant: string;
  isOneSize: boolean;
  priceOS: string;
  priceXS: string;
  priceSXL: string;
  price2XL: string;
  price3XL: string;
  price4XL: string;
  price5XL: string;
}

const emptyForm: BlankForm = {
  brand: "", garmentType: "", modelName: "", variant: "",
  isOneSize: false, priceOS: "",
  priceXS: "", priceSXL: "", price2XL: "", price3XL: "", price4XL: "", price5XL: "",
};

export default function BlanksPage() {
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showHidden, setShowHidden] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingBlank, setEditingBlank] = useState<CatalogBlank | null>(null);
  const [form, setForm] = useState<BlankForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<CatalogBlank | null>(null);
  const [customType, setCustomType] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const notifySaved = useNotifySaved();
  const notifyError = useNotifyMutationError();

  const queryInput = {
    search: search || undefined,
    brand: brandFilter !== "all" ? brandFilter : undefined,
    garmentType: typeFilter !== "all" ? typeFilter : undefined,
    includeHidden: showHidden,
  };

  const { data: blanks, isLoading, refetch } = useBlanksList(queryInput);
  const { data: brands } = useBlanksBrands();
  const { data: garmentTypes } = useBlanksGarmentTypes();

  function closeForm() {
    setShowForm(false);
    setEditingBlank(null);
    setForm(emptyForm);
  }

  const createMutation = useCreateBlank();
  const updateMutation = useUpdateBlank();
  const forkSystemMutation = useForkSystemBlank();
  const hideSystemMutation = useHideSystemBlank();
  const restoreSystemMutation = useRestoreSystemBlank();
  const deleteMutation = useDeleteBlank();
  const bulkImportMutation = useBulkImportBlanks();
  const reorderMutation = useReorderBlanks();

  function moveByOffset(index: number, offset: -1 | 1) {
    if (!blanks) return;
    const sortable = blanks.filter((b) => !b.isHidden);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= sortable.length) return;

    const reordered = sortable.slice();
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const payload = reordered.map((b, i) => ({ id: b.id, sortOrder: i }));
    reorderMutation.mutate(payload, {
      onSuccess: () => refetch(),
      onError: (err) => { notifyError(err, "Failed to reorder"); refetch(); },
    });
  }

  const allGarmentTypes = Array.from(new Set([...DEFAULT_GARMENT_TYPES, ...(garmentTypes ?? [])]));

  function openAdd() {
    setEditingBlank(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(blank: CatalogBlank) {
    if (blank.isHidden) return; // tombstones aren't editable; user should Restore first
    setEditingBlank(blank);
    setForm({
      brand: blank.brand,
      garmentType: blank.garmentType,
      modelName: blank.modelName,
      variant: blank.variant ?? "",
      isOneSize: blank.isOneSize ?? false,
      priceOS: blank.priceOS ?? "",
      priceXS: blank.priceXS ?? "",
      priceSXL: blank.priceSXL ?? "",
      price2XL: blank.price2XL ?? "",
      price3XL: blank.price3XL ?? "",
      price4XL: blank.price4XL ?? "",
      price5XL: blank.price5XL ?? "",
    });
    setShowForm(true);
  }

  function openDelete(blank: CatalogBlank) {
    setDeleteTarget(blank);
  }

  function handleReset(blank: CatalogBlank) {
    if (!blank.overridesSystemId) return;
    restoreSystemMutation.mutate(
      { systemId: blank.overridesSystemId },
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
          onError: (err) => notifyError(err, "Failed to hide blank"),
        }
      );
    } else if (target.overridesSystemId) {
      hideSystemMutation.mutate(
        { systemId: target.overridesSystemId },
        {
          onSuccess: () => { notifySaved("Hidden from your list"); refetch(); },
          onError: (err) => notifyError(err, "Failed to hide blank"),
        }
      );
    } else {
      deleteMutation.mutate(
        { id: target.id },
        {
          onSuccess: () => { notifySaved("Blank deleted"); refetch(); },
          onError: (err) => notifyError(err, "Failed to delete blank"),
        }
      );
    }
  }

  function handleSubmit() {
    if (!form.brand || !form.garmentType || !form.modelName) {
      notifyError(new Error("validation"), "Brand, garment type, and model name are required");
      return;
    }
    const garmentType = form.garmentType === "__custom__" ? customType : form.garmentType;
    // Empty price strings are accepted — server's optionalPrice transform coerces "" to "0".
    const data = { ...form, garmentType };
    if (!editingBlank) {
      createMutation.mutate(data, {
        onSuccess: () => { notifySaved("Blank added"); refetch(); closeForm(); },
        onError: (err) => notifyError(err, "Failed to add blank"),
      });
    } else if (typeof editingBlank.id === "string") {
      forkSystemMutation.mutate(
        { systemId: editingBlank.id, ...data },
        {
          onSuccess: () => { notifySaved("Customized for your shop"); refetch(); closeForm(); },
          onError: (err) => notifyError(err, "Failed to save customization"),
        }
      );
    } else {
      updateMutation.mutate(
        { id: editingBlank.id, ...data },
        {
          onSuccess: () => { notifySaved("Blank updated"); refetch(); closeForm(); },
          onError: (err) => notifyError(err, "Failed to update blank"),
        }
      );
    }
  }

  function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        const blanksToImport = rows.map((row) => {
          const oneSizeRaw = (row["One Size"] || row["one_size"] || row["isOneSize"] || "").trim().toLowerCase();
          const isOneSize = oneSizeRaw === "true" || oneSizeRaw === "yes" || oneSizeRaw === "1";
          return {
            brand: row["Brand"] || row["brand"] || "",
            garmentType: row["Garment Type"] || row["garment_type"] || row["garmentType"] || "",
            modelName: row["Model"] || row["model"] || row["modelName"] || "",
            variant: row["Variant"] || row["variant"] || "",
            isOneSize,
            priceOS: row["OS price"] || row["priceOS"] || "0",
            priceXS: row["XS price"] || row["priceXS"] || "0",
            priceSXL: row["S-XL price"] || row["priceSXL"] || "0",
            price2XL: row["2XL price"] || row["price2XL"] || "0",
            price3XL: row["3XL price"] || row["price3XL"] || "0",
            price4XL: row["4XL price"] || row["price4XL"] || "0",
            price5XL: row["5XL price"] || row["price5XL"] || "0",
          };
        }).filter((b) => b.brand && b.modelName);
        if (blanksToImport.length === 0) {
          notifyError(new Error("validation"), "No valid rows found in CSV");
          return;
        }
        bulkImportMutation.mutate(blanksToImport, {
          onSuccess: (data) => { notifySaved(`Imported ${data.count} blanks`); refetch(); },
          onError: (err) => notifyError(err, "Import failed"),
        });
      },
      error: () => notifyError(new Error("parse"), "Failed to parse CSV"),
    });
    e.target.value = "";
  }

  function downloadTemplate() {
    const csv =
      "Brand,Garment Type,Model,Variant,One Size,OS price,XS price,S-XL price,2XL price,3XL price,4XL price,5XL price\n" +
      "Sample,T-shirt,Sample Blank,,false,,4.62,4.62,6.25,7.27,8.84,10.05\n" +
      "Sample,Hat,Sample Hat,,true,8.50,,,,,,";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "blanks-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Blanks Library</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {blanks?.length ?? 0} item{blanks?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 hidden sm:flex">
            <Download className="h-3.5 w-3.5" /> Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Import CSV</span>
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
          <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 text-white gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Blank</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search blanks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-full sm:w-36 h-9 text-sm">
            <SelectValue placeholder="All brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {brands?.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-44 h-9 text-sm">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {allGarmentTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Switch
          id="show-hidden-blanks"
          checked={showHidden}
          onCheckedChange={setShowHidden}
          className="data-[state=checked]:bg-primary"
        />
        <Label htmlFor="show-hidden-blanks" className="text-xs text-muted-foreground cursor-pointer">
          Show hidden defaults
        </Label>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && (blanks?.length ?? 0) === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold mb-2">No blanks found</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Add your first blank manually or import a CSV file to get started.
          </p>
          <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 text-white gap-2">
            <Plus className="h-4 w-4" /> Add your first blank
          </Button>
        </div>
      )}

      {/* List */}
      {!isLoading && (blanks?.length ?? 0) > 0 && (() => {
        const sortable = blanks!.filter((b) => !b.isHidden);
        const hidden = blanks!.filter((b) => b.isHidden);
        const renderCard = (blank: CatalogBlank) => {
          const isHidden = !!blank.isHidden;
          const isSystemRow = blank.isSystem && !blank.overridesSystemId;
          const isCustomized = !!blank.overridesSystemId && !isHidden;
          return (
            <Card
              className={`border-border/60 hover:border-primary/30 hover:shadow-sm transition-all group ${isHidden ? "opacity-60" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">
                        {blank.brand} {blank.modelName}
                      </span>
                      {blank.variant && (
                        <Badge variant="secondary" className="text-xs px-2 py-0">
                          {blank.variant}
                        </Badge>
                      )}
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
                    <p className="text-xs text-muted-foreground mt-1">{blank.garmentType}</p>
                    {blank.isOneSize ? (
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          OS: <span className="text-foreground font-medium">${blank.priceOS ?? "0"}</span>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          XS: <span className="text-foreground font-medium">${blank.priceXS}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          S–XL: <span className="text-foreground font-medium">${blank.priceSXL}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          2XL: <span className="text-foreground font-medium">${blank.price2XL}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          3XL: <span className="text-foreground font-medium">${blank.price3XL}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          4XL: <span className="text-foreground font-medium">${blank.price4XL}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          5XL: <span className="text-foreground font-medium">${blank.price5XL}</span>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isHidden ? (
                      <Button
                        variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"
                        onClick={() => handleReset(blank)}
                        title="Restore this default to your list"
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Restore
                      </Button>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(blank)} title="Edit">
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        {isCustomized && (
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => handleReset(blank)}
                            title="Reset to default"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => openDelete(blank)}
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
            {sortable.map((blank, index) => (
              <div key={String(blank.id)} className="flex items-stretch gap-1.5">
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
                <div className="flex-1 min-w-0">{renderCard(blank)}</div>
              </div>
            ))}
            {hidden.length > 0 && (
              <div className="space-y-2 pt-1">
                {hidden.map((blank) => (
                  // Hidden tombstones don't get arrows. Indent to align with the
                  // sortable rows, which sit to the right of the move column.
                  <div key={String(blank.id)} className="pl-[30px]">
                    {renderCard(blank)}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) closeForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {!editingBlank
                ? "Add Blank"
                : typeof editingBlank.id === "string"
                  ? "Customize System Blank"
                  : "Edit Blank"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Brand *</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="e.g. Gildan" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Garment Type *</Label>
                <Select
                  value={form.garmentType}
                  onValueChange={(v) => setForm({ ...form, garmentType: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {allGarmentTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    <SelectItem value="__custom__">+ Custom type</SelectItem>
                  </SelectContent>
                </Select>
                {form.garmentType === "__custom__" && (
                  <Input
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    placeholder="Enter custom type"
                    className="h-9 mt-1"
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Model Name *</Label>
                <Input value={form.modelName} onChange={(e) => setForm({ ...form, modelName: e.target.value })} placeholder="e.g. 5000" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Variant</Label>
                <Input value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} placeholder="e.g. Safety Yellow" className="h-9" />
              </div>
            </div>
            <div className="flex items-start gap-2.5 pt-1">
              <Checkbox
                id="oneSize"
                checked={form.isOneSize}
                onCheckedChange={(v) => setForm({ ...form, isOneSize: v === true })}
                className="mt-0.5"
              />
              <div className="flex-1">
                <Label htmlFor="oneSize" className="text-sm font-normal leading-relaxed cursor-pointer">
                  One size only
                </Label>
                <p className="text-xs text-muted-foreground">
                  For hats, totes, bags, and other one-size products.
                </p>
              </div>
            </div>

            {form.isOneSize ? (
              <div>
                <Label className="text-xs font-medium mb-2 block">Pricing</Label>
                <div className="space-y-1.5 max-w-[8rem]">
                  <Label className="text-xs text-muted-foreground">Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      value={form.priceOS}
                      onChange={(e) => setForm({ ...form, priceOS: e.target.value })}
                      placeholder="0.00"
                      className="h-9 pl-6"
                      type="number" step="0.01" min="0"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <Label className="text-xs font-medium mb-2 block">Pricing <span className="text-muted-foreground font-normal">(leave blank if unsupported)</span></Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">XS</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input value={form.priceXS} onChange={(e) => setForm({ ...form, priceXS: e.target.value })} placeholder="0.00" className="h-9 pl-6" type="number" step="0.01" min="0" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">S – XL</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input value={form.priceSXL} onChange={(e) => setForm({ ...form, priceSXL: e.target.value })} placeholder="0.00" className="h-9 pl-6" type="number" step="0.01" min="0" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">2XL</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input value={form.price2XL} onChange={(e) => setForm({ ...form, price2XL: e.target.value })} placeholder="0.00" className="h-9 pl-6" type="number" step="0.01" min="0" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">3XL</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input value={form.price3XL} onChange={(e) => setForm({ ...form, price3XL: e.target.value })} placeholder="0.00" className="h-9 pl-6" type="number" step="0.01" min="0" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">4XL</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input value={form.price4XL} onChange={(e) => setForm({ ...form, price4XL: e.target.value })} placeholder="0.00" className="h-9 pl-6" type="number" step="0.01" min="0" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">5XL</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input value={form.price5XL} onChange={(e) => setForm({ ...form, price5XL: e.target.value })} placeholder="0.00" className="h-9 pl-6" type="number" step="0.01" min="0" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || forkSystemMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {!editingBlank ? "Add Blank" : "Save Changes"}
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
                : "Delete blank?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (typeof deleteTarget.id === "string" || deleteTarget.overridesSystemId)
                ? "We'll hide this default from your list. Toggle \"Show hidden defaults\" to bring it back."
                : "This blank will be permanently removed from your library."}
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
