"use client";

import * as React from "react";
import motion from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ButtonGroup } from "@/components/ui/button-group";
import { Plus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMsal } from "@azure/msal-react";
import { useModelOptions, useUserSearch, useLocations, type UserOption } from "@/hooks/use-inventory-options";
import { Spinner } from "@/components/ui/spinner";
import { useGlobalLoading } from "@/components/loading/loading-provider";
import { useLottieOverlay } from "@/components/lottie/overlay-provider";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAsset?: number;
};

export default function AssetCreateDialog({ open, onOpenChange, defaultAsset }: Props) {
  const [asset, setAsset] = React.useState("");
  const [model, setModel] = React.useState("");
  const [serial, setSerial] = React.useState("");
  const [userLocation, setUserLocation] = React.useState("");
  const [status, setStatus] = React.useState<"ready_to_deploy" | "deployed" | "retired">("ready_to_deploy");
  const [imageFile, setImageFile] = React.useState<File | null>(null);

  // Model combobox state
  const [modelOpen, setModelOpen] = React.useState(false);
  const [modelQuery, setModelQuery] = React.useState("");
  const [modelManual, setModelManual] = React.useState(false);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    models: modelOptions,
    loading: modelLoading,
    error: modelError,
  } = useModelOptions(modelOpen && !modelManual, modelQuery, 200);

  // User/Location combobox state
  const [userLocOpen, setUserLocOpen] = React.useState(false);
  const [userQuery, setUserQuery] = React.useState("");
  const [userManual, setUserManual] = React.useState(false);

  const {
    users: userOptions,
    loading: usersLoading,
    error: usersError,
  } = useUserSearch(userQuery, userLocOpen);

  const {
    locations,
    loading: locationsLoading,
    error: locationsError,
    refetch: refetchLocations,
  } = useLocations();

  React.useEffect(() => {
    if (userLocOpen && (locations.length === 0 || locationsError) && !locationsLoading) {
      void refetchLocations();
    }
  }, [userLocOpen, locations.length, locationsError, locationsLoading, refetchLocations]);

  const filteredLocations = React.useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return q ? locations.filter((l) => l.toLowerCase().includes(q)) : locations;
  }, [locations, userQuery]);

  const formatUser = React.useCallback((u: UserOption) => {
    const label = u.displayName || u.userPrincipalName || u.mail || u.id;
    const sub = u.mail || u.userPrincipalName || "";
    return { label, sub };
  }, []);

  // Auth + create-handling for Save
  const { instance, accounts } = useMsal();
  const isMock =
    process.env.NEXT_PUBLIC_USE_MOCK_INVENTORY === "true" ||
    process.env.USE_MOCK_INVENTORY === "true";
  const API_SCOPE =
    process.env.NEXT_PUBLIC_AZURE_API_SCOPE ||
    process.env.AZURE_API_SCOPE ||
    "";
  const { withGlobalLoading } = useGlobalLoading();
  const { open: openOverlay } = useLottieOverlay();

  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  async function getAuthHeaders(): Promise<HeadersInit> {
    // In mock mode, no auth header required
    if (isMock) {
      return { "Content-Type": "application/json" };
    }
    if (!API_SCOPE) {
      throw new Error("Missing API scope. Set NEXT_PUBLIC_AZURE_API_SCOPE.");
    }
    const account = instance.getActiveAccount() || accounts[0] || null;
    if (!account) {
      throw new Error("Not authenticated");
    }
    const result = await instance.acquireTokenSilent({
      scopes: [API_SCOPE],
      account,
    });
    return {
      Authorization: `Bearer ${result.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  function reset() {
    setAsset("");
    setModel("");
    setSerial("");
    setUserLocation("");
    setStatus("ready_to_deploy");
    setImageFile(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  React.useEffect(() => {
    if (open && typeof defaultAsset === "number") {
      setAsset(String(defaultAsset));
    }
  }, [open, defaultAsset]);

  function getCreateAnimationUrl(s: "ready_to_deploy" | "deployed" | "retired"): string | null {
    switch (s) {
      case "ready_to_deploy":
        return "/animations/createreadytodeploy.json";
      case "deployed":
        return "/animations/createdeployed.json";
      case "retired":
        return "/animations/createretired.json";
      default:
        return null;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);

    // Ensure asset is a valid number before attempting create
    const assetNum = Number(asset);
    if (!Number.isFinite(assetNum)) {
      setSaveError("Invalid asset number");
      return;
    }

    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const payload = {
        fields: {
          asset: assetNum,
          model,
          serial,
          userLocation,
          status,
          // assetImage and notes are optional; omitted for now
        },
      };

      const res = await withGlobalLoading(fetch("/api/inventory", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }));

      if (!res.ok) {
        let message = `Create failed (${res.status})`;
        try {
          const data = (await res.json()) as { error?: string; detail?: string };
          message = data?.error || data?.detail || message;
        } catch {
          // ignore json parsing error, keep default message
        }
        setSaveError(message);
        return;
      }

      // Play status-specific Lottie overlay on successful create
      const animationUrl = getCreateAnimationUrl(status);
      if (animationUrl) {
        void openOverlay({ url: animationUrl, loop: false, autoplay: true });
      }

      // Success: close the dialog (creation only occurs via Save)
      onOpenChange(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        // Larger centered card, close button already provided by DialogContent
        className={cn(
          "w-full pt-8 pb-8 px-[2.4rem] rounded-2xl max-w-[63.75vw] md:max-w-[63.75vw]",
          "bg-stone-950/50 backdrop-blur border-[1px] border-neutral-400 shadow-[inset_2px_2px_8px_rgba(0,0,0,0.1),inset_-2px_-2px_8px_rgba(0,0,0,0.02),0_4px_4px_8px_rgba(0,0,0,0.1)]"
        )}
      >
        <h2 className="text-white text-3xl sm:text-4xl font-semibold tracking-tight mb-6">
          New Asset
        </h2>

        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6 pb-[2.3rem]">
          {/* Left column */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-white" htmlFor="asset">Asset</Label>
              <div className={cn("w-full md:w-1/4 rounded-xl", asset ? "bg-zinc-500" : "bg-zinc-700")}>
                <Input
                  id="asset"
                  className={cn(
                    "text-white placeholder:text-white/65 rounded-xl",
                    asset ? "border-zinc-500" : "border-zinc-700"
                  )}
                  inputMode="numeric"
                  placeholder="Asset Number"
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                  required
                />
              </div>
              <Label className="text-white" htmlFor="model">Model</Label>
              <div className="flex gap-2 ">
                <div className="relative grow md:grow-0 md:w-3/4 bg-zinc-700 rounded-xl">
                  <Input
                    id="model"
                    className="md:px-2.5 text-white placeholder:text-white/65 rounded-xl border-zinc-700"
                    role="combobox"
                    aria-expanded={modelOpen && !modelManual}
                    aria-controls="model-options"
                    aria-autocomplete="list"
                    placeholder="Model Identity"
                    value={model}
                    onFocus={() => {
                      if (!modelManual) setModelOpen(true);
                    }}
                    onChange={(e) => {
                      const v = e.target.value;
                      setModel(v);
                      setModelQuery(v);
                      if (!modelManual) setModelOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setModelOpen(false);
                      }
                    }}
                    onBlur={() => {
                      // Delay closing to allow option mousedown to fire first
                      if (closeTimerRef.current) {
                        clearTimeout(closeTimerRef.current);
                      }
                      closeTimerRef.current = setTimeout(() => {
                        setModelOpen(false);
                        closeTimerRef.current = null;
                      }, 100);
                    }}
                    required
                  />
                  {modelOpen && !modelManual && (
                    <div
                      id="model-options"
                      role="listbox"
                      className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border bg-popover shadow-md p-1 text-sm"
                    >
                      {modelLoading && (
                        <div className="px-3 py-2 text-muted-foreground">Loading...</div>
                      )}
                      {!modelLoading && modelError && (
                        <div className="px-3 py-2 text-destructive">{modelError}</div>
                      )}
                      {!modelLoading && !modelError && modelOptions.length === 0 && (
                        <div className="px-3 py-2 text-muted-foreground">No models found</div>
                      )}
                      {!modelLoading &&
                        !modelError &&
                        modelOptions.map((opt) => (
                          <button
                            key={opt}
                            role="option"
                            className="w-full px-3 py-2 text-left hover:bg-accent"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (closeTimerRef.current) {
                                clearTimeout(closeTimerRef.current);
                                closeTimerRef.current = null;
                              }
                              setModel(opt);
                              setModelQuery(opt);
                              setModelOpen(false);
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  className="text-white bg-zinc-700 rounded-xl border-zinc-700"
                  size="icon"
                  variant="outline"
                  aria-label="Toggle model list"
                  title="Toggle model list"
                  disabled={modelManual}
                  onMouseDown={(e) => {
                    // Prevent input blur from immediately closing
                    e.preventDefault();
                    if (closeTimerRef.current) {
                      clearTimeout(closeTimerRef.current);
                      closeTimerRef.current = null;
                    }
                  }}
                  onClick={() => {
                    if (modelManual) return;
                    setModelOpen((o) => !o);
                  }}
                >
                  <ChevronDown className="size-4 text-white" />
                </Button>
                <Button
                  type="button"
                  className="text-white bg-zinc-700 rounded-xl border-zinc-700"
                  size="icon"
                  variant={modelManual ? "default" : "outline"}
                  aria-pressed={modelManual}
                  aria-label={modelManual ? "Manual entry enabled" : "Manual entry"}
                  title={modelManual ? "Manual entry enabled" : "Manual entry"}
                  onClick={() => {
                    setModelManual((prev) => {
                      const next = !prev;
                      if (closeTimerRef.current) {
                        clearTimeout(closeTimerRef.current);
                        closeTimerRef.current = null;
                      }
                      if (next) {
                        // enabling manual entry closes dropdown
                        setModelOpen(false);
                      } else {
                        // disabling manual entry reopens suggestions
                        setModelOpen(true);
                      }
                      return next;
                    });
                  }}
                >
                  <Plus className="size-4 text-white" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white" htmlFor="serial">Serial</Label>
              <div className="w-full md:w-3/4 bg-zinc-700 rounded-xl">
                <Input
                  id="serial"
                  className="md:px-2.5 text-white placeholder:text-white/65 rounded-xl border-zinc-700"
                  placeholder="Serial Number"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-white" htmlFor="image">Image</Label>
              <div className="w-full md:w-3/4 bg-zinc-700 rounded-xl">
                <Input
                  id="image"
                  type="file"
                  className="md:px-2.5 text-transparent file:text-white/85 file:cursor-pointer file:bg-transparent file:border-0 file:px-0 file:mr-0 rounded-xl border-zinc-700"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white" htmlFor="userloc">User/Location</Label>
              <div className="flex gap-2">
                <div className="relative grow md:grow-0 md:w-3/4 bg-zinc-700 rounded-xl">
                  <Input
                    id="userloc"
                    className="md:px-2.5 text-white placeholder:text-white/65 rounded-xl border-zinc-700"
                    role="combobox"
                    aria-expanded={userLocOpen && !userManual}
                    aria-controls="userloc-options"
                    aria-autocomplete="list"
                    placeholder="Name"
                    value={userLocation}
                    onFocus={() => {
                      if (!userManual) setUserLocOpen(true);
                    }}
                    onChange={(e) => {
                      const v = e.target.value;
                      setUserLocation(v);
                      setUserQuery(v);
                      if (!userManual) setUserLocOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setUserLocOpen(false);
                      }
                    }}
                    onBlur={() => {
                      // Delay closing to allow option mousedown to fire first
                      if (closeTimerRef.current) {
                        clearTimeout(closeTimerRef.current);
                      }
                      closeTimerRef.current = setTimeout(() => {
                        setUserLocOpen(false);
                        closeTimerRef.current = null;
                      }, 100);
                    }}
                    required
                  />
                  {userLocOpen && !userManual && (
                    <div
                      id="userloc-options"
                      role="listbox"
                      className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-md border bg-popover shadow-md p-1 text-sm"
                    >
                      <div className="px-3 py-1 text-xs text-muted-foreground">Users</div>
                      {usersLoading ? (
                        <div className="px-3 py-2 text-muted-foreground">Searching...</div>
                      ) : usersError ? (
                        <div className="px-3 py-2 text-destructive">{usersError}</div>
                      ) : userQuery.trim().length >= 2 && userOptions.length === 0 ? (
                        <div className="px-3 py-2 text-muted-foreground">No users</div>
                      ) : (
                        userOptions.map((u) => {
                          const { label, sub } = formatUser(u);
                          const value = label + (sub && sub !== label ? ` (${sub})` : "");
                          return (
                            <button
                              key={u.id}
                              role="option"
                              className="w-full px-3 py-2 text-left hover:bg-accent"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                if (closeTimerRef.current) {
                                  clearTimeout(closeTimerRef.current);
                                  closeTimerRef.current = null;
                                }
                                setUserLocation(value);
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
                            </button>
                          );
                        })
                      )}

                      <div className="mt-1 px-3 py-1 text-xs text-muted-foreground">Locations</div>
                      {locationsLoading ? (
                        <div className="px-3 py-2 text-muted-foreground">Loading...</div>
                      ) : locationsError ? (
                        <div className="px-3 py-2 text-destructive">{locationsError}</div>
                      ) : filteredLocations.length === 0 ? (
                        <div className="px-3 py-2 text-muted-foreground">No locations</div>
                      ) : (
                        filteredLocations.map((opt) => (
                          <button
                            key={opt}
                            role="option"
                            className="w-full px-3 py-2 text-left hover:bg-accent"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (closeTimerRef.current) {
                                clearTimeout(closeTimerRef.current);
                                closeTimerRef.current = null;
                              }
                              setUserLocation(opt);
                              setUserLocOpen(false);
                            }}
                          >
                            {opt}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  className="text-white bg-zinc-700 rounded-xl border-zinc-700"
                  size="icon"
                  variant="outline"
                  aria-label="Toggle user/location list"
                  title="Toggle user/location list"
                  disabled={userManual}
                  onMouseDown={(e) => {
                    // Prevent input blur from immediately closing
                    e.preventDefault();
                    if (closeTimerRef.current) {
                      clearTimeout(closeTimerRef.current);
                      closeTimerRef.current = null;
                    }
                  }}
                  onClick={() => {
                    if (userManual) return;
                    setUserLocOpen((o) => !o);
                  }}
                >
                  <ChevronDown className="size-4 text-white" />
                </Button>

                <Button
                  type="button"
                  className="text-white bg-zinc-700 rounded-xl border-zinc-700"
                  size="icon"
                  variant={userManual ? "default" : "outline"}
                  aria-pressed={userManual}
                  aria-label={userManual ? "Manual entry enabled" : "Manual entry"}
                  title={userManual ? "Manual entry enabled" : "Manual entry"}
                  onClick={() => {
                    setUserManual((prev) => {
                      const next = !prev;
                      if (closeTimerRef.current) {
                        clearTimeout(closeTimerRef.current);
                        closeTimerRef.current = null;
                      }
                      if (next) {
                        // enabling manual entry closes dropdown
                        setUserLocOpen(false);
                      } else {
                        // disabling manual entry reopens suggestions
                        setUserLocOpen(true);
                      }
                      return next;
                    });
                  }}
                >
                  <Plus className="size-4 text-white" />
                </Button>
              </div>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm text-white font-medium text-foreground">Asset Status</legend>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <ButtonGroup
                  ariaLabel="Asset Status"
                  value={status}
                  onChange={(val) => setStatus(val as "ready_to_deploy" | "deployed" | "retired")}
                  options={[
                    { label: "Ready to Deploy", value: "ready_to_deploy", color: "ready", testId: "status-ready" },
                    { label: "Deployed", value: "deployed", color: "deployed", testId: "status-deployed" },
                    { label: "Retired", value: "retired", color: "retired", testId: "status-retired" },
                  ]}
                />

                <Button
                  type="submit"
                  className="rounded-xl bg-white text-black px-6 gap-2"
                  disabled={saving}
                  aria-busy={saving}
                >
                  {saving ? (
                    <>
                      <Spinner size="sm" aria-label="Saving" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
             </div>
              {saveError && (
                <span className="text-sm text-destructive">{saveError}</span>
              )}
            </fieldset>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}
