import { useState } from "react";
import { useLocation } from "wouter";
import { authClient } from "@/lib/auth-client";
import { hasDraft } from "@/lib/quoteDraft";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { X } from "lucide-react";

export default function Signup() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
      marketingOptIn,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "Sign up failed");
      return;
    }
    setLocation(hasDraft() ? "/quotes/new" : "/");
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-sm border-border/60 relative">
        <button
          type="button"
          onClick={() => setLocation("/")}
          aria-label="Close"
          className="absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
        <CardHeader>
          <CardTitle className="text-xl">Create your account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div className="flex items-start gap-2.5 pt-1">
              <Checkbox
                id="marketing"
                checked={marketingOptIn}
                onCheckedChange={(v) => setMarketingOptIn(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="marketing" className="text-sm font-normal leading-relaxed cursor-pointer">
                Email me product updates and printing tips from DTF Station.
              </Label>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating account..." : "Create account"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <a href="/login" className="text-primary hover:underline font-medium">
                Sign in
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
