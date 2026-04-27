// Migration of localStorage anonymous-mode data into the authenticated
// database after signup or login. Runs every authed mutation in sequence so
// failures bubble out and we can leave localStorage intact for retry. Only
// clears the anon keys after every write succeeds.

import { useCallback } from "react";
import { trpc } from "@/lib/trpc";
import {
  anonymousStore,
  type AnonBlankRow,
  type AnonPresetRow,
  type AnonSettings,
} from "@/lib/anonymousStore";

export type MigrationCounts = {
  blanks: number;
  presets: number;
  quotes: number;
  hasSettings: boolean;
};

/**
 * Decide which authed mutation a given anonymous blank row maps to.
 * - tombstone     (overridesSystemId set, isHidden=true) → hideSystem
 * - positionOnly  (overridesSystemId set, !isHidden, brand=='') → reorder upsert
 * - override      (overridesSystemId set, !isHidden, brand!='') → forkSystem
 * - plain         (overridesSystemId null, !isHidden) → create
 * - invalid       (overridesSystemId null, isHidden=true) → skip
 */
type BlankAction =
  | { kind: "create"; data: AnonBlankRow }
  | { kind: "fork"; systemId: string; data: AnonBlankRow }
  | { kind: "hide"; systemId: string }
  | { kind: "positionOnly"; systemId: string; sortOrder: number }
  | { kind: "skip" };

function classifyBlank(row: AnonBlankRow): BlankAction {
  if (row.overridesSystemId && row.isHidden) {
    return { kind: "hide", systemId: row.overridesSystemId };
  }
  if (row.overridesSystemId) {
    if (row.brand === "" && row.modelName === "") {
      return { kind: "positionOnly", systemId: row.overridesSystemId, sortOrder: row.sortOrder };
    }
    return { kind: "fork", systemId: row.overridesSystemId, data: row };
  }
  if (!row.isHidden) {
    return { kind: "create", data: row };
  }
  return { kind: "skip" };
}

type PresetAction =
  | { kind: "create"; data: AnonPresetRow }
  | { kind: "fork"; systemId: string; data: AnonPresetRow }
  | { kind: "hide"; systemId: string }
  | { kind: "positionOnly"; systemId: string; sortOrder: number }
  | { kind: "skip" };

function classifyPreset(row: AnonPresetRow): PresetAction {
  if (row.overridesSystemId && row.isHidden) {
    return { kind: "hide", systemId: row.overridesSystemId };
  }
  if (row.overridesSystemId) {
    if (row.name === "") {
      return { kind: "positionOnly", systemId: row.overridesSystemId, sortOrder: row.sortOrder };
    }
    return { kind: "fork", systemId: row.overridesSystemId, data: row };
  }
  if (!row.isHidden) {
    return { kind: "create", data: row };
  }
  return { kind: "skip" };
}

/** Decode a `data:image/png;base64,XXXX` URL into the parts uploadLogo expects. */
function parseDataUrl(dataUrl: string): { base64: string; mimeType: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mimeType: m[1], base64: m[2] };
}

export function useMigrateAnonData() {
  const utils = trpc.useUtils();

  // Blanks
  const createBlank = trpc.blanks.create.useMutation();
  const forkSystemBlank = trpc.blanks.forkSystem.useMutation();
  const hideSystemBlank = trpc.blanks.hideSystem.useMutation();
  const reorderBlanks = trpc.blanks.reorder.useMutation();

  // Presets
  const createPreset = trpc.printPresets.create.useMutation();
  const forkSystemPreset = trpc.printPresets.forkSystem.useMutation();
  const hideSystemPreset = trpc.printPresets.hideSystem.useMutation();
  const reorderPresets = trpc.printPresets.reorder.useMutation();

  // Quotes
  const createQuote = trpc.quotes.create.useMutation();

  // Settings
  const updateSettings = trpc.settings.update.useMutation();
  const uploadLogo = trpc.settings.uploadLogo.useMutation();

  const getCounts = useCallback((): MigrationCounts => {
    return anonymousStore.snapshotCounts();
  }, []);

  /**
   * Run all authed inserts. Throws if any step fails — caller leaves
   * localStorage intact for next-login retry. On success, returns the new
   * quote-number → DB-id mapping so the export-flow can navigate to the
   * migrated quote.
   */
  const migrate = useCallback(async (): Promise<{
    /** Maps anon quoteNumber → newly-created DB quote id. */
    quoteNumberToDbId: Map<string, number>;
  }> => {
    const dump = anonymousStore.exportAll();

    // ── 1. Blanks ────────────────────────────────────────────────────────
    // After insert/fork/hide, also call reorder to write the original anon
    // sortOrder values onto the new DB rows. position-only forks are created
    // entirely through the reorder mutation (it upserts a fork carrying just
    // the sortOrder).
    const blankReorderItems: Array<{ id: number | string; sortOrder: number }> = [];
    for (const row of dump.blanks) {
      const action = classifyBlank(row);
      if (action.kind === "skip") continue;
      if (action.kind === "create") {
        const result = await createBlank.mutateAsync({
          brand: action.data.brand,
          garmentType: action.data.garmentType,
          modelName: action.data.modelName,
          variant: action.data.variant ?? undefined,
          isOneSize: action.data.isOneSize,
          priceOS: action.data.priceOS ?? undefined,
          priceXS: action.data.priceXS,
          priceSXL: action.data.priceSXL,
          price2XL: action.data.price2XL,
          price3XL: action.data.price3XL,
          price4XL: action.data.price4XL,
          price5XL: action.data.price5XL,
        });
        blankReorderItems.push({ id: result.id, sortOrder: row.sortOrder });
      } else if (action.kind === "fork") {
        const result = await forkSystemBlank.mutateAsync({
          systemId: action.systemId,
          brand: action.data.brand,
          garmentType: action.data.garmentType,
          modelName: action.data.modelName,
          variant: action.data.variant ?? undefined,
          isOneSize: action.data.isOneSize,
          priceOS: action.data.priceOS ?? undefined,
          priceXS: action.data.priceXS,
          priceSXL: action.data.priceSXL,
          price2XL: action.data.price2XL,
          price3XL: action.data.price3XL,
          price4XL: action.data.price4XL,
          price5XL: action.data.price5XL,
        });
        blankReorderItems.push({ id: result.id, sortOrder: row.sortOrder });
      } else if (action.kind === "hide") {
        await hideSystemBlank.mutateAsync({ systemId: action.systemId });
      } else if (action.kind === "positionOnly") {
        blankReorderItems.push({ id: action.systemId, sortOrder: action.sortOrder });
      }
    }
    if (blankReorderItems.length > 0) {
      await reorderBlanks.mutateAsync(blankReorderItems);
    }

    // ── 2. Presets ───────────────────────────────────────────────────────
    const presetReorderItems: Array<{ id: number | string; sortOrder: number }> = [];
    for (const row of dump.presets) {
      const action = classifyPreset(row);
      if (action.kind === "skip") continue;
      if (action.kind === "create") {
        const result = await createPreset.mutateAsync({
          name: action.data.name,
          inkCost: action.data.inkCost,
          setupFee: action.data.setupFee,
          perPrintCost: action.data.perPrintCost,
        });
        presetReorderItems.push({ id: result.id, sortOrder: row.sortOrder });
      } else if (action.kind === "fork") {
        const result = await forkSystemPreset.mutateAsync({
          systemId: action.systemId,
          name: action.data.name,
          inkCost: action.data.inkCost,
          setupFee: action.data.setupFee,
          perPrintCost: action.data.perPrintCost,
        });
        presetReorderItems.push({ id: result.id, sortOrder: row.sortOrder });
      } else if (action.kind === "hide") {
        await hideSystemPreset.mutateAsync({ systemId: action.systemId });
      } else if (action.kind === "positionOnly") {
        presetReorderItems.push({ id: action.systemId, sortOrder: action.sortOrder });
      }
    }
    if (presetReorderItems.length > 0) {
      await reorderPresets.mutateAsync(presetReorderItems);
    }

    // ── 3. Settings ──────────────────────────────────────────────────────
    // Only ship fields the user actually changed away from the anon defaults.
    const settings = dump.settings;
    const settingsPayload: Partial<AnonSettings> = {};
    if (settings.shopName) settingsPayload.shopName = settings.shopName;
    if (settings.shopLogoSize !== "medium") settingsPayload.shopLogoSize = settings.shopLogoSize;
    if (settings.shopLogoPosition !== "top-left")
      settingsPayload.shopLogoPosition = settings.shopLogoPosition;
    if (settings.defaultTaxRate !== "0") settingsPayload.defaultTaxRate = settings.defaultTaxRate;
    if (settings.defaultMargin !== 30) settingsPayload.defaultMargin = settings.defaultMargin;
    if (settings.currencySymbol !== "$") settingsPayload.currencySymbol = settings.currencySymbol;
    if (settings.marketingOptIn) settingsPayload.marketingOptIn = settings.marketingOptIn;

    if (Object.keys(settingsPayload).length > 0) {
      await updateSettings.mutateAsync(settingsPayload);
    }

    // Logo: anon stored as `data:` URL; authed needs base64 + mimeType. Decode and upload.
    if (settings.shopLogo && settings.shopLogo.startsWith("data:")) {
      const parsed = parseDataUrl(settings.shopLogo);
      if (parsed) {
        await uploadLogo.mutateAsync({
          base64: parsed.base64,
          mimeType: parsed.mimeType,
          fileName: "logo",
        });
      }
    }

    // ── 4. Quotes ────────────────────────────────────────────────────────
    // blankId / presetId are local anon counters; they don't map to DB rows.
    // Drop them and let the embedded snapshots carry the data, same pattern
    // system-catalog quote items already use.
    const quoteNumberToDbId = new Map<string, number>();
    for (const q of dump.quotes) {
      const result = await createQuote.mutateAsync({
        customerName: q.customerName ?? undefined,
        customerPhone: q.customerPhone ?? undefined,
        customerEmail: q.customerEmail ?? undefined,
        margin: q.margin,
        taxEnabled: q.taxEnabled,
        taxRate: q.taxRate,
        notes: q.notes ?? undefined,
        subtotal: q.subtotal,
        taxAmount: q.taxAmount,
        total: q.total,
        status: q.status,
        items: q.items.map((it) => ({
          // Drop blankId/presetId — they don't translate cross-store
          blankSnapshot: it.blankSnapshot,
          qtyOS: it.qtyOS,
          qtyXS: it.qtyXS,
          qtyS: it.qtyS,
          qtyM: it.qtyM,
          qtyL: it.qtyL,
          qtyXL: it.qtyXL,
          qty2XL: it.qty2XL,
          qty3XL: it.qty3XL,
          qty4XL: it.qty4XL,
          qty5XL: it.qty5XL,
          lineNotes: it.lineNotes ?? undefined,
          blankCost: it.blankCost,
          printCost: it.printCost,
          lineTotal: it.lineTotal,
          prints: it.prints.map((p) => ({
            presetSnapshot: p.presetSnapshot,
            cost: p.cost,
          })),
        })),
      });
      quoteNumberToDbId.set(q.quoteNumber, result.id);
    }

    // All writes succeeded — invalidate every authed query cache so the UI
    // picks up the migrated rows on next render.
    await Promise.all([
      utils.blanks.list.invalidate(),
      utils.blanks.brands.invalidate(),
      utils.blanks.garmentTypes.invalidate(),
      utils.printPresets.list.invalidate(),
      utils.quotes.list.invalidate(),
      utils.settings.get.invalidate(),
    ]);

    return { quoteNumberToDbId };
  }, [
    createBlank,
    forkSystemBlank,
    hideSystemBlank,
    reorderBlanks,
    createPreset,
    forkSystemPreset,
    hideSystemPreset,
    reorderPresets,
    createQuote,
    updateSettings,
    uploadLogo,
    utils,
  ]);

  return { migrate, getCounts };
}
