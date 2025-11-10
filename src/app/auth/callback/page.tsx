"use client";

import * as React from "react";
import { useMsal } from "@azure/msal-react";
import { useRouter } from "next/navigation";
import type { AuthenticationResult } from "@azure/msal-browser";

export default function AuthCallbackPage() {
  const { instance } = useMsal();
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function handle() {
      try {
        // Ensure MSAL is initialized before calling any API, then complete redirect flow
        await instance.initialize();
        const result = (await instance.handleRedirectPromise()) as AuthenticationResult | null;
        if (!cancelled) {
          if (result?.account) {
            const current = instance.getActiveAccount();
            if (!current) {
              instance.setActiveAccount(result.account);
            }
          }
          // Redirect to preserved deep link if available; fallback to dashboard
          let redirectTo = "/dashboard";
          try {
            if (typeof window !== "undefined") {
              const saved = sessionStorage.getItem("postLoginRedirect");
              if (saved && !saved.startsWith("/auth")) {
                redirectTo = saved;
              }
              sessionStorage.removeItem("postLoginRedirect");
            }
          } catch {
            // ignore storage errors
          }
          try {
            if (typeof window !== "undefined") {
              sessionStorage.setItem("justLoggedIn", "true");
            }
          } catch {
            // ignore storage errors
          }
          router.replace(redirectTo);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Authentication error");
        }
      }
    }

    void handle();
    return () => {
      cancelled = true;
    };
  }, [instance, router]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Completing sign-in…</p>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}
