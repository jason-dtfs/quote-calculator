import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { anonymousStore } from "@/lib/anonymousStore";
import type { CatalogPreset } from "@shared/constants";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";

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

export type PresetListInput = { includeHidden?: boolean };

export function usePrintPresetsList(input?: PresetListInput): QueryLike<CatalogPreset[]> {
  const { user } = useAuth();
  const trpcQuery = trpc.printPresets.list.useQuery(input, { enabled: !!user });
  const anonQuery = useAnonQuery<CatalogPreset[]>(
    () => anonymousStore.printPresets.list(input),
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

export type PresetCreateInput = Parameters<typeof anonymousStore.printPresets.create>[0];
export function useCreatePrintPreset(): MutationLike<PresetCreateInput, { id: number }> {
  const { user } = useAuth();
  const trpcMutation = trpc.printPresets.create.useMutation();
  if (user) return trpcMutation as unknown as MutationLike<PresetCreateInput, { id: number }>;
  return makeAnonMutation((input: PresetCreateInput) => anonymousStore.printPresets.create(input));
}

export type PresetUpdateInput = { id: number } & Partial<PresetCreateInput>;
export function useUpdatePrintPreset(): MutationLike<PresetUpdateInput, { success: true }> {
  const { user } = useAuth();
  const trpcMutation = trpc.printPresets.update.useMutation();
  if (user) return trpcMutation as unknown as MutationLike<PresetUpdateInput, { success: true }>;
  return makeAnonMutation((input: PresetUpdateInput) => {
    const { id, ...data } = input;
    anonymousStore.printPresets.update(id, data);
    return { success: true } as const;
  });
}

export function useDeletePrintPreset(): MutationLike<{ id: number }, { success: true }> {
  const { user } = useAuth();
  const trpcMutation = trpc.printPresets.delete.useMutation();
  if (user) return trpcMutation as unknown as MutationLike<{ id: number }, { success: true }>;
  return makeAnonMutation(({ id }: { id: number }) => {
    anonymousStore.printPresets.delete(id);
    return { success: true } as const;
  });
}

export type ForkSystemPresetInput = Parameters<typeof anonymousStore.printPresets.forkSystem>[0];
export function useForkSystemPreset(): MutationLike<ForkSystemPresetInput, { id: number }> {
  const { user } = useAuth();
  const trpcMutation = trpc.printPresets.forkSystem.useMutation();
  if (user) return trpcMutation as unknown as MutationLike<ForkSystemPresetInput, { id: number }>;
  return makeAnonMutation((input: ForkSystemPresetInput) =>
    anonymousStore.printPresets.forkSystem(input)
  );
}

export function useHideSystemPreset(): MutationLike<{ systemId: string }, { id: number }> {
  const { user } = useAuth();
  const trpcMutation = trpc.printPresets.hideSystem.useMutation();
  if (user) return trpcMutation as unknown as MutationLike<{ systemId: string }, { id: number }>;
  return makeAnonMutation((input: { systemId: string }) =>
    anonymousStore.printPresets.hideSystem(input)
  );
}

export function useRestoreSystemPreset(): MutationLike<{ systemId: string }, { success: true }> {
  const { user } = useAuth();
  const trpcMutation = trpc.printPresets.restoreSystem.useMutation();
  if (user) return trpcMutation as unknown as MutationLike<{ systemId: string }, { success: true }>;
  return makeAnonMutation((input: { systemId: string }) =>
    anonymousStore.printPresets.restoreSystem(input)
  );
}

export type PresetReorderInput = Array<{ id: number | string; sortOrder: number }>;

// See applyOptimisticBlankReorder in useBlanks.ts for the rationale; same
// shape, different element type.
function applyOptimisticPresetReorder(
  current: CatalogPreset[] | undefined,
  newOrder: PresetReorderInput,
): CatalogPreset[] | undefined {
  if (!current) return current;
  const byId = new Map<string, CatalogPreset>();
  current.forEach((c) => byId.set(String(c.id), c));
  const orderedIds = new Set(newOrder.map((it) => String(it.id)));
  const reordered: CatalogPreset[] = [];
  for (const it of newOrder) {
    const item = byId.get(String(it.id));
    if (item) reordered.push(item);
  }
  const rest = current.filter((c) => !orderedIds.has(String(c.id)));
  return [...reordered, ...rest];
}

export function useReorderPrintPresets(): MutationLike<PresetReorderInput, { success: true }> {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();

  const trpcMutation = trpc.printPresets.reorder.useMutation({
    onMutate: async (input) => {
      const queryKey = getQueryKey(trpc.printPresets.list);
      await queryClient.cancelQueries({ queryKey });
      const entries = queryClient.getQueriesData<CatalogPreset[]>({ queryKey });
      const snapshot: Array<{ key: QueryKey; data: CatalogPreset[] | undefined }> = entries.map(
        ([key, data]) => ({ key, data }),
      );
      for (const [key, data] of entries) {
        const next = applyOptimisticPresetReorder(data, input);
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
      utils.printPresets.list.invalidate();
    },
  });

  if (user) return trpcMutation as unknown as MutationLike<PresetReorderInput, { success: true }>;
  return makeAnonMutation((input: PresetReorderInput) =>
    anonymousStore.printPresets.reorder(input)
  );
}
