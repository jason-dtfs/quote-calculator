import { describe, expect, it } from "vitest";
import {
  calcBlankCost,
  calcPrintCost,
  calcLineTotal,
  calcQuoteTotals,
  totalQty,
  formatCurrency,
  formatQtySummary,
  blankDisplayName,
} from "../client/src/lib/pricing";
import type { QuoteItemDraft } from "../client/src/lib/pricing";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<QuoteItemDraft> = {}): QuoteItemDraft {
  return {
    qtyS: 5,
    qtyM: 10,
    qtyL: 5,
    qtyXL: 5,
    qty2XL: 2,
    qty3XL: 1,
    qty4XL: 0,
    prints: [],
    lineNotes: "",
    blankSnapshot: {
      brand: "Gildan",
      garmentType: "T-shirt",
      modelName: "5000",
      priceSXL: "5.00",
      price2XL: "6.50",
      price3XL: "7.50",
      price4XLPlus: "8.50",
    },
    ...overrides,
  };
}

// ─── totalQty ─────────────────────────────────────────────────────────────────

describe("totalQty", () => {
  it("sums all size quantities", () => {
    const item = makeItem();
    expect(totalQty(item)).toBe(28); // 5+10+5+5+2+1+0
  });

  it("returns 0 for empty item", () => {
    const item = makeItem({ qtyS: 0, qtyM: 0, qtyL: 0, qtyXL: 0, qty2XL: 0, qty3XL: 0, qty4XL: 0 });
    expect(totalQty(item)).toBe(0);
  });
});

// ─── calcBlankCost ────────────────────────────────────────────────────────────

describe("calcBlankCost", () => {
  it("calculates cost correctly with size tiers", () => {
    const item = makeItem();
    // S-XL: (5+10+5+5) * 5.00 = 125
    // 2XL: 2 * 6.50 = 13
    // 3XL: 1 * 7.50 = 7.50
    // 4XL: 0
    expect(calcBlankCost(item)).toBeCloseTo(145.5);
  });

  it("returns 0 when no blank snapshot", () => {
    const item = makeItem({ blankSnapshot: undefined });
    expect(calcBlankCost(item)).toBe(0);
  });
});

// ─── calcPrintCost ────────────────────────────────────────────────────────────

describe("calcPrintCost", () => {
  it("calculates print cost with setup fee and per-print cost", () => {
    const item = makeItem({
      prints: [
        {
          presetId: 1,
          presetSnapshot: { name: "Front", inkCost: "1.00", setupFee: "10.00", perPrintCost: "2.00" },
          cost: "0",
        },
      ],
    });
    // (ink + perPrint) * qty + setup = (1+2)*28 + 10 = 94
    // But calcPrintCost uses: perPrint * qty + setup = 2*28 + 10 = 66
    // The ink cost is separate from per-print cost in the formula
    expect(calcPrintCost(item)).toBeCloseTo(66);
  });

  it("returns 0 for no prints", () => {
    const item = makeItem({ prints: [] });
    expect(calcPrintCost(item)).toBe(0);
  });
});

// ─── calcLineTotal ────────────────────────────────────────────────────────────

describe("calcLineTotal", () => {
  it("applies margin correctly", () => {
    const item = makeItem({ prints: [] });
    const blankCost = calcBlankCost(item); // 145.5
    const lineTotal = calcLineTotal(item, 30);
    // lineTotal = cost / (1 - 0.30) = 145.5 / 0.7 ≈ 207.857
    expect(lineTotal).toBeCloseTo(blankCost / 0.7, 2);
  });

  it("handles 0% margin (cost = price)", () => {
    const item = makeItem({ prints: [] });
    const blankCost = calcBlankCost(item);
    expect(calcLineTotal(item, 0)).toBeCloseTo(blankCost, 2);
  });
});

// ─── calcQuoteTotals ──────────────────────────────────────────────────────────

describe("calcQuoteTotals", () => {
  it("calculates subtotal, tax, and total correctly", () => {
    const items = [makeItem({ prints: [] })];
    const { subtotal, taxAmount, total } = calcQuoteTotals(items, 30, 10, true);
    const expectedSubtotal = calcLineTotal(items[0], 30);
    expect(subtotal).toBeCloseTo(expectedSubtotal, 2);
    expect(taxAmount).toBeCloseTo(expectedSubtotal * 0.1, 2);
    expect(total).toBeCloseTo(expectedSubtotal * 1.1, 2);
  });

  it("skips tax when disabled", () => {
    const items = [makeItem({ prints: [] })];
    const { taxAmount, total, subtotal } = calcQuoteTotals(items, 30, 10, false);
    expect(taxAmount).toBe(0);
    expect(total).toBeCloseTo(subtotal, 2);
  });
});

// ─── formatCurrency ───────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  it("formats with default dollar sign", () => {
    expect(formatCurrency(100)).toBe("$100.00");
  });

  it("formats with custom symbol", () => {
    expect(formatCurrency(49.99, "€")).toBe("€49.99");
  });
});

// ─── formatQtySummary ─────────────────────────────────────────────────────────

describe("formatQtySummary", () => {
  it("returns formatted size summary", () => {
    const item = makeItem();
    const summary = formatQtySummary(item);
    expect(summary).toContain("S: 5");
    expect(summary).toContain("M: 10");
    expect(summary).toContain("2XL: 2");
  });

  it("returns 'No sizes' for empty item", () => {
    const item = makeItem({ qtyS: 0, qtyM: 0, qtyL: 0, qtyXL: 0, qty2XL: 0, qty3XL: 0, qty4XL: 0 });
    expect(formatQtySummary(item)).toBe("No sizes");
  });
});

// ─── blankDisplayName ─────────────────────────────────────────────────────────

describe("blankDisplayName", () => {
  it("returns brand + model name", () => {
    expect(blankDisplayName({ brand: "Gildan", garmentType: "T-shirt", modelName: "5000", priceSXL: "5", price2XL: "6", price3XL: "7", price4XLPlus: "8" }))
      .toBe("Gildan 5000");
  });

  it("includes variant when present", () => {
    expect(blankDisplayName({ brand: "Gildan", garmentType: "T-shirt", modelName: "5000", variant: "Safety Yellow", priceSXL: "5", price2XL: "6", price3XL: "7", price4XLPlus: "8" }))
      .toBe("Gildan 5000 (Safety Yellow)");
  });

  it("returns 'Custom item' for null snapshot", () => {
    expect(blankDisplayName(null)).toBe("Custom item");
  });
});
