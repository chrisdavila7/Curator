# Active Directory-backed enrichment for Hand Receipt

Overview
- Adds an optional AD lookup to enrich two PDF fields when generating the “Blank Hand Receipt”.
- Source input: the staged “User/Location” free-text (on Check Out).
- If a user match is found in Entra ID (Microsoft Graph), map:
  - Department/Location = user.companyName
  - Supervisor = manager.displayName
- If unresolved or properties are missing, leave fields blank.

API: GET /api/directory/resolve
- Runtime: nodejs
- Dynamic: force-dynamic
- Cache: no-store

Request
- Headers:
  - Authorization: Bearer <user access token> (obtained client-side via MSAL; server exchanges with OBO for Graph)
- Query: ?query=<free-text>
  - Accepts email/UPN or display name substrings (allows wiggle room for typos via $filter startswith and fallback $search)

Responses
- 200 OK
  {
    "user": {
      "id": "...",
      "displayName": "...",
      "userPrincipalName": "...",
      "companyName": "Contoso Ltd", // optional
      "department": "Engineering"   // optional
    } | null,
    "manager": {
      "id": "...",
      "displayName": "Ada Lovelace",
      "userPrincipalName": "ada@contoso.com"
    } | null
  }
- 400 Bad Request: { "error": "Missing query" }
- 401 Unauthorized: { "error": "Missing Authorization" }
- 502 Bad Gateway: { "error": "Directory lookup failed" }

Behavior notes
- Match selection:
  - If query looks like UPN/email: try GET /users/{query}
  - Else fuzzy filter:
    - GET /users?$filter=startswith(displayName,'q') or startswith(userPrincipalName,'q')&$top=5
  - If still no candidates: fallback $search with ConsistencyLevel: eventual
    - GET /users?$search="displayName:q"&$top=5
  - Pick best match deterministically:
    1) exact UPN (case-insensitive)
    2) exact displayName (case-insensitive)
    3) startsWith(displayName)
    4) startsWith(userPrincipalName)
    5) first candidate
- Manager:
  - GET /users/{id}/manager?$select=id,displayName,userPrincipalName
  - Returns null if 404 (no manager)
- Privacy:
  - No data stored server-side; used transiently to populate the PDF

Client integration
- On /check-in-out, when “Generate Hand Receipt” is clicked:
  1) Use stagedOut[0].to as the query
  2) Call /api/directory/resolve
  3) If found:
     - adCompany = user.companyName
     - adSupervisor = manager.displayName
  4) Call generateBlankHandReceipt({ ..., adCompany, adSupervisor })
  5) If any value not found or errors occur: omit those fields (leave blank)

Mapping impact
- The mapping function for Blank Hand Receipt remains unchanged.
- The generator conditionally augments the field set:
  - "Department/Location" = adCompany (if provided and non-empty)
  - "Supervisor" = adSupervisor (if provided and non-empty)
- All other fields retain existing rules.

Permissions and consent
- Backend app registration (used for OBO) must have delegated scopes:
  - User.Read.All (user lookup)
  - Directory.Read.All (manager relationship)
- Admin consent required for delegated scopes.
- GRAPH_SCOPES remains default to https://graph.microsoft.com/.default (ensure the above scopes are granted on the app registration).
- Using $search on /users requires ConsistencyLevel: eventual header; ensure the application is allowed to use $search on directory objects (standard Graph behavior with the granted delegated scopes above).

Environment variables
- GRAPH_SCOPES (optional; default: https://graph.microsoft.com/.default)
- DEBUG_GRAPH=true to enable path/drive/user lookup diagnostics in server logs

Diagnostics
- DEBUG_GRAPH=true prints:
  - User lookup attempts (direct/filter/search variants)
  - Manager fetch attempt and outcome
- All API responses include Cache-Control: no-store

Tests
- tests/api-directory-resolve.spec.ts
  - Covers auth errors, missing query, success (user + manager), not found, and upstream error mapping
- tests/hand-receipt-ad-mapping.spec.ts
  - Verifies that when enrichment inputs are provided, the generated fields include Department/Location and Supervisor
  - Verifies omission when enrichment is absent

Acceptance criteria
- Given a staged Check Out with “User/Location” that matches an Entra ID user:
  - Department/Location is set to user.companyName
  - Supervisor is set to manager.displayName
  - If any value is missing or no user found, those fields remain blank
- Preview, Print, Download continue to function

Security
- OBO token exchange is used; no PII persisted
- Non-sensitive diagnostics only
