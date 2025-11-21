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

  const isMock =
    process.env.NEXT_PUBLIC_USE_MOCK_INVENTORY === "true" ||
    process.env.USE_MOCK_INVENTORY === "true";

  const activeAccount = React.useMemo(
    () => instance.getActiveAccount() || accounts[0] || null,
    [instance, accounts]
  );

  React.useEffect(() => {
    if (isMock || activeAccount) {
      router.replace("/dashboard");
    }
  }, [isMock, activeAccount, router]);

  return null;
}
