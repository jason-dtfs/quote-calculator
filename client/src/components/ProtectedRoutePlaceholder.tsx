import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useLocation } from "wouter";

type Props = {
  title: string;
  description: string;
};

export function ProtectedRoutePlaceholder({ title, description }: Props) {
  const [, setLocation] = useLocation();
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">{description}</p>
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
          <Button
            onClick={() => setLocation("/login")}
            variant="outline"
            className="flex-1"
          >
            Sign in
          </Button>
          <Button
            onClick={() => setLocation("/signup")}
            className="flex-1 bg-primary hover:bg-primary/90 text-white"
          >
            Create free account
          </Button>
        </div>
      </div>
    </div>
  );
}
