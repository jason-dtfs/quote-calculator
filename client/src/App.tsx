import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
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
import { useEffect } from "react";

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
