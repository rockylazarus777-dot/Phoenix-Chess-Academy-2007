import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

/**
 * Server-only Cloudflare R2 client — certificate PDF storage only
 * (Phase 18). NEVER imported from a Client Component (enforced by
 * `server-only`).
 *
 * STORAGE PROVIDER DECISION: Cloudflare R2, accessed via its
 * S3-compatible API. The bucket is PRIVATE — no `r2.dev` public URL, no
 * custom public media domain is ever read or constructed here. See
 * docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Private R2 Bucket
 * Decision".
 *
 * R2 ENVIRONMENT ARCHITECTURE: this project already has generic R2
 * account credentials from Phase 13 (`CLOUDFLARE_ACCOUNT_ID`,
 * `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`) —
 * those three are REUSED as-is here, per "reuse existing R2
 * architecture, do not create duplicate incompatible configuration."
 * `CLOUDFLARE_R2_BUCKET_NAME` / `CLOUDFLARE_R2_PUBLIC_URL` (also Phase
 * 13) are deliberately NOT reused — those describe a PUBLIC media
 * bucket, structurally incompatible with private certificate storage.
 * A new, certificate-specific, server-only bucket variable is added
 * instead: `CLOUDFLARE_R2_CERTIFICATES_BUCKET` (no public-URL
 * companion exists or is ever added for it). The S3 endpoint is derived
 * deterministically from the account ID
 * (`https://<accountId>.r2.cloudflarestorage.com`, R2's documented
 * endpoint shape) rather than requiring a separate endpoint env var —
 * one fewer piece of duplicated configuration to keep in sync.
 *
 * AWS SDK PACKAGE DECISION: only `@aws-sdk/client-s3` is installed.
 * `@aws-sdk/s3-request-presigner` is deliberately NOT installed —
 * Phase 18's download architecture never issues a signed/presigned R2
 * URL to the browser; every download is streamed through the
 * application's own Route Handler (see
 * `/api/certificates/[certificateId]/download`). See "AWS SDK Package
 * Decision" in docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md.
 *
 * R2 CONFIGURATION FAILURE: `isR2Configured()` lets callers fail safely
 * (a `STORAGE_UNAVAILABLE` action result / generic download-unavailable
 * response) instead of throwing when R2 env vars are simply not set in
 * this environment yet. The S3 client itself is constructed lazily
 * (only inside `getClient()`, on first real use) so importing this
 * module never crashes the app at startup.
 */

const MAX_CERTIFICATE_PDF_BYTES = 10 * 1024 * 1024; // 10 MB — see "PDF Maximum Size"

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

let cachedClient: S3Client | null = null;

function readR2Config(): R2Config | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.CLOUDFLARE_R2_CERTIFICATES_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function getClient(config: R2Config): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return cachedClient;
}

/** Lets callers (generation action, download route) fail safely when R2 env vars are not configured. */
export function isR2Configured(): boolean {
  return readR2Config() !== null;
}

/**
 * Uploads one certificate PDF to the private R2 bucket. Never logs the
 * underlying AWS/R2 error (may contain request metadata) — callers map
 * any failure to the safe `R2_UPLOAD_FAILED` internal code only.
 */
export async function uploadCertificatePdf(key: string, bytes: Uint8Array): Promise<{ ok: true } | { ok: false }> {
  const config = readR2Config();
  if (!config) return { ok: false };

  if (bytes.byteLength === 0 || bytes.byteLength > MAX_CERTIFICATE_PDF_BYTES) {
    return { ok: false };
  }

  try {
    const client = getClient(config);
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: bytes,
        ContentType: "application/pdf",
      }),
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Fetches one certificate PDF's bytes from the private R2 bucket, for
 * streaming through the download Route Handler. Never returns/logs the
 * raw AWS/R2 error (e.g. NoSuchKey, endpoint, bucket) — the caller
 * always converts a `{ ok: false }` result into one generic "certificate
 * unavailable" response.
 */
export async function getCertificatePdfObject(key: string): Promise<{ ok: true; body: Uint8Array } | { ok: false }> {
  const config = readR2Config();
  if (!config) return { ok: false };

  try {
    const client = getClient(config);
    const result = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }),
    );

    if (!result.Body) return { ok: false };
    const body = await result.Body.transformToByteArray();
    if (body.byteLength === 0 || body.byteLength > MAX_CERTIFICATE_PDF_BYTES) {
      return { ok: false };
    }
    return { ok: true, body };
  } catch {
    return { ok: false };
  }
}

export { MAX_CERTIFICATE_PDF_BYTES };
