# Quote Calculator — TODO

## Phase 1: Setup
- [x] Initialize project scaffold (web-db-user)
- [x] Configure global styles (Poppins font, teal accent, CSS variables)
- [x] Install additional dependencies (jspdf, papaparse)
- [x] Write todo.md

## Phase 2: Database & Backend
- [x] Extend users table (shopName, shopLogo, defaultTaxRate, defaultMargin, currencySymbol, marketingOptIn, plan, seedCompleted)
- [x] Create blanks table (brand, garmentType, modelName, variant, priceSXL, price2XL, price3XL, price4XLPlus)
- [x] Create print_presets table (name, inkCost, setupFee, perPrintCost)
- [x] Create quotes table (customerName, customerPhone, customerEmail, status, margin, taxRate, taxEnabled, notes, subtotal, taxAmount, total, quoteNumber)
- [x] Create quote_items table (blankId, blankSnapshot, qtyS/M/L/XL/2XL/3XL/4XL, lineNotes, lineTotal, blankCost, printCost)
- [x] Create quote_item_prints table (presetId, presetSnapshot, cost)
- [x] Generate and apply DB migrations
- [x] Backend: blanks CRUD router
- [x] Backend: print presets CRUD router
- [x] Backend: quotes CRUD router (create, list, get, update, delete, duplicate, updateStatus)
- [x] Backend: settings router (get/update user settings, uploadLogo)
- [x] Backend: seed default blanks + print presets on first login

## Phase 3: Auth & Layout
- [x] Auth-gated routing (redirect unauthenticated users to login)
- [x] Dashboard layout with sidebar (Quotes, Blanks Library, Print Costs, Settings)
- [x] Mobile sidebar (hamburger menu / drawer)
- [x] PWA manifest.json
- [x] Service worker registration

## Phase 4: Blanks Library
- [x] Blanks list page with search and filter (brand, garment type)
- [x] Add blank modal/form
- [x] Edit blank modal/form
- [x] Delete blank with confirmation
- [x] CSV import (bulk add)
- [x] Preload 10 starter blanks on first login

## Phase 5: Print Cost Presets
- [x] Print presets list page
- [x] Add preset form
- [x] Edit preset form
- [x] Delete preset with confirmation
- [x] Preload 5 default presets on first login

## Phase 6: Quote Builder
- [x] New quote flow — add item (select blank, size breakdown)
- [x] Assign print locations to item
- [x] Add line-item notes
- [x] Multi-item support (add another item)
- [x] One-off custom blank support

## Phase 7: Pricing & Output
- [x] Pricing screen: margin slider (10–80%, 5% steps)
- [x] Tax toggle + tax rate input
- [x] Customer info fields (name, phone, email)
- [x] Live total calculation (blank cost, print cost, margin, subtotal, tax, total)
- [x] PDF export (customer-facing, shop logo, itemized)
- [x] CSV export
- [x] Copy to clipboard (plain text)

## Phase 8: Quote History & Settings
- [x] Quote history list (status: draft, sent, accepted)
- [x] View quote detail
- [x] Duplicate quote
- [x] Settings page: shop name, logo upload, default tax, default margin, currency symbol
- [x] Logo size + position controls for PDF
- [x] Account info display (via OAuth — show info only)
- [x] Marketing opt-in toggle

## Phase 9: Polish & Tests
- [x] Empty states for quotes, blanks, presets
- [x] Mobile-first responsive review
- [x] Smooth transitions and micro-interactions
- [x] Footer: "Powered by DTF Station" link
- [x] Vitest unit tests (18 passing)
- [x] Final checkpoint

## Fixes (post-launch)
- [x] PDF: remove all teal/color — grayscale only (black, white, gray)
- [x] PDF: fix column header / first data row overlap — add vertical spacing
- [x] Size format: change "5S 10M" → "S: 5  M: 10" in formatQtySummary (pricing.ts)
- [x] Size format: apply new format in PDF with line-wrapping support in SIZES column
