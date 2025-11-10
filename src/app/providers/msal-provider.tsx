"use client";

import * as React from "react";
import { MsalProvider } from "@azure/msal-react";
import {
  PublicClientApplication,
  type Configuration,
  EventType,
  type AccountInfo,
  type AuthenticationResult,
  type EventMessage,
} from "@azure/msal-browser";

function createMsalInstance() {
  const tenantId =
    process.env.NEXT_PUBLIC_AZURE_TENANT_ID || process.env.AZURE_TENANT_ID || "common";
  // Fallback GUID allows provider to initialize in mock mode without real app registration
  const clientId = process.env.NEXT_PUBLIC_AZURE_FRONTEND_CLIENT_ID || "00000000-0000-0000-0000-000000000000";
  const redirectUri =
    process.env.NEXT_PUBLIC_AZURE_REDIRECT_URI ||
    (typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "/auth/callback");

  const config: Configuration = {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri,
      navigateToLoginRequestUrl: false,
    },
    cache: {
      cacheLocation: "sessionStorage",
      storeAuthStateInCookie: false,
    },
    system: {
      loggerOptions: {
        loggerCallback: () => {
          // hook up your logger if desired
        },
      },
    },
  };

  const pca = new PublicClientApplication(config);
  return pca;
}

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const pca = React.useMemo(() => createMsalInstance(), []);

  React.useEffect(() => {
    pca.initialize().then(() => {
      // Keep an active account set
      const accounts = pca.getAllAccounts();
      if (accounts.length > 0 && !pca.getActiveAccount()) {
        pca.setActiveAccount(accounts[0]);
      }

      pca.addEventCallback((event: EventMessage) => {
        if (
          event.eventType === EventType.LOGIN_SUCCESS ||
          event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS
        ) {
          const result = event.payload as AuthenticationResult | null;
          const account = result?.account as AccountInfo | undefined;
          if (account && !pca.getActiveAccount()) {
            pca.setActiveAccount(account);
          }
        }
      });
    });
  }, [pca]);

  return <MsalProvider instance={pca}>{children}</MsalProvider>;
}
