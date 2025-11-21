# Hand Receipt Grouping and Multi-PDF Generation

Overview
- When the “Generate Hand Receipt” button is selected on /check-in-out, staged Check Out assets are grouped by their User/Location (“to”) value.
- The system generates exactly one PDF per group of up to five assets for the same User/Location. If more than five assets exist for a user, additional PDFs are created for the overflow.
- Each asset fills exactly one set of the numbered slot fields (1–5) in the PDF: Asset Tag (x), Asset Name/Model (x), Serial Number (x), Replacement Cost (x).
- Active Directory (AD) enrichment (Department/Location and Supervisor) is resolved once per unique User/Location and reused for all PDFs belonging to that group.
- The UI previews the generated PDFs sequentially in the modal dialog: spinner while generating → first preview → on close, the next preview is shown until exhausted.

Behavior
1) Group by User/Location
- Input: stagedOut: Array<{ asset: number; model: string; serial: string; to: string }>
- Group by “to” preserving the order in which each User/Location first appears.
- Within each group, maintain asset ordering as staged.

2) Chunk into up to five assets per PDF
- Each group is chunked into arrays of up to five assets. Example:
  - 7 assets for “John Doe” → 2 PDFs (5 + 2)
  - 3 assets for “Jane Roe” → 1 PDF (3)

3) AD enrichment resolved once per group
- For each unique User/Location value in stagedOut, perform one request to GET /api/directory/resolve?query={userLocation}.
- If resolved:
  - Department/Location = user.companyName
  - Supervisor = manager.displayName
- If the resolve fails or values are missing, enrichment fields are left blank for all PDFs in that group.
- Field-name aliasing ensures internal AcroForm name variants are populated (e.g., “Department/Location”, “Department / Location”, “Supervisor Name”, “Manager”, etc.).

4) Field mapping per PDF
- For each chunk, call generateBlankHandReceipt(...) with:
  - assets: the chunk’s assets (up to 5)
  - employeeName: the group’s User/Location string
  - ctsRepName: the current user’s display name
  - date: normalized to MM/DD/YYYY by the generator
  - adCompany: optional (from user.companyName), if available
  - adSupervisor: optional (from manager.displayName), if available
- mapToBlankHandReceipt fills:
  - Employee Name 1 = employeeName
  - Date 1 = date
  - Asset Tag/Name-Model/Serial for slots 1..5 (only those present in the chunk)
  - Replacement Cost (1..5) intentionally left blank
  - CTS Department Representative = ctsRepName
  - Date 3 = date
- The generator conditionally augments alias fields for Department/Location and Supervisor if enrichment is provided.

5) UI preview sequencing
- The dialog opens immediately with a spinner during generation.
- Once all PDFs are generated, the first PDF is displayed in the iframe preview.
- When the user closes the dialog, if more PDFs remain, the dialog re-opens automatically with the next PDF until all are shown.

Edge cases and guarantees
- If stagedOut is empty, the existing “No item staged” toast is shown; no PDFs are generated.
- If a group resolves enrichment successfully while another group fails, only the resolved group’s PDFs receive AD values; others remain blank.
- Dates are normalized to MM/DD/YYYY regardless of input format; unknown formats fallback to today’s date.
- Only fields required by a given chunk are set; slots beyond the number of assets in the chunk are omitted (not written).

Implementation references
- Grouping and chunking logic: src/lib/pdf/group-by-user-location.ts (groupAndChunk)
- Orchestration: src/lib/pdf/orchestrate-hand-receipts.ts (orchestrateHandReceipts)
- PDF generation: src/lib/pdf/generate-hand-receipt.ts (date normalization, field aliasing for enrichment)
- Mapping: src/lib/pdf/mappings/blank-hand-receipt.ts (pure mapping for Blank Hand Receipt)
- UI wiring: src/app/check-in-out/page.tsx (sequential preview queue)

Tests
- tests/hand-receipt-grouping.spec.ts validates grouping and chunking behavior
- tests/generate-hand-receipt-multi.spec.ts validates one resolve per group, correct slot usage, enrichment behavior, Replacement Cost left blank, and output ordering

Acceptance criteria
- One PDF per User/Location per up to five assets; overflow assets produce additional PDFs for that User/Location.
- Multiple User/Location values produce multiple PDFs as required.
- Each asset uses exactly one numbered slot (1–5) within a PDF; no duplication or overlap.
- AD fields appear when resolvable; otherwise remain blank.
- Dates are MM/DD/YYYY.
