CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."shop_logo_position" AS ENUM('top-left', 'top-center', 'top-right');--> statement-breakpoint
CREATE TYPE "public"."shop_logo_size" AS ENUM('small', 'medium', 'large');--> statement-breakpoint
CREATE TYPE "public"."user_plan" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blanks" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"brand" varchar(255) NOT NULL,
	"garmentType" varchar(255) NOT NULL,
	"modelName" varchar(255) NOT NULL,
	"variant" varchar(255),
	"priceSXL" numeric(8, 2) DEFAULT '0' NOT NULL,
	"price2XL" numeric(8, 2) DEFAULT '0' NOT NULL,
	"price3XL" numeric(8, 2) DEFAULT '0' NOT NULL,
	"price4XLPlus" numeric(8, 2) DEFAULT '0' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_presets" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"inkCost" numeric(8, 2) DEFAULT '0' NOT NULL,
	"setupFee" numeric(8, 2) DEFAULT '0' NOT NULL,
	"perPrintCost" numeric(8, 2) DEFAULT '0' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_item_prints" (
	"id" serial PRIMARY KEY NOT NULL,
	"quoteItemId" integer NOT NULL,
	"presetId" integer,
	"presetSnapshot" jsonb,
	"cost" numeric(8, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quoteId" integer NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"blankId" integer,
	"blankSnapshot" jsonb,
	"qtyS" integer DEFAULT 0 NOT NULL,
	"qtyM" integer DEFAULT 0 NOT NULL,
	"qtyL" integer DEFAULT 0 NOT NULL,
	"qtyXL" integer DEFAULT 0 NOT NULL,
	"qty2XL" integer DEFAULT 0 NOT NULL,
	"qty3XL" integer DEFAULT 0 NOT NULL,
	"qty4XL" integer DEFAULT 0 NOT NULL,
	"lineNotes" text,
	"blankCost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"printCost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"lineTotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"quoteNumber" varchar(64),
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"customerName" varchar(255),
	"customerPhone" varchar(64),
	"customerEmail" varchar(320),
	"margin" integer DEFAULT 30 NOT NULL,
	"taxEnabled" boolean DEFAULT false NOT NULL,
	"taxRate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"subtotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"taxAmount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"token" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"plan" "user_plan" DEFAULT 'free' NOT NULL,
	"shopName" varchar(255),
	"shopLogo" text,
	"shopLogoSize" "shop_logo_size" DEFAULT 'medium',
	"shopLogoPosition" "shop_logo_position" DEFAULT 'top-left',
	"defaultTaxRate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"defaultMargin" integer DEFAULT 30 NOT NULL,
	"currencySymbol" varchar(8) DEFAULT '$' NOT NULL,
	"marketingOptIn" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blanks" ADD CONSTRAINT "blanks_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_presets" ADD CONSTRAINT "print_presets_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_item_prints" ADD CONSTRAINT "quote_item_prints_quoteItemId_quote_items_id_fk" FOREIGN KEY ("quoteItemId") REFERENCES "public"."quote_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_item_prints" ADD CONSTRAINT "quote_item_prints_presetId_print_presets_id_fk" FOREIGN KEY ("presetId") REFERENCES "public"."print_presets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quoteId_quotes_id_fk" FOREIGN KEY ("quoteId") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_blankId_blanks_id_fk" FOREIGN KEY ("blankId") REFERENCES "public"."blanks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;