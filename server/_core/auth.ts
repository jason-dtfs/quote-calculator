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
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:5173",
  ],
});

export type Auth = typeof auth;
