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
import type { MigrationCounts } from "@/_core/hooks/useMigrateAnonData";

type Props = {
  open: boolean;
  counts: MigrationCounts;
  pending: boolean;
  onImport: () => void;
  onDiscard: () => void;
};

function formatCounts(counts: MigrationCounts): string {
  const parts: string[] = [];
  if (counts.blanks > 0) parts.push(`${counts.blanks} blank${counts.blanks === 1 ? "" : "s"}`);
  if (counts.presets > 0) parts.push(`${counts.presets} preset${counts.presets === 1 ? "" : "s"}`);
  if (counts.quotes > 0) parts.push(`${counts.quotes} quote${counts.quotes === 1 ? "" : "s"}`);
  if (counts.hasSettings) parts.push("shop settings");
  if (parts.length === 0) return "no items";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function AnonMigrationPrompt({ open, counts, pending, onImport, onDiscard }: Props) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Import your sandbox?</AlertDialogTitle>
          <AlertDialogDescription>
            We found {formatCounts(counts)} from before you signed in. Bring it into your account?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} onClick={onDiscard}>
            Discard
          </AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={onImport}>
            {pending ? "Importing…" : "Import"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
