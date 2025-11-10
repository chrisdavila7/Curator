"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-sidebar";

export function ClientLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const hideChrome = pathname === "/" || pathname.startsWith("/auth");

  // On unauthenticated routes (landing + auth), render children without AppShell/Sidebar.
  return hideChrome ? (
    <div className="min-h-screen p-6 md:p-8">{children}</div>
  ) : (
    <AppShell>{children}</AppShell>
  );
}
