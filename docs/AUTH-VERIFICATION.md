# Verifying Authentication (MSAL + Next.js)

This project uses MSAL for Azure AD authentication on the client and optional JWT verification plus On-Behalf-Of (OBO) flow on the server for API calls to Microsoft Graph/SharePoint.

By default, local dev runs in mock mode (no Azure required). Follow the steps below to test real sign-in and validate tokens end-to-end.

## 1) Prerequisites (Azure AD App Registrations)

You need two Azure AD apps:

1) Frontend SPA (public client)
   - Redirect URI: http://localhost:3000/auth/callback
   - Expose no client secret
   - Grant delegated permissions to your protected API scope (see below)

2) Backend API (confidential client)
   - Expose an API scope for delegated access (e.g., api://<BACKEND_APP_ID>/access_as_user)
   - Create a client secret
   - If calling Microsoft Graph via OBO, ensure appropriate Graph delegated permissions are consented (e.g., Sites.Read.All, Files.Read.All, etc., as required by features)

Note: Scope naming can vary (e.g., api://<BACKEND_APP_ID>/user_impersonation). Use the exact scope string you configured.

## 2) Environment Configuration

Edit `.env.local` and set values for real auth:

```
# Turn off mock mode
USE_MOCK_INVENTORY=false
NEXT_PUBLIC_USE_MOCK_INVENTORY=false

# Tenant (GUID or 'common' if multi-tenant)
NEXT_PUBLIC_AZURE_TENANT_ID=<TENANT_GUID_OR_common>
AZURE_TENANT_ID=<TENANT_GUID_OR_common>

# Frontend SPA (public client) app id
NEXT_PUBLIC_AZURE_FRONTEND_CLIENT_ID=<SPA_CLIENT_ID>

# SPA redirect URI
NEXT_PUBLIC_AZURE_REDIRECT_URI=http://localhost:3000/auth/callback

# Delegated API scope used by the SPA for loginRedirect/acquireToken
# Example: api://<BACKEND_APP_ID>/access_as_user
NEXT_PUBLIC_AZURE_API_SCOPE=api://<BACKEND_APP_ID>/access_as_user
AZURE_API_SCOPE=api://<BACKEND_APP_ID>/access_as_user

# Optional: Turn on server-side JWT verification (recommended for real auth)
AZURE_VERIFY_JWT=true

# Backend confidential client (required for JWT verification and OBO exchange)
AZURE_BACKEND_CLIENT_ID=<BACKEND_APP_ID>
AZURE_BACKEND_CLIENT_SECRET=<BACKEND_CLIENT_SECRET>

# Graph default scope and tunables (keep defaults unless you know you need changes)
GRAPH_SCOPES=https://graph.microsoft.com/.default
```

Save the file and restart the dev server:
```
npm run dev
```

## 3) End-to-End Sign-In Test (Browser)

1. Navigate to http://localhost:3000
   - You should be redirected to Microsoft sign-in and then back to `/auth/callback`, and finally to your original route (e.g., `/dashboard`).

2. Validate MSAL client state via DevTools
   - We expose the MSAL instance in dev at `window.msalPca`.
   - Open the browser console and run:
     ```js
     // Check current account
     window.msalPca.getActiveAccount()
     // Or list all cached accounts
     window.msalPca.getAllAccounts()
     ```

3. Verify access token acquisition
   - Use the exact scope you configured in `.env.local`:
     ```js
     const scope = "<your scope>"; // e.g., "api://<BACKEND_APP_ID>/access_as_user"
     const account = window.msalPca.getActiveAccount();
     const res = await window.msalPca.acquireTokenSilent({ scopes: [scope], account });
     res.accessToken // should be a non-empty string (JWT)
     ```

4. Manually test the protected API using the token
   - Example from the console:
     ```js
     const token = res.accessToken;
     const r = await fetch("/api/inventory", {
       headers: { Authorization: `Bearer ${token}` }
     });
     r.status // expect 200
     await r.json()
     ```
   - If `AZURE_VERIFY_JWT=true`, the API will validate the token audience against your backend app id. A mismatch will return 401.

## 4) cURL Test (Optional)

You can also test the API outside the browser by pasting the token:
```
curl -i ^
  -H "Authorization: Bearer <PASTE_ACCESS_TOKEN_HERE>" ^
  http://localhost:3000/api/inventory
```
Expected: `HTTP/1.1 200 OK` with JSON body.  
If you see 401 with `Invalid or unauthorized token`, check your audience (`aud`) claim and scope string.

## 5) Common Pitfalls and Fixes

- Blank page or immediate redirect loops:
  - Ensure `USE_MOCK_INVENTORY=false` and `NEXT_PUBLIC_USE_MOCK_INVENTORY=false` for real auth.
  - The landing page redirects to `/dashboard` only when authenticated or in mock mode.

- “Missing API scope” error in UI:
  - Set `NEXT_PUBLIC_AZURE_API_SCOPE` (and optionally `AZURE_API_SCOPE`) to your delegated scope string.

- 401 from API when `AZURE_VERIFY_JWT=true`:
  - The token’s audience must match your backend app id (or `api://<appId>`). Confirm your SPA is requesting the correct scope and your backend `AZURE_BACKEND_CLIENT_ID` is set.

- MSAL “redirect URI mismatch”:
  - Ensure the SPA app registration has `http://localhost:3000/auth/callback` configured.

- OBO/token exchange failures (server logs show OBO or Graph errors):
  - Ensure `AZURE_BACKEND_CLIENT_ID`, `AZURE_BACKEND_CLIENT_SECRET`, and `AZURE_TENANT_ID` are set.
  - Confirm your backend app has consented delegated Graph permissions if your features query Graph.

## 6) Optional Diagnostics

- Set `DEBUG_GRAPH=true` in `.env.local` to add diagnostic response headers (e.g., `X-Graph-Retries`, `X-Graph-Duration`) on API responses that call Graph.

- Check `/auth/callback` behavior:
  - The page shows “Completing sign-in…” while finishing MSAL redirect flow and then takes you to your saved route.

## 7) Reset to Mock Mode (No Azure)

If you only need the UI and mock data:
```
USE_MOCK_INVENTORY=true
NEXT_PUBLIC_USE_MOCK_INVENTORY=true
AZURE_VERIFY_JWT=false
```
Restart `npm run dev` and the app will run without Azure sign-in.
