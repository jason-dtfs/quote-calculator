import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth";

type SessionData = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
export type SessionUser = SessionData["user"];
export type SessionInfo = SessionData["session"];

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: SessionUser | null;
  session: SessionInfo | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const sessionData = await auth.api.getSession({
    headers: fromNodeHeaders(opts.req.headers),
  });

  return {
    req: opts.req,
    res: opts.res,
    user: sessionData?.user ?? null,
    session: sessionData?.session ?? null,
  };
}
