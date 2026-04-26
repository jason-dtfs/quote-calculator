import { authClient } from "@/lib/auth-client";
import { useLocation } from "wouter";

export function useAuth() {
  const session = authClient.useSession();
  const [, setLocation] = useLocation();

  const logout = async () => {
    await authClient.signOut();
    setLocation("/");
  };

  return {
    user: session.data?.user ?? null,
    loading: session.isPending,
    error: session.error ?? null,
    isAuthenticated: !!session.data?.user,
    logout,
    refresh: () => session.refetch(),
  };
}
