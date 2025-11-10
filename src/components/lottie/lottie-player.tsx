/* 
  Reusable client-safe Lottie wrapper for future animations.
  - No animations are imported or rendered here.
  - Marked as a client component to avoid SSR issues.
  - Exposes the Lottie instance via forwardRef for imperative control.
*/
"use client";

import React from "react";
import Lottie, { LottieRefCurrentProps } from "lottie-react";

export type LottiePlayerProps = {
  animationData: object; // JSON content for the animation (to be provided by consumers later)
  loop?: boolean | number;
  autoplay?: boolean;
  speed?: number; // applied via ref when available
  direction?: 1 | -1; // applied via ref when available
  className?: string;
  style?: React.CSSProperties;
  initialSegment?: [number, number];
  role?: string;
  ariaLabel?: string;

  // Event handlers supported by lottie-react (pass-through)
  onComplete?: () => void;
  onLoopComplete?: () => void;
  onEnterFrame?: () => void;

  // Escape hatch for additional Lottie props (excluding ones we control)
  lottieProps?: Omit<
    React.ComponentProps<typeof Lottie>,
    | "animationData"
    | "loop"
    | "autoplay"
    | "lottieRef"
    | "initialSegment"
    | "onComplete"
    | "onLoopComplete"
    | "onEnterFrame"
  >;
};

/**
 * LottiePlayer
 * - Client-only wrapper around lottie-react's <Lottie />
 * - Provides a stable API and forwards the internal Lottie instance via ref
 *
 * Example (for later use):
 *   const ref = useRef<LottieRefCurrentProps>(null);
 *   <LottiePlayer ref={ref} animationData={data} loop autoplay className="h-24 w-24" />
 *   // ref.current?.play(); ref.current?.pause(); ref.current?.setSpeed(1.5); etc.
 */
const LottiePlayer = React.forwardRef<LottieRefCurrentProps, LottiePlayerProps>(
  (
    {
      animationData,
      loop = true,
      autoplay = true,
      speed,
      direction,
      className,
      style,
      initialSegment,
      role,
      ariaLabel,
      onComplete,
      onLoopComplete,
      onEnterFrame,
      lottieProps,
    },
    forwardedRef
  ) => {
    const innerRef = React.useRef<LottieRefCurrentProps>(null);

    // Expose the inner Lottie instance to consumers (mirror lottieRef to forwardedRef)
    const setRef = (ref: React.ForwardedRef<LottieRefCurrentProps>, value: LottieRefCurrentProps | null) => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref && typeof ref === "object") {
        (ref as React.MutableRefObject<LottieRefCurrentProps | null>).current = value;
      }
    };

    React.useLayoutEffect(() => {
      // assign current instance to forwarded ref on mount, and cleanup on unmount
      setRef(forwardedRef, innerRef.current ?? null);
      return () => {
        setRef(forwardedRef, null);
      };
    }, []);

    // Apply speed/direction imperatively if provided
    React.useEffect(() => {
      const inst = innerRef.current;
      if (!inst) return;
      if (typeof speed === "number") inst.setSpeed(speed);
      if (typeof direction === "number") inst.setDirection(direction as 1 | -1);
    }, [speed, direction]);

    return (
      <Lottie
        animationData={animationData}
        loop={loop}
        autoplay={autoplay}
        lottieRef={innerRef}
        className={className}
        style={style}
        initialSegment={initialSegment}
        role={role ?? "img"}
        aria-label={ariaLabel}
        onComplete={onComplete}
        onLoopComplete={onLoopComplete}
        onEnterFrame={onEnterFrame}
        {...lottieProps}
      />
    );
  }
);

LottiePlayer.displayName = "LottiePlayer";

export type { LottieRefCurrentProps as LottiePlayerRef };
export default LottiePlayer;
