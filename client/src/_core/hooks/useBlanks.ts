// Auth-routed hooks for the blanks catalog. Authed users get tRPC-backed
// queries/mutations; anonymous users hit the localStorage-backed
// anonymousStore. Pages don't need to know which side they're on.

import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { anonymousStore } from "@/lib/anonymousStore";
import type { CatalogBlank } from "@shared/constants";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";

// Query/mutation surface our pages actually use; not the full React Query shape.
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

// ─── Anon helpers ─────────────────────────────────────────────────────────────

/** Subscribe a query to anon-store mutations and re-pull on change. */
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
        // store read errors are non-fatal — leave previous data in place
      }
    };
    refetch();
    return anonymousStore.subscribe(refetch);
    // depKey is a JSON-stringified version of the relevant input
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

/** Build a synchronous mutation surface around a store call. */
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

// ─── Hooks ────────────────────────────────────────────────────────────────────

export type BlankListInput = {
  search?: string;
  brand?: string;
  garmentType?: string;
  includeHidden?: boolean;
};

export function useBlanksList(input?: BlankListInput): QueryLike<CatalogBlank[]> {
  const { user } = useAuth();
  const trpcQuery = trpc.blanks.list.useQuery(input, { enabled: !!user });
  const anonQuery = useAnonQuery<CatalogBlank[]>(
    () => anonymousStore.blanks.list(input),
    JSON.stringify({ user: !!user, input })
  );
  if (user) {
    return {
      data: trpcQuery.data,
      isLoading: trpcQuery.isLoading,
      refetch: () => void trpcQuery.refetch(),
    };
  }
  return anonQuery;
}

export function useBlanksBrands(): QueryLike<string[]> {
  const { user } = useAuth();
  const trpcQuery = trpc.blanks.brands.useQuery(undefined, { enabled: !!user });
  const anonQuery = useAnonQuery<string[]>(
    () => anonymousStore.blanks.brands(),
    user ? "authed" : "anon"
  );
  if (user) {
    return {
      data: trpcQuery.data,
      isLoading: trpcQuery.isLoading,
      refetch: () => void trpcQuery.refetch(),
    };
  }
  return anonQuery;
}

export function useBlanksGarmentTypes(): QueryLike<string[]> {
  const { user } = useAuth();
  const trpcQuery = trpc.blanks.garmentTypes.useQuery(undefined, { enabled: !!user });
  const anonQuery = useAnonQuery<string[]>(
    () => anonymousStore.blanks.garmentTypes(),
    user ? "authed" : "anon"
  );
  if (user) {
    return {
      data: trpcQuery.data,
      isLoading: trpcQuery.isLoading,
      refetch: () => void trpcQuery.refetch(),
    };
  }
  return anonQuery;
}

export type BlankCreateInput = Parameters<typeof anonymousStore.blanks.create>[0];
export function useCreateBlank(): MutationLike<BlankCreateInput, { id: number }> {
  const { user } = useAuth();
  const trpcMutation = trpc.blanks.create.useMutation();
  if (user) return trpcMutation as unknown as MutationLike<BlankCreateInput, { id: number }>;
  return makeAnonMutation((input: BlankCreateInput) => anonymousStore.blanks.create(input));
}

export type BlankUpdateInput = { id: number } & Partial<BlankCreateInput>;
export function useUpdateBlank(): MutationLike<BlankUpdateInput, { success: true }> {
  const { user } = useAuth();
  const trpcMutation = trpc.blanks.update.useMutation();
  if (user) return trpcMutation as unknown as MutationLike<BlankUpdateInput, { success: true }>;
  return makeAnonMutation((input: BlankUpdateInput) => {
    const { id, ...data } = input;
    anonymousStore.blanks.update(id, data);
    return { success: true } as const;
  });
}

export function useDeleteBlank(): MutationLike<{ id: number }, { success: true }> {
  const { user } = useAuth();
  const trpcMutation = trpc.blanks.delete.useMutation();
  if (user) return trpcMutation as unknown as MutationLike<{ id: number }, { success: true }>;
  return makeAnonMutation(({ id }: { id: number }) => {
    anonymousStore.blanks.delete(id);
    return { success: true } as const;
  });
}

export type ForkSystemBlankInput = Parameters<typeof anonymousStore.blanks.forkSystem>[0];
export function useForkSystemBlank(): MutationLike<ForkSystemBlankInput, { id: number }> {
  const { user } = useAuth();
  const trpcMutation = trpc.blanks.forkSystem.useMutation();
  if (user) return trpcMutation as unknown as MutationLike<ForkSystemBlankInput, { id: number }>;
  return makeAnonMutation((input: ForkSystemBlankInput) => anonymousStore.blanks.forkSystem(input));
}

export function useHideSystemBlank(): MutationLike<{ systemId: string }, { id: number }> {
  const { user } = useAuth();
  const trpcMutation = trpc.blanks.hideSystem.useMutation();
  if (user) return trpcMutation as unknown as MutationLike<{ systemId: string }, { id: number }>;
  return makeAnonMutation((input: { systemId: string }) => anonymousStore.blanks.hideSystem(input));
}

export function useRestoreSystemBlank(): MutationLike<{ systemId: string }, { success: true }> {
  const { user } = useAuth();
  const trpcMutation = trpc.blanks.restoreSystem.useMutation();
  if (user) return trpcMutation as unknown as MutationLike<{ systemId: string }, { success: true }>;
  return makeAnonMutation((input: { systemId: string }) => anonymousStore.blanks.restoreSystem(input));
}

export function useBulkImportBlanks(): MutationLike<BlankCreateInput[], { count: number }> {
  const { user } = useAuth();
  const trpcMutation = trpc.blanks.bulkImport.useMutation();
  if (user) return trpcMutation as unknown as MutationLike<BlankCreateInput[], { count: number }>;
  return makeAnonMutation((input: BlankCreateInput[]) => anonymousStore.blanks.bulkImport(input));
}

export type BlankReorderInput = Array<{ id: number | string; sortOrder: number }>;

// Apply a reorder payload to a cached list, in-place semantics. Items present
// in `newOrder` are placed in payload order at the front; items absent (e.g.
// hidden tombstones, which the page strips before sending) keep their relative
// positions at the tail. Server merge logic puts hidden tombstones last too,
// so this matches the eventual server response and avoids a layout flip when
// the invalidation refetch lands.
function applyOptimisticBlankReorder(
  current: CatalogBlank[] | undefined,
  newOrder: BlankReorderInput,
): CatalogBlank[] | undefined {
  if (!current) return current;
  const byId = new Map<string, CatalogBlank>();
  current.forEach((c) => byId.set(String(c.id), c));
  const orderedIds = new Set(newOrder.map((it) => String(it.id)));
  const reordered: CatalogBlank[] = [];
  for (const it of newOrder) {
    const item = byId.get(String(it.id));
    if (item) reordered.push(item);
  }
  const rest = current.filter((c) => !orderedIds.has(String(c.id)));
  return [...reordered, ...rest];
}

export function useReorderBlanks(): MutationLike<BlankReorderInput, { success: true }> {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();

  // Standard TanStack optimistic pattern: cancel in-flight, snapshot every
  // cached blanks.list entry (one per distinct input — search, brand, etc.),
  // overwrite each with the reordered list, roll back on error, invalidate on
  // settle so the server's truth wins on the next fetch.
  const trpcMutation = trpc.blanks.reorder.useMutation({
    onMutate: async (input) => {
      const queryKey = getQueryKey(trpc.blanks.list);
      await queryClient.cancelQueries({ queryKey });
      const entries = queryClient.getQueriesData<CatalogBlank[]>({ queryKey });
      const snapshot: Array<{ key: QueryKey; data: CatalogBlank[] | undefined }> = entries.map(
        ([key, data]) => ({ key, data }),
      );
      for (const [key, data] of entries) {
        const next = applyOptimisticBlankReorder(data, input);
        if (next) queryClient.setQueryData(key, next);
      }
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshot) return;
      for (const { key, data } of ctx.snapshot) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: () => {
      utils.blanks.list.invalidate();
    },
  });

  if (user) return trpcMutation as unknown as MutationLike<BlankReorderInput, { success: true }>;
  return makeAnonMutation((input: BlankReorderInput) => anonymousStore.blanks.reorder(input));
}
