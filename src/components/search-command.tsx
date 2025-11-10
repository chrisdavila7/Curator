"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useMsal } from "@azure/msal-react";
import type { AccountInfo, AuthenticationResult } from "@azure/msal-browser";
import { useRouter } from "next/navigation";
import type { InventoryItem } from "@/types/inventory";

const isMock =
  process.env.NEXT_PUBLIC_USE_MOCK_INVENTORY === "true" ||
  process.env.USE_MOCK_INVENTORY === "true";

const API_SCOPE =
  process.env.NEXT_PUBLIC_AZURE_API_SCOPE ||
  process.env.AZURE_API_SCOPE ||
  "";

// Minimal result shape used by the UI
type SearchResult = Pick<InventoryItem, "asset" | "model" | "userLocation" | "status">;

function isDigitsOnly(s: string): boolean {
  return /^[0-9]+$/.test(s);
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, tokens }: { text: string | number; tokens: string[] }) {
  const str = String(text ?? "");
  if (!tokens.length || !str) return <>{str}</>;
  const escaped = tokens.filter(Boolean).map(escapeRegExp);
  if (!escaped.length) return <>{str}</>;
  const regex = new RegExp(`(${escaped.join("|")})`, "ig");
  const parts = str.split(regex);
  return (
    <>
      {parts.map((part, i) => {
        const isMatch = tokens.some((t) => part.toLowerCase() === t.toLowerCase());
        return isMatch ? (
          <span key={i} className="font-semibold bg-yellow-200 dark:bg-yellow-800/40 rounded-sm px-0.5">
            {part}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        );
      })}
    </>
  );
}

export function SearchCommand({ className }: { className?: string }) {
  const router = useRouter();
  const { instance, accounts } = useMsal();
  const [msalReady, setMsalReady] = React.useState(false);
  const [needsLogin, setNeedsLogin] = React.useState(false);
  const triggerLogin = React.useCallback(async () => {
    if (!API_SCOPE) return;
    try {
      await instance.initialize();
    } catch {
      // ignore
    }
    await instance.loginRedirect({ scopes: [API_SCOPE] });
  }, [instance]);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);

  const [value, setValue] = React.useState("");
  const trimmed = value.trim();
  const isNumericQuery = trimmed.length > 0 && isDigitsOnly(trimmed);
  const isOpen = trimmed.length > 0;
  const tokens = React.useMemo(() => (trimmed ? trimmed.split(/\s+/) : []), [trimmed]);

  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  // Candidate labels for simple prefix autocompletion.
  const actions = React.useMemo(() => ["Create Item", "Import CSV", "Export CSV"], []);
  const navigation = React.useMemo(
    () => ["Home", "Inventory", "Orders", "Reports", "Settings"],
    []
  );
  const allLabels = React.useMemo(() => [...actions, ...navigation], [actions, navigation]);

  const suggestion = React.useMemo(() => {
    const v = trimmed;
    if (!v) return "";
    const lower = v.toLowerCase();
    return allLabels.find((l) => l.toLowerCase().startsWith(lower)) ?? "";
  }, [trimmed, allLabels]);

  const activeAccount = React.useMemo<AccountInfo | null>(() => {
    return instance.getActiveAccount() || accounts[0] || null;
  }, [instance, accounts]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await instance.initialize();
      } catch {
        // ignore init error
      }
      if (!cancelled) setMsalReady(true);
    })();
    const t = setTimeout(() => {
      if (!cancelled) setMsalReady(true);
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [instance]);

  // Positioning for overlay dropdown (portal)
  const [overlayPos, setOverlayPos] = React.useState<{ left: number; top: number; width: number } | null>(null);
  const updateOverlayPos = React.useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setOverlayPos({ left: r.left, top: r.bottom + 4, width: r.width }); // 4px offset
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    updateOverlayPos();
    const onScrollOrResize = () => updateOverlayPos();

    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);

    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [isOpen, updateOverlayPos]);

  // Close on outside click (including overlay)
  React.useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (overlayRef.current?.contains(target)) return;
      // Clicked outside both input container and overlay
      setValue("");
      setResults([]);
      setApiError(null);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  // Debounced search to backend when numeric query is present
  const abortRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => {
    // Clear previous results on query change
    setApiError(null);

    if (!isNumericQuery) {
      setResults([]);
      setLoading(false);
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const doSearch = async () => {
      setLoading(true);
      try {
        let headers: HeadersInit = {};
        if (!isMock) {
          if (!API_SCOPE) {
            setApiError("Missing API scope");
            setLoading(false);
            return;
          }
          if (!msalReady || !activeAccount) {
            setNeedsLogin(true);
            setLoading(false);
            return;
          }
          // Try silent token; do not force login from this component
          try {
            const result = (await instance.acquireTokenSilent({
              scopes: [API_SCOPE],
              account: activeAccount || undefined,
              forceRefresh: false,
            })) as AuthenticationResult;
            headers = { Authorization: `Bearer ${result.accessToken}` };
          } catch {
            setNeedsLogin(true);
            setLoading(false);
            return;
          }
        }

        const params = new URLSearchParams();
        params.set("q", trimmed);
        params.set("top", "10");

        const res = await fetch(`/api/inventory/search?${params.toString()}`, {
          method: "GET",
          headers,
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 401) {
            setNeedsLogin(true);
            setResults([]);
            setLoading(false);
            return;
          }
          const text = await res.text();
          throw new Error(`Search ${res.status}: ${text}`);
        }
        const data = (await res.json()) as SearchResult[];
        setResults(data || []);
        setLoading(false);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setApiError(e instanceof Error ? e.message : "Search failed");
        setLoading(false);
      }
    };

    const t = setTimeout(doSearch, 250); // debounce
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [trimmed, isNumericQuery, instance, activeAccount, msalReady]);

  return (
    <div ref={containerRef} className={cn("w-full", className)}>
      <Command
        className={cn(
          // input-like chrome
          "border rounded-md bg-background shadow-sm transition-[box-shadow]",
          // ring when focused/open
          "focus-within:ring-1 focus-within:ring-ring/50",
          // normalize heights; hide internal divider when closed
          "[&_[data-slot=command-input-wrapper]]:h-10 [&_[data-slot=command-input]]:h-10",
          isOpen ? "ring-2 ring-ring/50" : "[&_[data-slot=command-input-wrapper]]:border-0"
        )}>
        {/* Anchor strictly around the input wrapper for accurate overlay positioning */}
        <div ref={anchorRef} className="relative">
          <CommandInput
            value={value}
            onValueChange={(v) => {
              setValue(v);
              if (!v.trim()) {
                setResults([]);
                setApiError(null);
              }
            }}
            placeholder="Search inventory or actions…"
            onKeyDown={(e) => {
              // Accept autocompletion with Tab or ArrowRight when caret is at the end
              if ((e.key === "Tab" || e.key === "ArrowRight") && suggestion) {
                const t = e.currentTarget as HTMLInputElement;
                const atEnd =
                  t.selectionStart === t.value.length && t.selectionEnd === t.value.length;
                if (atEnd) {
                  e.preventDefault();
                  setValue(suggestion);
                  return;
                }
              }
              if (e.key === "Escape") {
                setValue("");
                setResults([]);
                setApiError(null);
              }
              if (e.key === "Enter") {
                const v = (e.currentTarget as HTMLInputElement).value.trim();
                if (isDigitsOnly(v)) {
                  // Navigate directly to asset page
                  router.push(`/asset/${v}`);
                  setValue("");
                  setResults([]);
                }
              }
            }}
            // Do not open on focus alone; only typing opens it
            onFocus={() => {
              // no-op
            }}
          />

          {/* Ghost autocompletion overlay.
              Offset left to account for: px-3 (12px) + icon (16px) + gap-2 (8px) = 36px (pl-9) */}
          {value && suggestion && suggestion.toLowerCase().startsWith(trimmed.toLowerCase()) && (
            <div className="pointer-events-none absolute inset-0 flex items-center pl-9 pr-3">
              <div className="relative w-full text-sm text-muted-foreground/50 whitespace-nowrap overflow-hidden">
                <span className="invisible">{value}</span>
                <span>{suggestion.slice(value.length)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Results list is rendered in a portal as an overlay so it does not affect layout */}
        {isOpen &&
          overlayPos &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={overlayRef}
              style={{
                position: "fixed",
                left: overlayPos.left,
                top: overlayPos.top,
                width: overlayPos.width,
              }}
              className="z-50"
            >
              <div className="bg-popover text-popover-foreground border rounded-md shadow-lg overflow-hidden">
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>

                  {/* Asset results (only when numeric query) */}
                  {isNumericQuery && (
                    <>
                      <CommandGroup heading="Assets">
                        {/* Direct navigation option */}
                        <CommandItem
                          key={`open-${trimmed}`}
                          onSelect={() => {
                            router.push(`/asset/${trimmed}`);
                            setValue("");
                            setResults([]);
                          }}
                        >
                          <>Open asset <Highlight text={trimmed} tokens={tokens} /></>
                        </CommandItem>
                        {/* Auth prompt when needed */}
                        {!isMock && needsLogin && (
                          <CommandItem
                            key="signin"
                            onSelect={() => {
                              void triggerLogin();
                            }}
                          >
                            Sign in to search
                          </CommandItem>
                        )}
                        {loading && <CommandItem disabled>Searching…</CommandItem>}
                        {!loading && apiError && (
                          <CommandItem disabled className="text-destructive">
                            {apiError}
                          </CommandItem>
                        )}
                        {!loading &&
                          !apiError &&
                          results.map((r) => (
                            <CommandItem
                              key={r.asset}
                              onSelect={() => {
                                router.push(`/asset/${r.asset}`);
                                setValue("");
                                setResults([]);
                              }}
                            >
                              <span className="font-mono text-xs mr-2">
                                <Highlight text={r.asset} tokens={tokens} />
                              </span>
                              <span className="font-medium">
                                <Highlight text={r.model} tokens={tokens} />
                              </span>
                              <span className="mx-2 text-muted-foreground">—</span>
                              <span className="text-muted-foreground">
                                <Highlight text={r.userLocation} tokens={tokens} />
                              </span>
                            </CommandItem>
                          ))}
                        {!loading && !apiError && results.length === 0 && (
                          <CommandItem disabled>No matching assets</CommandItem>
                        )}
                      </CommandGroup>
                      <CommandSeparator />
                    </>
                  )}

                  <CommandGroup heading="Actions">
                    {actions.map((label) => (
                      <CommandItem key={label}>{label}</CommandItem>
                    ))}
                  </CommandGroup>

                  <CommandSeparator />

                  <CommandGroup heading="Navigation">
                    {navigation.map((label) => (
                      <CommandItem key={label}>{label}</CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </div>
            </div>,
            document.body
          )}
      </Command>
    </div>
  );
}
