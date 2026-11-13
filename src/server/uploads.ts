// Small public files kept in the database, such as images in campaign
// emails. Fine for a handful of images; large files belong in object storage.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { uploads } from "@/db/schema";

// Kept under the request-size limit of common hosts.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

// No WebP or AVIF: Outlook and several older clients render them as a broken
// image, and a blast is the wrong place to discover that.
export const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif"]);

export async function saveUpload(input: {
  eventId: string;
  contentType: string;
  bytes: Buffer;
  createdBy: string;
}): Promise<{ id: string }> {
  const [row] = await db()
    .insert(uploads)
    .values({
      event_id: input.eventId,
      content_type: input.contentType,
      bytes: input.bytes,
      size: input.bytes.length,
      created_by: input.createdBy,
    })
    .returning({ id: uploads.id });
  return { id: row.id };
}

export async function getUpload(
  id: string,
): Promise<{ contentType: string; bytes: Buffer } | null> {
  const [row] = await db()
    .select({ contentType: uploads.content_type, bytes: uploads.bytes })
    .from(uploads)
    .where(eq(uploads.id, id))
    .limit(1);
  return row ?? null;
}
