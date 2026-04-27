import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const userPlanEnum = pgEnum("user_plan", ["free", "pro"]);
export const shopLogoSizeEnum = pgEnum("shop_logo_size", ["small", "medium", "large"]);
export const shopLogoPositionEnum = pgEnum("shop_logo_position", [
  "top-left",
  "top-center",
  "top-right",
]);
export const quoteStatusEnum = pgEnum("quote_status", ["draft", "sent", "accepted"]);

// ─── Better Auth: user (extended with shop fields via additionalFields) ───────

export const user = pgTable("user", {
  // Better Auth core
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),

  // App-specific (extended via Better Auth additionalFields)
  role: userRoleEnum("role").notNull().default("user"),
  plan: userPlanEnum("plan").notNull().default("free"),
  shopName: varchar("shopName", { length: 255 }),
  shopLogo: text("shopLogo"),
  shopLogoSize: shopLogoSizeEnum("shopLogoSize").default("medium"),
  shopLogoPosition: shopLogoPositionEnum("shopLogoPosition").default("top-left"),
  defaultTaxRate: numeric("defaultTaxRate", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  defaultMargin: integer("defaultMargin").notNull().default(30),
  currencySymbol: varchar("currencySymbol", { length: 8 }).notNull().default("$"),
  marketingOptIn: boolean("marketingOptIn").notNull().default(false),
});

export type User = typeof user.$inferSelect;
export type InsertUser = typeof user.$inferInsert;

// ─── Better Auth: session ─────────────────────────────────────────────────────

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expiresAt", { withTimezone: true, mode: "date" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Session = typeof session.$inferSelect;

// ─── Better Auth: account (credentials provider stores password hash here) ────

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", {
    withTimezone: true,
    mode: "date",
  }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", {
    withTimezone: true,
    mode: "date",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Account = typeof account.$inferSelect;

// ─── Better Auth: verification ────────────────────────────────────────────────

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Verification = typeof verification.$inferSelect;

// ─── Blanks ───────────────────────────────────────────────────────────────────

export const blanks = pgTable(
  "blanks",
  {
    id: serial("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    brand: varchar("brand", { length: 255 }).notNull(),
    garmentType: varchar("garmentType", { length: 255 }).notNull(),
    modelName: varchar("modelName", { length: 255 }).notNull(),
    variant: varchar("variant", { length: 255 }),
    // One-size flag short-circuits all six tier prices; a single priceOS is
    // used instead. priceOS is nullable so the column is meaningful only when
    // isOneSize is true. The zod input layer still coerces empty string → "0"
    // for consistency, so DB rows in practice carry "0" rather than null.
    isOneSize: boolean("isOneSize").notNull().default(false),
    priceOS: numeric("priceOS", { precision: 8, scale: 2 }),
    priceXS: numeric("priceXS", { precision: 8, scale: 2 }).notNull().default("0"),
    priceSXL: numeric("priceSXL", { precision: 8, scale: 2 }).notNull().default("0"),
    price2XL: numeric("price2XL", { precision: 8, scale: 2 }).notNull().default("0"),
    price3XL: numeric("price3XL", { precision: 8, scale: 2 }).notNull().default("0"),
    price4XL: numeric("price4XL", { precision: 8, scale: 2 }).notNull().default("0"),
    price5XL: numeric("price5XL", { precision: 8, scale: 2 }).notNull().default("0"),
    // When set, this row is the user's customization of a system catalog item
    // (e.g. "system:gildan-5000-tshirt"). When also isHidden=true, the row is a
    // tombstone hiding that system item from the user's view. When isHidden=false
    // and the data fields (brand/modelName) are empty, this is a position-only
    // fork created by drag-reorder — merge logic substitutes the system data.
    overridesSystemId: text("overridesSystemId"),
    isHidden: boolean("isHidden").notNull().default(false),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userOverrideIdx: index("blanks_user_override_idx").on(
      table.userId,
      table.overridesSystemId,
    ),
  }),
);

export type Blank = typeof blanks.$inferSelect;
export type InsertBlank = typeof blanks.$inferInsert;

// ─── Print Presets ────────────────────────────────────────────────────────────

export const printPresets = pgTable(
  "print_presets",
  {
    id: serial("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    inkCost: numeric("inkCost", { precision: 8, scale: 2 }).notNull().default("0"),
    setupFee: numeric("setupFee", { precision: 8, scale: 2 }).notNull().default("0"),
    perPrintCost: numeric("perPrintCost", { precision: 8, scale: 2 }).notNull().default("0"),
    overridesSystemId: text("overridesSystemId"),
    isHidden: boolean("isHidden").notNull().default(false),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userOverrideIdx: index("print_presets_user_override_idx").on(
      table.userId,
      table.overridesSystemId,
    ),
  }),
);

export type PrintPreset = typeof printPresets.$inferSelect;
export type InsertPrintPreset = typeof printPresets.$inferInsert;

// ─── Quotes ───────────────────────────────────────────────────────────────────

export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  quoteNumber: varchar("quoteNumber", { length: 64 }),
  status: quoteStatusEnum("status").notNull().default("draft"),
  customerName: varchar("customerName", { length: 255 }),
  customerPhone: varchar("customerPhone", { length: 64 }),
  customerEmail: varchar("customerEmail", { length: 320 }),
  margin: integer("margin").notNull().default(30),
  taxEnabled: boolean("taxEnabled").notNull().default(false),
  taxRate: numeric("taxRate", { precision: 5, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("taxAmount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = typeof quotes.$inferInsert;

// ─── Quote Items ──────────────────────────────────────────────────────────────

export const quoteItems = pgTable("quote_items", {
  id: serial("id").primaryKey(),
  quoteId: integer("quoteId")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  sortOrder: integer("sortOrder").notNull().default(0),
  blankId: integer("blankId").references(() => blanks.id, { onDelete: "set null" }),
  blankSnapshot: jsonb("blankSnapshot"),
  qtyOS: integer("qtyOS").notNull().default(0),
  qtyXS: integer("qtyXS").notNull().default(0),
  qtyS: integer("qtyS").notNull().default(0),
  qtyM: integer("qtyM").notNull().default(0),
  qtyL: integer("qtyL").notNull().default(0),
  qtyXL: integer("qtyXL").notNull().default(0),
  qty2XL: integer("qty2XL").notNull().default(0),
  qty3XL: integer("qty3XL").notNull().default(0),
  qty4XL: integer("qty4XL").notNull().default(0),
  qty5XL: integer("qty5XL").notNull().default(0),
  lineNotes: text("lineNotes"),
  blankCost: numeric("blankCost", { precision: 10, scale: 2 }).notNull().default("0"),
  printCost: numeric("printCost", { precision: 10, scale: 2 }).notNull().default("0"),
  lineTotal: numeric("lineTotal", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export type QuoteItem = typeof quoteItems.$inferSelect;
export type InsertQuoteItem = typeof quoteItems.$inferInsert;

// ─── Quote Item Print Locations ───────────────────────────────────────────────

export const quoteItemPrints = pgTable("quote_item_prints", {
  id: serial("id").primaryKey(),
  quoteItemId: integer("quoteItemId")
    .notNull()
    .references(() => quoteItems.id, { onDelete: "cascade" }),
  presetId: integer("presetId").references(() => printPresets.id, { onDelete: "set null" }),
  presetSnapshot: jsonb("presetSnapshot"),
  cost: numeric("cost", { precision: 8, scale: 2 }).notNull().default("0"),
});

export type QuoteItemPrint = typeof quoteItemPrints.$inferSelect;
export type InsertQuoteItemPrint = typeof quoteItemPrints.$inferInsert;
