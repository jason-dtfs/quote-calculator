// Anonymous-mode data store. Mirrors the shape of the tRPC procedures used by
// authed flows but persists everything in localStorage. Hooks in
// client/src/_core/hooks/* route between this store and tRPC at call time
// based on whether ctx.user is present.
//
// Merge logic for blanks/presets is duplicated from server/routers.ts on
// purpose — different inputs (localStorage rows vs DB rows), and a shared
// helper would need a generic constraint that doesn't pull its weight.

import {
  CatalogBlank,
  CatalogPreset,
  SYSTEM_BLANKS,
  SYSTEM_PRESETS,
  SYSTEM_SORT_OFFSET,
} from "@shared/constants";
import type { BlankSnapshot, PrintSnapshot } from "@/lib/pricing";

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEY = {
  blanks: "qc:anon:v1:blanks",
  presets: "qc:anon:v1:print_presets",
  quotes: "qc:anon:v1:quotes",
  settings: "qc:anon:v1:settings",
  nextId: "qc:anon:v1:next_id",
} as const;

// All anon keys (including ancillary flags) — used by clearAll() and hasAnyData().
const ANON_DATA_KEYS = [KEY.blanks, KEY.presets, KEY.quotes, KEY.settings] as const;
const ANON_ANCILLARY_KEYS = [
  KEY.nextId,
  "qc:anon:v1:banner_dismissed",
  "qc:anon:v1:migration_handled",
] as const;

// ─── Row shapes ───────────────────────────────────────────────────────────────

export type AnonBlankRow = {
  id: number;
  brand: string;
  garmentType: string;
  modelName: string;
  variant: string | null;
  isOneSize: boolean;
  priceOS: string | null;
  priceXS: string;
  priceSXL: string;
  price2XL: string;
  price3XL: string;
  price4XL: string;
  price5XL: string;
  overridesSystemId: string | null;
  isHidden: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AnonPresetRow = {
  id: number;
  name: string;
  inkCost: string;
  setupFee: string;
  perPrintCost: string;
  overridesSystemId: string | null;
  isHidden: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AnonQuoteItemPrint = {
  presetId?: number;
  presetSnapshot?: PrintSnapshot;
  cost: string;
};

export type AnonQuoteItem = {
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
  lineNotes?: string | null;
  blankCost: string;
  printCost: string;
  lineTotal: string;
  prints: AnonQuoteItemPrint[];
};

export type AnonQuote = {
  id: number;
  quoteNumber: string;
  status: "draft" | "sent" | "accepted";
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  margin: number;
  taxEnabled: boolean;
  taxRate: string;
  notes: string | null;
  subtotal: string;
  taxAmount: string;
  total: string;
  items: AnonQuoteItem[];
  createdAt: string;
  updatedAt: string;
};

export type AnonSettings = {
  shopName: string | null;
  shopLogo: string | null; // data:... URL or null
  shopLogoSize: "small" | "medium" | "large";
  shopLogoPosition: "top-left" | "top-center" | "top-right";
  defaultTaxRate: string;
  defaultMargin: number;
  currencySymbol: string;
  marketingOptIn: boolean;
};

const DEFAULT_SETTINGS: AnonSettings = {
  shopName: null,
  shopLogo: null,
  shopLogoSize: "medium",
  shopLogoPosition: "top-left",
  defaultTaxRate: "0",
  defaultMargin: 30,
  currencySymbol: "$",
  marketingOptIn: false,
};

// ─── Errors ───────────────────────────────────────────────────────────────────

export class StorageQuotaError extends Error {
  constructor() {
    super("Browser storage full");
    this.name = "StorageQuotaError";
  }
}

// ─── Low-level read/write ─────────────────────────────────────────────────────

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // QuotaExceededError on most browsers; some throw NS_ERROR_DOM_QUOTA_REACHED.
    // We don't bother distinguishing — re-throw as our typed error.
    throw new StorageQuotaError();
  }
}

function nextId(): number {
  const current = parseInt(localStorage.getItem(KEY.nextId) ?? "0", 10) || 0;
  const next = current + 1;
  writeJSON(KEY.nextId, next);
  return next;
}

function nowIso(): string {
  return new Date().toISOString();
}

function generateQuoteNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `Q${yy}${mm}${dd}-${rand}`;
}

// ─── Subscriber pattern ───────────────────────────────────────────────────────
// Mutations call notify(); queries that ran subscribe() will re-read.

type Subscriber = () => void;
const subscribers = new Set<Subscriber>();

function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function notify(): void {
  for (const fn of subscribers) {
    try {
      fn();
    } catch {
      // a subscriber blowing up shouldn't take down the rest
    }
  }
}

// ─── Filter helpers (mirror server/routers.ts) ────────────────────────────────

function matchesBlankFilter(
  b: { brand: string; garmentType: string; modelName: string; variant: string | null },
  search?: string,
  brand?: string,
  garmentType?: string
): boolean {
  if (brand && b.brand !== brand) return false;
  if (garmentType && b.garmentType !== garmentType) return false;
  if (search) {
    const needle = search.toLowerCase();
    const hay = `${b.brand} ${b.modelName} ${b.variant ?? ""}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

// ─── Blanks ───────────────────────────────────────────────────────────────────

function readBlanks(): AnonBlankRow[] {
  return readJSON<AnonBlankRow[]>(KEY.blanks, []);
}

function writeBlanks(rows: AnonBlankRow[]): void {
  writeJSON(KEY.blanks, rows);
}

function blankRowToCatalog(b: AnonBlankRow): CatalogBlank {
  return {
    id: b.id,
    brand: b.brand,
    garmentType: b.garmentType,
    modelName: b.modelName,
    variant: b.variant,
    priceXS: b.priceXS,
    priceSXL: b.priceSXL,
    price2XL: b.price2XL,
    price3XL: b.price3XL,
    price4XL: b.price4XL,
    price5XL: b.price5XL,
    isOneSize: b.isOneSize,
    priceOS: b.priceOS,
    isSystem: false,
    overridesSystemId: b.overridesSystemId,
  };
}

// A row with overridesSystemId set, !isHidden, and empty data fields was
// created by drag-reorder of a system item — it carries a sortOrder but no
// user customization. The merge logic substitutes the underlying system data.
function isPositionOnlyBlankFork(r: AnonBlankRow): boolean {
  return r.overridesSystemId !== null && !r.isHidden && r.brand === "" && r.modelName === "";
}

function isPositionOnlyPresetFork(r: AnonPresetRow): boolean {
  return r.overridesSystemId !== null && !r.isHidden && r.name === "";
}

function nextBlankSortOrder(rows: AnonBlankRow[]): number {
  if (rows.length === 0) return 0;
  let max = -1;
  for (const r of rows) {
    if (r.sortOrder > max && r.sortOrder < SYSTEM_SORT_OFFSET) max = r.sortOrder;
  }
  return max + 1;
}

function nextPresetSortOrder(rows: AnonPresetRow[]): number {
  if (rows.length === 0) return 0;
  let max = -1;
  for (const r of rows) {
    if (r.sortOrder > max && r.sortOrder < SYSTEM_SORT_OFFSET) max = r.sortOrder;
  }
  return max + 1;
}

const blanks = {
  list(input?: {
    search?: string;
    brand?: string;
    garmentType?: string;
    includeHidden?: boolean;
  }): CatalogBlank[] {
    const rows = readBlanks();

    const shadowedSystemIds = new Set(
      rows.filter((r) => r.overridesSystemId !== null).map((r) => r.overridesSystemId as string)
    );

    // Visible user rows: split into position-only (render as system data) and
    // real customizations (render as their own data).
    type Decorated = { item: CatalogBlank; sortOrder: number };
    const decorated: Decorated[] = [];

    for (const r of rows) {
      if (r.isHidden) continue;
      if (isPositionOnlyBlankFork(r)) {
        const sys = SYSTEM_BLANKS.find((s) => s.id === r.overridesSystemId);
        if (!sys) continue;
        if (!matchesBlankFilter(sys, input?.search, input?.brand, input?.garmentType)) continue;
        // Render system data — UI sees it as a system item with its original
        // string id, so no "Customized" badge appears for a pure reorder.
        decorated.push({ item: { ...sys }, sortOrder: r.sortOrder });
      } else {
        if (!matchesBlankFilter(r, input?.search, input?.brand, input?.garmentType)) continue;
        decorated.push({ item: blankRowToCatalog(r), sortOrder: r.sortOrder });
      }
    }

    // Unforked system items get effective sortOrder = SYSTEM_SORT_OFFSET + array index
    SYSTEM_BLANKS.forEach((b, i) => {
      if (shadowedSystemIds.has(b.id as string)) return;
      if (!matchesBlankFilter(b, input?.search, input?.brand, input?.garmentType)) return;
      decorated.push({ item: b, sortOrder: SYSTEM_SORT_OFFSET + i });
    });

    decorated.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      const ab = `${a.item.brand} ${a.item.modelName}`.toLowerCase();
      const bb = `${b.item.brand} ${b.item.modelName}`.toLowerCase();
      return ab.localeCompare(bb);
    });

    const merged: CatalogBlank[] = decorated.map((d) => d.item);

    if (input?.includeHidden) {
      const tombstones = rows.filter((b) => b.isHidden && b.overridesSystemId);
      for (const t of tombstones) {
        const sysItem = SYSTEM_BLANKS.find((s) => s.id === t.overridesSystemId);
        if (!sysItem) continue;
        if (!matchesBlankFilter(sysItem, input?.search, input?.brand, input?.garmentType)) continue;
        merged.push({ ...sysItem, overridesSystemId: t.overridesSystemId, isHidden: true });
      }
    }

    return merged;
  },

  brands(): string[] {
    const userBrands = readBlanks()
      .filter((r) => !r.isHidden)
      .map((r) => r.brand)
      .filter((b) => b !== "");
    const systemBrands = SYSTEM_BLANKS.map((b) => b.brand);
    return Array.from(new Set([...userBrands, ...systemBrands])).sort();
  },

  garmentTypes(): string[] {
    const userTypes = readBlanks()
      .filter((r) => !r.isHidden)
      .map((r) => r.garmentType)
      .filter((t) => t !== "");
    const systemTypes = SYSTEM_BLANKS.map((b) => b.garmentType);
    return Array.from(new Set([...userTypes, ...systemTypes])).sort();
  },

  create(input: {
    brand: string;
    garmentType: string;
    modelName: string;
    variant?: string;
    isOneSize?: boolean;
    priceOS?: string | null;
    priceXS?: string;
    priceSXL?: string;
    price2XL?: string;
    price3XL?: string;
    price4XL?: string;
    price5XL?: string;
    sortOrder?: number;
  }): { id: number } {
    const rows = readBlanks();
    const now = nowIso();
    const row: AnonBlankRow = {
      id: nextId(),
      brand: input.brand,
      garmentType: input.garmentType,
      modelName: input.modelName,
      variant: input.variant ?? null,
      isOneSize: input.isOneSize ?? false,
      priceOS: input.priceOS ?? "0",
      priceXS: input.priceXS || "0",
      priceSXL: input.priceSXL || "0",
      price2XL: input.price2XL || "0",
      price3XL: input.price3XL || "0",
      price4XL: input.price4XL || "0",
      price5XL: input.price5XL || "0",
      overridesSystemId: null,
      isHidden: false,
      sortOrder: input.sortOrder ?? nextBlankSortOrder(rows),
      createdAt: now,
      updatedAt: now,
    };
    writeBlanks([...rows, row]);
    notify();
    return { id: row.id };
  },

  update(id: number, data: Partial<Omit<AnonBlankRow, "id" | "createdAt">>): void {
    const rows = readBlanks();
    const next = rows.map((r) =>
      r.id === id ? { ...r, ...data, id, updatedAt: nowIso() } : r
    );
    writeBlanks(next);
    notify();
  },

  delete(id: number): void {
    writeBlanks(readBlanks().filter((r) => r.id !== id));
    notify();
  },

  forkSystem(input: {
    systemId: string;
    brand: string;
    garmentType: string;
    modelName: string;
    variant?: string;
    isOneSize?: boolean;
    priceOS?: string | null;
    priceXS?: string;
    priceSXL?: string;
    price2XL?: string;
    price3XL?: string;
    price4XL?: string;
    price5XL?: string;
  }): { id: number } {
    if (!SYSTEM_BLANKS.some((b) => b.id === input.systemId)) {
      throw new Error(`Unknown system blank: ${input.systemId}`);
    }
    const rows = readBlanks();
    const existing = rows.find((r) => r.overridesSystemId === input.systemId);
    const now = nowIso();
    if (existing) {
      blanks.update(existing.id, {
        brand: input.brand,
        garmentType: input.garmentType,
        modelName: input.modelName,
        variant: input.variant ?? null,
        isOneSize: input.isOneSize ?? false,
        priceOS: input.priceOS ?? "0",
        priceXS: input.priceXS || "0",
        priceSXL: input.priceSXL || "0",
        price2XL: input.price2XL || "0",
        price3XL: input.price3XL || "0",
        price4XL: input.price4XL || "0",
        price5XL: input.price5XL || "0",
        isHidden: false,
      });
      return { id: existing.id };
    }
    const row: AnonBlankRow = {
      id: nextId(),
      brand: input.brand,
      garmentType: input.garmentType,
      modelName: input.modelName,
      variant: input.variant ?? null,
      isOneSize: input.isOneSize ?? false,
      priceOS: input.priceOS ?? "0",
      priceXS: input.priceXS || "0",
      priceSXL: input.priceSXL || "0",
      price2XL: input.price2XL || "0",
      price3XL: input.price3XL || "0",
      price4XL: input.price4XL || "0",
      price5XL: input.price5XL || "0",
      overridesSystemId: input.systemId,
      isHidden: false,
      sortOrder: nextBlankSortOrder(rows),
      createdAt: now,
      updatedAt: now,
    };
    writeBlanks([...rows, row]);
    notify();
    return { id: row.id };
  },

  hideSystem(input: { systemId: string }): { id: number } {
    if (!SYSTEM_BLANKS.some((b) => b.id === input.systemId)) {
      throw new Error(`Unknown system blank: ${input.systemId}`);
    }
    const rows = readBlanks();
    const existing = rows.find((r) => r.overridesSystemId === input.systemId);
    if (existing) {
      blanks.update(existing.id, { isHidden: true });
      return { id: existing.id };
    }
    const now = nowIso();
    const row: AnonBlankRow = {
      id: nextId(),
      brand: "",
      garmentType: "",
      modelName: "",
      variant: null,
      isOneSize: false,
      priceOS: null,
      priceXS: "0",
      priceSXL: "0",
      price2XL: "0",
      price3XL: "0",
      price4XL: "0",
      price5XL: "0",
      overridesSystemId: input.systemId,
      isHidden: true,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    writeBlanks([...rows, row]);
    notify();
    return { id: row.id };
  },

  restoreSystem(input: { systemId: string }): { success: true } {
    writeBlanks(readBlanks().filter((r) => r.overridesSystemId !== input.systemId));
    notify();
    return { success: true };
  },

  bulkImport(rowInputs: Array<Parameters<typeof blanks.create>[0]>): { count: number } {
    const rows = readBlanks();
    const now = nowIso();
    let nextOrder = nextBlankSortOrder(rows);
    const newRows: AnonBlankRow[] = rowInputs.map((input) => ({
      id: nextId(),
      brand: input.brand,
      garmentType: input.garmentType,
      modelName: input.modelName,
      variant: input.variant ?? null,
      isOneSize: input.isOneSize ?? false,
      priceOS: input.priceOS ?? "0",
      priceXS: input.priceXS || "0",
      priceSXL: input.priceSXL || "0",
      price2XL: input.price2XL || "0",
      price3XL: input.price3XL || "0",
      price4XL: input.price4XL || "0",
      price5XL: input.price5XL || "0",
      overridesSystemId: null,
      isHidden: false,
      sortOrder: nextOrder++,
      createdAt: now,
      updatedAt: now,
    }));
    writeBlanks([...rows, ...newRows]);
    notify();
    return { count: newRows.length };
  },

  // Persist a new ordering for the visible list. Each entry is either a user
  // row id (number) or a system catalog id (string). For system ids, upsert a
  // position-only fork so the new sortOrder is captured; for user ids, just
  // update sortOrder. Items not included keep their existing sortOrder.
  reorder(items: Array<{ id: string | number; sortOrder: number }>): { success: true } {
    const rows = readBlanks();
    const now = nowIso();
    const byUserId = new Map<number, AnonBlankRow>();
    rows.forEach((r) => byUserId.set(r.id, r));
    const bySystemId = new Map<string, AnonBlankRow>();
    rows.forEach((r) => {
      if (r.overridesSystemId) bySystemId.set(r.overridesSystemId, r);
    });

    const next: AnonBlankRow[] = [...rows];

    for (const it of items) {
      if (typeof it.id === "number") {
        const idx = next.findIndex((r) => r.id === it.id);
        if (idx === -1) continue;
        next[idx] = { ...next[idx], sortOrder: it.sortOrder, updatedAt: now };
        continue;
      }
      const systemId = it.id;
      if (!SYSTEM_BLANKS.some((b) => b.id === systemId)) continue;
      const existing = bySystemId.get(systemId);
      if (existing) {
        const idx = next.findIndex((r) => r.id === existing.id);
        if (idx !== -1) {
          next[idx] = { ...next[idx], sortOrder: it.sortOrder, updatedAt: now };
        }
      } else {
        next.push({
          id: nextId(),
          brand: "",
          garmentType: "",
          modelName: "",
          variant: null,
          isOneSize: false,
          priceOS: null,
          priceXS: "0",
          priceSXL: "0",
          price2XL: "0",
          price3XL: "0",
          price4XL: "0",
          price5XL: "0",
          overridesSystemId: systemId,
          isHidden: false,
          sortOrder: it.sortOrder,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    writeBlanks(next);
    notify();
    return { success: true };
  },
};

// ─── Print Presets ────────────────────────────────────────────────────────────

function readPresets(): AnonPresetRow[] {
  return readJSON<AnonPresetRow[]>(KEY.presets, []);
}

function writePresets(rows: AnonPresetRow[]): void {
  writeJSON(KEY.presets, rows);
}

function presetRowToCatalog(p: AnonPresetRow): CatalogPreset {
  return {
    id: p.id,
    name: p.name,
    inkCost: p.inkCost,
    setupFee: p.setupFee,
    perPrintCost: p.perPrintCost,
    isSystem: false,
    overridesSystemId: p.overridesSystemId,
  };
}

const printPresets = {
  list(input?: { includeHidden?: boolean }): CatalogPreset[] {
    const rows = readPresets();
    const shadowedSystemIds = new Set(
      rows.filter((r) => r.overridesSystemId !== null).map((r) => r.overridesSystemId as string)
    );

    type Decorated = { item: CatalogPreset; sortOrder: number };
    const decorated: Decorated[] = [];

    for (const r of rows) {
      if (r.isHidden) continue;
      if (isPositionOnlyPresetFork(r)) {
        const sys = SYSTEM_PRESETS.find((s) => s.id === r.overridesSystemId);
        if (!sys) continue;
        decorated.push({ item: { ...sys }, sortOrder: r.sortOrder });
      } else {
        decorated.push({ item: presetRowToCatalog(r), sortOrder: r.sortOrder });
      }
    }

    SYSTEM_PRESETS.forEach((p, i) => {
      if (shadowedSystemIds.has(p.id as string)) return;
      decorated.push({ item: p, sortOrder: SYSTEM_SORT_OFFSET + i });
    });

    decorated.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.item.name.toLowerCase().localeCompare(b.item.name.toLowerCase());
    });

    const merged: CatalogPreset[] = decorated.map((d) => d.item);

    if (input?.includeHidden) {
      const tombstones = rows.filter((p) => p.isHidden && p.overridesSystemId);
      for (const t of tombstones) {
        const sysItem = SYSTEM_PRESETS.find((s) => s.id === t.overridesSystemId);
        if (!sysItem) continue;
        merged.push({ ...sysItem, overridesSystemId: t.overridesSystemId, isHidden: true });
      }
    }
    return merged;
  },

  create(input: {
    name: string;
    inkCost?: string;
    setupFee?: string;
    perPrintCost?: string;
    sortOrder?: number;
  }): { id: number } {
    const rows = readPresets();
    const now = nowIso();
    const row: AnonPresetRow = {
      id: nextId(),
      name: input.name,
      inkCost: input.inkCost || "0",
      setupFee: input.setupFee || "0",
      perPrintCost: input.perPrintCost || "0",
      overridesSystemId: null,
      isHidden: false,
      sortOrder: input.sortOrder ?? nextPresetSortOrder(rows),
      createdAt: now,
      updatedAt: now,
    };
    writePresets([...rows, row]);
    notify();
    return { id: row.id };
  },

  update(id: number, data: Partial<Omit<AnonPresetRow, "id" | "createdAt">>): void {
    const next = readPresets().map((r) =>
      r.id === id ? { ...r, ...data, id, updatedAt: nowIso() } : r
    );
    writePresets(next);
    notify();
  },

  delete(id: number): void {
    writePresets(readPresets().filter((r) => r.id !== id));
    notify();
  },

  forkSystem(input: {
    systemId: string;
    name: string;
    inkCost?: string;
    setupFee?: string;
    perPrintCost?: string;
  }): { id: number } {
    if (!SYSTEM_PRESETS.some((p) => p.id === input.systemId)) {
      throw new Error(`Unknown system preset: ${input.systemId}`);
    }
    const rows = readPresets();
    const existing = rows.find((r) => r.overridesSystemId === input.systemId);
    const now = nowIso();
    if (existing) {
      printPresets.update(existing.id, {
        name: input.name,
        inkCost: input.inkCost || "0",
        setupFee: input.setupFee || "0",
        perPrintCost: input.perPrintCost || "0",
        isHidden: false,
      });
      return { id: existing.id };
    }
    const row: AnonPresetRow = {
      id: nextId(),
      name: input.name,
      inkCost: input.inkCost || "0",
      setupFee: input.setupFee || "0",
      perPrintCost: input.perPrintCost || "0",
      overridesSystemId: input.systemId,
      isHidden: false,
      sortOrder: nextPresetSortOrder(rows),
      createdAt: now,
      updatedAt: now,
    };
    writePresets([...rows, row]);
    notify();
    return { id: row.id };
  },

  hideSystem(input: { systemId: string }): { id: number } {
    if (!SYSTEM_PRESETS.some((p) => p.id === input.systemId)) {
      throw new Error(`Unknown system preset: ${input.systemId}`);
    }
    const rows = readPresets();
    const existing = rows.find((r) => r.overridesSystemId === input.systemId);
    if (existing) {
      printPresets.update(existing.id, { isHidden: true });
      return { id: existing.id };
    }
    const now = nowIso();
    const row: AnonPresetRow = {
      id: nextId(),
      name: "",
      inkCost: "0",
      setupFee: "0",
      perPrintCost: "0",
      overridesSystemId: input.systemId,
      isHidden: true,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    writePresets([...rows, row]);
    notify();
    return { id: row.id };
  },

  restoreSystem(input: { systemId: string }): { success: true } {
    writePresets(readPresets().filter((r) => r.overridesSystemId !== input.systemId));
    notify();
    return { success: true };
  },

  reorder(items: Array<{ id: string | number; sortOrder: number }>): { success: true } {
    const rows = readPresets();
    const now = nowIso();
    const bySystemId = new Map<string, AnonPresetRow>();
    rows.forEach((r) => {
      if (r.overridesSystemId) bySystemId.set(r.overridesSystemId, r);
    });

    const next: AnonPresetRow[] = [...rows];

    for (const it of items) {
      if (typeof it.id === "number") {
        const idx = next.findIndex((r) => r.id === it.id);
        if (idx === -1) continue;
        next[idx] = { ...next[idx], sortOrder: it.sortOrder, updatedAt: now };
        continue;
      }
      const systemId = it.id;
      if (!SYSTEM_PRESETS.some((p) => p.id === systemId)) continue;
      const existing = bySystemId.get(systemId);
      if (existing) {
        const idx = next.findIndex((r) => r.id === existing.id);
        if (idx !== -1) {
          next[idx] = { ...next[idx], sortOrder: it.sortOrder, updatedAt: now };
        }
      } else {
        next.push({
          id: nextId(),
          name: "",
          inkCost: "0",
          setupFee: "0",
          perPrintCost: "0",
          overridesSystemId: systemId,
          isHidden: false,
          sortOrder: it.sortOrder,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    writePresets(next);
    notify();
    return { success: true };
  },
};

// ─── Quotes ───────────────────────────────────────────────────────────────────

function readQuotes(): AnonQuote[] {
  return readJSON<AnonQuote[]>(KEY.quotes, []);
}

function writeQuotes(rows: AnonQuote[]): void {
  writeJSON(KEY.quotes, rows);
}

const quotes = {
  list(): AnonQuote[] {
    // Newest first to match authed quotes.list ordering
    return [...readQuotes()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  get(id: number): AnonQuote | undefined {
    return readQuotes().find((q) => q.id === id);
  },

  /** Find by quote number — used by post-signup migration flow. */
  getByNumber(quoteNumber: string): AnonQuote | undefined {
    return readQuotes().find((q) => q.quoteNumber === quoteNumber);
  },

  create(input: {
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    margin: number;
    taxEnabled: boolean;
    taxRate: string;
    notes?: string;
    subtotal: string;
    taxAmount: string;
    total: string;
    status?: "draft" | "sent" | "accepted";
    items: AnonQuoteItem[];
  }): { id: number; quoteNumber: string } {
    const rows = readQuotes();
    const now = nowIso();
    const row: AnonQuote = {
      id: nextId(),
      quoteNumber: generateQuoteNumber(),
      status: input.status ?? "draft",
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
      customerEmail: input.customerEmail ?? null,
      margin: input.margin,
      taxEnabled: input.taxEnabled,
      taxRate: input.taxRate,
      notes: input.notes ?? null,
      subtotal: input.subtotal,
      taxAmount: input.taxAmount,
      total: input.total,
      items: input.items,
      createdAt: now,
      updatedAt: now,
    };
    writeQuotes([...rows, row]);
    notify();
    return { id: row.id, quoteNumber: row.quoteNumber };
  },

  update(
    id: number,
    data: Partial<Omit<AnonQuote, "id" | "quoteNumber" | "createdAt">>
  ): void {
    const next = readQuotes().map((q) =>
      q.id === id ? { ...q, ...data, id, updatedAt: nowIso() } : q
    );
    writeQuotes(next);
    notify();
  },

  updateStatus(id: number, status: AnonQuote["status"]): void {
    quotes.update(id, { status });
  },

  delete(id: number): void {
    writeQuotes(readQuotes().filter((q) => q.id !== id));
    notify();
  },

  duplicate(id: number): { id: number; quoteNumber: string } | undefined {
    const original = readQuotes().find((q) => q.id === id);
    if (!original) return undefined;
    const now = nowIso();
    const copy: AnonQuote = {
      ...original,
      id: nextId(),
      quoteNumber: generateQuoteNumber(),
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    writeQuotes([...readQuotes(), copy]);
    notify();
    return { id: copy.id, quoteNumber: copy.quoteNumber };
  },
};

// ─── Settings ─────────────────────────────────────────────────────────────────

function readSettings(): AnonSettings {
  return { ...DEFAULT_SETTINGS, ...readJSON<Partial<AnonSettings>>(KEY.settings, {}) };
}

function writeSettings(value: AnonSettings): void {
  writeJSON(KEY.settings, value);
}

const settings = {
  get(): AnonSettings {
    return readSettings();
  },

  update(data: Partial<AnonSettings>): void {
    writeSettings({ ...readSettings(), ...data });
    notify();
  },

  uploadLogo(input: { base64: string; mimeType: string }): { dataUrl: string } {
    const dataUrl = `data:${input.mimeType};base64,${input.base64}`;
    settings.update({ shopLogo: dataUrl });
    return { dataUrl };
  },
};

// ─── Migration helpers ────────────────────────────────────────────────────────

function hasAnyData(): boolean {
  return (
    readBlanks().length > 0 ||
    readPresets().length > 0 ||
    readQuotes().length > 0 ||
    Object.keys(readJSON(KEY.settings, {}) as object).length > 0
  );
}

function snapshotCounts(): { blanks: number; presets: number; quotes: number; hasSettings: boolean } {
  return {
    blanks: readBlanks().length,
    presets: readPresets().length,
    quotes: readQuotes().length,
    hasSettings: Object.keys(readJSON(KEY.settings, {}) as object).length > 0,
  };
}

function exportAll(): {
  blanks: AnonBlankRow[];
  presets: AnonPresetRow[];
  quotes: AnonQuote[];
  settings: AnonSettings;
} {
  return {
    blanks: readBlanks(),
    presets: readPresets(),
    quotes: readQuotes(),
    settings: readSettings(),
  };
}

function clearAll(): void {
  for (const k of [...ANON_DATA_KEYS, ...ANON_ANCILLARY_KEYS]) {
    try {
      localStorage.removeItem(k);
    } catch {
      // ignore
    }
  }
  notify();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const anonymousStore = {
  blanks,
  printPresets,
  quotes,
  settings,
  // Cross-cutting
  hasAnyData,
  snapshotCounts,
  exportAll,
  clearAll,
  subscribe,
};

// Expose on window in dev for ad-hoc probing in DevTools console.
if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as unknown as { anonymousStore: typeof anonymousStore }).anonymousStore =
    anonymousStore;
}
