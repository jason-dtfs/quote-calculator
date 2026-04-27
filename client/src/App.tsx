import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/_core/hooks/useAuth";
import { useMigrateAnonData } from "@/_core/hooks/useMigrateAnonData";
import { AnonMigrationPrompt } from "@/components/AnonMigrationPrompt";
import DashboardLayout from "@/components/DashboardLayout";
import { anonymousStore } from "@/lib/anonymousStore";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import QuotesPage from "./pages/QuotesPage";
import BlanksPage from "./pages/BlanksPage";
import PrintCostsPage from "./pages/PrintCostsPage";
import SettingsPage from "./pages/SettingsPage";
import QuoteBuilderPage from "./pages/QuoteBuilderPage";
import QuoteDetailPage from "./pages/QuoteDetailPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const MIGRATION_HANDLED_KEY = "qc:anon:v1:migration_handled";
const PENDING_EXPORT_KEY = "qc:pending-quote-export";

export type PendingQuoteExport = {
  quoteNumber: string;
  action: "copy" | "csv" | "pdf";
  capturedAt: number;
};

function usePWA() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // SW registration failed silently
        });
      });
    }
  }, []);
}

/**
 * Top-level orchestration that runs after authentication resolves:
 *  1. If `qc:pending-quote-export` is set, the user came back here from a
 *     locked Copy/CSV/PDF action. Silently migrate everything, redirect to
 *     the now-saved quote, and let QuoteDetailPage's `?autoExport=` handler
 *     fire the original action.
 *  2. Otherwise, if anon data exists and migration hasn't already been
 *     handled this account-session, show the import prompt. The user can
 *     accept (migrate everything) or discard (drop all anon data). Either
 *     way we set the handled flag so we don't re-prompt.
 */
function PostAuthCoordinator() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { migrate, getCounts } = useMigrateAnonData();

  const [promptOpen, setPromptOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [counts, setCounts] = useState({ blanks: 0, presets: 0, quotes: 0, hasSettings: false });

  // Guard against double-firing in StrictMode dev re-mounts.
  const ranForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    if (ranForUserRef.current === user.id) return;
    ranForUserRef.current = user.id;

    let cancelled = false;

    (async () => {
      // ── 1. Pending export-flow takes priority ──
      const pendingRaw = (() => {
        try {
          return localStorage.getItem(PENDING_EXPORT_KEY);
        } catch {
          return null;
        }
      })();

      if (pendingRaw) {
        try {
          const pendingExport = JSON.parse(pendingRaw) as PendingQuoteExport;
          const { quoteNumberToDbId } = await migrate();
          if (cancelled) return;
          const dbId = quoteNumberToDbId.get(pendingExport.quoteNumber);
          // Mark migration handled and clear localStorage (anon + ancillary keys).
          try {
            localStorage.setItem(MIGRATION_HANDLED_KEY, "true");
          } catch {
            /* ignore */
          }
          anonymousStore.clearAll();
          try {
            localStorage.removeItem(PENDING_EXPORT_KEY);
          } catch {
            /* ignore */
          }
          if (dbId) {
            setLocation(`/quotes/${dbId}?autoExport=${pendingExport.action}`);
          }
          toast.success("Welcome — your sandbox is now saved to your account.");
        } catch (err) {
          // On failure leave localStorage intact; user can retry next login.
          console.error("[PostAuth] Export-flow migration failed:", err);
          toast.error("Couldn't import your sandbox just yet. We'll try again next time.");
        }
        return;
      }

      // ── 2. General migration prompt ──
      let alreadyHandled = false;
      try {
        alreadyHandled = localStorage.getItem(MIGRATION_HANDLED_KEY) === "true";
      } catch {
        /* ignore */
      }
      if (alreadyHandled) return;

      if (!anonymousStore.hasAnyData()) {
        try {
          localStorage.setItem(MIGRATION_HANDLED_KEY, "true");
        } catch {
          /* ignore */
        }
        return;
      }

      setCounts(getCounts());
      setPromptOpen(true);
    })().catch((err) => {
      console.error("[PostAuth] coordinator error:", err);
    });

    return () => {
      cancelled = true;
    };
  }, [user, loading, migrate, getCounts, setLocation]);

  async function handleImport() {
    setPending(true);
    try {
      await migrate();
      anonymousStore.clearAll();
      try {
        localStorage.setItem(MIGRATION_HANDLED_KEY, "true");
      } catch {
        /* ignore */
      }
      setPromptOpen(false);
      toast.success("Sandbox imported.");
    } catch (err) {
      // Leave localStorage intact for retry
      console.error("[PostAuth] migration failed:", err);
      toast.error("Couldn't import your sandbox. We'll try again next time you log in.");
      setPromptOpen(false);
    } finally {
      setPending(false);
    }
  }

  function handleDiscard() {
    anonymousStore.clearAll();
    try {
      localStorage.setItem(MIGRATION_HANDLED_KEY, "true");
    } catch {
      /* ignore */
    }
    setPromptOpen(false);
    toast.success("Sandbox discarded.");
  }

  if (!user) return null;
  return (
    <AnonMigrationPrompt
      open={promptOpen}
      counts={counts}
      pending={pending}
      onImport={handleImport}
      onDiscard={handleDiscard}
    />
  );
}

function DashboardRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={QuotesPage} />
        <Route path="/quotes/new" component={QuoteBuilderPage} />
        <Route path="/quotes/:id/edit" component={QuoteBuilderPage} />
        <Route path="/quotes/:id" component={QuoteDetailPage} />
        <Route path="/blanks" component={BlanksPage} />
        <Route path="/print-costs" component={PrintCostsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  usePWA();

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <PostAuthCoordinator />
          <Switch>
            <Route path="/login" component={Login} />
            <Route path="/signup" component={Signup} />
            <Route>
              <DashboardRoutes />
            </Route>
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
