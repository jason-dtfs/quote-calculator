import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { STATUS_COLORS, STATUS_LABELS, formatCurrency } from "@/lib/pricing";
import { Copy, Eye, FileText, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useState } from "react";
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

export default function QuotesPage() {
  const [, setLocation] = useLocation();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Calling settings.get triggers the first-login seed (blanks + presets)
  trpc.settings.get.useQuery();
  const { data: quotes, isLoading, refetch } = trpc.quotes.list.useQuery();
  const deleteMutation = trpc.quotes.delete.useMutation({
    onSuccess: () => { toast.success("Quote deleted"); refetch(); },
    onError: () => toast.error("Failed to delete quote"),
  });
  const duplicateMutation = trpc.quotes.duplicate.useMutation({
    onSuccess: (data) => {
      toast.success(`Quote duplicated as ${data.quoteNumber}`);
      refetch();
    },
    onError: () => toast.error("Failed to duplicate quote"),
  });
  const updateStatusMutation = trpc.quotes.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); refetch(); },
  });

  const filtered = quotes?.filter((q) => statusFilter === "all" || q.status === statusFilter) ?? [];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Quotes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {quotes?.length ?? 0} total quote{quotes?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          onClick={() => setLocation("/quotes/new")}
          className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Quote</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Filter */}
      {(quotes?.length ?? 0) > 0 && (
        <div className="mb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (quotes?.length ?? 0) === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold mb-2">No quotes yet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Create your first quote to start pricing custom apparel orders for your customers.
          </p>
          <Button
            onClick={() => setLocation("/quotes/new")}
            className="bg-primary hover:bg-primary/90 text-white gap-2"
          >
            <Plus className="h-4 w-4" />
            Create your first quote
          </Button>
        </div>
      )}

      {/* Filtered empty */}
      {!isLoading && (quotes?.length ?? 0) > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">No quotes with status "{statusFilter}"</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setStatusFilter("all")}>
            Clear filter
          </Button>
        </div>
      )}

      {/* Quote list */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((quote) => (
            <Card
              key={quote.id}
              className="border-border/60 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group"
              onClick={() => setLocation(`/quotes/${quote.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">
                        {quote.quoteNumber}
                      </span>
                      <Badge className={`text-xs px-2 py-0.5 font-medium border-0 ${STATUS_COLORS[quote.status]}`}>
                        {STATUS_LABELS[quote.status]}
                      </Badge>
                    </div>
                    {quote.customerName && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {quote.customerName}
                        {quote.customerEmail && ` · ${quote.customerEmail}`}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(quote.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-base font-semibold text-foreground">
                      {formatCurrency(parseFloat(quote.total ?? "0"))}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/quotes/${quote.id}`); }}>
                          <Eye className="mr-2 h-4 w-4" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateMutation.mutate({ id: quote.id }); }}>
                          <Copy className="mr-2 h-4 w-4" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: quote.id, status: "draft" }); }}
                          disabled={quote.status === "draft"}
                        >
                          Mark as Draft
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: quote.id, status: "sent" }); }}
                          disabled={quote.status === "sent"}
                        >
                          Mark as Sent
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: quote.id, status: "accepted" }); }}
                          disabled={quote.status === "accepted"}
                        >
                          Mark as Accepted
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); setDeleteId(quote.id); }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete quote?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The quote and all its items will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => { if (deleteId) deleteMutation.mutate({ id: deleteId }); setDeleteId(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
