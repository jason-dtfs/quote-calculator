// ─── App Config ───────────────────────────────────────────────────────────────

// Re-exported from shared constants so existing imports keep working.
export { APP_NAME, APP_TAGLINE } from "@shared/constants";

// ─── Size labels ──────────────────────────────────────────────────────────────

export const SIZE_KEYS = ["qtyXS", "qtyS", "qtyM", "qtyL", "qtyXL", "qty2XL", "qty3XL", "qty4XL", "qty5XL"] as const;
export const SIZE_LABELS: Record<string, string> = {
  qtyXS: "XS", qtyS: "S", qtyM: "M", qtyL: "L", qtyXL: "XL", qty2XL: "2XL", qty3XL: "3XL", qty4XL: "4XL", qty5XL: "5XL",
};

// Sizes that fall under the priceSXL tier (S–XL is one cost bracket).
export const STANDARD_SIZE_KEYS = ["qtyS", "qtyM", "qtyL", "qtyXL"] as const;

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
  priceXS: string;
  priceSXL: string;
  price2XL: string;
  price3XL: string;
  price4XL: string;
  price5XL: string;
  // One-size mode short-circuits the six tier prices: priceOS is the only
  // applicable price and the qtyOS quantity bucket is the only one used.
  // `isOneSize` and `priceOS` are optional on snapshots written before the
  // one-size feature; treat missing as false / "0".
  isOneSize?: boolean;
  priceOS?: string | null;
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
  qtyOS: number;
  qtyXS: number;
  qtyS: number;
  qtyM: number;
  qtyL: number;
  qtyXL: number;
  qty2XL: number;
  qty3XL: number;
  qty4XL: number;
  qty5XL: number;
  lineNotes?: string;
  prints: { presetId?: number; presetSnapshot?: PrintSnapshot; cost: string }[];
}

export function calcBlankCost(item: QuoteItemDraft): number {
  const snap = item.blankSnapshot;
  if (!snap) return 0;

  // One-size short-circuit: a single price × qtyOS, ignore the tier columns.
  if (snap.isOneSize) {
    const priceOS = parseFloat(snap.priceOS ?? "0") || 0;
    return item.qtyOS * priceOS;
  }

  const priceXS = parseFloat(snap.priceXS) || 0;
  const priceSXL = parseFloat(snap.priceSXL) || 0;
  const price2XL = parseFloat(snap.price2XL) || 0;
  const price3XL = parseFloat(snap.price3XL) || 0;
  const price4XL = parseFloat(snap.price4XL) || 0;
  const price5XL = parseFloat(snap.price5XL) || 0;

  // S, M, L, XL all fall under the priceSXL tier
  const stdQty = item.qtyS + item.qtyM + item.qtyL + item.qtyXL;

  return (
    item.qtyXS * priceXS +
    stdQty * priceSXL +
    item.qty2XL * price2XL +
    item.qty3XL * price3XL +
    item.qty4XL * price4XL +
    item.qty5XL * price5XL
  );
}

export function calcPrintCost(item: QuoteItemDraft): number {
  // qtyOS counts toward print volume the same way as any sized qty does — the
  // per-print cost is per unit regardless of size. setupFee is one-shot per
  // print location, also unchanged.
  const totalQty =
    item.qtyOS +
    item.qtyXS + item.qtyS + item.qtyM + item.qtyL + item.qtyXL +
    item.qty2XL + item.qty3XL + item.qty4XL + item.qty5XL;
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
  return (
    item.qtyOS +
    item.qtyXS + item.qtyS + item.qtyM + item.qtyL + item.qtyXL +
    item.qty2XL + item.qty3XL + item.qty4XL + item.qty5XL
  );
}

export function formatCurrency(amount: number, symbol = "$"): string {
  return `${symbol}${amount.toFixed(2)}`;
}

export function formatQtySummary(item: QuoteItemDraft): string {
  // One-size items only ever have qtyOS — render that label and skip the
  // tier columns so PDFs and the clipboard / CSV outputs stay clean.
  if (item.blankSnapshot?.isOneSize) {
    return item.qtyOS ? `OS: ${item.qtyOS}` : "No sizes";
  }
  const parts: string[] = [];
  if (item.qtyXS) parts.push(`XS: ${item.qtyXS}`);
  if (item.qtyS) parts.push(`S: ${item.qtyS}`);
  if (item.qtyM) parts.push(`M: ${item.qtyM}`);
  if (item.qtyL) parts.push(`L: ${item.qtyL}`);
  if (item.qtyXL) parts.push(`XL: ${item.qtyXL}`);
  if (item.qty2XL) parts.push(`2XL: ${item.qty2XL}`);
  if (item.qty3XL) parts.push(`3XL: ${item.qty3XL}`);
  if (item.qty4XL) parts.push(`4XL: ${item.qty4XL}`);
  if (item.qty5XL) parts.push(`5XL: ${item.qty5XL}`);
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
