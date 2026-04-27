import { TRPCError } from "@trpc/server";
import path from "path";
import { z } from "zod";
import {
  bulkCreateBlanks,
  createBlank,
  createPrintPreset,
  createQuote,
  createQuoteItem,
  createQuoteItemPrint,
  deleteBlank,
  deleteBlankBySystemId,
  deletePrintPreset,
  deletePrintPresetBySystemId,
  deleteQuote,
  deleteQuoteItemPrintsByItemId,
  deleteQuoteItemsByQuoteId,
  findBlankBySystemId,
  findPrintPresetBySystemId,
  getBlankBrands,
  getBlankGarmentTypes,
  getBlanks,
  getMaxBlankSortOrder,
  getMaxPrintPresetSortOrder,
  getPrintPresets,
  getQuoteById,
  getQuoteItemPrints,
  getQuoteItems,
  getQuotes,
  getUserById,
  reorderBlanks,
  reorderPrintPresets,
  updateBlank,
  updatePrintPreset,
  updateQuote,
  updateUserSettings,
} from "./db";
import {
  CatalogBlank,
  CatalogPreset,
  SYSTEM_BLANKS,
  SYSTEM_PRESETS,
  SYSTEM_SORT_OFFSET,
} from "@shared/constants";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storage } from "./storage";

// ─── Quote number generator ───────────────────────────────────────────────────

function generateQuoteNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `Q${yy}${mm}${dd}-${rand}`;
}

// ─── Catalog merge helpers ────────────────────────────────────────────────────

function matchesBlankFilter(
  b: CatalogBlank,
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

// Catalog ordering: every visible item — user-owned or unforked system —
// resolves to a single sortOrder, then alphabetical tiebreak. User rows use
// their own column. Unforked system items use SYSTEM_SORT_OFFSET + array
// index, which is large enough to keep them below user rows by default
// (preserves the original "user-first, then system" merge for fresh users).
// Drag-reorder writes explicit small sortOrder values across the whole list,
// so the offset only matters for never-reordered state.

// A user row with overridesSystemId set, !isHidden, and empty data fields
// (brand=='' && modelName=='') is a position-only fork created by drag-reorder
// of a system item. The merge substitutes the system data so the UI doesn't
// flag it as "Customized" — it's purely a sortOrder carrier.
function isPositionOnlyBlankFork(r: {
  overridesSystemId: string | null;
  isHidden: boolean;
  brand: string;
  modelName: string;
}): boolean {
  return r.overridesSystemId !== null && !r.isHidden && r.brand === "" && r.modelName === "";
}

function isPositionOnlyPresetFork(r: {
  overridesSystemId: string | null;
  isHidden: boolean;
  name: string;
}): boolean {
  return r.overridesSystemId !== null && !r.isHidden && r.name === "";
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

// Tier prices are optional and accept "", null, undefined, or numeric strings.
// Empty values coerce to "0" so the form can submit blank fields without a
// validation error and so existing rows can be edited the same way.
const optionalPrice = z
  .string()
  .nullish()
  .transform((v) => (v === undefined || v === null || v === "") ? "0" : v);

const blankInput = z.object({
  brand: z.string().min(1),
  garmentType: z.string().min(1),
  modelName: z.string().min(1),
  variant: z.string().optional(),
  isOneSize: z.boolean().optional().default(false),
  priceOS: optionalPrice,
  priceXS: optionalPrice,
  priceSXL: optionalPrice,
  price2XL: optionalPrice,
  price3XL: optionalPrice,
  price4XL: optionalPrice,
  price5XL: optionalPrice,
});

const presetInput = z.object({
  name: z.string().min(1),
  inkCost: z.string(),
  setupFee: z.string(),
  perPrintCost: z.string(),
});

const quoteItemPrintInput = z.object({
  presetId: z.number().optional(),
  presetSnapshot: z.any().optional(),
  cost: z.string(),
});

const quoteItemInput = z.object({
  blankId: z.number().optional(),
  blankSnapshot: z.any().optional(),
  qtyOS: z.number().default(0),
  qtyXS: z.number().default(0),
  qtyS: z.number().default(0),
  qtyM: z.number().default(0),
  qtyL: z.number().default(0),
  qtyXL: z.number().default(0),
  qty2XL: z.number().default(0),
  qty3XL: z.number().default(0),
  qty4XL: z.number().default(0),
  qty5XL: z.number().default(0),
  lineNotes: z.string().optional(),
  blankCost: z.string(),
  printCost: z.string(),
  lineTotal: z.string(),
  prints: z.array(quoteItemPrintInput),
});

const quoteInput = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().optional(),
  margin: z.number().min(10).max(40),
  taxEnabled: z.boolean(),
  taxRate: z.string(),
  notes: z.string().optional(),
  subtotal: z.string(),
  taxAmount: z.string(),
  total: z.string(),
  status: z.enum(["draft", "sent", "accepted"]).optional(),
  items: z.array(quoteItemInput),
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    // Better Auth owns sign-out at POST /api/auth/sign-out. Stub kept for API
    // surface stability; clients call authClient.signOut() directly.
    logout: publicProcedure.mutation(() => ({ success: true } as const)),
  }),

  // ─── Settings ──────────────────────────────────────────────────────────────

  settings: router({
    get: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      return user;
    }),

    update: protectedProcedure
      .input(z.object({
        shopName: z.string().optional(),
        shopLogoSize: z.enum(["small", "medium", "large"]).optional(),
        shopLogoPosition: z.enum(["top-left", "top-center", "top-right"]).optional(),
        defaultTaxRate: z.string().optional(),
        defaultMargin: z.number().optional(),
        currencySymbol: z.string().optional(),
        marketingOptIn: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await updateUserSettings(ctx.user.id, input);
        return { success: true };
      }),

    uploadLogo: protectedProcedure
      .input(z.object({
        base64: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const ext = path.extname(input.fileName).toLowerCase() || ".png";
        const key = `logos/${ctx.user.id}${ext}`;

        // If the previous logo had a different extension, remove it.
        const existing = await getUserById(ctx.user.id);
        if (existing?.shopLogo && existing.shopLogo !== key) {
          await storage.delete(existing.shopLogo);
        }

        await storage.put(key, buffer, input.mimeType);
        await updateUserSettings(ctx.user.id, { shopLogo: key });
        return { key };
      }),
  }),

  // ─── Blanks (hybrid w/ overrides + tombstones) ─────────────────────────────

  blanks: router({
    list: publicProcedure
      .input(z.object({
        search: z.string().optional(),
        brand: z.string().optional(),
        garmentType: z.string().optional(),
        includeHidden: z.boolean().optional().default(false),
      }).optional())
      .query(async ({ ctx, input }): Promise<CatalogBlank[]> => {
        const systemFiltered = SYSTEM_BLANKS.filter((b) =>
          matchesBlankFilter(b, input?.search, input?.brand, input?.garmentType)
        );

        if (!ctx.user) return systemFiltered;

        const userRows = await getBlanks(
          ctx.user.id,
          input?.search,
          input?.brand,
          input?.garmentType
        );

        // System ids the user has shadowed (override OR tombstone) — must hide
        // these from the system catalog half of the merge.
        const shadowedSystemIds = new Set(
          userRows
            .filter((r) => r.overridesSystemId !== null)
            .map((r) => r.overridesSystemId as string)
        );

        type Decorated = { item: CatalogBlank; sortOrder: number };
        const decorated: Decorated[] = [];

        for (const b of userRows) {
          if (b.isHidden) continue;
          if (isPositionOnlyBlankFork(b)) {
            // Substitute system data — UI sees a system item with its system id,
            // but its position is taken from this row's sortOrder.
            const sys = SYSTEM_BLANKS.find((s) => s.id === b.overridesSystemId);
            if (!sys) continue;
            if (!matchesBlankFilter(sys, input?.search, input?.brand, input?.garmentType)) continue;
            decorated.push({ item: { ...sys }, sortOrder: b.sortOrder });
            continue;
          }
          decorated.push({
            item: {
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
            },
            sortOrder: b.sortOrder,
          });
        }

        // Unforked system items: effective sortOrder = offset + array index
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

        // When includeHidden=true, surface tombstones rendered with the system
        // item's original data so the user sees what they hid.
        if (input?.includeHidden) {
          const tombstones = userRows.filter((b) => b.isHidden && b.overridesSystemId);
          for (const t of tombstones) {
            const sysItem = SYSTEM_BLANKS.find((s) => s.id === t.overridesSystemId);
            if (!sysItem) continue;
            // Re-apply filter to the original system data
            if (!matchesBlankFilter(sysItem, input?.search, input?.brand, input?.garmentType)) continue;
            merged.push({
              ...sysItem,
              overridesSystemId: t.overridesSystemId,
              isHidden: true,
            });
          }
        }

        return merged;
      }),

    brands: publicProcedure.query(async ({ ctx }) => {
      const systemBrands = SYSTEM_BLANKS.map((b) => b.brand);
      const userBrands = ctx.user ? await getBlankBrands(ctx.user.id) : [];
      return Array.from(new Set([...userBrands, ...systemBrands])).sort();
    }),

    garmentTypes: publicProcedure.query(async ({ ctx }) => {
      const systemTypes = SYSTEM_BLANKS.map((b) => b.garmentType);
      const userTypes = ctx.user ? await getBlankGarmentTypes(ctx.user.id) : [];
      return Array.from(new Set([...userTypes, ...systemTypes])).sort();
    }),

    create: protectedProcedure
      .input(blankInput)
      .mutation(async ({ ctx, input }) => {
        const sortOrder = (await getMaxBlankSortOrder(ctx.user.id)) + 1;
        const id = await createBlank({ ...input, userId: ctx.user.id, sortOrder });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number() }).merge(blankInput.partial()))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateBlank(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteBlank(input.id, ctx.user.id);
        return { success: true };
      }),

    // Edit a system item → upsert a user-owned override for it.
    forkSystem: protectedProcedure
      .input(z.object({ systemId: z.string() }).merge(blankInput))
      .mutation(async ({ ctx, input }) => {
        const { systemId, ...data } = input;
        if (!SYSTEM_BLANKS.some((b) => b.id === systemId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown system blank" });
        }
        const existing = await findBlankBySystemId(ctx.user.id, systemId);
        if (existing) {
          await updateBlank(existing.id, ctx.user.id, { ...data, isHidden: false });
          return { id: existing.id };
        }
        const sortOrder = (await getMaxBlankSortOrder(ctx.user.id)) + 1;
        const id = await createBlank({
          ...data,
          userId: ctx.user.id,
          overridesSystemId: systemId,
          isHidden: false,
          sortOrder,
        });
        return { id };
      }),

    // Delete a system item from the user's view → upsert a tombstone.
    hideSystem: protectedProcedure
      .input(z.object({ systemId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!SYSTEM_BLANKS.some((b) => b.id === input.systemId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown system blank" });
        }
        const existing = await findBlankBySystemId(ctx.user.id, input.systemId);
        if (existing) {
          await updateBlank(existing.id, ctx.user.id, { isHidden: true });
          return { id: existing.id };
        }
        // Fresh tombstone — placeholder values for NOT NULL columns
        const id = await createBlank({
          userId: ctx.user.id,
          overridesSystemId: input.systemId,
          isHidden: true,
          brand: "",
          garmentType: "",
          modelName: "",
          isOneSize: false,
          priceOS: null,
          priceXS: "0",
          priceSXL: "0",
          price2XL: "0",
          price3XL: "0",
          price4XL: "0",
          price5XL: "0",
        });
        return { id };
      }),

    // Reset / Restore: drop the user's row for a system item entirely so the
    // original SYSTEM_BLANKS entry is what they see again.
    restoreSystem: protectedProcedure
      .input(z.object({ systemId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await deleteBlankBySystemId(ctx.user.id, input.systemId);
        return { success: true };
      }),

    bulkImport: protectedProcedure
      .input(z.array(blankInput))
      .mutation(async ({ ctx, input }) => {
        const start = (await getMaxBlankSortOrder(ctx.user.id)) + 1;
        const data = input.map((b, i) => ({ ...b, userId: ctx.user.id, sortOrder: start + i }));
        await bulkCreateBlanks(data);
        return { count: data.length };
      }),

    // Persist a new ordering of the visible list. Each entry is either a user
    // row id (number) or a system catalog id (string). For system ids we
    // upsert a position-only fork (empty data fields, sortOrder set). For user
    // ids we just update sortOrder. Items not included keep their existing
    // sortOrder, which lets callers omit hidden/filtered-out items.
    reorder: protectedProcedure
      .input(
        z.array(
          z.object({
            id: z.union([z.number(), z.string()]),
            sortOrder: z.number().int(),
          }),
        ),
      )
      .mutation(async ({ ctx, input }) => {
        const userUpdates: Array<{ id: number; sortOrder: number }> = [];
        for (const it of input) {
          if (typeof it.id === "number") {
            userUpdates.push({ id: it.id, sortOrder: it.sortOrder });
            continue;
          }
          const systemId = it.id;
          if (!SYSTEM_BLANKS.some((b) => b.id === systemId)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown system blank" });
          }
          const existing = await findBlankBySystemId(ctx.user.id, systemId);
          if (existing) {
            userUpdates.push({ id: existing.id, sortOrder: it.sortOrder });
          } else {
            await createBlank({
              userId: ctx.user.id,
              overridesSystemId: systemId,
              isHidden: false,
              sortOrder: it.sortOrder,
              brand: "",
              garmentType: "",
              modelName: "",
              isOneSize: false,
              priceOS: null,
              priceXS: "0",
              priceSXL: "0",
              price2XL: "0",
              price3XL: "0",
              price4XL: "0",
              price5XL: "0",
            });
          }
        }
        await reorderBlanks(ctx.user.id, userUpdates);
        return { success: true };
      }),
  }),

  // ─── Print Presets (hybrid w/ overrides + tombstones) ──────────────────────

  printPresets: router({
    list: publicProcedure
      .input(z.object({
        includeHidden: z.boolean().optional().default(false),
      }).optional())
      .query(async ({ ctx, input }): Promise<CatalogPreset[]> => {
        if (!ctx.user) return [...SYSTEM_PRESETS];

        const userRows = await getPrintPresets(ctx.user.id);

        const shadowedSystemIds = new Set(
          userRows
            .filter((r) => r.overridesSystemId !== null)
            .map((r) => r.overridesSystemId as string)
        );

        type Decorated = { item: CatalogPreset; sortOrder: number };
        const decorated: Decorated[] = [];

        for (const p of userRows) {
          if (p.isHidden) continue;
          if (isPositionOnlyPresetFork(p)) {
            const sys = SYSTEM_PRESETS.find((s) => s.id === p.overridesSystemId);
            if (!sys) continue;
            decorated.push({ item: { ...sys }, sortOrder: p.sortOrder });
            continue;
          }
          decorated.push({
            item: {
              id: p.id,
              name: p.name,
              inkCost: p.inkCost,
              setupFee: p.setupFee,
              perPrintCost: p.perPrintCost,
              isSystem: false,
              overridesSystemId: p.overridesSystemId,
            },
            sortOrder: p.sortOrder,
          });
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
          const tombstones = userRows.filter((p) => p.isHidden && p.overridesSystemId);
          for (const t of tombstones) {
            const sysItem = SYSTEM_PRESETS.find((s) => s.id === t.overridesSystemId);
            if (!sysItem) continue;
            merged.push({ ...sysItem, overridesSystemId: t.overridesSystemId, isHidden: true });
          }
        }

        return merged;
      }),

    create: protectedProcedure
      .input(presetInput)
      .mutation(async ({ ctx, input }) => {
        const sortOrder = (await getMaxPrintPresetSortOrder(ctx.user.id)) + 1;
        const id = await createPrintPreset({ ...input, userId: ctx.user.id, sortOrder });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number() }).merge(presetInput.partial()))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updatePrintPreset(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deletePrintPreset(input.id, ctx.user.id);
        return { success: true };
      }),

    forkSystem: protectedProcedure
      .input(z.object({ systemId: z.string() }).merge(presetInput))
      .mutation(async ({ ctx, input }) => {
        const { systemId, ...data } = input;
        if (!SYSTEM_PRESETS.some((p) => p.id === systemId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown system preset" });
        }
        const existing = await findPrintPresetBySystemId(ctx.user.id, systemId);
        if (existing) {
          await updatePrintPreset(existing.id, ctx.user.id, { ...data, isHidden: false });
          return { id: existing.id };
        }
        const sortOrder = (await getMaxPrintPresetSortOrder(ctx.user.id)) + 1;
        const id = await createPrintPreset({
          ...data,
          userId: ctx.user.id,
          overridesSystemId: systemId,
          isHidden: false,
          sortOrder,
        });
        return { id };
      }),

    hideSystem: protectedProcedure
      .input(z.object({ systemId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!SYSTEM_PRESETS.some((p) => p.id === input.systemId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown system preset" });
        }
        const existing = await findPrintPresetBySystemId(ctx.user.id, input.systemId);
        if (existing) {
          await updatePrintPreset(existing.id, ctx.user.id, { isHidden: true });
          return { id: existing.id };
        }
        const id = await createPrintPreset({
          userId: ctx.user.id,
          overridesSystemId: input.systemId,
          isHidden: true,
          name: "",
          inkCost: "0",
          setupFee: "0",
          perPrintCost: "0",
        });
        return { id };
      }),

    restoreSystem: protectedProcedure
      .input(z.object({ systemId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await deletePrintPresetBySystemId(ctx.user.id, input.systemId);
        return { success: true };
      }),

    reorder: protectedProcedure
      .input(
        z.array(
          z.object({
            id: z.union([z.number(), z.string()]),
            sortOrder: z.number().int(),
          }),
        ),
      )
      .mutation(async ({ ctx, input }) => {
        const userUpdates: Array<{ id: number; sortOrder: number }> = [];
        for (const it of input) {
          if (typeof it.id === "number") {
            userUpdates.push({ id: it.id, sortOrder: it.sortOrder });
            continue;
          }
          const systemId = it.id;
          if (!SYSTEM_PRESETS.some((p) => p.id === systemId)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown system preset" });
          }
          const existing = await findPrintPresetBySystemId(ctx.user.id, systemId);
          if (existing) {
            userUpdates.push({ id: existing.id, sortOrder: it.sortOrder });
          } else {
            await createPrintPreset({
              userId: ctx.user.id,
              overridesSystemId: systemId,
              isHidden: false,
              sortOrder: it.sortOrder,
              name: "",
              inkCost: "0",
              setupFee: "0",
              perPrintCost: "0",
            });
          }
        }
        await reorderPrintPresets(ctx.user.id, userUpdates);
        return { success: true };
      }),
  }),

  // ─── Quotes ────────────────────────────────────────────────────────────────

  quotes: router({
    list: protectedProcedure.query(async ({ ctx }) => getQuotes(ctx.user.id)),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const quote = await getQuoteById(input.id, ctx.user.id);
        if (!quote) throw new TRPCError({ code: "NOT_FOUND" });

        const items = await getQuoteItems(quote.id);
        const itemsWithPrints = await Promise.all(
          items.map(async (item) => {
            const prints = await getQuoteItemPrints(item.id);
            return { ...item, prints };
          })
        );

        return { ...quote, items: itemsWithPrints };
      }),

    create: protectedProcedure
      .input(quoteInput)
      .mutation(async ({ ctx, input }) => {
        const { items, ...quoteData } = input;
        const quoteNumber = generateQuoteNumber();
        const quoteId = await createQuote({
          ...quoteData,
          userId: ctx.user.id,
          quoteNumber,
          status: quoteData.status ?? "draft",
        });

        for (let i = 0; i < items.length; i++) {
          const { prints, ...itemData } = items[i];
          const itemId = await createQuoteItem({ ...itemData, quoteId, sortOrder: i });
          for (const print of prints) {
            await createQuoteItemPrint({ ...print, quoteItemId: itemId });
          }
        }

        return { id: quoteId, quoteNumber };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number() }).merge(quoteInput.partial()))
      .mutation(async ({ ctx, input }) => {
        const { id, items, ...quoteData } = input;

        const existing = await getQuoteById(id, ctx.user.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        await updateQuote(id, ctx.user.id, quoteData);

        if (items !== undefined) {
          // Delete existing items and recreate
          const existingItems = await getQuoteItems(id);
          for (const item of existingItems) {
            await deleteQuoteItemPrintsByItemId(item.id);
          }
          await deleteQuoteItemsByQuoteId(id);

          for (let i = 0; i < items.length; i++) {
            const { prints, ...itemData } = items[i];
            const itemId = await createQuoteItem({ ...itemData, quoteId: id, sortOrder: i });
            for (const print of prints) {
              await createQuoteItemPrint({ ...print, quoteItemId: itemId });
            }
          }
        }

        return { success: true };
      }),

    updateStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: z.enum(["draft", "sent", "accepted"]) }))
      .mutation(async ({ ctx, input }) => {
        await updateQuote(input.id, ctx.user.id, { status: input.status });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getQuoteById(input.id, ctx.user.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        const items = await getQuoteItems(input.id);
        for (const item of items) {
          await deleteQuoteItemPrintsByItemId(item.id);
        }
        await deleteQuoteItemsByQuoteId(input.id);
        await deleteQuote(input.id, ctx.user.id);
        return { success: true };
      }),

    duplicate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const original = await getQuoteById(input.id, ctx.user.id);
        if (!original) throw new TRPCError({ code: "NOT_FOUND" });

        const quoteNumber = generateQuoteNumber();
        const newQuoteId = await createQuote({
          userId: ctx.user.id,
          quoteNumber,
          status: "draft",
          customerName: original.customerName,
          customerPhone: original.customerPhone,
          customerEmail: original.customerEmail,
          margin: original.margin,
          taxEnabled: original.taxEnabled,
          taxRate: original.taxRate,
          notes: original.notes,
          subtotal: original.subtotal,
          taxAmount: original.taxAmount,
          total: original.total,
        });

        const items = await getQuoteItems(input.id);
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const prints = await getQuoteItemPrints(item.id);
          const newItemId = await createQuoteItem({
            quoteId: newQuoteId,
            sortOrder: i,
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
            blankCost: item.blankCost,
            printCost: item.printCost,
            lineTotal: item.lineTotal,
          });
          for (const print of prints) {
            await createQuoteItemPrint({
              quoteItemId: newItemId,
              presetId: print.presetId,
              presetSnapshot: print.presetSnapshot,
              cost: print.cost,
            });
          }
        }

        return { id: newQuoteId, quoteNumber };
      }),
  }),
});

export type AppRouter = typeof appRouter;
