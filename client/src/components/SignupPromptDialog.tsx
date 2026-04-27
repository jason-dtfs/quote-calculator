import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Optional: run before navigating to /signup or /login (e.g. stash a draft). */
  beforeNavigate?: () => void;
};

export function SignupPromptDialog({
  open,
  onOpenChange,
  title,
  description,
  beforeNavigate,
}: Props) {
  const [, setLocation] = useLocation();

  function go(path: "/signup" | "/login") {
    beforeNavigate?.();
    onOpenChange(false);
    setLocation(path);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <Button variant="outline" onClick={() => go("/login")}>
            Sign in
          </Button>
          <AlertDialogAction onClick={() => go("/signup")}>
            Create free account
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
