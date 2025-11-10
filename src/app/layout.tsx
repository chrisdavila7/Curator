import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClientLayoutShell } from "@/app/client-layout-shell";
import { ClientProviders } from "@/app/providers/msal-provider";
import { AuthGuard } from "@/app/providers/auth-guard";
import { ToastProvider } from "@/components/ui/toast-provider";
import { GlobalLoadingProvider } from "@/components/loading/loading-provider";
import { LottieOverlayProvider } from "@/components/lottie/overlay-provider";
import LottieOverlay from "@/components/lottie/lottie-overlay";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CURATOR",
  description: "CURATOR",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GlobalLoadingProvider>
          <LottieOverlayProvider>
            <ClientProviders>
              <AuthGuard>
                <ToastProvider>
                  <ClientLayoutShell>{children}</ClientLayoutShell>
                  <LottieOverlay />
                </ToastProvider>
              </AuthGuard>
            </ClientProviders>
          </LottieOverlayProvider>
        </GlobalLoadingProvider>
      </body>
    </html>
  );
}
