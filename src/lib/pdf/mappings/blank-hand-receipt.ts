export type BlankHandReceiptAsset = {
  tag: string;
  model: string;
  serial: string;
};

export type MapBlankHandReceiptInput = {
  // Up to 5 assets; extras ignored
  assets: BlankHandReceiptAsset[];
  // Employee Name 1 = User/Location value
  employeeName: string;
  // CTS Department Representative = current user display name
  ctsRepName: string;
  // Date 1 and Date 3 = current date (YYYY-MM-DD)
  date: string;
};

/**
 * Field mapping for "Master Hand Receipt/Blank Hand Receipt.pdf"
 *
 * Rules:
 * - (x) = Number 1..5; only fill slots for available assets; leave others unset
 * - Employee Name 1 = employeeName
 * - Date 1 = date
 * - Asset Tag (x) = assets[x-1].tag
 * - Asset Name/Model (x) = assets[x-1].model
 * - Serial Number (x) = assets[x-1].serial
 * - Replacement Cost (x) = "N/A" (string) for filled slots
 * - CTS Department Representative = ctsRepName
 * - Date 3 = date
 *
 * Leave the following fields blank (do NOT set them at all):
 * - Department/Location, Supervisor, Employee Name (Print), Date 2,
 *   CTS Department Representative 2, Date 4
 */
export const mapToBlankHandReceipt = (
  input: MapBlankHandReceiptInput
): Record<string, string | boolean | number> => {
  const out: Record<string, string | boolean | number> = {};

  // Employee name and primary date
  out["Employee Name 1"] = input.employeeName;
  out["Date 1"] = input.date;

  // Asset slots (1..5)
  const max = Math.min(5, input.assets.length);
  for (let i = 0; i < max; i++) {
    const n = i + 1;
    const a = input.assets[i];
    out[`Asset Tag ${n}`] = a.tag;
    out[`Asset Name/Model ${n}`] = a.model;
    out[`Serial Number ${n}`] = a.serial;
    // Replacement Cost intentionally left blank per latest requirement
  }

  // Representative and date 3
  out["CTS Department Representative"] = input.ctsRepName;
  out["Date 3"] = input.date;

  // Explicitly leave unspecified fields blank by NOT setting them:
  // Department/Location, Supervisor, Employee Name (Print), Date 2,
  // CTS Department Representative 2, Date 4

  return out;
};
