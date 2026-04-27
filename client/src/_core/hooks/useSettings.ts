import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { anonymousStore, type AnonSettings } from "@/lib/anonymousStore";

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

// The shape returned by useSettings(). For authed users it's the wider drizzle
// User row; for anon it's our local AnonSettings. Both expose the fields pages
// actually read (shopName, shopLogo, *Margin, *TaxRate, currencySymbol,
// shopLogoSize, shopLogoPosition, marketingOptIn).
export type SettingsView = AnonSettings & {
  // Authed user rows have additional fields (id, email, etc.) — we don't
  // narrow the type here; pages only access the subset.
  [extra: string]: unknown;
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useSettings(): QueryLike<SettingsView | null> {
  const { user } = useAuth();
  const trpcQuery = trpc.settings.get.useQuery(undefined, { enabled: !!user });
  const anonQuery = useAnonQuery<SettingsView | null>(
    () => anonymousStore.settings.get() as SettingsView,
    user ? "authed" : "anon"
  );
  if (user) {
    return {
      data: trpcQuery.data as SettingsView | null | undefined,
      isLoading: trpcQuery.isLoading,
      refetch: () => void trpcQuery.refetch(),
    };
  }
  return anonQuery;
}

export type SettingsUpdateInput = {
  shopName?: string;
  shopLogoSize?: "small" | "medium" | "large";
  shopLogoPosition?: "top-left" | "top-center" | "top-right";
  defaultTaxRate?: string;
  defaultMargin?: number;
  currencySymbol?: string;
  marketingOptIn?: boolean;
};

export function useUpdateSettings(): MutationLike<SettingsUpdateInput, { success: true }> {
  const { user } = useAuth();
  const trpcMutation = trpc.settings.update.useMutation();
  if (user) return trpcMutation as unknown as MutationLike<SettingsUpdateInput, { success: true }>;
  return makeAnonMutation((input: SettingsUpdateInput) => {
    anonymousStore.settings.update(input as Partial<AnonSettings>);
    return { success: true } as const;
  });
}

export type UploadLogoInput = { base64: string; mimeType: string; fileName: string };

/**
 * Upload-logo result shape:
 *  - authed: { key } — the storage key, frontend builds URL via `/api/uploads/${key}`
 *  - anon:   { key } where the value is a `data:` URL (callers detect via startsWith("data:"))
 *
 * Centralising the discriminator on the consumer side (a `startsWith("data:")` check) means
 * pages don't have to branch on auth state for the success handler.
 */
export function useUploadLogo(): MutationLike<UploadLogoInput, { key: string }> {
  const { user } = useAuth();
  const trpcMutation = trpc.settings.uploadLogo.useMutation();
  if (user) return trpcMutation as unknown as MutationLike<UploadLogoInput, { key: string }>;
  return makeAnonMutation((input: UploadLogoInput) => {
    const { dataUrl } = anonymousStore.settings.uploadLogo({
      base64: input.base64,
      mimeType: input.mimeType,
    });
    return { key: dataUrl };
  });
}
