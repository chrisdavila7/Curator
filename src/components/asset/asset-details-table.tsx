"use client";

import * as React from "react";
import type { InventoryItem } from "@/types/inventory";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  item: InventoryItem;
  className?: string;
};

function CellLabel({ children }: { children: React.ReactNode }) {
  return (
    <TableCell className="w-48 text-muted-foreground whitespace-nowrap">{children}</TableCell>
  );
}

function Value({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TableCell>) {
  return (
    <TableCell className={cn("whitespace-nowrap", className)} {...props}>
      {children}
    </TableCell>
  );
}

export function AssetDetailsTable({ item, className }: Props) {
  const dash = <span className="text-muted-foreground">—</span>;

  return (
    <div className={cn("rounded-md border w-full overflow-hidden", className)}>
      <Table className="w-full text-sm [&_td]:py-2 [&_td]:px-3 [&_td]:align-middle">
        <TableBody>
          <TableRow data-serial-anchor>
            <CellLabel>Serial</CellLabel>
            <Value>{item.serial || dash}</Value>
          </TableRow>
          <TableRow>
            <CellLabel>Model</CellLabel>
            <Value>{item.model || dash}</Value>
          </TableRow>
          <TableRow>
            <CellLabel>Current User/Location</CellLabel>
            <Value>{item.userLocation || dash}</Value>
          </TableRow>
          <TableRow>
            <CellLabel>Created By</CellLabel>
            <Value>{item.createdBy || dash}</Value>
          </TableRow>
          <TableRow>
            <CellLabel>Purchased By</CellLabel>
            <Value>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground cursor-help">—</span>
                  </TooltipTrigger>
                  <TooltipContent>Not available</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Value>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
