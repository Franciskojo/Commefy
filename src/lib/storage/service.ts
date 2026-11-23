import "server-only";
import { type ObjectId } from "mongodb";
import { getEnv } from "@/lib/env";
import { Errors } from "@/lib/errors";
import { randomToken } from "@/lib/security/crypto";
import { rawTenantCollection } from "@/lib/db/collections";
import type { MediaDoc } from "@/lib/db/types";

// Supported MIME types and magic byte headers
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function validateImageMagicBytes(buffer: Buffer): { valid: boolean; mime?: string } {
  if (buffer.length < 12) return { valid: false };

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, mime: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, mime: "image/png" };
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { valid: true, mime: "image/gif" };
  }

  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, mime: "image/webp" };
  }

  return { valid: false };
}

export async function uploadImage(params: {
  tenantId: ObjectId;
  actorUserId: ObjectId;
  buffer: Buffer;
  clientMime: string;
}): Promise<MediaDoc> {
  const env = getEnv();

  if (params.buffer.length > env.UPLOAD_MAX_BYTES) {
    throw Errors.validation(`File exceeds maximum size limit of ${Math.round(env.UPLOAD_MAX_BYTES / 1024 / 1024)}MB`);
  }

  const magic = validateImageMagicBytes(params.buffer);
  if (!magic.valid || !magic.mime || !ALLOWED_MIME_TYPES.has(magic.mime)) {
    throw Errors.validation("Invalid or unsupported image format. Allowed formats: JPEG, PNG, WebP, GIF");
  }

  const mime = magic.mime;
  const ext = mime.split("/")[1];
  const randomKey = randomToken(16);
  const storageKey = `tenants/${params.tenantId.toHexString()}/${randomKey}.${ext}`;

  let url: string;
  let provider: "mongo" | "cloudinary" = "mongo";

  if (env.STORAGE_PROVIDER === "cloudinary" && env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY) {
    provider = "cloudinary";
    const endpoint = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`;
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(params.buffer)], { type: mime });
    formData.append("file", blob, `${randomKey}.${ext}`);
    formData.append("public_id", storageKey.replace(/\.[^.]+$/, ""));
    formData.append("api_key", env.CLOUDINARY_API_KEY);

    const res = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw Errors.internal("Failed to upload image to Cloudinary");
    }
    const data = await res.json();
    url = data.secure_url;
  } else {
    // Default mongo/base64 data-URI provider for zero-config local dev & tests
    const base64 = params.buffer.toString("base64");
    url = `data:${mime};base64,${base64}`;
  }

  const mediaDoc: MediaDoc = {
    _id: new (await import("mongodb")).ObjectId(),
    tenantId: params.tenantId,
    key: storageKey,
    provider,
    url,
    mime,
    bytes: params.buffer.length,
    width: 800,
    height: 800,
    status: "attached",
    createdBy: params.actorUserId,
    createdAt: new Date(),
  };

  const mediaCol = await rawTenantCollection("media");
  await mediaCol.insertOne(mediaDoc);

  return mediaDoc;
}
