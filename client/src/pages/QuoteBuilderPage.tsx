import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useBlanksList } from "@/_core/hooks/useBlanks";
import { useNotifyMutationError, useNotifySaved } from "@/_core/hooks/useNotifySaved";
import { usePrintPresetsList } from "@/_core/hooks/usePrintPresets";
import { useCreateQuote, useQuoteById, useUpdateQuote } from "@/_core/hooks/useQuotes";
import { useSettings } from "@/_core/hooks/useSettings";
import {
  BlankSnapshot,
  PrintSnapshot,
  QuoteItemDraft,
  SIZE_KEYS,
  SIZE_LABELS,
  blankDisplayName,
  calcBlankCost,
  calcLineTotal,
  calcPrintCost,
  calcQuoteTotals,
  formatCurrency,
  formatQtySummary,
  totalQty,
} from "@/lib/pricing";
import { clearDraft, loadDraft } from "@/lib/quoteDraft";
import { ArrowLeft, ChevronRight, Edit2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

type Step = "items" | "pricing" | "review";

const MARGIN_STEPS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80];

// UI-only augmentation: tracks which catalog item is selected, including
// system items where blankId/presetId stay undefined (no FK row to point at).
// Stripped before sending to the server.
type DraftPrintUI = QuoteItemDraft["prints"][number] & { catalogKey?: string };
type ItemDraftUI = Omit<QuoteItemDraft, "prints"> & {
  prints: DraftPrintUI[];
  blankCatalogKey?: string;
};

function emptyItem(): ItemDraftUI {
  return { qtyOS: 0, qtyXS: 0, qtyS: 0, qtyM: 0, qtyL: 0, qtyXL: 0, qty2XL: 0, qty3XL: 0, qty4XL: 0, qty5XL: 0, prints: [], lineNotes: "" };
}

function stripDraftUI(item: ItemDraftUI): QuoteItemDraft {
  const { blankCatalogKey: _bk, prints, ...rest } = item;
  return {
    ...rest,
    prints: prints.map(({ catalogKey: _ck, ...p }) => p),
  };
}

export default function QuoteBuilderPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const quoteId = params.id ? parseInt(params.id) : undefined;
  const isEditing = !!quoteId;

  const notifySaved = useNotifySaved();
  const notifyError = useNotifyMutationError();

  // Load existing quote for editing — works for both authed (DB) and anon (localStorage)
  const { data: existingQuote } = useQuoteById(quoteId ?? 0, { enabled: isEditing });
  const { data: settings } = useSettings();
  const { data: blanks } = useBlanksList({});
  const { data: printPresets } = usePrintPresetsList();

  // Steps
  const [step, setStep] = useState<Step>("items");

  // Items state
  const [items, setItems] = useState<ItemDraftUI[]>([]);
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [itemDraft, setItemDraft] = useState<ItemDraftUI>(emptyItem());
  const [showItemForm, setShowItemForm] = useState(false);

  // Pricing state
  const [margin, setMargin] = useState(30);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState("0");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");

  const currencySymbol = settings?.currencySymbol ?? "$";

  // Seed defaults from settings
  useEffect(() => {
    if (settings && !isEditing) {
      setMargin(settings.defaultMargin ?? 30);
      setTaxRate(String(settings.defaultTaxRate ?? "0"));
    }
  }, [settings, isEditing]);

  // Populate from existing quote
  useEffect(() => {
    if (existingQuote) {
      setMargin(existingQuote.margin);
      setTaxEnabled(existingQuote.taxEnabled ?? false);
      setTaxRate(String(existingQuote.taxRate ?? "0"));
      setCustomerName(existingQuote.customerName ?? "");
      setCustomerPhone(existingQuote.customerPhone ?? "");
      setCustomerEmail(existingQuote.customerEmail ?? "");
      setNotes(existingQuote.notes ?? "");
      const loadedItems: ItemDraftUI[] = (existingQuote.items ?? []).map((item) => ({
        blankId: item.blankId ?? undefined,
        blankCatalogKey: item.blankId ? String(item.blankId) : undefined,
        blankSnapshot: item.blankSnapshot as BlankSnapshot | undefined,
        qtyOS: item.qtyOS ?? 0,
        qtyXS: item.qtyXS ?? 0,
        qtyS: item.qtyS ?? 0,
        qtyM: item.qtyM ?? 0,
        qtyL: item.qtyL ?? 0,
        qtyXL: item.qtyXL ?? 0,
        qty2XL: item.qty2XL ?? 0,
        qty3XL: item.qty3XL ?? 0,
        qty4XL: item.qty4XL ?? 0,
        qty5XL: item.qty5XL ?? 0,
        lineNotes: item.lineNotes ?? "",
        prints: (item.prints ?? []).map((p) => ({
          presetId: p.presetId ?? undefined,
          catalogKey: p.presetId ? String(p.presetId) : undefined,
          presetSnapshot: p.presetSnapshot as PrintSnapshot | undefined,
          cost: p.cost ?? "0",
        })),
      }));
      setItems(loadedItems);
    }
  }, [existingQuote]);

  // Restore an anonymous draft after the user signs up / logs back in.
  useEffect(() => {
    if (isEditing) return;
    const draft = loadDraft();
    if (!draft) return;
    setMargin(draft.margin);
    setTaxEnabled(draft.taxEnabled);
    setTaxRate(draft.taxRate);
    setCustomerName(draft.customerName);
    setCustomerPhone(draft.customerPhone);
    setCustomerEmail(draft.customerEmail);
    setNotes(draft.notes);
    setItems(draft.items as ItemDraftUI[]);
    clearDraft();
    toast.success("Draft restored — hit Save Quote when you're ready");
  }, [isEditing]);

  const totals = useMemo(
    () => calcQuoteTotals(items as QuoteItemDraft[], margin, parseFloat(taxRate) || 0, taxEnabled),
    [items, margin, taxRate, taxEnabled]
  );

  const createMutation = useCreateQuote();
  const updateMutation = useUpdateQuote();

  function openAddItem() {
    setEditingItemIdx(null);
    setItemDraft(emptyItem());
    setShowItemForm(true);
  }

  function openEditItem(idx: number) {
    setEditingItemIdx(idx);
    setItemDraft({ ...items[idx] });
    setShowItemForm(true);
  }

  function saveItem() {
    if (totalQty(itemDraft) === 0) { toast.error("Add at least one unit"); return; }
    if (!itemDraft.blankSnapshot && !itemDraft.blankId) { toast.error("Select a blank"); return; }
    if (editingItemIdx !== null) {
      const updated = [...items];
      updated[editingItemIdx] = itemDraft;
      setItems(updated);
    } else {
      setItems([...items, itemDraft]);
    }
    setShowItemForm(false);
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function handleSave() {
    const payload = {
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      customerEmail: customerEmail || undefined,
      margin,
      taxEnabled,
      taxRate: taxRate || "0",
      notes: notes || undefined,
      subtotal: totals.subtotal.toFixed(2),
      taxAmount: totals.taxAmount.toFixed(2),
      total: totals.total.toFixed(2),
      status: "draft" as const,
      items: items.map((item) => ({
        blankId: item.blankId,
        blankSnapshot: item.blankSnapshot,
        qtyOS: item.qtyOS,
        qtyXS: item.qtyXS,
        qtyS: item.qtyS,
        qtyM: item.qtyM,
        qtyL: item.qtyL,
        qtyXL: item.qtyXL,
        qty2XL: item.qty2XL,
        qty3XL: item.qty3XL,
        qty4XL: item.qty4XL,
        qty5XL: item.qty5XL,
        lineNotes: item.lineNotes,
        blankCost: calcBlankCost(item as QuoteItemDraft).toFixed(2),
        printCost: calcPrintCost(item as QuoteItemDraft).toFixed(2),
        lineTotal: calcLineTotal(item as QuoteItemDraft, margin).toFixed(2),
        prints: item.prints.map((p) => ({
          presetId: p.presetId,
          presetSnapshot: p.presetSnapshot,
          cost: p.cost,
        })),
      })),
    };

    if (isEditing) {
      updateMutation.mutate(
        { id: quoteId!, ...payload },
        {
          onSuccess: () => {
            notifySaved("Quote updated");
            setLocation(`/quotes/${quoteId}`);
          },
          onError: (err) => notifyError(err, "Failed to update quote"),
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (data) => {
          notifySaved(`Quote ${data.quoteNumber} created`);
          setLocation(`/quotes/${data.id}`);
        },
        onError: (err) => notifyError(err, "Failed to save quote"),
      });
    }
  }

  const marginIdx = MARGIN_STEPS.indexOf(margin) !== -1 ? MARGIN_STEPS.indexOf(margin) : 4;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{isEditing ? "Edit Quote" : "New Quote"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {step === "items" ? "Add items to your quote" : step === "pricing" ? "Set pricing and customer info" : "Review and save"}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {(["items", "pricing", "review"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => { if (s !== "items" && items.length === 0) return; setStep(s); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                step === s
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${step === s ? "bg-white/20" : "bg-background"}`}>
                {i + 1}
              </span>
              {s === "items" ? "Items" : s === "pricing" ? "Pricing" : "Review"}
            </button>
            {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Items ── */}
      {step === "items" && (
        <div className="space-y-3">
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-xl">
              <p className="text-sm text-muted-foreground mb-3">No items added yet</p>
              <Button onClick={openAddItem} className="bg-primary hover:bg-primary/90 text-white gap-2">
                <Plus className="h-4 w-4" /> Add first item
              </Button>
            </div>
          )}

          {items.map((item, idx) => (
            <Card key={idx} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{blankDisplayName(item.blankSnapshot)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatQtySummary(item)} · {totalQty(item)} units</p>
                    {item.prints.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.prints.length} print location{item.prints.length !== 1 ? "s" : ""}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground">
                        Blank: <span className="text-foreground font-medium">{formatCurrency(calcBlankCost(item), currencySymbol)}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Print: <span className="text-foreground font-medium">{formatCurrency(calcPrintCost(item), currencySymbol)}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditItem(idx)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {items.length > 0 && (
            <Button variant="outline" onClick={openAddItem} className="w-full gap-2 border-dashed">
              <Plus className="h-4 w-4" /> Add another item
            </Button>
          )}

          {items.length > 0 && (
            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep("pricing")} className="bg-primary hover:bg-primary/90 text-white gap-2">
                Continue to Pricing <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Pricing ── */}
      {step === "pricing" && (
        <div className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Margin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Profit margin applied to all items</span>
                <span className="text-lg font-bold text-primary">{margin}%</span>
              </div>
              <Slider
                value={[marginIdx]}
                onValueChange={([idx]) => setMargin(MARGIN_STEPS[idx] ?? 30)}
                min={0}
                max={MARGIN_STEPS.length - 1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between">
                {MARGIN_STEPS.map((m) => (
                  <span key={m} className={`text-[10px] ${m === margin ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                    {m}%
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Tax</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Add sales tax</p>
                  <p className="text-xs text-muted-foreground">Shown as a separate line on the PDF</p>
                </div>
                <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} className="data-[state=checked]:bg-primary" />
              </div>
              {taxEnabled && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tax Rate</Label>
                  <div className="relative w-36">
                    <Input
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      placeholder="0"
                      className="h-9 pr-7"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Customer Info <span className="text-muted-foreground font-normal">(optional)</span></CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Customer Name</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Jane Smith" className="h-9" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Phone</Label>
                  <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+1 555 0100" className="h-9" type="tel" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Email</Label>
                  <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="jane@example.com" className="h-9" type="email" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes for the customer..." className="resize-none" rows={3} />
              </div>
            </CardContent>
          </Card>

          {/* Live totals (internal) */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Internal Breakdown</p>
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-muted-foreground truncate max-w-[60%]">{blankDisplayName(item.blankSnapshot)}</span>
                  <span className="font-medium">{formatCurrency(calcLineTotal(item, margin), currencySymbol)}</span>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(totals.subtotal, currencySymbol)}</span>
              </div>
              {taxEnabled && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                  <span className="font-medium">{formatCurrency(totals.taxAmount, currencySymbol)}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-primary text-lg">{formatCurrency(totals.total, currencySymbol)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep("items")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button onClick={() => setStep("review")} className="bg-primary hover:bg-primary/90 text-white gap-2">
              Review Quote <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Review ── */}
      {step === "review" && (
        <div className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {customerName && (
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="text-sm font-medium mt-0.5">{customerName}</p>
                  {customerEmail && <p className="text-xs text-muted-foreground">{customerEmail}</p>}
                  {customerPhone && <p className="text-xs text-muted-foreground">{customerPhone}</p>}
                </div>
              )}
              <Separator />
              {items.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">{blankDisplayName(item.blankSnapshot)}</span>
                    <span className="text-sm font-semibold">{formatCurrency(calcLineTotal(item, margin), currencySymbol)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatQtySummary(item)} · {totalQty(item)} units</p>
                  {item.prints.map((p, pi) => (
                    <p key={pi} className="text-xs text-muted-foreground pl-3">
                      · {(p.presetSnapshot as PrintSnapshot)?.name ?? "Print location"}
                    </p>
                  ))}
                  {item.lineNotes && <p className="text-xs text-muted-foreground italic pl-3">"{item.lineNotes}"</p>}
                </div>
              ))}
              <Separator />
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(totals.subtotal, currencySymbol)}</span>
                </div>
                {taxEnabled && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                    <span>{formatCurrency(totals.taxAmount, currencySymbol)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(totals.total, currencySymbol)}</span>
                </div>
              </div>
              {notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="text-sm mt-0.5">{notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep("pricing")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white px-8 shadow-sm"
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : isEditing ? "Update Quote" : "Save Quote"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Item Form Dialog ── */}
      <Dialog open={showItemForm} onOpenChange={(open) => { if (!open) setShowItemForm(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItemIdx !== null ? "Edit Item" : "Add Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Blank selection */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Select Blank *</Label>
              <Select
                value={itemDraft.blankCatalogKey ?? "custom"}
                onValueChange={(v) => {
                  if (v === "custom") {
                    setItemDraft({ ...itemDraft, blankId: undefined, blankCatalogKey: undefined, blankSnapshot: undefined });
                  } else {
                    const blank = blanks?.find((b) => String(b.id) === v);
                    if (blank) {
                      const dbId = typeof blank.id === "number" ? blank.id : undefined;
                      setItemDraft({
                        ...itemDraft,
                        blankId: dbId,
                        blankCatalogKey: v,
                        blankSnapshot: {
                          brand: blank.brand,
                          garmentType: blank.garmentType,
                          modelName: blank.modelName,
                          variant: blank.variant ?? undefined,
                          isOneSize: blank.isOneSize,
                          priceOS: blank.priceOS,
                          priceXS: blank.priceXS ?? "0",
                          priceSXL: blank.priceSXL ?? "0",
                          price2XL: blank.price2XL ?? "0",
                          price3XL: blank.price3XL ?? "0",
                          price4XL: blank.price4XL ?? "0",
                          price5XL: blank.price5XL ?? "0",
                        },
                      });
                    }
                  }
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choose a blank..." />
                </SelectTrigger>
                <SelectContent>
                  {blanks?.map((b) => (
                    <SelectItem key={String(b.id)} value={String(b.id)}>
                      {b.brand} {b.modelName}{b.variant ? ` (${b.variant})` : ""} — ${b.priceSXL}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">+ Custom / one-off item</SelectItem>
                </SelectContent>
              </Select>

              {/* Custom blank fields */}
              {!itemDraft.blankCatalogKey && (() => {
                // Empty strings (not "0") so the placeholder text shows until the user types.
                // Server's optionalPrice transform coerces "" → "0" on save.
                const emptySnap: BlankSnapshot = {
                  brand: "", garmentType: "", modelName: "",
                  priceXS: "", priceSXL: "", price2XL: "", price3XL: "", price4XL: "", price5XL: "",
                };
                const snap = itemDraft.blankSnapshot ?? emptySnap;
                const updateSnap = (partial: Partial<BlankSnapshot>) =>
                  setItemDraft({ ...itemDraft, blankSnapshot: { ...snap, ...partial } });

                return (
                  <div className="space-y-3 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Brand</Label>
                        <Input
                          placeholder="e.g. Gildan"
                          className="h-9"
                          value={snap.brand}
                          onChange={(e) => updateSnap({ brand: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Model name</Label>
                        <Input
                          placeholder="e.g. 5000"
                          className="h-9"
                          value={snap.modelName}
                          onChange={(e) => updateSnap({ modelName: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-2 block">Pricing <span className="text-muted-foreground font-normal">(leave blank if unsupported)</span></Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {([
                          ["XS", "priceXS"],
                          ["S – XL", "priceSXL"],
                          ["2XL", "price2XL"],
                          ["3XL", "price3XL"],
                          ["4XL", "price4XL"],
                          ["5XL", "price5XL"],
                        ] as const).map(([label, key]) => (
                          <div key={key} className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{label}</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                              <Input
                                placeholder="0.00"
                                className="h-9 pl-6"
                                type="number" step="0.01" min="0"
                                value={snap[key] ?? ""}
                                onChange={(e) => updateSnap({ [key]: e.target.value } as Partial<BlankSnapshot>)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Size breakdown — one input for one-size items, otherwise 9
                inputs grouped visually (S/M/L/XL share the priceSXL tier). */}
            {itemDraft.blankSnapshot?.isOneSize ? (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Quantity *</Label>
                <div className="max-w-[8rem]">
                  <Label className="text-[10px] text-muted-foreground text-center block">OS</Label>
                  <Input
                    type="number"
                    min="0"
                    value={itemDraft.qtyOS || ""}
                    onChange={(e) => setItemDraft({ ...itemDraft, qtyOS: parseInt(e.target.value) || 0 })}
                    className="h-9 text-center px-1"
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  One size only · Total: <span className="font-medium text-foreground">{totalQty(itemDraft)} units</span>
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Size Breakdown *</Label>
                <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
                  {SIZE_KEYS.map((key) => {
                    const isStandard = key === "qtyS" || key === "qtyM" || key === "qtyL" || key === "qtyXL";
                    return (
                      <div key={key} className="space-y-1">
                        <Label className={`text-[10px] text-center block ${isStandard ? "text-primary/70" : "text-muted-foreground"}`}>
                          {SIZE_LABELS[key]}
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          value={itemDraft[key] || ""}
                          onChange={(e) => setItemDraft({ ...itemDraft, [key]: parseInt(e.target.value) || 0 })}
                          className="h-9 text-center px-1"
                          placeholder="0"
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  S–XL share one price tier · Total: <span className="font-medium text-foreground">{totalQty(itemDraft)} units</span>
                </p>
              </div>
            )}

            {/* Print locations */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Print Locations</Label>
              {(printPresets?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">No print presets — add some in Print Costs</p>
              ) : (
                <div className="space-y-2">
                  {printPresets!.map((preset) => {
                    const presetKey = String(preset.id);
                    const isSelected = itemDraft.prints.some((p) => p.catalogKey === presetKey);
                    return (
                      <div
                        key={presetKey}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected ? "border-primary/50 bg-primary/5" : "border-border hover:border-border/80"
                        }`}
                        onClick={() => {
                          if (isSelected) {
                            setItemDraft({ ...itemDraft, prints: itemDraft.prints.filter((p) => p.catalogKey !== presetKey) });
                          } else {
                            const qty = totalQty(itemDraft as QuoteItemDraft);
                            const perPrint = parseFloat(preset.perPrintCost ?? "0");
                            const setup = parseFloat(preset.setupFee ?? "0");
                            const ink = parseFloat(preset.inkCost ?? "0");
                            const cost = ((ink + perPrint) * qty + setup).toFixed(2);
                            const dbId = typeof preset.id === "number" ? preset.id : undefined;
                            setItemDraft({
                              ...itemDraft,
                              prints: [
                                ...itemDraft.prints,
                                {
                                  presetId: dbId,
                                  catalogKey: presetKey,
                                  presetSnapshot: {
                                    name: preset.name,
                                    inkCost: preset.inkCost ?? "0",
                                    setupFee: preset.setupFee ?? "0",
                                    perPrintCost: preset.perPrintCost ?? "0",
                                  },
                                  cost,
                                },
                              ],
                            });
                          }
                        }}
                      >
                        <Checkbox checked={isSelected} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{preset.name}</p>
                          <p className="text-xs text-muted-foreground">
                            ${parseFloat(preset.perPrintCost ?? "0").toFixed(2)}/unit + ${parseFloat(preset.setupFee ?? "0").toFixed(2)} setup
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Line notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Line Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                value={itemDraft.lineNotes ?? ""}
                onChange={(e) => setItemDraft({ ...itemDraft, lineNotes: e.target.value })}
                placeholder="e.g. Front print only, no back"
                className="resize-none"
                rows={2}
              />
            </div>

            {/* Item cost preview */}
            {totalQty(itemDraft) > 0 && itemDraft.blankSnapshot && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Cost Preview</p>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Blank cost</span>
                  <span className="font-medium">{formatCurrency(calcBlankCost(itemDraft), currencySymbol)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Print cost</span>
                  <span className="font-medium">{formatCurrency(calcPrintCost(itemDraft), currencySymbol)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemForm(false)}>Cancel</Button>
            <Button onClick={saveItem} className="bg-primary hover:bg-primary/90 text-white">
              {editingItemIdx !== null ? "Update Item" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
