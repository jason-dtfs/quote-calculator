import "dotenv/config";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  Blank,
  InsertBlank,
  InsertPrintPreset,
  InsertQuote,
  InsertQuoteItem,
  InsertQuoteItemPrint,
  PrintPreset,
  Quote,
  QuoteItem,
  QuoteItemPrint,
  User,
  blanks,
  printPresets,
  quoteItemPrints,
  quoteItems,
  quotes,
  user,
} from "../drizzle/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const client = postgres(process.env.DATABASE_URL, { ssl: "require" });
export const db = drizzle(client);

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUserById(id: string): Promise<User | undefined> {
  const result = await db.select().from(user).where(eq(user.id, id)).limit(1);
  return result[0];
}

export async function updateUserSettings(
  userId: string,
  data: Partial<
    Pick<
      User,
      | "shopName"
      | "shopLogo"
      | "shopLogoSize"
      | "shopLogoPosition"
      | "defaultTaxRate"
      | "defaultMargin"
      | "currencySymbol"
      | "marketingOptIn"
    >
  >
): Promise<void> {
  await db.update(user).set(data).where(eq(user.id, userId));
}

// ─── Blanks ───────────────────────────────────────────────────────────────────

export async function getBlanks(
  userId: string,
  search?: string,
  brand?: string,
  garmentType?: string
): Promise<Blank[]> {
  const conditions = [eq(blanks.userId, userId)];
  if (search) {
    conditions.push(
      or(
        ilike(blanks.modelName, `%${search}%`),
        ilike(blanks.brand, `%${search}%`),
        ilike(blanks.variant, `%${search}%`)
      ) as ReturnType<typeof eq>
    );
  }
  if (brand) conditions.push(eq(blanks.brand, brand));
  if (garmentType) conditions.push(eq(blanks.garmentType, garmentType));

  return db
    .select()
    .from(blanks)
    .where(and(...conditions))
    .orderBy(blanks.sortOrder, blanks.brand, blanks.modelName);
}

export async function getMaxBlankSortOrder(userId: string): Promise<number> {
  const result = await db
    .select({ max: sql<number | null>`MAX(${blanks.sortOrder})` })
    .from(blanks)
    .where(eq(blanks.userId, userId));
  return result[0]?.max ?? -1;
}

export async function reorderBlanks(
  userId: string,
  items: Array<{ id: number; sortOrder: number }>,
): Promise<void> {
  if (items.length === 0) return;
  const ids = items.map((i) => i.id);
  // Validate ownership: every id we're about to update must belong to userId.
  const owned = await db
    .select({ id: blanks.id })
    .from(blanks)
    .where(and(inArray(blanks.id, ids), eq(blanks.userId, userId)));
  if (owned.length !== ids.length) {
    throw new Error("reorderBlanks: not all ids owned by user");
  }
  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx
        .update(blanks)
        .set({ sortOrder: item.sortOrder })
        .where(and(eq(blanks.id, item.id), eq(blanks.userId, userId)));
    }
  });
}

export async function getBlankById(id: number, userId: string): Promise<Blank | undefined> {
  const result = await db
    .select()
    .from(blanks)
    .where(and(eq(blanks.id, id), eq(blanks.userId, userId)))
    .limit(1);
  return result[0];
}

export async function createBlank(data: InsertBlank): Promise<number> {
  const [row] = await db.insert(blanks).values(data).returning({ id: blanks.id });
  return row.id;
}

export async function updateBlank(
  id: number,
  userId: string,
  data: Partial<InsertBlank>
): Promise<void> {
  await db.update(blanks).set(data).where(and(eq(blanks.id, id), eq(blanks.userId, userId)));
}

export async function deleteBlank(id: number, userId: string): Promise<void> {
  await db.delete(blanks).where(and(eq(blanks.id, id), eq(blanks.userId, userId)));
}

export async function bulkCreateBlanks(data: InsertBlank[]): Promise<void> {
  if (data.length === 0) return;
  await db.insert(blanks).values(data);
}

export async function getBlankBrands(userId: string): Promise<string[]> {
  const result = await db
    .selectDistinct({ brand: blanks.brand })
    .from(blanks)
    .where(and(eq(blanks.userId, userId), eq(blanks.isHidden, false)))
    .orderBy(blanks.brand);
  return result.map((r) => r.brand);
}

export async function findBlankBySystemId(
  userId: string,
  systemId: string
): Promise<Blank | undefined> {
  const result = await db
    .select()
    .from(blanks)
    .where(and(eq(blanks.userId, userId), eq(blanks.overridesSystemId, systemId)))
    .limit(1);
  return result[0];
}

export async function deleteBlankBySystemId(
  userId: string,
  systemId: string
): Promise<void> {
  await db
    .delete(blanks)
    .where(and(eq(blanks.userId, userId), eq(blanks.overridesSystemId, systemId)));
}

export async function getBlankGarmentTypes(userId: string): Promise<string[]> {
  const result = await db
    .selectDistinct({ garmentType: blanks.garmentType })
    .from(blanks)
    .where(and(eq(blanks.userId, userId), eq(blanks.isHidden, false)))
    .orderBy(blanks.garmentType);
  return result.map((r) => r.garmentType);
}

// ─── Print Presets ────────────────────────────────────────────────────────────

export async function getPrintPresets(userId: string): Promise<PrintPreset[]> {
  return db
    .select()
    .from(printPresets)
    .where(eq(printPresets.userId, userId))
    .orderBy(printPresets.sortOrder, printPresets.name);
}

export async function getMaxPrintPresetSortOrder(userId: string): Promise<number> {
  const result = await db
    .select({ max: sql<number | null>`MAX(${printPresets.sortOrder})` })
    .from(printPresets)
    .where(eq(printPresets.userId, userId));
  return result[0]?.max ?? -1;
}

export async function reorderPrintPresets(
  userId: string,
  items: Array<{ id: number; sortOrder: number }>,
): Promise<void> {
  if (items.length === 0) return;
  const ids = items.map((i) => i.id);
  const owned = await db
    .select({ id: printPresets.id })
    .from(printPresets)
    .where(and(inArray(printPresets.id, ids), eq(printPresets.userId, userId)));
  if (owned.length !== ids.length) {
    throw new Error("reorderPrintPresets: not all ids owned by user");
  }
  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx
        .update(printPresets)
        .set({ sortOrder: item.sortOrder })
        .where(and(eq(printPresets.id, item.id), eq(printPresets.userId, userId)));
    }
  });
}

export async function getPrintPresetById(
  id: number,
  userId: string
): Promise<PrintPreset | undefined> {
  const result = await db
    .select()
    .from(printPresets)
    .where(and(eq(printPresets.id, id), eq(printPresets.userId, userId)))
    .limit(1);
  return result[0];
}

export async function createPrintPreset(data: InsertPrintPreset): Promise<number> {
  const [row] = await db
    .insert(printPresets)
    .values(data)
    .returning({ id: printPresets.id });
  return row.id;
}

export async function updatePrintPreset(
  id: number,
  userId: string,
  data: Partial<InsertPrintPreset>
): Promise<void> {
  await db
    .update(printPresets)
    .set(data)
    .where(and(eq(printPresets.id, id), eq(printPresets.userId, userId)));
}

export async function deletePrintPreset(id: number, userId: string): Promise<void> {
  await db
    .delete(printPresets)
    .where(and(eq(printPresets.id, id), eq(printPresets.userId, userId)));
}

export async function findPrintPresetBySystemId(
  userId: string,
  systemId: string
): Promise<PrintPreset | undefined> {
  const result = await db
    .select()
    .from(printPresets)
    .where(and(eq(printPresets.userId, userId), eq(printPresets.overridesSystemId, systemId)))
    .limit(1);
  return result[0];
}

export async function deletePrintPresetBySystemId(
  userId: string,
  systemId: string
): Promise<void> {
  await db
    .delete(printPresets)
    .where(and(eq(printPresets.userId, userId), eq(printPresets.overridesSystemId, systemId)));
}

// ─── Quotes ───────────────────────────────────────────────────────────────────

export async function getQuotes(userId: string): Promise<Quote[]> {
  return db.select().from(quotes).where(eq(quotes.userId, userId)).orderBy(desc(quotes.createdAt));
}

export async function getQuoteById(id: number, userId: string): Promise<Quote | undefined> {
  const result = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
    .limit(1);
  return result[0];
}

export async function createQuote(data: InsertQuote): Promise<number> {
  const [row] = await db.insert(quotes).values(data).returning({ id: quotes.id });
  return row.id;
}

export async function updateQuote(
  id: number,
  userId: string,
  data: Partial<InsertQuote>
): Promise<void> {
  await db.update(quotes).set(data).where(and(eq(quotes.id, id), eq(quotes.userId, userId)));
}

export async function deleteQuote(id: number, userId: string): Promise<void> {
  await db.delete(quotes).where(and(eq(quotes.id, id), eq(quotes.userId, userId)));
}

// ─── Quote Items ──────────────────────────────────────────────────────────────

export async function getQuoteItems(quoteId: number): Promise<QuoteItem[]> {
  return db
    .select()
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, quoteId))
    .orderBy(quoteItems.sortOrder);
}

export async function createQuoteItem(data: InsertQuoteItem): Promise<number> {
  const [row] = await db.insert(quoteItems).values(data).returning({ id: quoteItems.id });
  return row.id;
}

export async function updateQuoteItem(id: number, data: Partial<InsertQuoteItem>): Promise<void> {
  await db.update(quoteItems).set(data).where(eq(quoteItems.id, id));
}

export async function deleteQuoteItem(id: number): Promise<void> {
  await db.delete(quoteItems).where(eq(quoteItems.id, id));
}

export async function deleteQuoteItemsByQuoteId(quoteId: number): Promise<void> {
  await db.delete(quoteItems).where(eq(quoteItems.quoteId, quoteId));
}

// ─── Quote Item Prints ────────────────────────────────────────────────────────

export async function getQuoteItemPrints(quoteItemId: number): Promise<QuoteItemPrint[]> {
  return db
    .select()
    .from(quoteItemPrints)
    .where(eq(quoteItemPrints.quoteItemId, quoteItemId));
}

export async function createQuoteItemPrint(data: InsertQuoteItemPrint): Promise<number> {
  const [row] = await db
    .insert(quoteItemPrints)
    .values(data)
    .returning({ id: quoteItemPrints.id });
  return row.id;
}

export async function deleteQuoteItemPrintsByItemId(quoteItemId: number): Promise<void> {
  await db.delete(quoteItemPrints).where(eq(quoteItemPrints.quoteItemId, quoteItemId));
}
