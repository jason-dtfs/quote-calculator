import "dotenv/config";
import { and, desc, eq, ilike, or } from "drizzle-orm";
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
    .orderBy(blanks.brand, blanks.modelName);
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
    .where(eq(blanks.userId, userId))
    .orderBy(blanks.brand);
  return result.map((r) => r.brand);
}

export async function getBlankGarmentTypes(userId: string): Promise<string[]> {
  const result = await db
    .selectDistinct({ garmentType: blanks.garmentType })
    .from(blanks)
    .where(eq(blanks.userId, userId))
    .orderBy(blanks.garmentType);
  return result.map((r) => r.garmentType);
}

// ─── Print Presets ────────────────────────────────────────────────────────────

export async function getPrintPresets(userId: string): Promise<PrintPreset[]> {
  return db
    .select()
    .from(printPresets)
    .where(eq(printPresets.userId, userId))
    .orderBy(printPresets.name);
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
