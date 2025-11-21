"use client";

import * as React from "react";
import { motion } from "framer-motion";

export type FinalizeStatusIconKind = "in" | "out";

export const FINALIZE_STATUS_ICON_DURATION = 0.15;

type FinalizeStatusIconProps = {
  kind: FinalizeStatusIconKind;
  fallbackColor: string;
};

export default function FinalizeStatusIcon({ kind, fallbackColor }: FinalizeStatusIconProps) {
  const label = kind === "in" ? "Check In status" : "Check Out status";

  const fillColor = kind === "in" ? "#373753" : "#FA6E4B";

  return (
    <span
      data-testid="finalize-status-icon"
      aria-hidden="true"
      className="inline-flex items-center justify-center"
      style={{ color: fallbackColor }}
    >
      <motion.svg
        initial={{ scale: 0.3, opacity: 1 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 20, duration: FINALIZE_STATUS_ICON_DURATION }}
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={label}
        className="h-7 w-7"
      >
        {kind === "in" ? (
          <>
            <path
              d="M21 7.9999C20.9996 7.64918 20.9071 7.30471 20.7315 7.00106C20.556 6.69742 20.3037 6.44526 20 6.2699L13 2.2699C12.696 2.09437 12.3511 2.00195 12 2.00195C11.6489 2.00195 11.304 2.09437 11 2.2699L4 6.2699C3.69626 6.44526 3.44398 6.69742 3.26846 7.00106C3.09294 7.30471 3.00036 7.64918 3 7.9999V15.9999C3.00036 16.3506 3.09294 16.6951 3.26846 16.9987C3.44398 17.3024 3.69626 17.5545 4 17.7299L11 21.7299C11.304 21.9054 11.6489 21.9979 12 21.9979C12.3511 21.9979 12.696 21.9054 13 21.7299L20 17.7299C20.3037 17.5545 20.556 17.3024 20.7315 16.9987C20.9071 16.6951 20.9996 16.3506 21 15.9999V7.9999Z"
              fill={fillColor}
              stroke="black"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3.30005 7L12 12L20.7001 7"
              fill={fillColor}
              stroke="black"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 22V12Z"
              fill={fillColor}
            />
            <path
              d="M12 22V12"
              stroke="black"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          <>
            <path
              d="M21 7.9999C20.9996 7.64918 20.9071 7.30471 20.7315 7.00106C20.556 6.69742 20.3037 6.44526 20 6.2699L13 2.2699C12.696 2.09437 12.3511 2.00195 12 2.00195C11.6489 2.00195 11.304 2.09437 11 2.2699L4 6.2699C3.69626 6.44526 3.44398 6.69742 3.26846 7.00106C3.09294 7.30471 3.00036 7.64918 3 7.9999V15.9999C3.00036 16.3506 3.09294 16.6951 3.26846 16.9987C3.44398 17.3024 3.69626 17.5545 4 17.7299L11 21.7299C11.304 21.9054 11.6489 21.9979 12 21.9979C12.3511 21.9979 12.696 21.9054 13 21.7299L20 17.7299C20.3037 17.5545 20.556 17.3024 20.7315 16.9987C20.9071 16.6951 20.9996 16.3506 21 15.9999V7.9999Z"
              fill={fillColor}
              stroke="black"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3.30005 7L12 12L20.7001 7"
              fill={fillColor}
              stroke="black"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 22V12Z"
              fill={fillColor}
            />
            <path
              d="M12 22V12"
              stroke="black"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
      </motion.svg>
    </span>
  );
}
