This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-building) for more details.

## Inventory Options Endpoints

These backend endpoints power the dropdowns in the Asset Page Edit Menu.

- GET /api/inventory/options/models
  - Returns distinct model strings from the SharePoint List: { models: string[] }
  - Query: search? (substring filter), top? (default 50, max 200)
  - Implementation: scans list items for the free‑text Model field and caches results for a short TTL.
  - Cache: MODELS_CACHE_TTL_SECONDS (default 900s). Cache automatically invalidated after item PATCH/POST that sets a model.

- GET /api/inventory/options/users
  - Directory search via Microsoft Graph /users with $search (ConsistencyLevel: eventual).
  - Returns: { users: Array<{ id, displayName?, mail?, userPrincipalName? }> }
  - Query: search (required, min 2 chars), top? (default 20, max 50)
  - Requires delegated scope: User.ReadBasic.All (admin consent). Client should debounce (e.g., 250ms).

- GET /api/inventory/options/locations
  - Static list provided by the business: { locations: string[] }
  - Query: search? (substring filter), top? (optional)
  - Order preserved to match the provided list.

Mock mode: when USE_MOCK_INVENTORY=true, endpoints return data without auth and derive models/users from mock data.

### Example (mock mode)
```bash
curl 'http://localhost:3000/api/inventory/options/models?search=Dell&top=5'
curl 'http://localhost:3000/api/inventory/options/users?search=Alex&top=5'
curl 'http://localhost:3000/api/inventory/options/locations?search=hou'
```

### Example (live)
```bash
# Replace $TOKEN with a valid user bearer token
curl -H "Authorization: Bearer $TOKEN" 'http://localhost:3000/api/inventory/options/models?top=50'
curl -H "Authorization: Bearer $TOKEN" 'http://localhost:3000/api/inventory/options/users?search=jane&top=10'
curl -H "Authorization: Bearer $TOKEN" 'http://localhost:3000/api/inventory/options/locations'
```

## Auth and Permissions

- Live mode requires Authorization: Bearer <token> on all endpoints.
- Optional server-side JWT verification when AZURE_VERIFY_JWT=true.
- Azure App Registration (delegated permissions):
  - Sites.ReadWrite.All (items CRUD already used by create/update/delete)
  - User.ReadBasic.All (needed for /users search)
  - Note: Columns management (Sites.Manage.All) is out of scope here and can be added later if needed.

GRAPH_SCOPES defaults to https://graph.microsoft.com/.default; ensure your app registration has the above delegated permissions and admin consent.

## Environment Variables

- SP_HOSTNAME: SharePoint hostname, e.g. contoso.sharepoint.com
- SP_SITE_PATH: Site path, e.g. /sites/Inventory
- SP_LIST_ID_OR_NAME: Target list id or name
- USE_MOCK_INVENTORY: "true" to serve mock data without auth (test/dev)
- USE_MOCK_INVENTORY_WRITE: "true" to simulate writes without Graph
- GRAPH_MAX_RETRIES: Optional retry count for Graph calls (default 3)
- MODELS_CACHE_TTL_SECONDS: TTL for models options cache (default 900)
- AZURE_VERIFY_JWT: "true" to enforce JWT verification for API tokens
- GRAPH_SCOPES: Space/comma separated scopes to request via OBO (default .default)

## Testing

Run the full test suite:
```bash
npm run test
```

Key tests for these endpoints:
- tests/api-options-endpoints.spec.ts (models/users/locations)
- tests/api-inventory-route.spec.ts (items list/create)
- Other component and service tests are included; mock mode is enforced during tests.

---

## Lottie-React Foundation (Prepared for future animations)

This codebase is prepared to render Lottie animations using [lottiereact.com](https://lottiereact.com) guidance. No animations are currently wired into the UI; only foundational support is added.

What’s included
- Dependency installed: `lottie-react` (see package.json)
- Client-safe reusable wrapper: `src/components/lottie/lottie-player.tsx`
  - Marked `"use client"` for Next.js App Router compatibility
  - Forwards the internal Lottie instance via `ref` for imperative controls (`play`, `pause`, `stop`, `setSpeed`, `setDirection`, etc.)
  - No animation JSON bundled/imported here

TypeScript support
- `tsconfig.json` already includes `"resolveJsonModule": true` and `"esModuleInterop": true`
- This allows importing animation JSON files like:
  ```ts
  import success from "@/assets/animations/success.json";
  ```
  or loading from `public/animations/*.json` via `fetch` at runtime.

How to add an animation later (example usage, not currently wired)
- In a client component:
  ```tsx
  "use client";

  import React, { useRef } from "react";
  import LottiePlayer, { LottiePlayerRef } from "@/components/lottie/lottie-player";
  import success from "@/assets/animations/success.json"; // or fetch from /animations/success.json

  export function SuccessBadge() {
    const ref = useRef<LottiePlayerRef>(null);
    return (
      <LottiePlayer
        ref={ref}
        animationData={success}
        loop={false}
        autoplay
        className="h-24 w-24"
      />
    );
  }
  ```
- Alternative (large files): place JSON in `public/animations/...` and load dynamically:
  ```tsx
  "use client";
  import React from "react";
  import LottiePlayer from "@/components/lottie/lottie-player";

  export function BigAnimation() {
    const [data, setData] = React.useState<object | null>(null);

    React.useEffect(() => {
      let mounted = true;
      fetch("/animations/big.json")
        .then((r) => r.json())
        .then((json) => { if (mounted) setData(json); });
      return () => { mounted = false; };
    }, []);

    if (!data) return null; // or a fallback
    return <LottiePlayer animationData={data} loop autoplay className="h-40 w-40" />;
  }
  ```

SSR guidance (Next.js App Router)
- Always render Lottie from a client component. The included wrapper is already client-safe.
- If you must use `lottie-react` directly, dynamically import with `ssr: false`:
  ```tsx
  import dynamic from "next/dynamic";
  const LottieNoSSR = dynamic(() => import("lottie-react"), { ssr: false });
  ```
  Prefer the shared `LottiePlayer` wrapper for consistency.

Reduced motion and accessibility
- For decorative animations, pass `role="img"` (default) and consider `aria-hidden` if purely decorative.
- Respect user motion preferences by disabling autoplay/loop based on `prefers-reduced-motion`:
  ```tsx
  const prefersReduced = typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  <LottiePlayer animationData={...} autoplay={!prefersReduced} loop={!prefersReduced} />;
  ```

Interactivity (optional for future)
- `lottie-react` provides `useLottie` and `useLottieInteractivity` for scroll/hover driven animations.
- You can build a specialized component later that maps scroll/visibility to frames without changing the wrapper.

Testing approach
- Wrapper tests live in `tests/lottie-player.spec.tsx`
- We mock `lottie-react` and assert that the wrapper:
  - Renders without throwing
  - Exposes imperative methods via the forwarded ref
  - Applies `speed` and `direction` via the ref

Migration checklist for adding real animations later
- Choose asset location:
  - Small/medium: `src/assets/animations/*` (import with bundling)
  - Large/shared: `public/animations/*` (fetch at runtime)
- Import/load JSON and pass as `animationData` to `LottiePlayer`
- Consider `loop`, `autoplay`, and `onComplete` to control lifecycle
- Gate heavy/looping animations with IntersectionObserver or conditional rendering
- Respect reduced motion preferences and add accessible labels where needed
