import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  bulkCreateBlanks,
  createBlank,
  createPrintPreset,
  createQuote,
  createQuoteItem,
  createQuoteItemPrint,
  deleteBlank,
  deleteQuote,
  deleteQuoteItem,
  deleteQuoteItemPrintsByItemId,
  deleteQuoteItemsByQuoteId,
  deletePrintPreset,
  getBlankBrands,
  getBlankById,
  getBlankGarmentTypes,
  getBlanks,
  getPrintPresetById,
  getPrintPresets,
  getQuoteById,
  getQuoteItemPrints,
  getQuoteItems,
  getQuotes,
  getUserById,
  updateBlank,
  updatePrintPreset,
  updateQuote,
  updateQuoteItem,
  updateUserSettings,
} from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";

// ─── Seed helpers ─────────────────────────────────────────────────────────────

const STARTER_BLANKS = [
  { brand: "Gildan", garmentType: "T-shirt", modelName: "5000", variant: "", priceSXL: "5.00", price2XL: "6.50", price3XL: "7.50", price4XLPlus: "8.50" },
  { brand: "Bella+Canvas", garmentType: "T-shirt", modelName: "3001", variant: "", priceSXL: "7.00", price2XL: "8.50", price3XL: "9.50", price4XLPlus: "10.50" },
  { brand: "Comfort Colors", garmentType: "T-shirt", modelName: "1717", variant: "", priceSXL: "9.00", price2XL: "11.00", price3XL: "12.50", price4XLPlus: "14.00" },
  { brand: "Independent", garmentType: "Hoodie", modelName: "SS4500", variant: "", priceSXL: "18.00", price2XL: "20.00", price3XL: "22.00", price4XLPlus: "24.00" },
  { brand: "Next Level", garmentType: "T-shirt", modelName: "6210", variant: "", priceSXL: "8.00", price2XL: "9.50", price3XL: "11.00", price4XLPlus: "12.50" },
  { brand: "Gildan", garmentType: "Hoodie", modelName: "18500", variant: "", priceSXL: "14.00", price2XL: "16.00", price3XL: "18.00", price4XLPlus: "20.00" },
  { brand: "Champion", garmentType: "Crewneck sweatshirt", modelName: "S700", variant: "", priceSXL: "16.00", price2XL: "18.00", price3XL: "20.00", price4XLPlus: "22.00" },
  { brand: "Port & Company", garmentType: "T-shirt", modelName: "PC54", variant: "", priceSXL: "5.50", price2XL: "7.00", price3XL: "8.00", price4XLPlus: "9.00" },
  { brand: "Bella+Canvas", garmentType: "T-shirt", modelName: "3413 Triblend", variant: "", priceSXL: "10.00", price2XL: "12.00", price3XL: "13.50", price4XLPlus: "15.00" },
  { brand: "Comfort Colors", garmentType: "T-shirt", modelName: "4400", variant: "", priceSXL: "8.50", price2XL: "10.50", price3XL: "12.00", price4XLPlus: "13.50" },
];

const STARTER_PRESETS = [
  { name: "Full front print", inkCost: "2.50", setupFee: "5.00", perPrintCost: "3.00" },
  { name: "Full back print", inkCost: "2.50", setupFee: "5.00", perPrintCost: "3.00" },
  { name: "Pocket print", inkCost: "1.00", setupFee: "3.00", perPrintCost: "1.50" },
  { name: "Sleeve print", inkCost: "1.25", setupFee: "3.00", perPrintCost: "1.75" },
  { name: "Neck tag", inkCost: "0.50", setupFee: "2.00", perPrintCost: "0.75" },
];

async function seedUserData(userId: number) {
  const blanksToInsert = STARTER_BLANKS.map((b) => ({
    userId,
    brand: b.brand,
    garmentType: b.garmentType,
    modelName: b.modelName,
    variant: b.variant,
    priceSXL: b.priceSXL,
    price2XL: b.price2XL,
    price3XL: b.price3XL,
    price4XLPlus: b.price4XLPlus,
  }));
  await bulkCreateBlanks(blanksToInsert);

  for (const p of STARTER_PRESETS) {
    await createPrintPreset({ userId, name: p.name, inkCost: p.inkCost, setupFee: p.setupFee, perPrintCost: p.perPrintCost });
  }

  await updateUserSettings(userId, { seedCompleted: true });
}

// ─── Quote number generator ───────────────────────────────────────────────────

function generateQuoteNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `Q${yy}${mm}${dd}-${rand}`;
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const blankInput = z.object({
  brand: z.string().min(1),
  garmentType: z.string().min(1),
  modelName: z.string().min(1),
  variant: z.string().optional(),
  priceSXL: z.string(),
  price2XL: z.string(),
  price3XL: z.string(),
  price4XLPlus: z.string(),
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
  qtyS: z.number().default(0),
  qtyM: z.number().default(0),
  qtyL: z.number().default(0),
  qtyXL: z.number().default(0),
  qty2XL: z.number().default(0),
  qty3XL: z.number().default(0),
  qty4XL: z.number().default(0),
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
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Settings ──────────────────────────────────────────────────────────────

  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      // Seed on first login
      if (!user.seedCompleted) {
        await seedUserData(user.id);
      }

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
        await updateUserSettings(ctx.user.id, input as Parameters<typeof updateUserSettings>[1]);
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
        const key = `logos/${ctx.user.id}/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await updateUserSettings(ctx.user.id, { shopLogo: url });
        return { url };
      }),
  }),

  // ─── Blanks ────────────────────────────────────────────────────────────────

  blanks: router({
    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        brand: z.string().optional(),
        garmentType: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return getBlanks(ctx.user.id, input?.search, input?.brand, input?.garmentType);
      }),

    brands: protectedProcedure.query(async ({ ctx }) => getBlankBrands(ctx.user.id)),
    garmentTypes: protectedProcedure.query(async ({ ctx }) => getBlankGarmentTypes(ctx.user.id)),

    create: protectedProcedure
      .input(blankInput)
      .mutation(async ({ ctx, input }) => {
        const id = await createBlank({ ...input, userId: ctx.user.id });
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

    bulkImport: protectedProcedure
      .input(z.array(blankInput))
      .mutation(async ({ ctx, input }) => {
        const data = input.map((b) => ({ ...b, userId: ctx.user.id }));
        await bulkCreateBlanks(data);
        return { count: data.length };
      }),
  }),

  // ─── Print Presets ─────────────────────────────────────────────────────────

  printPresets: router({
    list: protectedProcedure.query(async ({ ctx }) => getPrintPresets(ctx.user.id)),

    create: protectedProcedure
      .input(presetInput)
      .mutation(async ({ ctx, input }) => {
        const id = await createPrintPreset({ ...input, userId: ctx.user.id });
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
            qtyS: item.qtyS,
            qtyM: item.qtyM,
            qtyL: item.qtyL,
            qtyXL: item.qtyXL,
            qty2XL: item.qty2XL,
            qty3XL: item.qty3XL,
            qty4XL: item.qty4XL,
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
