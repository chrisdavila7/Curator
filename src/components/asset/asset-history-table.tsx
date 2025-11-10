"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { AssetHistoryEvent, HistoryField } from "@/types/history";

type Props = {
  events: AssetHistoryEvent[];
  pageSize?: number;
  className?: string;
};

const FIELD_LABEL: Record<HistoryField, string> = {
  asset: "Asset",
  serial: "Serial",
  model: "Model",
  userLocation: "User/Location",
  status: "Status",
  assetImage: "Image",
  notes: "Notes",
};

function formatWhen(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    // Compact but readable format
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso || "";
  }
}

function LeftCellText(e: AssetHistoryEvent) {
  const label = FIELD_LABEL[e.field];
  if (e.changeType === "changed") {
    return (
      <>
        Changed {label} —{" "}
        <span className="text-muted-foreground">{e.from || "—"}</span> &rarr;{" "}
        <span className="font-medium">{e.to || "—"}</span>
      </>
    );
  }
  if (e.changeType === "added") {
    return (
      <>
        Added {label} — <span className="font-medium">{e.to || "—"}</span>
      </>
    );
  }
  // removed
  return (
    <>
      Removed {label} — <span className="text-muted-foreground">{e.from || "—"}</span>
    </>
  );
}

export function AssetHistoryTable({ events, pageSize = 5, className }: Props) {
  const [page, setPage] = React.useState(1);

  const pageCount = Math.max(1, Math.ceil((events?.length || 0) / pageSize));
  const clampedPage = Math.min(Math.max(1, page), pageCount);
  const start = (clampedPage - 1) * pageSize;
  const pageItems = events.slice(start, start + pageSize);

  const go = (p: number) => setPage(Math.min(Math.max(1, p), pageCount));

  // Basic numeric pagination with ellipsis when many pages
  const numbers = React.useMemo(() => {
    const max = pageCount;
    const current = clampedPage;
    const out: (number | string)[] = [];
    const add = (v: number | string) => out.push(v);

    if (max <= 7) {
      for (let i = 1; i <= max; i++) add(i);
      return out;
    }
    add(1);
    if (current > 3) add("…");
    const startRange = Math.max(2, current - 1);
    const endRange = Math.min(max - 1, current + 1);
    for (let i = startRange; i <= endRange; i++) add(i);
    if (current < max - 2) add("…");
    add(max);
    return out;
  }, [clampedPage, pageCount]);

  return (
    <div className={cn("rounded-md border", className)}>
      <Table className="text-sm [&_td]:py-2 [&_td]:px-3">
        <TableBody>
          {pageItems.map((e, idx) => (
            <TableRow key={`${e.at}-${e.field}-${idx}`}>
              <TableCell className="whitespace-nowrap">
                <LeftCellText {...e} />
              </TableCell>
              <TableCell className="w-64 text-right whitespace-nowrap">
                <span className="text-muted-foreground">
                  {e.by || "Unknown"} • {formatWhen(e.at)}
                </span>
              </TableCell>
            </TableRow>
          ))}
          {pageItems.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground">
                No modifications detected
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {/* Pagination footer */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-1 py-2">
          <button
            type="button"
            className="px-2 py-1 text-xs rounded hover:bg-accent disabled:opacity-50"
            onClick={() => go(clampedPage - 1)}
            disabled={clampedPage <= 1}
            aria-label="Previous page"
          >
            {"<"}
          </button>
          {numbers.map((n, i) =>
            typeof n === "number" ? (
              <button
                key={`${n}-${i}`}
                type="button"
                onClick={() => go(n)}
                aria-current={n === clampedPage ? "page" : undefined}
                className={cn(
                  "min-w-6 px-2 py-1 text-xs rounded hover:bg-accent",
                  n === clampedPage && "bg-accent text-accent-foreground"
                )}
              >
                {n}
              </button>
            ) : (
              <span key={`ellipsis-${i}`} className="px-2 py-1 text-xs text-muted-foreground">
                {n}
              </span>
            )
          )}
          <button
            type="button"
            className="px-2 py-1 text-xs rounded hover:bg-accent disabled:opacity-50"
            onClick={() => go(clampedPage + 1)}
            disabled={clampedPage >= pageCount}
            aria-label="Next page"
          >
            {">"}
          </button>
        </div>
      )}
    </div>
  );
}
