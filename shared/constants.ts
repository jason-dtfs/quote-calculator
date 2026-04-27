// ─── App identity ────────────────────────────────────────────────────────────
// Single source of truth — change here to rename the app everywhere it's used
// programmatically. (client/index.html still hardcodes the title in static HTML.)

export const APP_NAME = "Quote Calculator";
export const APP_TAGLINE = "Professional quoting for print shops";

// ─── Catalog types ───────────────────────────────────────────────────────────
// CatalogBlank/CatalogPreset is the unified shape returned by blanks.list /
// printPresets.list. System items have string ids prefixed "system:" and never
// hit the DB. User items have integer ids from Postgres serial. The frontend
// uses `typeof id === "string"` (or `isSystemId`) to decide whether actions
// like edit/delete are permitted, and whether to set `blankId` / `presetId`
// (FK columns) when saving a quote item.

// id semantics:
//   string "system:..." → unmodified system catalog item, OR a hidden system
//                          item surfaced when includeHidden is on.
//   number              → a row in blanks/print_presets the user owns. Either
//                          a custom (overridesSystemId null) or an override of a
//                          system item (overridesSystemId set).
// isSystem:    item came from SYSTEM_BLANKS / SYSTEM_PRESETS untouched.
// overridesSystemId: if present, this is a user-owned customization of that
//                    system item — UI shows a "Customized" badge and "Reset" action.
// isHidden:    only present (and true) on rows surfaced by includeHidden=true; a
//              tombstone the user created via "delete this system item." UI shows
//              the underlying system data greyed out with a "Restore" action.

export type CatalogBlank = {
  id: string | number;
  brand: string;
  garmentType: string;
  modelName: string;
  variant: string | null;
  // Multi-size pricing tiers. Used when isOneSize is false.
  priceXS: string;
  priceSXL: string;
  price2XL: string;
  price3XL: string;
  price4XL: string;
  price5XL: string;
  // One-size mode (hats, totes, bags, etc.). When true, the six tier prices
  // above are ignored and priceOS is the single price for any quantity.
  isOneSize: boolean;
  priceOS: string | null;
  isSystem: boolean;
  overridesSystemId?: string | null;
  isHidden?: boolean;
};

export type CatalogPreset = {
  id: string | number;
  name: string;
  inkCost: string;
  setupFee: string;
  perPrintCost: string;
  isSystem: boolean;
  overridesSystemId?: string | null;
  isHidden?: boolean;
};

export const SYSTEM_ID_PREFIX = "system:";

export function isSystemId(id: string | number): id is string {
  return typeof id === "string" && id.startsWith(SYSTEM_ID_PREFIX);
}

// Effective sortOrder for an unforked system item is SYSTEM_SORT_OFFSET + its
// array index. The offset is large enough that all user rows (custom or fork)
// sort above unforked system items by default — preserving the original
// "user-first, then system" merged ordering. Once a user drags to reorder, the
// reorder mutation writes explicit sortOrder values to all visible items, so
// the offset only matters for fresh, never-reordered state.
export const SYSTEM_SORT_OFFSET = 1_000_000;

// ─── System catalog ──────────────────────────────────────────────────────────
// Anonymous users see only this. Authenticated users see this merged with
// their own DB rows. Curated, not exhaustive — users add their own.

export const SYSTEM_BLANKS: CatalogBlank[] = [
  { id: "system:sample-blank-tshirt", brand: "Sample", garmentType: "T-shirt", modelName: "Sample Blank", variant: null, priceXS: "4.62", priceSXL: "4.62", price2XL: "6.25", price3XL: "7.27", price4XL: "8.84", price5XL: "10.05", isOneSize: false, priceOS: null, isSystem: true },
];

export const SYSTEM_PRESETS: CatalogPreset[] = [
  { id: "system:full-front-print", name: "Full front print", inkCost: "5.00", perPrintCost: "1.00", setupFee: "0.00", isSystem: true },
  { id: "system:full-back-print", name: "Full back print", inkCost: "5.00", perPrintCost: "1.00", setupFee: "0.00", isSystem: true },
  { id: "system:pocket-print", name: "Pocket print", inkCost: "1.00", perPrintCost: "1.00", setupFee: "0.00", isSystem: true },
  { id: "system:neck-tag", name: "Neck tag", inkCost: "0.50", perPrintCost: "1.00", setupFee: "0.00", isSystem: true },
];
