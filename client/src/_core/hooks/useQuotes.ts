import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { anonymousStore, type AnonQuote, type AnonQuoteItem } from "@/lib/anonymousStore";

type QueryLike<T> = {
  data: T | undefined;
  isLoading: boolean;
  refetch: () => void;
};

type MutationOpts<TData> = {
  onSuccess?: (data: TData) => void;
  onError?: (err: Error) => void;
};

type MutationLike<TInput, TData> = {
  mutate: (input: TInput, opts?: MutationOpts<TData>) => void;
  mutateAsync: (input: TInput) => Promise<TData>;
  isPending: boolean;
};

function useAnonQuery<T>(read: () => T, depKey: string): QueryLike<T> {
  const [data, setData] = useState<T>(() => {
    try {
      return read();
    } catch {
      return undefined as unknown as T;
    }
  });
  useEffect(() => {
    const refetch = () => {
      try {
        setData(read());
      } catch {
        /* ignore */
      }
    };
    refetch();
    return anonymousStore.subscribe(refetch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  return {
    data,
    isLoading: false,
    refetch: () => {
      try {
        setData(read());
      } catch {
        /* ignore */
      }
    },
  };
}

function makeAnonMutation<TInput, TData>(
  fn: (input: TInput) => TData
): MutationLike<TInput, TData> {
  return {
    mutate: (input, opts) => {
      try {
        const result = fn(input);
        opts?.onSuccess?.(result);
      } catch (err) {
        opts?.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    },
    mutateAsync: async (input) => fn(input),
    isPending: false,
  };
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type QuoteListItem = {
  id: number;
  quoteNumber: string;
  status: "draft" | "sent" | "accepted";
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  total: string;
  createdAt: string | Date;
};

// Shape returned by quotes.get on either side. We deliberately let the authed
// shape be wider; pages access the fields they need.
export type QuoteDetail = AnonQuote;

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useQuotesList(): QueryLike<QuoteListItem[]> {
  const { user } = useAuth();
  const trpcQuery = trpc.quotes.list.useQuery(undefined, { enabled: !!user });
  const anonQuery = useAnonQuery<QuoteListItem[]>(
    () => anonymousStore.quotes.list(),
    user ? "authed" : "anon"
  );
  if (user) {
    return {
      data: trpcQuery.data as QuoteListItem[] | undefined,
      isLoading: trpcQuery.isLoading,
      refetch: () => void trpcQuery.refetch(),
    };
  }
  return anonQuery;
}

export function useQuoteById(id: number, opts?: { enabled?: boolean }): QueryLike<QuoteDetail | undefined> {
  const { user } = useAuth();
  const enabled = opts?.enabled !== false;
  const trpcQuery = trpc.quotes.get.useQuery({ id }, { enabled: !!user && enabled });
  const anonQuery = useAnonQuery<QuoteDetail | undefined>(
    () => (enabled ? anonymousStore.quotes.get(id) : undefined),
    JSON.stringify({ user: !!user, id, enabled })
  );
  if (user) {
    return {
      data: trpcQuery.data as QuoteDetail | undefined,
      isLoading: trpcQuery.isLoading,
      refetch: () => void trpcQuery.refetch(),
    };
  }
  return anonQuery;
}

export type QuoteCreateInput = {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  margin: number;
  taxEnabled: boolean;
  taxRate: string;
  notes?: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  status?: "draft" | "sent" | "accepted";
  items: AnonQuoteItem[];
};

export function useCreateQuote(): MutationLike<QuoteCreateInput, { id: number; quoteNumber: string }> {
  const { user } = useAuth();
  const trpcMutation = trpc.quotes.create.useMutation();
  if (user)
    return trpcMutation as unknown as MutationLike<QuoteCreateInput, { id: number; quoteNumber: string }>;
  return makeAnonMutation((input: QuoteCreateInput) => anonymousStore.quotes.create(input));
}

export type QuoteUpdateInput = { id: number } & Partial<QuoteCreateInput>;
export function useUpdateQuote(): MutationLike<QuoteUpdateInput, { success: true }> {
  const { user } = useAuth();
  const trpcMutation = trpc.quotes.update.useMutation();
  if (user) return trpcMutation as unknown as MutationLike<QuoteUpdateInput, { success: true }>;
  return makeAnonMutation((input: QuoteUpdateInput) => {
    const { id, ...data } = input;
    anonymousStore.quotes.update(id, data as Partial<AnonQuote>);
    return { success: true } as const;
  });
}

export function useUpdateQuoteStatus(): MutationLike<
  { id: number; status: "draft" | "sent" | "accepted" },
  { success: true }
> {
  const { user } = useAuth();
  const trpcMutation = trpc.quotes.updateStatus.useMutation();
  if (user)
    return trpcMutation as unknown as MutationLike<
      { id: number; status: "draft" | "sent" | "accepted" },
      { success: true }
    >;
  return makeAnonMutation(({ id, status }: { id: number; status: "draft" | "sent" | "accepted" }) => {
    anonymousStore.quotes.updateStatus(id, status);
    return { success: true } as const;
  });
}

export function useDeleteQuote(): MutationLike<{ id: number }, { success: true }> {
  const { user } = useAuth();
  const trpcMutation = trpc.quotes.delete.useMutation();
  if (user) return trpcMutation as unknown as MutationLike<{ id: number }, { success: true }>;
  return makeAnonMutation(({ id }: { id: number }) => {
    anonymousStore.quotes.delete(id);
    return { success: true } as const;
  });
}

export function useDuplicateQuote(): MutationLike<
  { id: number },
  { id: number; quoteNumber: string }
> {
  const { user } = useAuth();
  const trpcMutation = trpc.quotes.duplicate.useMutation();
  if (user)
    return trpcMutation as unknown as MutationLike<
      { id: number },
      { id: number; quoteNumber: string }
    >;
  return makeAnonMutation(({ id }: { id: number }) => {
    const result = anonymousStore.quotes.duplicate(id);
    if (!result) throw new Error("Quote not found");
    return result;
  });
}
