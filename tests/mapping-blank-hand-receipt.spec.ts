import { describe, it, expect } from "vitest";

import { mapToBlankHandReceipt } from "@/lib/pdf/mappings/blank-hand-receipt";

describe("mapToBlankHandReceipt", () => {
  it("maps single asset with required fields and leaves specified fields blank", () => {
    const fields = mapToBlankHandReceipt({
      assets: [{ tag: "1323", model: "Model-X", serial: "SN-1323" }],
      employeeName: "Jane Doe", // User/Location
      ctsRepName: "John Smith", // current user display name
      date: "2025-11-11",
    });

    // Required fields
    expect(fields["Employee Name 1"]).toBe("Jane Doe");
    expect(fields["Date 1"]).toBe("2025-11-11");
    expect(fields["Asset Tag 1"]).toBe("1323");
    expect(fields["Asset Name/Model 1"]).toBe("Model-X");
    expect(fields["Serial Number 1"]).toBe("SN-1323");
    expect(Object.prototype.hasOwnProperty.call(fields, "Replacement Cost 1")).toBe(false);
    expect(fields["CTS Department Representative"]).toBe("John Smith");
    expect(fields["Date 3"]).toBe("2025-11-11");

    // Ensure other slots are not set
    expect(Object.prototype.hasOwnProperty.call(fields, "Asset Tag 2")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(fields, "Asset Name/Model 2")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(fields, "Serial Number 2")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(fields, "Replacement Cost 2")).toBe(false);

    // Explicitly left blank fields should not be present at all
    const leftBlank = [
      "Department/Location",
      "Supervisor",
      "Employee Name (Print)",
      "Date 2",
      "CTS Department Representative 2",
      "Date 4",
    ] as const;
    for (const name of leftBlank) {
      expect(Object.prototype.hasOwnProperty.call(fields, name)).toBe(false);
    }
  });

  it("fills up to 5 assets and does not exceed bounds", () => {
    const fields = mapToBlankHandReceipt({
      assets: [
        { tag: "1", model: "M1", serial: "S1" },
        { tag: "2", model: "M2", serial: "S2" },
        { tag: "3", model: "M3", serial: "S3" },
        { tag: "4", model: "M4", serial: "S4" },
        { tag: "5", model: "M5", serial: "S5" },
        { tag: "6", model: "M6", serial: "S6" }, // should be ignored
      ],
      employeeName: "Jane",
      ctsRepName: "Rep",
      date: "2025-11-11",
    });

    for (let i = 1; i <= 5; i++) {
      expect(fields[`Asset Tag ${i}`]).toBe(String(i));
      expect(fields[`Asset Name/Model ${i}`]).toBe(`M${i}`);
      expect(fields[`Serial Number ${i}`]).toBe(`S${i}`);
      expect(Object.prototype.hasOwnProperty.call(fields, `Replacement Cost ${i}`)).toBe(false);
    }
    expect(Object.prototype.hasOwnProperty.call(fields, "Asset Tag 6")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(fields, "Asset Name/Model 6")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(fields, "Serial Number 6")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(fields, "Replacement Cost 6")).toBe(false);
  });
});
