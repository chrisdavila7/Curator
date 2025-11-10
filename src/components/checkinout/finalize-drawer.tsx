"use client";

import * as React from "react";
import type { InventoryItem } from "@/types/inventory";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeftFromLine, ArrowRightFromLine, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type InRow = Pick<InventoryItem, "asset" | "serial" | "model">;
type OutRow = Pick<InventoryItem, "asset" | "serial" | "model"> & { from: string; to: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stagedIn: InRow[];
  stagedOut: OutRow[];
  onRemove: (kind: "in" | "out", asset: number) => void;
  onSubmit: () => Promise<void> | void;
  submitting: boolean;
  submitError?: string;
};

export default function FinalizeDrawer({ open, onOpenChange, stagedIn, stagedOut, onRemove, onSubmit, submitting, submitError }: Props) {
  // Build rows to display (order is not critical for the mock; show In then Out)
  type RowEntry = { kind: "in"; row: InRow } | { kind: "out"; row: OutRow };

  const rows = React.useMemo<RowEntry[]>(
    () => [
      ...stagedIn.map((r) => ({ kind: "in" as const, row: r })),
      ...stagedOut.map((r) => ({ kind: "out" as const, row: r })),
    ],
    [stagedIn, stagedOut]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Transparent to render our own rounded panel that "hugs" content */}
      <SheetContent
        side="bottom"
        className="bg-transparent border-none inset-x-0 p-6 pb-8 sm:pb-10"
        aria-label="Finalize staged items"
      >
        <div className="mx-auto w-full sm:max-w-[740px] h-[75vh] min-h-0 overflow-hidden rounded-2xl bg-background shadow-xl p-6 flex flex-col">
          {/* Handle bar */}
          <div className="mx-auto mb-4 h-1.5 w-20 rounded-full bg-muted-foreground/30" />

          {/* Scrollable table area (grows up to 75vh, then scrolls) */}
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
                      const { kind } = entry;
                      const isIn = kind === "in";
                      const AccentColor = isIn ? "bg-sky-500" : "bg-emerald-600";

                      // Content replacements with real staged data:
                      // - In: left shows asset number, right shows "Inventory"
                      // - Out: left shows "{asset} — {from}", right shows "{to}"
                      return (
                        <TableRow key={`${entry.kind}-${entry.row.asset}`} className="hover:bg-transparent font-semibold">
                          <TableCell className="w-1/2 pl-3">
                            <div className="relative">
                              <span
                                aria-hidden="true"
                                className={cn("absolute left-0 top-0 bottom-0 w-[0.29rem]", AccentColor)}
                              />
                              <span aria-hidden="true" className="inline-block w-10" />
                              {entry.kind === "in" ? (
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
                            {isIn ? (
                              <ArrowLeftFromLine className="mx-auto size-5 text-foreground/90" aria-hidden="true" />
                            ) : (
                              <ArrowRightFromLine className="mx-auto size-5 text-foreground/90" aria-hidden="true" />
                            )}
                          </TableCell>

                          <TableCell className="w-1/2 pr-3 text-right">
                            {entry.kind === "in" ? (
                              <span>Inventory</span>
                            ) : (
                              <span title={entry.row.to}>{entry.row.to}</span>
                            )}
                          </TableCell>
                          <TableCell className="w-10 pr-3 text-right">
                            <button
                              type="button"
                              aria-label={`Remove staged ${entry.kind === "in" ? "Check In" : "Check Out"} for asset ${entry.row.asset}`}
                              className="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              onClick={() => onRemove(entry.kind, entry.row.asset)}
                            >
                              <Trash2 className="size-4 text-muted-foreground" aria-hidden="true" />
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
          <div className="mt-6 space-y-3">
            <Button
              type="button"
              className="w-full h-9 bg-black text-white hover:bg-black/90 gap-2"
              onClick={onSubmit}
              disabled={submitting || (stagedIn.length + stagedOut.length === 0)}
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
            <Button
              type="button"
              variant="outline"
              className="w-full h-9"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            {submitError && (
              <div role="alert" aria-live="polite" className="text-sm text-destructive">
                {submitError}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
