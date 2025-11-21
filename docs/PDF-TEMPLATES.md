PDF Templates: SharePoint Integration and API Contracts

Overview
- Templates are stored in SharePoint (Document Library) and fetched via Microsoft Graph using On-Behalf-Of (OBO) tokens.
- Client fills AcroForm PDFs with pdf-lib and can optionally upload generated PDFs back to SharePoint via an API.
- All endpoints are force-dynamic with Cache-Control: no-store to avoid caching sensitive content.
- Mock mode remains available but is disabled for staging/production per your instruction.

Environment Variables
Add these to .env.local (see .env.example for defaults):

Required
- SP_HOSTNAME=dssw.sharepoint.com
- SP_SITE_PATH=/sites/Inventory
- SP_TEMPLATES_DRIVE_ID=auto
- SP_TEMPLATES_FOLDER_PATH=/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FInventory%2FShared%20Documents%2F-%20Master%20Hand%20Receipts%20-&viewid=3bd7574d-0620-447a-beeb-bc0e24b692d7

Feature Flags
- USE_MOCK_TEMPLATES=false
- NEXT_PUBLIC_USE_MOCK_TEMPLATES=false
- ENABLE_SHAREPOINT_SAVE=true (enable POST /api/documents)

Optional
- UPLOAD_TARGET_FOLDER_PATH=/Shared Documents (default upload root if not provided)
- DEBUG_GRAPH=false (minimal logging for Graph calls)
- GRAPH_SCOPES=https://graph.microsoft.com/.default
- GRAPH_MAX_RETRIES=3

Notes on SP_TEMPLATES_FOLDER_PATH
- You may supply either:
  - A drive-relative path: /Templates or /- Master Hand Receipts -
  - A SharePoint UI “AllItems.aspx” URL with id=… (as provided). The implementation extracts the server-relative id and normalizes to a drive-relative path automatically.
- The provided value resolves to the folder “- Master Hand Receipts -” under Shared Documents.

Security Model
- OBO (delegated) continues to be used. The user’s API token is exchanged for a Microsoft Graph token server-side.
- Template bytes are streamed to the client with no-store headers.
- Uploads execute only when users explicitly POST to /api/documents.

API Contracts

1) GET /api/templates
- Purpose: List available template PDFs in the configured SharePoint folder
- Request headers:
  - Authorization: Bearer {userToken} (required when USE_MOCK_TEMPLATES=false)
- Response:
  - 200
    {
      "templates": [
        { "key": "asset-checkout-v1", "name": "asset-checkout-v1", "itemId": "...", "modified": "2024-06-01T00:00:00Z" }
      ]
    }
  - 401 when Authorization missing in real mode
- Headers: Cache-Control: no-store
- Key = filename without .pdf extension
- name currently mirrors key; can be refined to use a friendlier label later

2) GET /api/templates/{key}
- Purpose: Stream a single template by key from SharePoint
- Request headers:
  - Authorization: Bearer {userToken} (required when USE_MOCK_TEMPLATES=false)
- Response:
  - 200: application/pdf (raw bytes)
  - 404: { "error": "Template not found" } when item missing
  - 401: { "error": "Missing Authorization" } in real mode without Authorization
- Headers: Cache-Control: no-store, Content-Type: application/pdf

3) POST /api/documents (Save to SharePoint)
- Purpose: Upload a generated PDF to SharePoint
- Feature flag: ENABLE_SHAREPOINT_SAVE=true required
- Authorization: Bearer {userToken} required
- Supported payloads:
  A) application/octet-stream
     - Query params: fileName (required), assetId?, templateKey?
     - Body: raw PDF bytes
  B) application/json
     - Body: { fileName: string; assetId?: string; templateKey?: string; bytesBase64?: string }
- Behavior:
  - If UPLOAD_TARGET_FOLDER_PATH is unset, defaults to /Shared Documents.
  - If payload size >= 4 MiB, uses Graph Upload Session (chunked upload).
  - Otherwise, simple PUT /content.
- Responses:
  - 201: { id: string; webUrl?: string; eTag?: string }
  - 400: invalid input (e.g., missing fileName or missing bytes)
  - 401: missing Authorization
  - 404: feature disabled (ENABLE_SHAREPOINT_SAVE=false)
  - 415: unsupported content-type
  - 502: Graph error
- Headers: Cache-Control: no-store

Filenames and Conventions
- As requested: “{userLocation} {templateKey} UNSIGNED.pdf”
- Example: “HQ asset-checkout-v1 UNSIGNED.pdf”
- Typical template size < 500KB; typical upload < 1.5MB

Template Field Labels (for client filling)
- Employee 1, Date 1, Department/Location, Supervisor
- Asset Tag 1..5, Asset Name/Model 1..5, Serial Number 1..5, Replacement Cost 1..5
- Employee Name (Print), Date 2, CTS Department Representative, Date 3
- These labels should match AcroForm field names on the template PDFs. If the actual field names differ, ensure the mapping table is updated in the client PDF fill utility.

Implementation Notes

Lib Helpers (src/lib/graph/templates.ts)
- listTemplatesWithUserToken(userToken):
  - OBO -> Graph token
  - Resolve siteId and driveId (auto if SP_TEMPLATES_DRIVE_ID=auto)
  - Resolve folder path from SP_TEMPLATES_FOLDER_PATH (supports AllItems.aspx id= form)
  - List children, filter *.pdf, map to DTO
- getTemplateBytesWithUserToken(userToken, key):
  - GET /drives/{driveId}/root:{folder}/{key}.pdf:/content
  - Return ArrayBuffer
- uploadPdfWithUserToken(userToken, { fileName, bytes, targetFolderPath? }):
  - If bytes >= 4 MiB -> createUploadSession + PATCH chunks
  - Else -> PUT /content
  - Returns { id, webUrl, eTag? }

API Routes
- GET /api/templates and GET /api/templates/[key] respect USE_MOCK_TEMPLATES
- POST /api/documents requires ENABLE_SHAREPOINT_SAVE=true

Examples

List templates
curl -i -H "Authorization: Bearer {userToken}" http://localhost:3000/api/templates

Fetch a template PDF
curl -i -H "Authorization: Bearer {userToken}" http://localhost:3000/api/templates/asset-checkout-v1

Upload PDF (binary)
curl -i -X POST "http://localhost:3000/api/documents?fileName=HQ%20asset-checkout-v1%20UNSIGNED.pdf&assetId=1001&templateKey=asset-checkout-v1" \
  -H "Authorization: Bearer {userToken}" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @filled.pdf

Upload PDF (JSON base64)
node -e "const fs=require('fs');const b64=fs.readFileSync('filled.pdf').toString('base64');console.log(JSON.stringify({fileName:'HQ asset-checkout-v1 UNSIGNED.pdf',templateKey:'asset-checkout-v1',assetId:'1001',bytesBase64:b64}))" \
| curl -i -X POST http://localhost:3000/api/documents \
  -H "Authorization: Bearer {userToken}" \
  -H "Content-Type: application/json" \
  --data @-

Operational Notes
- No mock fallback in staging/production: set USE_MOCK_TEMPLATES=false and ensure SharePoint access works.
- The code emits minimal Graph errors (502) without leaking details; set DEBUG_GRAPH=true only when diagnosing.
- If a dedicated upload folder is decided later, set UPLOAD_TARGET_FOLDER_PATH, e.g. /Documents/Generated or /Documents/Generated/{assetId} (the per-asset subfolder scheme can be added easily).

Next Configuration Actions (per your inputs)
- Set these in .env.local:
  USE_MOCK_TEMPLATES=false
  NEXT_PUBLIC_USE_MOCK_TEMPLATES=false
  ENABLE_SHAREPOINT_SAVE=true
  SP_HOSTNAME=dssw.sharepoint.com
  SP_SITE_PATH=/sites/Inventory
  SP_TEMPLATES_DRIVE_ID=auto
  SP_TEMPLATES_FOLDER_PATH=/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FInventory%2FShared%20Documents%2F-%20Master%20Hand%20Receipts%20-&viewid=3bd7574d-0620-447a-beeb-bc0e24b692d7
  UPLOAD_TARGET_FOLDER_PATH=/Shared Documents (or omit to use default)
- Confirm the SharePoint folder “- Master Hand Receipts -” contains the PDFs to be listed and fetched.
- When you later select a dedicated upload folder, set UPLOAD_TARGET_FOLDER_PATH accordingly.

Testing
- New tests:
  - tests/api-templates-sharepoint.spec.ts
  - tests/api-documents-upload.spec.ts
- Both suites mock Graph helpers and verify:
  - List/fetch behaviors with 401/404, headers, and PDF signature “%PDF”
  - Upload behaviors for small and large files (upload session path), with both binary and base64 JSON payloads, and proper error responses
