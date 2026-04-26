// ─── App Config ───────────────────────────────────────────────────────────────

export const APP_NAME = "Quote Calculator";
export const APP_TAGLINE = "Professional quoting for print shops";

// ─── Size labels ──────────────────────────────────────────────────────────────

export const SIZE_KEYS = ["qtyS", "qtyM", "qtyL", "qtyXL", "qty2XL", "qty3XL", "qty4XL"] as const;
export const SIZE_LABELS: Record<string, string> = {
  qtyS: "S", qtyM: "M", qtyL: "L", qtyXL: "XL", qty2XL: "2XL", qty3XL: "3XL", qty4XL: "4XL",
};

export type SizeKey = typeof SIZE_KEYS[number];

// ─── Garment types ────────────────────────────────────────────────────────────

export const DEFAULT_GARMENT_TYPES = [
  "T-shirt", "Long sleeve", "Polo", "Hoodie", "Crewneck sweatshirt",
  "Tank top", "Hat", "Tote bag", "Other",
];

// ─── Pricing helpers ──────────────────────────────────────────────────────────

export interface BlankSnapshot {
  brand: string;
  garmentType: string;
  modelName: string;
  variant?: string;
  priceSXL: string;
  price2XL: string;
  price3XL: string;
  price4XLPlus: string;
}

export interface PrintSnapshot {
  name: string;
  inkCost: string;
  setupFee: string;
  perPrintCost: string;
}

export interface QuoteItemDraft {
  blankId?: number;
  blankSnapshot?: BlankSnapshot;
  qtyS: number;
  qtyM: number;
  qtyL: number;
  qtyXL: number;
  qty2XL: number;
  qty3XL: number;
  qty4XL: number;
  lineNotes?: string;
  prints: { presetId?: number; presetSnapshot?: PrintSnapshot; cost: string }[];
}

export function calcBlankCost(item: QuoteItemDraft): number {
  const snap = item.blankSnapshot;
  if (!snap) return 0;

  const priceSXL = parseFloat(snap.priceSXL) || 0;
  const price2XL = parseFloat(snap.price2XL) || 0;
  const price3XL = parseFloat(snap.price3XL) || 0;
  const price4XL = parseFloat(snap.price4XLPlus) || 0;

  const stdQty = item.qtyS + item.qtyM + item.qtyL + item.qtyXL;
  const qty2xl = item.qty2XL;
  const qty3xl = item.qty3XL;
  const qty4xl = item.qty4XL;

  return stdQty * priceSXL + qty2xl * price2XL + qty3xl * price3XL + qty4xl * price4XL;
}

export function calcPrintCost(item: QuoteItemDraft): number {
  const totalQty = item.qtyS + item.qtyM + item.qtyL + item.qtyXL + item.qty2XL + item.qty3XL + item.qty4XL;
  return item.prints.reduce((sum, p) => {
    const snap = p.presetSnapshot;
    if (!snap) return sum + (parseFloat(p.cost) || 0);
    const perPrint = parseFloat(snap.perPrintCost) || 0;
    const setup = parseFloat(snap.setupFee) || 0;
    return sum + perPrint * totalQty + setup;
  }, 0);
}

export function calcLineTotal(item: QuoteItemDraft, margin: number): number {
  const blankCost = calcBlankCost(item);
  const printCost = calcPrintCost(item);
  const cost = blankCost + printCost;
  return cost / (1 - margin / 100);
}

export function calcQuoteTotals(items: QuoteItemDraft[], margin: number, taxRate: number, taxEnabled: boolean) {
  const subtotal = items.reduce((sum, item) => sum + calcLineTotal(item, margin), 0);
  const taxAmount = taxEnabled ? subtotal * (taxRate / 100) : 0;
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

export function totalQty(item: QuoteItemDraft): number {
  return item.qtyS + item.qtyM + item.qtyL + item.qtyXL + item.qty2XL + item.qty3XL + item.qty4XL;
}

export function formatCurrency(amount: number, symbol = "$"): string {
  return `${symbol}${amount.toFixed(2)}`;
}

export function formatQtySummary(item: QuoteItemDraft): string {
  const parts: string[] = [];
  if (item.qtyS) parts.push(`S: ${item.qtyS}`);
  if (item.qtyM) parts.push(`M: ${item.qtyM}`);
  if (item.qtyL) parts.push(`L: ${item.qtyL}`);
  if (item.qtyXL) parts.push(`XL: ${item.qtyXL}`);
  if (item.qty2XL) parts.push(`2XL: ${item.qty2XL}`);
  if (item.qty3XL) parts.push(`3XL: ${item.qty3XL}`);
  if (item.qty4XL) parts.push(`4XL: ${item.qty4XL}`);
  return parts.join("    ") || "No sizes";
}

export function blankDisplayName(snap?: BlankSnapshot | null): string {
  if (!snap) return "Custom item";
  const parts = [snap.brand, snap.modelName];
  if (snap.variant) parts.push(`(${snap.variant})`);
  return parts.join(" ");
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
};

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-teal-100 text-teal-700",
};
