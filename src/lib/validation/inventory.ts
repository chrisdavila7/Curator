import { z } from "zod";
import type { InventoryItem, InventoryStatus } from "@/types/inventory";

const ALLOWED_STATUSES = ["ready_to_deploy", "deployed", "retired"] as const;

function normalizeStatus(input: unknown): InventoryStatus {
  if (typeof input !== "string") {
    throw new Error("status must be a string");
  }
  const norm = input.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if ((ALLOWED_STATUSES as readonly string[]).includes(norm)) {
    return norm as InventoryStatus;
  }
  throw new Error(`invalid status: ${input}`);
}

function isValidUrlOrPath(val: string): boolean {
  if (!val) return false;
  if (val.startsWith("/")) return true;
  try {
    const u = new URL(val);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeAssetImage(input: unknown): string {
  if (typeof input !== "string") return "";
  const trimmed = input.trim();
  return isValidUrlOrPath(trimmed) ? trimmed : "";
}

function normalizeDate(input: unknown): string {
  if (typeof input !== "string") throw new Error("date must be a string");
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error(`invalid date: ${input}`);
  // UI expects YYYY-MM-DD strings
  return d.toISOString().slice(0, 10);
}

export const ZInventoryItem = z.object({
  asset: z.coerce.number().int(),
  userLocation: z.string().trim().min(1),
  status: z
    .any()
    .transform((v) => normalizeStatus(v)),
  serial: z.string().trim().min(1),
  model: z.string().trim().min(1),
  assetImage: z
    .any()
    .transform((v) => sanitizeAssetImage(v)),
  notes: z.string().default("").transform((v) => v.trim()),
  modified: z
    .any()
    .transform((v) => normalizeDate(v)),
  modifiedBy: z.string().trim().min(1),
  created: z
    .any()
    .transform((v) => normalizeDate(v)),
  createdBy: z.string().trim().min(1),
}) satisfies z.ZodType<InventoryItem>;

export type ZInventoryItemInput = z.input<typeof ZInventoryItem>;

export function parseInventoryItem(raw: unknown): InventoryItem {
  const result = ZInventoryItem.safeParse(raw);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    throw new Error(`Invalid InventoryItem: ${msg}`);
  }
  return result.data;
}

/**
 * Write-side schemas: partial field updates, create payloads, and optional ETag.
 */

export const ZInventoryUpdateFields = z
  .object({
    serial: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
    userLocation: z.string().trim().min(1).optional(),
    status: z
      .any()
      .transform((v) => normalizeStatus(v))
      .optional(),
    notes: z
      .string()
      .transform((v) => v.trim())
      .optional(),
    assetImage: z
      .any()
      .transform((v) => sanitizeAssetImage(v))
      .optional(),
  })
  // Ensure at least one field is provided
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided for update",
  });

export type InventoryUpdateFields = z.infer<typeof ZInventoryUpdateFields>;

// PATCH payload for /api/inventory/[asset]
export const ZInventoryPatchPayload = z.object({
  fields: ZInventoryUpdateFields,
  // Accept missing etag and let server decide whether to use If-Match: * (force) or require concurrency later
  etag: z.string().trim().min(1).optional(),
});
export type InventoryPatchPayload = z.infer<typeof ZInventoryPatchPayload>;

// Minimal create payload; extend as business rules evolve.
export const ZInventoryCreateFields = z.object({
  asset: z.coerce.number().int(),
  userLocation: z.string().trim().min(1),
  status: z
    .any()
    .transform((v) => normalizeStatus(v)),
  serial: z.string().trim().min(1),
  model: z.string().trim().min(1),
  assetImage: z
    .any()
    .transform((v) => sanitizeAssetImage(v))
    .optional(),
  notes: z
    .string()
    .default("")
    .transform((v) => v.trim())
    .optional(),
});
export type InventoryCreateFields = z.infer<typeof ZInventoryCreateFields>;

export const ZInventoryCreatePayload = z.object({
  fields: ZInventoryCreateFields,
});
export type InventoryCreatePayload = z.infer<typeof ZInventoryCreatePayload>;
