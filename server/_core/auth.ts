import "dotenv/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../../drizzle/schema";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is required");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "user", input: false },
      plan: { type: "string", required: false, defaultValue: "free", input: false },
      shopName: { type: "string", required: false },
      shopLogo: { type: "string", required: false },
      shopLogoSize: { type: "string", required: false, defaultValue: "medium" },
      shopLogoPosition: { type: "string", required: false, defaultValue: "top-left" },
      defaultTaxRate: { type: "string", required: false, defaultValue: "0" },
      defaultMargin: { type: "number", required: false, defaultValue: 30 },
      currencySymbol: { type: "string", required: false, defaultValue: "$" },
      marketingOptIn: { type: "boolean", required: false, defaultValue: false },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  // Resolved per-request so dev gets any localhost port automatically while
  // production stays tight to whatever's configured via env.
  //
  //   BETTER_AUTH_URL              — primary deploy URL (always trusted)
  //   BETTER_AUTH_TRUSTED_ORIGINS  — optional comma-separated extras for
  //                                  multi-domain deploys (e.g. preview URLs)
  //
  // In NODE_ENV=development we additionally trust the request's own Origin
  // header if it matches /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.
  // The dev port shifts as ports get held, so a fixed list keeps biting us.
  trustedOrigins: (request) => {
    const list: string[] = [];
    if (process.env.BETTER_AUTH_URL) list.push(process.env.BETTER_AUTH_URL);
    for (const o of (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(",")) {
      const t = o.trim();
      if (t) list.push(t);
    }
    // Better Auth invokes trustedOrigins twice: once at init with no request
    // (for static context setup) and again per-request. Only the per-request
    // call gets the dev-localhost augmentation; the init call returns the
    // explicit-config list alone.
    if (request && process.env.NODE_ENV !== "production") {
      const origin = request.headers.get("origin");
      if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        list.push(origin);
      }
    }
    return list;
  },
});

export type Auth = typeof auth;
