import type { QuoteItemDraft } from "./pricing";

export const PENDING_DRAFT_KEY = "qc:pending-quote-draft";

export type PendingQuoteDraft = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  margin: number;
  taxEnabled: boolean;
  taxRate: string;
  notes: string;
  items: QuoteItemDraft[];
};

export function stashDraft(draft: PendingQuoteDraft): void {
  try {
    localStorage.setItem(PENDING_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export function loadDraft(): PendingQuoteDraft | null {
  try {
    const raw = localStorage.getItem(PENDING_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingQuoteDraft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(PENDING_DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function hasDraft(): boolean {
  try {
    return localStorage.getItem(PENDING_DRAFT_KEY) !== null;
  } catch {
    return false;
  }
}
