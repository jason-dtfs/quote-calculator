import { toast } from "sonner";
import { useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Returns a function that fires the right success toast on a save action:
 * - authed users: a normal "Saved" toast with the caller's message
 * - anonymous users: the soft "Saved here for now" prompt with a Create-account action
 *
 * Per the Change 4 spec: only fires on explicit user-initiated saves, never on autosave.
 */
export function useNotifySaved() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return useCallback(
    (authedMessage: string) => {
      if (user) {
        toast.success(authedMessage);
        return;
      }
      toast.success("Saved here for now.", {
        description: "Create an account to keep it for next time.",
        action: {
          label: "Create account",
          onClick: () => setLocation("/signup"),
        },
      });
    },
    [user, setLocation]
  );
}

/**
 * Returns a function for mutation onError handlers. Promotes a
 * StorageQuotaError (from anonymous-mode localStorage writes) to a friendly
 * "Browser storage full" toast with a Create-account CTA. Falls back to the
 * caller's default message for any other error.
 */
export function useNotifyMutationError() {
  const [, setLocation] = useLocation();

  return useCallback(
    (err: Error, defaultMessage: string) => {
      if (err.name === "StorageQuotaError") {
        toast.error("Browser storage full.", {
          description: "Sign up to keep your work.",
          action: {
            label: "Create account",
            onClick: () => setLocation("/signup"),
          },
        });
        return;
      }
      toast.error(defaultMessage);
    },
    [setLocation]
  );
}
