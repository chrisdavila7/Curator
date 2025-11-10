"use client";

/**
 * CheckInOutLottieToggle
 * - Standalone, click-to-play Lottie control to sit between the Stage card and Finalize card.
 * - Does NOT use the overlay lottie system.
 *
 * Behavior:
 * - On initial load, shows checkouttocheckin at ~1% poster (paused).
 * - 1st click: plays checkout -> checkin to 100%, then holds last frame.
 * - 2nd click: plays checkin -> checkout to 100%, then holds last frame.
 * - Subsequent clicks: always play the opposite of the currently postered animation and stop at 100%.
 * - While an animation is playing, clicks are ignored.
 */

import * as React from "react";
import LottiePlayer, { LottiePlayerRef } from "@/components/lottie/lottie-player";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type Dir = "c2i" | "i2c";

const PATHS: Record<Dir, string> = {
  c2i: "/animations/checkouttocheckin.json",
  i2c: "/animations/checkintocheckout.json",
};

const isCheckoutFromPoster = (dir: Dir | null): boolean => (dir === "i2c" ? true : false);

export default function CheckInOutLottieToggle({
  className,
  onModeChange,
  style,
  onUnavailableChange,
}: {
  className?: string;
  onModeChange?: (isCheckout: boolean) => void;
  style?: React.CSSProperties;
  onUnavailableChange?: (unavailable: boolean) => void;
}) {
  const ref = React.useRef<LottiePlayerRef>(null);

  // Cached animation JSON
  const [dataC2I, setDataC2I] = React.useState<object | null>(null);
  const [dataI2C, setDataI2C] = React.useState<object | null>(null);

  // Currently bound animation data for the Lottie component
  const [data, setData] = React.useState<object | null>(null);

  // Force remount when swapping animation data to ensure clean event hooks
  const [mountKey, setMountKey] = React.useState(0);

  // Playback/flow state
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [clicks, setClicks] = React.useState(0);
  const [posterAnim, setPosterAnim] = React.useState<Dir | null>(null); // which animation's last frame is currently shown
  const [playing, setPlaying] = React.useState<Dir | null>(null);

  // Ensure initial onModeChange(true) fires only once after initial poster
  const initialModeEmitted = React.useRef(false);

  // Load both animations and set initial poster (1% of c2i)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, b] = await Promise.all([
          fetch(PATHS.c2i, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
          fetch(PATHS.i2c, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        ]);
        if (cancelled) return;
        setDataC2I(a);
        setDataI2C(b);
        if (!a || !b) {
          onUnavailableChange?.(true);
          return;
        }
        onUnavailableChange?.(false);
        // Initial: show c2i at ~1% poster
        setData(a);
        setMountKey((k) => k + 1);
      } catch {
        if (!cancelled) onUnavailableChange?.(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onUnavailableChange]);

  // After initial mount of the Lottie with c2i data, set poster at ~1% (safeguard for short animations)
  React.useEffect(() => {
    if (!data || clicks > 0) return;

    let cancelled = false;
    let rafId: number | null = null;
    let attempts = 0;

    const apply = () => {
      if (cancelled) return;
      const inst = ref.current;
      if (inst) {
        const totalFrames = Math.floor(inst.getDuration(true) ?? 0);
        const atLeast = 1;
        const pctFrame = Math.max(atLeast, Math.floor(totalFrames * 0.01) || atLeast);
        inst.goToAndStop(pctFrame, true);
        // Reflect initial poster as c2i (Check Out)
        setPosterAnim("c2i");
        if (!initialModeEmitted.current) {
          initialModeEmitted.current = true;
          onModeChange?.(false);
        }
      } else if (attempts++ < 5) {
        rafId = requestAnimationFrame(apply);
      }
    };

    // Try immediately first (covers tests that only wait a single tick)
    apply();

    return () => {
      cancelled = true;
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [data, clicks, onModeChange]);

  const play = React.useCallback(
    (which: Dir) => {
      if (isPlaying) return;
      const next = which === "c2i" ? dataC2I : dataI2C;
      if (!next) return; // nothing to play
      setIsPlaying(true);
      setPlaying(which);
      setData(next);
      setMountKey((k) => k + 1);
      // Play from start on next frame
      requestAnimationFrame(() => ref.current?.goToAndPlay(0, true));
    },
    [isPlaying, dataC2I, dataI2C]
  );

  const onComplete = React.useCallback(() => {
    const inst = ref.current;
    if (inst) {
      const last = Math.max(0, Math.floor(inst.getDuration(true) ?? 1) - 1);
      inst.goToAndStop(last, true); // Ensure poster at 100%
    }
    if (playing) {
      setPosterAnim(playing);
      onModeChange?.(playing === "i2c");
    }
    setPlaying(null);
    setIsPlaying(false);
    setClicks((c) => c + 1);
  }, [playing, onModeChange]);

  const handleActivate = React.useCallback(() => {
    if (isPlaying) return;
    if (clicks === 0) return play("c2i");
    if (clicks === 1) return play("i2c");
    return play(posterAnim === "c2i" ? "i2c" : "c2i");
  }, [isPlaying, clicks, posterAnim, play]);

  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          aria-disabled={isPlaying}
          aria-pressed={isCheckoutFromPoster(posterAnim)}
          onClick={handleActivate}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleActivate();
            }
          }}
          style={style}
          className={[
            "rounded-md border bg-background/40 flex items-center justify-center",
            "transition-transform select-none opacity-100 scale-[1.15] origin-top",
            "cursor-pointer",
            className ?? "",
          ].join(" ")}
        >
          {data ? (
            <LottiePlayer
              key={mountKey}
              ref={ref}
              animationData={data}
              loop={false}
              autoplay={false}
              onComplete={onComplete}
              className="h-[120px] w-[120px]"
              ariaLabel="Check in/out toggle animation"
            />
          ) : (
            <div className="h-[120px] w-[120px] flex items-center justify-center text-muted-foreground text-sm">
              Animation unavailable
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        Toggle Check In/Out Mode
      </TooltipContent>
    </Tooltip>
  );
}
