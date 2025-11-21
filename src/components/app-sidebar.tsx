"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  House,
  CirclePlus,
  Boxes,
  ArrowRightLeft,
  Settings,
  Moon,
  CircleUserRound
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import AssetCreateDialog from "@/components/asset/asset-create-dialog";
import { useMsal } from "@azure/msal-react";
import { useLottieOverlay } from "@/components/lottie/overlay-provider";
import { useGlobalLoading } from "@/components/loading/loading-provider";

export function AppShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [defaultAsset, setDefaultAsset] = React.useState<number | undefined>(undefined);
  const [creating, setCreating] = React.useState(false);

  // MSAL + API scope (mirrors InventoryView)
  const { instance, accounts } = useMsal();
  const activeAccount = React.useMemo(
    () => instance.getActiveAccount() || accounts[0] || null,
    [instance, accounts]
  );
  const isMock =
    process.env.NEXT_PUBLIC_USE_MOCK_INVENTORY === "true" ||
    process.env.USE_MOCK_INVENTORY === "true";
  const API_SCOPE =
    process.env.NEXT_PUBLIC_AZURE_API_SCOPE ||
    process.env.AZURE_API_SCOPE ||
    "";
  const { withGlobalLoading } = useGlobalLoading();
  const { open: openOverlay, close: closeOverlay } = useLottieOverlay();

  const fetchNextAsset = React.useCallback(async (): Promise<number | undefined> => {
    try {
      let headers: HeadersInit = {};
      if (!isMock) {
        if (!API_SCOPE || !activeAccount) return undefined;
        const result = await instance.acquireTokenSilent({
          scopes: [API_SCOPE],
          account: activeAccount,
        });
        headers = { Authorization: `Bearer ${result.accessToken}` };
      }
      const res = await fetch("/api/inventory/next-asset", { method: "GET", headers });
      if (!res.ok) return undefined;
      const js = (await res.json()) as { nextAsset?: number };
      return typeof js.nextAsset === "number" ? js.nextAsset : undefined;
    } catch {
      return undefined;
    }
  }, [instance, activeAccount, API_SCOPE, isMock]);

  const handleCreate = React.useCallback(async () => {
    setCreating(true);
    try {
      await openOverlay({
        spinner: true,
      });
      const n = await withGlobalLoading(fetchNextAsset());
      if (typeof n === "number") setDefaultAsset(n);
      setCreateOpen(true);
    } finally {
      closeOverlay();
      setCreating(false);
    }
  }, [fetchNextAsset, withGlobalLoading, openOverlay, closeOverlay]);

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar onCreate={handleCreate} creating={creating} />
      <SidebarInset className={cn("p-6 md:p-8", className)}>{children}</SidebarInset>
      <AssetCreateDialog open={createOpen} onOpenChange={setCreateOpen} defaultAsset={defaultAsset} />
    </SidebarProvider>
  );
}

export default function AppSidebar({ onCreate, creating }: { onCreate?: () => void; creating?: boolean }) {


  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar variant="floating" collapsible="icon" className="h-full rounded-2xl py-10 mx-2">
        <SidebarContent className="h-full w-full rounded-lg border-6 border-white bg-white shadow-[inset_2px_2px_8px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgb(0,0,0,0.15),_0_4px_6px_-4px_rgb(0,0,0,0.15)]">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="backdrop-blur-sm bg- rounded-lg drop-shadow-sm">
                <motion.div whileHover={{ scale: 1.04}}>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Home" asChild>
                    <Link href="/">
                      <House />
                      <span>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                </motion.div>
                <motion.div whileHover={{ scale: 1.04}}>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Create" onClick={onCreate} disabled={!!creating}>
                    <CirclePlus />
                    <span>Create</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                </motion.div>
                <motion.div whileHover={{ scale: 1.04}}>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Assets" asChild>
                    <Link href="/assets">
                      <Boxes />
                      <span>Assets</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                </motion.div>
                <SidebarMenuItem className="pb-50">
                  <motion.div whileHover={{ scale: 1.04 }}>
                  <SidebarMenuButton tooltip="Check In/Out" asChild>
                    <Link href="/check-in-out">
                      <ArrowRightLeft />
                      <span>Check In/Out</span>
                    </Link>
                  </SidebarMenuButton>
                  </motion.div>
                </SidebarMenuItem>
                <motion.div whileHover={{ scale: 1.04}}>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="In Development">
                <CircleUserRound />
                <span>Account</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04}}>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="In Development">
                <Moon />
                <span>Dark Mode</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            </motion.div>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </TooltipProvider>
  );
}
