export type YubikeyHandReceiptAsset = {
  tag: string;
  model: string;
  serial: string;
  replacementCost?: number;
};

export type YubikeyHandReceiptDates = {
  date1: string;
  date2: string;
  date3: string;
};

export type YubikeyHandReceiptInput = {
  userLocation: string;
  employee: string;
  supervisor?: string;
  asset: YubikeyHandReceiptAsset;
  dates: YubikeyHandReceiptDates;
};

export type YubikeyHandReceiptFields = Record<string, string | boolean | number>;

/**
 * Map a single asset and context to the AcroForm fields for:
 * Master Hand Receipts/Misc/Yubikey Hand Receipt.pdf
 *
 * Field labels confirmed by user:
 * - Employee 1, Date 1, Department/Location, Supervisor
 * - Asset Tag 1, Asset Name/Model 1, Serial Number 1, Replacement Cost 1
 * - Employee Name (Print), Date 2, CTS Department Representative, Date 3
 *
 * Notes:
 * - We only fill the "1" slot since Phase 3 starts with a single asset flow.
 * - Optional fields (supervisor, replacementCost) are omitted when not provided.
 */
export const mapToYubikeyHandReceipt = (
  input: YubikeyHandReceiptInput
): YubikeyHandReceiptFields => {
  const fields: YubikeyHandReceiptFields = {};

  // Department and supervisor
  fields["Department/Location"] = input.userLocation;
  if (input.supervisor && input.supervisor.trim().length > 0) {
    fields["Supervisor"] = input.supervisor;
  }

  // Primary employee and date
  fields["Employee 1"] = input.employee;
  fields["Date 1"] = input.dates.date1;

  // Asset details (slot 1)
  fields["Asset Tag 1"] = input.asset.tag;
  fields["Asset Name/Model 1"] = input.asset.model;
  fields["Serial Number 1"] = input.asset.serial;
  if (typeof input.asset.replacementCost === "number") {
    fields["Replacement Cost 1"] = String(input.asset.replacementCost);
  }

  // Print/signing section
  fields["Employee Name (Print)"] = input.employee;
  fields["Date 2"] = input.dates.date2;
  if (input.supervisor && input.supervisor.trim().length > 0) {
    fields["CTS Department Representative"] = input.supervisor;
  }
  fields["Date 3"] = input.dates.date3;

  return fields;
};
