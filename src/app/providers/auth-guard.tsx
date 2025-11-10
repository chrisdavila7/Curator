"use client";

import * as React from "react";
import { useMsal } from "@azure/msal-react";
import { usePathname } from "next/navigation";

const API_SCOPE =
  process.env.NEXT_PUBLIC_AZURE_API_SCOPE ||
  process.env.AZURE_API_SCOPE ||
  "";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { instance, accounts } = useMsal();
  const pathname = usePathname() || "/";
  const [ready, setReady] = React.useState(false);
  const [startingLogin, setStartingLogin] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const triggeredRef = React.useRef(false);
  const bypassedOnceRef = React.useRef(false);

  // Allow bypass in tests (mock mode)
  const mockMode =
    process.env.NEXT_PUBLIC_USE_MOCK_INVENTORY === "true" ||
    process.env.USE_MOCK_INVENTORY === "true";

  const activeAccount = React.useMemo(
    () => instance.getActiveAccount() || accounts[0] || null,
    [instance, accounts]
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await instance.initialize();
      } catch {
        // ignore; login flow will surface issues if any
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instance]);

  React.useEffect(() => {
    if (mockMode) return; // tests bypass
    if (!ready) return; // wait for msal init
    if (pathname.startsWith("/auth")) return; // let callback finish
    if (triggeredRef.current) return; // avoid duplicate calls

    // If we just completed a login this page load, skip forcing again once.
    try {
      if (typeof window !== "undefined") {
        if (sessionStorage.getItem("justLoggedIn") === "true") {
          sessionStorage.removeItem("justLoggedIn");
          bypassedOnceRef.current = true;
          return;
        }
      }
    } catch {
      // ignore storage errors
    }
    if (bypassedOnceRef.current) return;

    if (!API_SCOPE) {
      setError("Missing API scope. Set NEXT_PUBLIC_AZURE_API_SCOPE or AZURE_API_SCOPE.");
      return;
    }

    triggeredRef.current = true;
    setStartingLogin(true);
    try {
      const currentPath =
        (typeof window !== "undefined" ? window.location.pathname : "/") +
        (typeof window !== "undefined" ? window.location.search : "") +
        (typeof window !== "undefined" ? window.location.hash : "");
      if (typeof window !== "undefined") {
        sessionStorage.setItem("postLoginRedirect", currentPath || "/");
      }
    } catch {
      // ignore storage errors
    }
    void instance.loginRedirect({ scopes: [API_SCOPE], prompt: "login" });
  }, [ready, activeAccount, pathname, instance, mockMode]);

  if (mockMode) return <>{children}</>;
  if (pathname.startsWith("/auth")) return <>{children}</>;

  if (!activeAccount) {
    return (
      <main className="min-h-screen grid place-items-center">
        <p className="text-sm text-muted-foreground">
          {error ? error : startingLogin ? "Opening Microsoft sign-in…" : "Checking sign-in…"}
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
