"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, Plus } from "lucide-react";
import { useUserSearch, useLocations, type UserOption } from "@/hooks/use-inventory-options";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { InlineLoader } from "@/components/ui/inline-loader";

export type UserLocationSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  showManualButton?: boolean;
};

/**
 * Reusable User/Location selector.
 * Mirrors the behavior used in the Create dialog:
 * - Input with dropdown suggestions for Users and Locations
 * - Toggle button to open/close suggestions
 * - Manual entry toggle button
 */
export default function UserLocationSelect({
  id,
  value,
  onChange,
  placeholder = "Name",
  className,
  required,
  showManualButton = true,
}: UserLocationSelectProps) {
  // Open/close + manual state mirrors Create dialog
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [manual, setManual] = React.useState(false);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    users: userOptions,
    loading: usersLoading,
    error: usersError,
  } = useUserSearch(query, open);

  const {
    locations,
    loading: locationsLoading,
    error: locationsError,
    refetch: refetchLocations,
  } = useLocations();

  React.useEffect(() => {
    if (open && (locations.length === 0 || locationsError) && !locationsLoading) {
      void refetchLocations();
    }
  }, [open, locations.length, locationsError, locationsLoading, refetchLocations]);

  const filteredLocations = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? locations.filter((l) => l.toLowerCase().includes(q)) : locations;
  }, [locations, query]);

  const formatUser = React.useCallback((u: UserOption) => {
    const label = u.displayName || u.userPrincipalName || u.mail || u.id;
    const sub = u.mail || u.userPrincipalName || "";
    return { label, sub };
  }, []);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [menuRect, setMenuRect] = React.useState<DOMRect | null>(null);

  React.useLayoutEffect(() => {
    if (open && !manual) {
      const update = () => {
        const el = containerRef.current;
        if (el) setMenuRect(el.getBoundingClientRect());
      };
      update();
      window.addEventListener("resize", update);
      // capture scroll on ancestors too
      window.addEventListener("scroll", update, true);
      return () => {
        window.removeEventListener("resize", update);
        window.removeEventListener("scroll", update, true);
      };
    } else {
      setMenuRect(null);
    }
  }, [open, manual]);

  return (
    <div className={cn("flex gap-2", className)}>
      <div ref={containerRef} className="relative grow">
        <Input
          id={id}
          role="combobox"
          aria-expanded={open && !manual}
          aria-controls={id ? `${id}-options` : "userloc-options"}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={value}
          className={cn("pr-8")}
          onFocus={() => {
            if (!manual) setOpen(true);
          }}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v);
            setQuery(v);
            if (!manual) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          onBlur={() => {
            // Delay closing to allow option mousedown to fire first
            if (closeTimerRef.current) {
              clearTimeout(closeTimerRef.current);
            }
            closeTimerRef.current = setTimeout(() => {
              setOpen(false);
              closeTimerRef.current = null;
            }, 100);
          }}
          required={required}
        />
        {(usersLoading || locationsLoading) && (
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
            <Spinner size="sm" aria-label="Loading options" />
          </div>
        )}
        {open && !manual && menuRect && createPortal(
          <div
            id={id ? `${id}-options` : "userloc-options"}
            role="listbox"
            className="z-[9999] max-h-72 overflow-y-auto rounded-md border bg-popover shadow-md p-1 text-sm"
            style={{ position: "fixed", top: menuRect.bottom + 4, left: menuRect.left, width: menuRect.width }}
          >
            <div className="px-3 py-1 text-xs text-muted-foreground">Users</div>
            {usersLoading ? (
              <div className="px-3 py-2 text-muted-foreground">
                <InlineLoader label="Searching…" size="sm" />
              </div>
            ) : usersError ? (
              <div className="px-3 py-2 text-destructive">{usersError}</div>
            ) : query.trim().length >= 2 && userOptions.length === 0 ? (
              <div className="px-3 py-2 text-muted-foreground">No users</div>
            ) : (
              userOptions.map((u) => {
                const { label, sub } = formatUser(u);
                const v = label + (sub && sub !== label ? ` (${sub})` : "");
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
                      onChange(v);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span>{label}</span>
                      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
                    </div>
                  </button>
                );
              })
            )}

            <div className="mt-1 px-3 py-1 text-xs text-muted-foreground">Locations</div>
            {locationsLoading ? (
              <div className="px-3 py-2 text-muted-foreground">
                <InlineLoader label="Loading…" size="sm" />
              </div>
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
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  {opt}
                </button>
              ))
            )}
          </div>,
          document.body
        )}
      </div>

      <Button
        type="button"
        size="icon"
        variant="outline"
        aria-label="Toggle user/location list"
        title="Toggle user/location list"
        disabled={manual}
        onMouseDown={(e) => {
          // Prevent input blur from immediately closing
          e.preventDefault();
          if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
          }
        }}
        onClick={() => {
          if (manual) return;
          setOpen((o) => !o);
        }}
      >
        <ChevronDown className="size-4" />
      </Button>

      {showManualButton && (
        <Button
          type="button"
          size="icon"
          variant={manual ? "default" : "outline"}
          aria-pressed={manual}
          aria-label={manual ? "Manual entry enabled" : "Manual entry"}
          title={manual ? "Manual entry enabled" : "Manual entry"}
          onClick={() => {
            setManual((prev) => {
              const next = !prev;
              if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current);
                closeTimerRef.current = null;
              }
              if (next) {
                // enabling manual entry closes dropdown
                setOpen(false);
              } else {
                // disabling manual entry reopens suggestions
                setOpen(true);
              }
              return next;
            });
          }}
        >
          <Plus className="size-4" />
        </Button>
      )}
    </div>
  );
}
