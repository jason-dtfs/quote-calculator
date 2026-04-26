import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { DEFAULT_GARMENT_TYPES } from "@/lib/pricing";
import { BookOpen, Download, Edit2, Plus, Search, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
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
  priceSXL: string;
  price2XL: string;
  price3XL: string;
  price4XLPlus: string;
}

const emptyForm: BlankForm = {
  brand: "", garmentType: "", modelName: "", variant: "",
  priceSXL: "", price2XL: "", price3XL: "", price4XLPlus: "",
};

export default function BlanksPage() {
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<BlankForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [customType, setCustomType] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const queryInput = {
    search: search || undefined,
    brand: brandFilter !== "all" ? brandFilter : undefined,
    garmentType: typeFilter !== "all" ? typeFilter : undefined,
  };

  const { data: blanks, isLoading, refetch } = trpc.blanks.list.useQuery(queryInput);
  const { data: brands } = trpc.blanks.brands.useQuery();
  const { data: garmentTypes } = trpc.blanks.garmentTypes.useQuery();

  const createMutation = trpc.blanks.create.useMutation({
    onSuccess: () => { toast.success("Blank added"); refetch(); setShowForm(false); setForm(emptyForm); },
    onError: () => toast.error("Failed to add blank"),
  });
  const updateMutation = trpc.blanks.update.useMutation({
    onSuccess: () => { toast.success("Blank updated"); refetch(); setShowForm(false); setEditId(null); setForm(emptyForm); },
    onError: () => toast.error("Failed to update blank"),
  });
  const deleteMutation = trpc.blanks.delete.useMutation({
    onSuccess: () => { toast.success("Blank deleted"); refetch(); },
    onError: () => toast.error("Failed to delete blank"),
  });
  const bulkImportMutation = trpc.blanks.bulkImport.useMutation({
    onSuccess: (data) => { toast.success(`Imported ${data.count} blanks`); refetch(); },
    onError: () => toast.error("Import failed"),
  });

  const allGarmentTypes = Array.from(new Set([...DEFAULT_GARMENT_TYPES, ...(garmentTypes ?? [])]));

  function openAdd() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(blank: NonNullable<typeof blanks>[number]) {
    setEditId(blank.id);
    setForm({
      brand: blank.brand,
      garmentType: blank.garmentType,
      modelName: blank.modelName,
      variant: blank.variant ?? "",
      priceSXL: blank.priceSXL ?? "",
      price2XL: blank.price2XL ?? "",
      price3XL: blank.price3XL ?? "",
      price4XLPlus: blank.price4XLPlus ?? "",
    });
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.brand || !form.garmentType || !form.modelName) {
      toast.error("Brand, garment type, and model name are required");
      return;
    }
    const garmentType = form.garmentType === "__custom__" ? customType : form.garmentType;
    const data = { ...form, garmentType };
    if (editId) {
      updateMutation.mutate({ id: editId, ...data });
    } else {
      createMutation.mutate(data);
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
        const blanksToImport = rows.map((row) => ({
          brand: row["Brand"] || row["brand"] || "",
          garmentType: row["Garment Type"] || row["garment_type"] || row["garmentType"] || "",
          modelName: row["Model"] || row["model"] || row["modelName"] || "",
          variant: row["Variant"] || row["variant"] || "",
          priceSXL: row["S-XL price"] || row["priceSXL"] || "0",
          price2XL: row["2XL price"] || row["price2XL"] || "0",
          price3XL: row["3XL price"] || row["price3XL"] || "0",
          price4XLPlus: row["4XL+ price"] || row["price4XLPlus"] || "0",
        })).filter((b) => b.brand && b.modelName);
        if (blanksToImport.length === 0) {
          toast.error("No valid rows found in CSV");
          return;
        }
        bulkImportMutation.mutate(blanksToImport);
      },
      error: () => toast.error("Failed to parse CSV"),
    });
    e.target.value = "";
  }

  function downloadTemplate() {
    const csv = "Brand,Garment Type,Model,Variant,S-XL price,2XL price,3XL price,4XL+ price\nGildan,T-shirt,5000,,5.00,6.50,7.50,8.50";
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
      {!isLoading && (blanks?.length ?? 0) > 0 && (
        <div className="space-y-2">
          {blanks!.map((blank) => (
            <Card key={blank.id} className="border-border/60 hover:border-primary/30 hover:shadow-sm transition-all group">
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
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{blank.garmentType}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
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
                        4XL+: <span className="text-foreground font-medium">${blank.price4XLPlus}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(blank)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(blank.id)}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Blank" : "Add Blank"}</DialogTitle>
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
            <div>
              <Label className="text-xs font-medium mb-2 block">Pricing</Label>
              <div className="grid grid-cols-2 gap-3">
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
                  <Label className="text-xs text-muted-foreground">4XL+</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input value={form.price4XLPlus} onChange={(e) => setForm({ ...form, price4XLPlus: e.target.value })} placeholder="0.00" className="h-9 pl-6" type="number" step="0.01" min="0" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {editId ? "Save Changes" : "Add Blank"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete blank?</AlertDialogTitle>
            <AlertDialogDescription>
              This blank will be permanently removed from your library.
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
