"use client";

import * as React from "react";
import type { InventoryItem } from "@/types/inventory";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type InRow = Pick<InventoryItem, "asset" | "serial" | "model">;
type OutRow = Pick<InventoryItem, "asset" | "serial" | "model"> & { from: string; to: string };

type Props = {
  stagedIn: InRow[];
  stagedOut: OutRow[];
  onRemove: (kind: "in" | "out", asset: number) => void;
  onSubmit: () => Promise<void> | void;
  submitting: boolean;
  submitError?: string;
  onCancel?: () => void;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Finalize panel card (side-by-side with Stage card).
 * Visual replacement for the Finalize drawer; carries the same functionality.
 */
export default function FinalizePanelCard({
  stagedIn,
  stagedOut,
  onRemove,
  onSubmit,
  submitting,
  submitError,
  onCancel,
  className,
  style,
}: Props) {
  type RowEntry = { kind: "in"; row: InRow } | { kind: "out"; row: OutRow };

  const rows = React.useMemo<RowEntry[]>(
    () => [
      ...stagedIn.map((r) => ({ kind: "in" as const, row: r })),
      ...stagedOut.map((r) => ({ kind: "out" as const, row: r })),
    ],
    [stagedIn, stagedOut]
  );

  const totalCount = stagedIn.length + stagedOut.length;

  return (
    <Card className={cn("h-full min-h-0 py-0", className)} style={style}>
      <CardContent className="px-12 pt-5 pb-4 h-full flex flex-col">
        {/* Scrollable table area */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full pr-2">
            <div className="rounded-md border overflow-hidden">
              <Table className="text-sm [&_td]:py-1.5 [&_td]:px-2 [&_td]:align-middle">
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow className="font-semibold">
                      <TableCell className="py-1.5 text-center text-muted-foreground" colSpan={4}>
                        No items staged
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((entry) => {
                      const isIn = entry.kind === "in";
                      const bandBg = isIn ? "bg-sky-500" : "bg-emerald-600";

                      return (
                        <TableRow key={`${entry.kind}-${entry.row.asset}`} className="hover:bg-transparent font-semibold">
                          <TableCell className="w-1/2 pl-3">
                            <div className="relative">
                              <span
                                aria-hidden="true"
                                className={cn("absolute left-0 top-0 bottom-0 w-[0.29rem]", bandBg)}
                              />
                              <span aria-hidden="true" className="inline-block w-10" />
                              {isIn ? (
                                <span className="tabular-nums">{entry.row.asset}</span>
                              ) : (
                                <span title={entry.row.from}>
                                  <span className="tabular-nums">{entry.row.asset}</span>
                                  <span className="text-muted-foreground"> — {entry.row.from}</span>
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="w-20 text-center">
                            <span className="text-foreground/90 text-sm">
                              {isIn ? "Check In" : "Check Out"}
                            </span>
                          </TableCell>

                          <TableCell className="w-1/2 pr-3 text-right">
                            {isIn ? (
                              <span>Inventory</span>
                            ) : (
                              <span title={entry.row.to}>{entry.row.to}</span>
                            )}
                          </TableCell>
                          <TableCell className="w-10 pr-3 text-right">
                            <button
                              type="button"
                              aria-label={`Remove staged ${isIn ? "Check In" : "Check Out"} for asset ${entry.row.asset}`}
                              className="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              onClick={() => onRemove(entry.kind, entry.row.asset)}
                            >
                              <Trash2 className="size-4 text-muted-foreground" aria-hidden="true" />
                              <span className="sr-only">Remove</span>
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </div>

        {/* Buttons */}
        <div className="mt-auto pt-6">
          <Button
            type="button"
            className="w-full h-9 bg-black text-white hover:bg-black/90 gap-2"
            onClick={onSubmit}
            disabled={submitting || totalCount === 0}
            aria-busy={submitting}
          >
            {submitting ? (
              <>
                <Spinner size="sm" aria-label="Submitting" />
                <span>Submitting…</span>
              </>
            ) : (
              "Submit"
            )}
          </Button>
          {submitError && (
            <div role="alert" aria-live="polite" className="mt-3 text-sm text-destructive">
              {submitError}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
