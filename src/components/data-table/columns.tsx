"use client";

import * as React from "react";
import { ColumnDef, Column } from "@tanstack/react-table";
import { InventoryItem } from "@/types/inventory";
import { StatusBadge } from "@/components/status-badge";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";

function SortableHeader<TData, TValue>({ column, children }: { column: Column<TData, TValue>; children: React.ReactNode }) {
  const isSorted = column.getIsSorted() as "asc" | "desc" | false;
  const ariaSort = isSorted === "asc" ? "ascending" : isSorted === "desc" ? "descending" : "none";

  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(isSorted === "asc")}
      aria-sort={ariaSort}
      className={[
        "group flex w-full items-center justify-start gap-2 rounded-sm px-2 py-1 text-sm transition-colors",
        "cursor-pointer hover:bg-accent hover:text-accent-foreground",
        isSorted ? "font-semibold text-foreground" : "text-muted-foreground",
      ].join(" ")}
    >
      <span className="truncate">{children}</span>
      {isSorted === "asc" ? (
        <ArrowUp className="size-4 shrink-0 opacity-100" />
      ) : isSorted === "desc" ? (
        <ArrowDown className="size-4 shrink-0 opacity-100" />
      ) : (
        <ArrowUpDown className="size-4 shrink-0 opacity-60 group-hover:opacity-100" />
      )}
    </button>
  );
}

export const inventoryColumns: ColumnDef<InventoryItem>[] = [
  {
    id: "asset",
    accessorKey: "asset",
    header: ({ column }) => (
      <SortableHeader column={column}>Asset</SortableHeader>
    ),
    cell: ({ row }) => {
      const asset = row.original.asset;
      if (!asset) return <span className="font-mono text-xs">—</span>;
      return (
        <Link
          href={`/asset/${asset}`}
          className="font-mono text-xs no-underline underline-offset-2 hover:underline focus:underline focus:outline-none focus:ring-2 focus:ring-ring rounded-sm"
          aria-label={`View Asset ${asset}`}
        >
          {asset}
        </Link>
      );
    },
  },
  {
    id: "model",
    accessorKey: "model",
    header: ({ column }) => (
      <SortableHeader column={column}>Model</SortableHeader>
    ),
    cell: ({ row }) => <span className="font-medium">{row.original.model}</span>,
  },
  {
    id: "serial",
    accessorKey: "serial",
    header: ({ column }) => (
      <SortableHeader column={column}>Serial</SortableHeader>
    ),
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.serial}</span>,
  },
  {
    id: "userLocation",
    accessorKey: "userLocation",
    header: ({ column }) => (
      <SortableHeader column={column}>User/Location</SortableHeader>
    ),
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.userLocation}</span>,
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const st = row.original.status;
      return <StatusBadge status={st} />;
    },
  },
  {
    id: "modified",
    accessorKey: "modified",
    header: ({ column }) => (
      <SortableHeader column={column}>Modified</SortableHeader>
    ),
    cell: ({ row }) => <span>{row.original.modified}</span>,
  },
];

export const deployedCardColumns: ColumnDef<InventoryItem>[] = [
  {
    id: "asset",
    accessorKey: "asset",
    header: "Asset",
    cell: ({ row }) => {
      const asset = row.original.asset;
      if (!asset) return <span>—</span>;
      return (
        <Link
          href={`/asset/${asset}`}
          className="no-underline underline-offset-2 hover:underline focus:underline"
          aria-label={`View Asset ${asset}`}
        >
          {asset}
        </Link>
      );
    },
  },
  {
    id: "userLocation",
    accessorKey: "userLocation",
    header: "User/Location",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.userLocation}</span>,
  },
  {
    id: "modifiedBy",
    accessorKey: "modifiedBy",
    header: "Modified By",
    cell: ({ row }) => <span>{row.original.modifiedBy}</span>,
  },
  {
    id: "modified",
    accessorKey: "modified",
    header: "Modified",
    cell: ({ row }) => <span>{row.original.modified}</span>,
  },
];

export const deployedCardColumnsNoModified: ColumnDef<InventoryItem>[] = [
  {
    id: "asset",
    accessorKey: "asset",
    header: "Asset",
    cell: ({ row }) => {
      const asset = row.original.asset;
      if (!asset) return <span>—</span>;
      return (
        <Link
          href={`/asset/${asset}`}
          className="no-underline underline-offset-2 hover:underline focus:underline"
          aria-label={`View Asset ${asset}`}
        >
          {asset}
        </Link>
      );
    },
  },
  {
    id: "userLocation",
    accessorKey: "userLocation",
    header: "User/Location",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.userLocation}</span>,
  },
  {
    id: "modifiedBy",
    accessorKey: "modifiedBy",
    header: "Modified By",
    cell: ({ row }) => <span>{row.original.modifiedBy}</span>,
  },
];
