"use client";

import * as React from "react";
import type { InventoryItem } from "@/types/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import {
  useModelOptions,
  useUserSearch,
  useLocations,
  type UserOption,
} from "@/hooks/use-inventory-options";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type RowStatus = "idle" | "dirty" | "success";
type RowState = {
  baseline: string;
  current: string;
  status: RowStatus;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
  onUpdate?: (fields: Partial<Pick<InventoryItem, "serial" | "model" | "userLocation">>) => Promise<{
    item?: InventoryItem;
    eTag?: string;
  }>;
};

export default function AssetEditSheet({ open, onOpenChange, item, onUpdate }: Props) {
  // Row states
  const [serial, setSerial] = React.useState<RowState>({
    baseline: item?.serial ?? "",
    current: item?.serial ?? "",
    status: "idle",
  });
  const [model, setModel] = React.useState<RowState>({
    baseline: item?.model ?? "",
    current: item?.model ?? "",
    status: "idle",
  });
  const [userLoc, setUserLoc] = React.useState<RowState>({
    baseline: item?.userLocation ?? "",
    current: item?.userLocation ?? "",
    status: "idle",
  });

  // Track per-row saving flags
  const [savingSerial, setSavingSerial] = React.useState(false);
  const [savingModel, setSavingModel] = React.useState(false);
  const [savingUserLoc, setSavingUserLoc] = React.useState(false);

  // Local image selection state to mirror previous Edit overlay behavior
  const [imageSelected, setImageSelected] = React.useState(false);

  // Stable asset identity key; used to avoid reinitializing on every field change
  const assetKey = item?.asset ?? null;

  // Reinitialize states whenever the sheet is opened or the asset identity changes
  React.useEffect(() => {
    if (!open) return;
    setSerial({
      baseline: item?.serial ?? "",
      current: item?.serial ?? "",
      status: "idle",
    });
    setModel({
      baseline: item?.model ?? "",
      current: item?.model ?? "",
      status: "idle",
    });
    setUserLoc({
      baseline: item?.userLocation ?? "",
      current: item?.userLocation ?? "",
      status: "idle",
    });
    setSavingSerial(false);
    setSavingModel(false);
    setSavingUserLoc(false);
    setImageSelected(false);
  }, [open, assetKey]);

  // Refresh baselines on item field changes while preserving success and user input
  React.useEffect(() => {
    if (!open) return;

    setSerial((s) => {
      const nextBase = item?.serial ?? "";
      if (s.status === "success") return { ...s, baseline: nextBase };
      const nextStatus: RowStatus = s.current === nextBase ? "idle" : "dirty";
      return { ...s, baseline: nextBase, status: nextStatus };
    });

    setModel((s) => {
      const nextBase = item?.model ?? "";
      if (s.status === "success") return { ...s, baseline: nextBase };
      const nextStatus: RowStatus = s.current === nextBase ? "idle" : "dirty";
      return { ...s, baseline: nextBase, status: nextStatus };
    });

    setUserLoc((s) => {
      const nextBase = item?.userLocation ?? "";
      if (s.status === "success") return { ...s, baseline: nextBase };
      const nextStatus: RowStatus = s.current === nextBase ? "idle" : "dirty";
      return { ...s, baseline: nextBase, status: nextStatus };
    });
  }, [open, item?.serial, item?.model, item?.userLocation]);

  // When closing the sheet, reset non-success rows back to their baseline values (parity with overlay)
  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && open) {
        setSerial((s) =>
          s.status === "success" ? s : { baseline: s.baseline, current: s.baseline, status: "idle" }
        );
        setModel((s) =>
          s.status === "success" ? s : { baseline: s.baseline, current: s.baseline, status: "idle" }
        );
        setUserLoc((s) =>
          s.status === "success" ? s : { baseline: s.baseline, current: s.baseline, status: "idle" }
        );
        setImageSelected(false);
      }
      onOpenChange(nextOpen);
    },
    [open, onOpenChange]
  );

  // Model dropdown state + options
  const [modelOpen, setModelOpen] = React.useState(false);
  const [modelQuery, setModelQuery] = React.useState("");
  const {
    models: modelOptions,
    loading: modelOptionsLoading,
    error: modelOptionsError,
  } = useModelOptions(modelOpen, modelQuery);

  const normalizedModelSet = React.useMemo(
    () => new Set(modelOptions.map((m) => m.trim().toLowerCase())),
    [modelOptions]
  );
  const canCreateModel = React.useMemo(() => {
    const q = modelQuery.trim().toLowerCase();
    return q.length > 0 && !normalizedModelSet.has(q);
  }, [modelQuery, normalizedModelSet]);

  // User/Location dropdown state + options
  const [userLocOpen, setUserLocOpen] = React.useState(false);
  const [userQuery, setUserQuery] = React.useState("");
  const {
    users: userOptions,
    loading: usersLoading,
    error: usersError,
  } = useUserSearch(userQuery, userLocOpen);
  const {
    locations,
    loading: locationsLoading,
    error: locationsError,
  } = useLocations();

  const filteredLocations = React.useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((l) => l.toLowerCase().includes(q));
  }, [locations, userQuery]);

  const formatUser = React.useCallback((u: UserOption) => {
    const label = u.displayName || u.userPrincipalName || u.mail || u.id;
    const sub = u.mail || u.userPrincipalName || "";
    return { label, sub };
  }, []);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[520px] max-w-[95vw]">
        <SheetHeader>
          <SheetTitle className="text-base">Edit Menu</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {/* Image preview + actions (moved inside the Sheet to preserve functionality while overlay is active) */}
          <div className="flex items-start gap-3">
            <div className="h-24 w-32 overflow-hidden rounded border bg-background grid place-items-center">
              {item?.assetImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.assetImage}
                  alt={item?.asset ? `Asset ${item.asset}` : "Asset image"}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-xs text-muted-foreground">No image</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="text-sm text-muted-foreground">Image</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setImageSelected(true)}
                >
                  Select
                </Button>
                <Button
                  size="sm"
                  variant={imageSelected ? "default" : "secondary"}
                  disabled={!imageSelected}
                >
                  Update
                </Button>
              </div>
            </div>
          </div>

          {/* Serial row */}
          <div className="grid grid-cols-[120px_1fr_auto] items-center gap-2">
            <div className="text-sm text-muted-foreground">Serial</div>
            <Input
              value={serial.current}
              disabled={serial.status === "success"}
              onChange={(e) => {
                const v = e.target.value;
                setSerial((s) => ({
                  ...s,
                  current: v,
                  status:
                    s.status === "success"
                      ? "success"
                      : v === s.baseline
                      ? "idle"
                      : "dirty",
                }));
              }}
            />

            {serial.status !== "success" ? (
              <Button
                size="sm"
                variant={serial.status === "dirty" ? "default" : "secondary"}
                disabled={serial.status !== "dirty" || savingSerial}
                onClick={async () => {
                  if (!onUpdate) {
                    setSerial((s) => ({
                      ...s,
                      status: "success",
                      baseline: s.current,
                    }));
                    return;
                  }
                  try {
                    setSavingSerial(true);
                    await onUpdate({ serial: serial.current });
                    setSerial((s) => ({
                      ...s,
                      status: "success",
                      baseline: s.current,
                    }));
                  } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error("Serial update failed", e);
                  } finally {
                    setSavingSerial(false);
                  }
                }}
              >
                {savingSerial ? "Updating..." : "Update"}
              </Button>
            ) : (
              <span className="flex items-center justify-end">
                <Check className="size-4 text-green-600" aria-label="Updated" />
              </span>
            )}
          </div>

          {/* Model row with dynamic options */}
          <div className="grid grid-cols-[120px_1fr_auto] items-center gap-2">
            <div className="text-sm text-muted-foreground">Model</div>

            <DropdownMenu
              open={modelOpen}
              onOpenChange={(o) => {
                setModelOpen(o);
                if (!o) setModelQuery("");
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  disabled={model.status === "success"}
                >
                  <span className="truncate">
                    {model.current || "Select model"}
                  </span>
                  <ChevronDown className="ml-2 size-4 opacity-60" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72 p-1">
                {/* Search input */}
                <div className="px-1 pb-1">
                  <Input
                    autoFocus
                    placeholder="Search or create model..."
                    value={modelQuery}
                    onChange={(e) => setModelQuery(e.target.value)}
                    disabled={model.status === "success"}
                  />
                </div>

                <DropdownMenuLabel>Model options</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {modelOptionsLoading && (
                  <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
                )}
                {!modelOptionsLoading && modelOptionsError && (
                  <DropdownMenuItem disabled className="text-destructive">
                    {modelOptionsError}
                  </DropdownMenuItem>
                )}

                {!modelOptionsLoading &&
                  !modelOptionsError &&
                  modelOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt}
                      onClick={() => {
                        setModel((s) => {
                          const nextStatus =
                            s.status === "success"
                              ? "success"
                              : opt === s.baseline
                              ? "idle"
                              : "dirty";
                          return { ...s, current: opt, status: nextStatus };
                        });
                        setModelOpen(false);
                      }}
                    >
                      {opt}
                    </DropdownMenuItem>
                  ))}

                {!modelOptionsLoading &&
                  !modelOptionsError &&
                  modelOptions.length === 0 && (
                    <DropdownMenuItem disabled>No models found</DropdownMenuItem>
                  )}

                {/* Create new value if typed and not in list */}
                {!modelOptionsLoading && !modelOptionsError && canCreateModel && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        const val = modelQuery.trim();
                        setModel((s) => {
                          const nextStatus =
                            s.status === "success"
                              ? "success"
                              : val === s.baseline
                              ? "idle"
                              : "dirty";
                          return { ...s, current: val, status: nextStatus };
                        });
                        setModelOpen(false);
                      }}
                    >
                      Create “{modelQuery.trim()}”
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {model.status !== "success" ? (
              <Button
                size="sm"
                variant={model.status === "dirty" ? "default" : "secondary"}
                disabled={model.status !== "dirty" || savingModel}
                onClick={async () => {
                  if (!onUpdate) {
                    setModel((s) => ({
                      ...s,
                      status: "success",
                      baseline: s.current,
                    }));
                    return;
                  }
                  try {
                    setSavingModel(true);
                    await onUpdate({ model: model.current });
                    setModel((s) => ({
                      ...s,
                      status: "success",
                      baseline: s.current,
                    }));
                  } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error("Model update failed", e);
                  } finally {
                    setSavingModel(false);
                  }
                }}
              >
                {savingModel ? "Updating..." : "Update"}
              </Button>
            ) : (
              <span className="flex items-center justify-end">
                <Check className="size-4 text-green-600" aria-label="Updated" />
              </span>
            )}
          </div>

          {/* User/Location row with users + locations */}
          <div className="grid grid-cols-[120px_1fr_auto] items-center gap-2">
            <div className="text-sm text-muted-foreground">User/Location</div>

            <DropdownMenu open={userLocOpen} onOpenChange={setUserLocOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  disabled={userLoc.status === "success"}
                >
                  <span className="truncate">
                    {userLoc.current || "Select user or location"}
                  </span>
                  <ChevronDown className="ml-2 size-4 opacity-60" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-80 p-1">
                <div className="px-1 pb-1">
                  <Input
                    autoFocus
                    placeholder="Search users (min 2 chars) or filter locations..."
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    disabled={userLoc.status === "success"}
                  />
                </div>

                {/* Users section */}
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Users
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {usersLoading && (
                  <DropdownMenuItem disabled>Searching...</DropdownMenuItem>
                )}
                {!usersLoading && usersError && (
                  <DropdownMenuItem disabled className="text-destructive">
                    {usersError}
                  </DropdownMenuItem>
                )}
                {!usersLoading &&
                  !usersError &&
                  userQuery.trim().length >= 2 &&
                  userOptions.length === 0 && (
                    <DropdownMenuItem disabled>No users</DropdownMenuItem>
                  )}
                {!usersLoading &&
                  !usersError &&
                  userOptions.map((u) => {
                    const { label, sub } = formatUser(u);
                    const value = label + (sub && sub !== label ? ` (${sub})` : "");
                    return (
                      <DropdownMenuItem
                        key={u.id}
                        onClick={() => {
                          setUserLoc((s) => {
                            const nextStatus =
                              s.status === "success"
                                ? "success"
                                : value === s.baseline
                                ? "idle"
                                : "dirty";
                            return { ...s, current: value, status: nextStatus };
                          });
                          setUserLocOpen(false);
                        }}
                      >
                        <div className="flex flex-col">
                          <span>{label}</span>
                          {sub && (
                            <span className="text-xs text-muted-foreground">
                              {sub}
                            </span>
                          )}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}

                {/* Locations section */}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Locations
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {locationsLoading && (
                  <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
                )}
                {!locationsLoading && locationsError && (
                  <DropdownMenuItem disabled className="text-destructive">
                    {locationsError}
                  </DropdownMenuItem>
                )}
                {!locationsLoading &&
                  !locationsError &&
                  filteredLocations.length === 0 && (
                    <DropdownMenuItem disabled>No locations</DropdownMenuItem>
                  )}
                {!locationsLoading &&
                  !locationsError &&
                  filteredLocations.map((opt) => (
                    <DropdownMenuItem
                      key={opt}
                      onClick={() => {
                        setUserLoc((s) => {
                          const nextStatus =
                            s.status === "success"
                              ? "success"
                              : opt === s.baseline
                              ? "idle"
                              : "dirty";
                          return { ...s, current: opt, status: nextStatus };
                        });
                        setUserLocOpen(false);
                      }}
                    >
                      {opt}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {userLoc.status !== "success" ? (
              <Button
                size="sm"
                variant={userLoc.status === "dirty" ? "default" : "secondary"}
                disabled={userLoc.status !== "dirty" || savingUserLoc}
                onClick={async () => {
                  if (!onUpdate) {
                    setUserLoc((s) => ({
                      ...s,
                      status: "success",
                      baseline: s.current,
                    }));
                    return;
                  }
                  try {
                    setSavingUserLoc(true);
                    await onUpdate({ userLocation: userLoc.current });
                    setUserLoc((s) => ({
                      ...s,
                      status: "success",
                      baseline: s.current,
                    }));
                  } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error("User/Location update failed", e);
                  } finally {
                    setSavingUserLoc(false);
                  }
                }}
              >
                {savingUserLoc ? "Updating..." : "Update"}
              </Button>
            ) : (
              <span className="flex items-center justify-end">
                <Check className="size-4 text-green-600" aria-label="Updated" />
              </span>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
