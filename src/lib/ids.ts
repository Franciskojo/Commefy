import { ObjectId } from "mongodb";
import { Errors } from "@/lib/errors";

/** Strict ObjectId parsing for untrusted input (24 hex chars only – no 12-byte strings). */
export function parseObjectId(value: unknown, label = "id"): ObjectId {
  if (typeof value !== "string" || !/^[a-f0-9]{24}$/i.test(value)) {
    throw Errors.validation(`Invalid ${label}`);
  }
  return new ObjectId(value);
}

export function tryParseObjectId(value: unknown): ObjectId | null {
  return typeof value === "string" && /^[a-f0-9]{24}$/i.test(value) ? new ObjectId(value) : null;
}

export function idStr(id: ObjectId | string): string {
  return typeof id === "string" ? id : id.toHexString();
}
