import { describe, it, expect } from "vitest";

import { mapToYubikeyHandReceipt } from "@/lib/pdf/mappings/yubikey-hand-receipt";

describe("mapToYubikeyHandReceipt", () => {
  it("maps a single asset and provided context to Yubikey Hand Receipt field names", () => {
    const fields = mapToYubikeyHandReceipt({
      userLocation: "HQ",
      employee: "Jane Doe",
      supervisor: "John Smith",
      asset: {
        tag: "1323",
        model: "Yubikey 5 NFC",
        serial: "YK-ABC-123",
        replacementCost: 50,
      },
      dates: {
        date1: "2025-11-10",
        date2: "2025-11-10",
        date3: "2025-11-10",
      },
    });

    // Department and supervisor
    expect(fields["Department/Location"]).toBe("HQ");
    expect(fields["Supervisor"]).toBe("John Smith");

    // Primary employee and dates
    expect(fields["Employee 1"]).toBe("Jane Doe");
    expect(fields["Date 1"]).toBe("2025-11-10");

    // Asset details (first slot only)
    expect(fields["Asset Tag 1"]).toBe("1323");
    expect(fields["Asset Name/Model 1"]).toBe("Yubikey 5 NFC");
    expect(fields["Serial Number 1"]).toBe("YK-ABC-123");
    expect(fields["Replacement Cost 1"]).toBe("50");

    // Print/signing section
    expect(fields["Employee Name (Print)"]).toBe("Jane Doe");
    expect(fields["Date 2"]).toBe("2025-11-10");
    expect(fields["CTS Department Representative"]).toBe("John Smith");
    expect(fields["Date 3"]).toBe("2025-11-10");
  });

  it("omits optional fields cleanly when not provided (replacementCost, supervisor)", () => {
    const fields = mapToYubikeyHandReceipt({
      userLocation: "HQ",
      employee: "Jane Doe",
      asset: {
        tag: "1323",
        model: "Yubikey 5 NFC",
        serial: "YK-ABC-123",
      },
      dates: {
        date1: "2025-11-10",
        date2: "2025-11-10",
        date3: "2025-11-10",
      },
    });

    expect(fields["Department/Location"]).toBe("HQ");
    expect(fields["Supervisor"]).toBeUndefined();
    expect(fields["Replacement Cost 1"]).toBeUndefined();
  });
});
