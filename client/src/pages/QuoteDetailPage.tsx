import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  BlankSnapshot,
  PrintSnapshot,
  QuoteItemDraft,
  STATUS_COLORS,
  STATUS_LABELS,
  blankDisplayName,
  formatCurrency,
  formatQtySummary,
  totalQty,
} from "@/lib/pricing";
import { DTFSTATION_LOGO_URL } from "@/lib/assets";
import {
  ArrowLeft,
  Check,
  Clipboard,
  Download,
  Edit2,
  FileText,
  Share2,
} from "lucide-react";
import { useParams, useLocation } from "wouter";
import { toast } from "sonner";
import jsPDF from "jspdf";

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const quoteId = parseInt(params.id);
  const [, setLocation] = useLocation();

  const { data: quote, isLoading, refetch } = trpc.quotes.get.useQuery({ id: quoteId });
  const { data: settings } = trpc.settings.get.useQuery();

  const updateStatusMutation = trpc.quotes.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); refetch(); },
  });

  const currencySymbol = settings?.currencySymbol ?? "$";

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto text-center py-20">
        <p className="text-muted-foreground">Quote not found.</p>
        <Button variant="link" onClick={() => setLocation("/")}>Back to Quotes</Button>
      </div>
    );
  }

  const items = (quote.items ?? []) as (typeof quote.items[number] & {
    blankSnapshot: BlankSnapshot | null;
    prints: { presetId?: number; presetSnapshot?: PrintSnapshot; cost?: string }[];
  })[];

  function buildClipboardText(): string {
    const lines: string[] = [];
    lines.push(`QUOTE — ${quote!.quoteNumber}`);
    if (quote!.customerName) lines.push(`Customer: ${quote!.customerName}`);
    if (quote!.customerEmail) lines.push(`Email: ${quote!.customerEmail}`);
    if (quote!.customerPhone) lines.push(`Phone: ${quote!.customerPhone}`);
    lines.push("");
    items.forEach((item, idx) => {
      lines.push(`Item ${idx + 1}: ${blankDisplayName(item.blankSnapshot)}`);
      lines.push(`  Sizes: ${formatQtySummary(item as unknown as QuoteItemDraft)}`);
      lines.push(`  Qty: ${totalQty(item as unknown as QuoteItemDraft)}`);
      if (item.prints?.length) {
        item.prints.forEach((p) => {
          lines.push(`  Print: ${(p.presetSnapshot as PrintSnapshot)?.name ?? "Print location"}`);
        });
      }
      if (item.lineNotes) lines.push(`  Note: ${item.lineNotes}`);
      lines.push(`  Line total: ${formatCurrency(parseFloat(item.lineTotal ?? "0"), currencySymbol)}`);
    });
    lines.push("");
    lines.push(`Subtotal: ${formatCurrency(parseFloat(quote!.subtotal ?? "0"), currencySymbol)}`);
    if (quote!.taxEnabled) {
      lines.push(`Tax (${quote!.taxRate}%): ${formatCurrency(parseFloat(quote!.taxAmount ?? "0"), currencySymbol)}`);
    }
    lines.push(`TOTAL: ${formatCurrency(parseFloat(quote!.total ?? "0"), currencySymbol)}`);
    if (quote!.notes) { lines.push(""); lines.push(`Notes: ${quote!.notes}`); }
    return lines.join("\n");
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(buildClipboardText())
      .then(() => toast.success("Quote copied to clipboard"))
      .catch(() => toast.error("Failed to copy"));
  }

  function exportCSV() {
    const rows: string[][] = [
      ["Quote Number", "Customer", "Email", "Phone", "Status", "Subtotal", "Tax", "Total", "Date"],
      [
        quote!.quoteNumber ?? "",
        quote!.customerName ?? "",
        quote!.customerEmail ?? "",
        quote!.customerPhone ?? "",
        quote!.status,
        quote!.subtotal ?? "0",
        quote!.taxAmount ?? "0",
        quote!.total ?? "0",
        new Date(quote!.createdAt).toLocaleDateString(),
      ],
      [],
      ["Item", "Blank", "Sizes", "Qty", "Print Locations", "Line Total"],
      ...items.map((item, idx) => [
        String(idx + 1),
        blankDisplayName(item.blankSnapshot),
        formatQtySummary(item as unknown as QuoteItemDraft),
        String(totalQty(item as unknown as QuoteItemDraft)),
        item.prints?.map((p) => (p.presetSnapshot as PrintSnapshot)?.name ?? "").join("; ") ?? "",
        formatCurrency(parseFloat(item.lineTotal ?? "0"), currencySymbol),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${quote!.quoteNumber}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  }

  async function exportPDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const margin = 20;
    let y = margin;

    // Header
    const logoSize = settings?.shopLogoSize ?? "medium";
    const logoH = logoSize === "small" ? 12 : logoSize === "large" ? 22 : 16;
    const logoW = logoH * 1.2;

    // Try to load shop logo
    if (settings?.shopLogo) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej();
          img.src = settings.shopLogo!;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        const pos = settings.shopLogoPosition ?? "top-left";
        const logoX = pos === "top-center" ? (pageW - logoW) / 2 : pos === "top-right" ? pageW - margin - logoW : margin;
        doc.addImage(dataUrl, "PNG", logoX, y, logoW, logoH);
      } catch {
        // logo load failed silently
      }
    }

    // Shop name
    if (settings?.shopName) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 30, 30);
      doc.text(settings.shopName, margin, y + 6);
      y += logoH + 4;
    } else {
      y += 10;
    }

    // Grayscale divider
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 12; // generous breathing room before QUOTE heading

    // Quote title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(20, 20, 20);
    doc.text("QUOTE", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(quote!.quoteNumber ?? "", margin, y + 6);
    doc.text(new Date(quote!.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), margin, y + 11);
    y += 18;

    // Customer info
    if (quote!.customerName || quote!.customerEmail || quote!.customerPhone) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text("BILL TO", margin, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      if (quote!.customerName) { doc.text(quote!.customerName, margin, y); y += 5; }
      if (quote!.customerEmail) { doc.text(quote!.customerEmail, margin, y); y += 5; }
      if (quote!.customerPhone) { doc.text(quote!.customerPhone, margin, y); y += 5; }
      y += 4;
    }

    // Items table header — grayscale fill, clear spacing before first row
    doc.setFillColor(235, 235, 235);
    doc.rect(margin, y, pageW - margin * 2, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text("ITEM", margin + 2, y + 5.5);
    doc.text("SIZES", margin + 80, y + 5.5);
    doc.text("QTY", margin + 120, y + 5.5);
    doc.text("TOTAL", pageW - margin - 2, y + 5.5, { align: "right" });
    y += 13; // extra spacing so first data row doesn't abut the header

    // Items — sizes column wraps, all grayscale
    // Column x positions
    const colItem = margin + 2;
    const colSizes = margin + 72;
    const colQty = margin + 122;
    const colTotal = pageW - margin - 2;
    const sizesColWidth = colQty - colSizes - 4; // available width for sizes text

    items.forEach((item) => {
      const name = blankDisplayName(item.blankSnapshot);
      const sizesRaw = formatQtySummary(item as unknown as QuoteItemDraft);
      const qty = String(totalQty(item as unknown as QuoteItemDraft));
      const lineTotal = formatCurrency(parseFloat(item.lineTotal ?? "0"), currencySymbol);
      const prints = item.prints?.map((p) => (p.presetSnapshot as PrintSnapshot)?.name ?? "").filter(Boolean).join(", ");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(20, 20, 20);

      // Sizes: split into lines that fit within the sizes column
      const sizeLines = doc.splitTextToSize(sizesRaw, sizesColWidth);
      const rowHeight = Math.max(5, sizeLines.length * 4.5);

      // Truncate item name if needed
      const nameStr = name.length > 32 ? name.substring(0, 30) + "…" : name;
      doc.text(nameStr, colItem, y);
      doc.text(sizeLines, colSizes, y);
      doc.text(qty, colQty, y);
      doc.text(lineTotal, colTotal, y, { align: "right" });
      y += rowHeight;

      if (prints) {
        doc.setFontSize(7.5);
        doc.setTextColor(110, 110, 110);
        doc.text(`Prints: ${prints}`, colItem + 2, y);
        y += 4;
      }
      if (item.lineNotes) {
        doc.setFontSize(7.5);
        doc.setTextColor(110, 110, 110);
        doc.text(`Note: ${item.lineNotes}`, colItem + 2, y);
        y += 4;
      }

      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.3);
      doc.line(margin, y + 1, pageW - margin, y + 1);
      y += 6;
    });

    y += 4;

    // Totals
    const totalsX = pageW - margin - 60;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text("Subtotal", totalsX, y);
    doc.text(formatCurrency(parseFloat(quote!.subtotal ?? "0"), currencySymbol), pageW - margin - 2, y, { align: "right" });
    y += 5;

    if (quote!.taxEnabled) {
      doc.text(`Tax (${quote!.taxRate}%)`, totalsX, y);
      doc.text(formatCurrency(parseFloat(quote!.taxAmount ?? "0"), currencySymbol), pageW - margin - 2, y, { align: "right" });
      y += 5;
    }

    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.5);
    doc.line(totalsX, y, pageW - margin, y);
    y += 8; // generous breathing room before TOTAL row

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text("TOTAL", totalsX, y);
    doc.text(formatCurrency(parseFloat(quote!.total ?? "0"), currencySymbol), pageW - margin - 2, y, { align: "right" });
    y += 10;

    // Notes
    if (quote!.notes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text("NOTES", margin, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      const noteLines = doc.splitTextToSize(quote!.notes ?? "", pageW - margin * 2);
      doc.text(noteLines, margin, y);
      y += noteLines.length * 5 + 4;
    }

    // Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.text("Generated with DTF Station Quote Calculator", pageW / 2, 287, { align: "center" });

    doc.save(`${quote!.quoteNumber}.pdf`);
    toast.success("PDF downloaded");
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold">{quote.quoteNumber}</h1>
              <Badge className={`text-xs px-2 py-0.5 font-medium border-0 ${STATUS_COLORS[quote.status]}`}>
                {STATUS_LABELS[quote.status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {new Date(quote.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => setLocation(`/quotes/${quoteId}/edit`)}
        >
          <Edit2 className="h-3.5 w-3.5" /> Edit
        </Button>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={copyToClipboard}>
          <Clipboard className="h-3.5 w-3.5" /> Copy
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
        <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90 text-white" onClick={exportPDF}>
          <FileText className="h-3.5 w-3.5" /> PDF
        </Button>
        <div className="ml-auto">
          <Select
            value={quote.status}
            onValueChange={(v) => updateStatusMutation.mutate({ id: quoteId, status: v as "draft" | "sent" | "accepted" })}
          >
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Customer info */}
      {(quote.customerName || quote.customerEmail || quote.customerPhone) && (
        <Card className="border-border/60 mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-0.5">
            {quote.customerName && <p className="text-sm font-medium">{quote.customerName}</p>}
            {quote.customerEmail && <p className="text-sm text-muted-foreground">{quote.customerEmail}</p>}
            {quote.customerPhone && <p className="text-sm text-muted-foreground">{quote.customerPhone}</p>}
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card className="border-border/60 mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={idx}>
                {idx > 0 && <Separator className="mb-4" />}
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{blankDisplayName(item.blankSnapshot)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatQtySummary(item as unknown as QuoteItemDraft)} · {totalQty(item as unknown as QuoteItemDraft)} units
                    </p>
                    {item.prints?.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {item.prints.map((p, pi) => (
                          <p key={pi} className="text-xs text-muted-foreground">
                            · {(p.presetSnapshot as PrintSnapshot)?.name ?? "Print location"}
                          </p>
                        ))}
                      </div>
                    )}
                    {item.lineNotes && (
                      <p className="text-xs text-muted-foreground italic mt-1">"{item.lineNotes}"</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatCurrency(parseFloat(item.lineTotal ?? "0"), currencySymbol)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Blank: {formatCurrency(parseFloat(item.blankCost ?? "0"), currencySymbol)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Print: {formatCurrency(parseFloat(item.printCost ?? "0"), currencySymbol)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card className="border-border/60 mb-4">
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(parseFloat(quote.subtotal ?? "0"), currencySymbol)}</span>
          </div>
          {quote.taxEnabled && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax ({quote.taxRate}%)</span>
              <span>{formatCurrency(parseFloat(quote.taxAmount ?? "0"), currencySymbol)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(parseFloat(quote.total ?? "0"), currencySymbol)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Margin: {quote.margin}%</p>
        </CardContent>
      </Card>

      {/* Notes */}
      {quote.notes && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-sm text-muted-foreground">{quote.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Footer branding */}
      <div className="flex items-center justify-center gap-2 mt-8 pb-4">
        <img src={DTFSTATION_LOGO_URL} alt="DTF Station" className="h-5 w-auto opacity-40" />
        <span className="text-xs text-muted-foreground/60">DTF Station Quote Calculator</span>
      </div>
    </div>
  );
}
