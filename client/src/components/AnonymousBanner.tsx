import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const DISMISS_KEY = "qc:anon:v1:banner_dismissed";

/**
 * Sticky-top banner for anonymous users. Pushes content down (not absolute or
 * fixed) — sits above the main scroll content, below any nav/header. Dismissal
 * persists in localStorage and survives reloads but is reset by the migration
 * cleanup on first authed page load.
 */
export function AnonymousBanner() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "true";
    } catch {
      return false;
    }
  });

  // If the user logs out we don't auto-restore the banner — once dismissed in
  // a session, stays dismissed for the browser. (Banner state syncs via
  // localStorage so multi-tab views agree.)
  useEffect(() => {
    if (user) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === DISMISS_KEY) setDismissed(e.newValue === "true");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [user]);

  if (loading || user || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div className="border-b border-primary/20 bg-primary/10 px-4 py-2 flex items-center gap-3">
      <p className="text-sm text-foreground flex-1">
        Try the calculator freely. Create an account when you're ready to keep your quotes and settings.
      </p>
      <Button
        size="sm"
        onClick={() => setLocation("/signup")}
        className="bg-primary hover:bg-primary/90 text-white shrink-0"
      >
        Create account
      </Button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
