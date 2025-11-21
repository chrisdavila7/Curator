"use client";

import * as React from "react";

type PageHeaderProps = {
  title?: string;
  className?: string;
};

/**
 * Standard page header matching the Home/Dashboard header.
 * Usage:
 *  - <PageHeader /> for default title and sizing
 *  - <PageHeader className="md:col-span-3" /> to span grid columns like Dashboard
 */
export default function PageHeader({ title = "Black Lab Solutions", className }: PageHeaderProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-semibold tracking-tight leading-none">
          <span className="sr-only">{title}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="block h-16 w-auto align-middle"
            src="/branding/blacklabsolutions-doghaustitle.svg"
            alt=""
            aria-hidden="true"
          />
        </h3>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="block h-[5.76rem] w-auto align-middle"
          src="/branding/blacklabsolutions-doghouseicon.svg"
          alt=""
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
