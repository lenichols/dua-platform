// Where uploaded files go. Pick a provider with STORAGE_PROVIDER:
//
//   database  (default)  in Postgres; nothing else to set up
//   s3                   any S3-compatible service: AWS S3, Cloudflare R2,
//                        Backblaze B2, MinIO, DigitalOcean Spaces…
//   supabase             a public bucket in Supabase Storage
//
// Uploads are public by design: they're images used in campaign emails, and
// a mail client has to be able to load them without signing in.
//
// To add another provider, write a function that returns a FileStore and add
// it to `fileStore` below.

import { randomUUID } from "crypto";
import { AwsClient } from "aws4fetch";
import { siteUrl } from "@/lib/email";
import { saveUpload } from "../uploads";
import { supabaseAdmin } from "./supabase";

export type NewFile = {
  eventId: string;
  bytes: Buffer;
  contentType: string;
  /** File extension without the dot, e.g. "png". */
  ext: string;
  createdBy: string;
};

export interface FileStore {
  /** Stores the file and returns a public URL for it. */
  put(file: NewFile): Promise<{ url: string }>;
}

export type StorageProviderName = "database" | "s3" | "supabase";

const trimSlashes = (s: string) => s.replace(/\/+$/, "");

function need(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set. It's required by STORAGE_PROVIDER.`);
  return value;
}

/** A name nobody can guess, grouped by event. */
const objectKey = (file: NewFile) => `${file.eventId}/${Date.now()}-${randomUUID()}.${file.ext}`;

// Emails live a long time and each upload gets its own name, so the file
// never changes underneath a message that already went out.
const CACHE_CONTROL = "public, max-age=31536000, immutable";

// ── database ─────────────────────────────────────────────────────

function database(): FileStore {
  return {
    async put(file) {
      const { id } = await saveUpload({
        eventId: file.eventId,
        contentType: file.contentType,
        bytes: file.bytes,
        createdBy: file.createdBy,
      });
      // Absolute, because the image is loaded from inside an inbox.
      return { url: `${siteUrl()}/uploads/${id}.${file.ext}` };
    },
  };
}

// ── S3-compatible ────────────────────────────────────────────────

/**
 * Settings:
 *   S3_BUCKET             the bucket name
 *   S3_ACCESS_KEY_ID      \
 *   S3_SECRET_ACCESS_KEY  /  credentials that may write to the bucket
 *   S3_REGION             e.g. "us-east-1" ("auto" for Cloudflare R2)
 *   S3_ENDPOINT           the service's address. Leave unset for AWS itself.
 *   S3_PUBLIC_URL         where the bucket's files can be read from, if that
 *                         differs from where they're written (a CDN or a
 *                         public bucket domain). Files are stored under it
 *                         by key.
 */
function s3(): FileStore {
  const bucket = need("S3_BUCKET");
  const region = process.env.S3_REGION?.trim() || "us-east-1";
  const endpoint = process.env.S3_ENDPOINT?.trim();
  // With a custom endpoint the bucket goes in the path, which every
  // S3-compatible service accepts. AWS itself wants it in the host name.
  const writeBase = endpoint
    ? `${trimSlashes(endpoint)}/${bucket}`
    : `https://${bucket}.s3.${region}.amazonaws.com`;
  const readBase = trimSlashes(process.env.S3_PUBLIC_URL?.trim() || writeBase);
  const client = new AwsClient({
    accessKeyId: need("S3_ACCESS_KEY_ID"),
    secretAccessKey: need("S3_SECRET_ACCESS_KEY"),
    service: "s3",
    region,
  });

  return {
    async put(file) {
      const key = objectKey(file);
      const res = await client.fetch(`${writeBase}/${key}`, {
        method: "PUT",
        headers: { "Content-Type": file.contentType, "Cache-Control": CACHE_CONTROL },
        body: new Uint8Array(file.bytes),
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 300);
        throw new Error(`The storage service refused the upload (${res.status}). ${detail}`);
      }
      return { url: `${readBase}/${key}` };
    },
  };
}

// ── Supabase Storage ─────────────────────────────────────────────

/**
 * Settings: SUPABASE_URL, SUPABASE_SECRET_KEY, and optionally
 * SUPABASE_STORAGE_BUCKET (default "dua-uploads"). The bucket is created as
 * a public bucket the first time it's needed.
 */
function supabase(): FileStore {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "dua-uploads";
  return {
    async put(file) {
      const client = supabaseAdmin();
      const key = objectKey(file);
      const upload = () =>
        client.storage.from(bucket).upload(key, file.bytes, {
          contentType: file.contentType,
          cacheControl: "31536000",
          upsert: false,
        });

      let { error } = await upload();
      if (error && /bucket not found/i.test(error.message)) {
        const created = await client.storage.createBucket(bucket, { public: true });
        if (created.error && !/already exists/i.test(created.error.message))
          throw new Error(`Couldn't create the "${bucket}" bucket: ${created.error.message}`);
        ({ error } = await upload());
      }
      if (error) throw new Error(`Supabase Storage refused the upload: ${error.message}`);
      return { url: client.storage.from(bucket).getPublicUrl(key).data.publicUrl };
    },
  };
}

// ── choosing one ─────────────────────────────────────────────────

export function storageProviderName(env = process.env): StorageProviderName {
  const chosen = env.STORAGE_PROVIDER?.trim().toLowerCase();
  if (!chosen || chosen === "database") return "database";
  if (chosen === "s3" || chosen === "supabase") return chosen;
  throw new Error(`STORAGE_PROVIDER must be "database", "s3" or "supabase", not "${chosen}".`);
}

export function fileStore(): FileStore {
  const name = storageProviderName();
  return name === "s3" ? s3() : name === "supabase" ? supabase() : database();
}
