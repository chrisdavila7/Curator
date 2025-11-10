"use client";

import * as React from "react";
import { useMsal } from "@azure/msal-react";
import { useRouter } from "next/navigation";

/**
 * Root page renders no UI; when authenticated, redirect to dashboard.
 * Authentication is enforced globally by AuthGuard (via RootLayout).
 * If unauthenticated, AuthGuard will trigger MSAL login redirect.
 */
export default function LandingPage() {
  const { instance, accounts } = useMsal();
  const router = useRouter();

  const activeAccount = React.useMemo(
    () => instance.getActiveAccount() || accounts[0] || null,
    [instance, accounts]
  );

  React.useEffect(() => {
    if (activeAccount) {
      router.replace("/dashboard");
    }
  }, [activeAccount, router]);

  return null;
}
