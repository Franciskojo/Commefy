import "server-only";
import { type ObjectId } from "mongodb";
import { platformCollection } from "@/lib/db/collections";
import type { AuditCategory, AuditLogDoc } from "@/lib/db/types";
import { hashIp } from "@/lib/security/crypto";
import { redact } from "@/lib/logger";

export interface RecordAuditParams {
  tenantId?: ObjectId;
  category: AuditCategory;
  action: string;
  outcome: "success" | "failure" | "denied";
  actor: {
    type: "user" | "customer" | "system" | "anonymous";
    id?: string;
    email?: string;
  };
  target?: {
    type: string;
    id?: string;
  };
  metadata?: Record<string, unknown>;
  requestId?: string;
  ip?: string;
}

export async function recordAudit(params: RecordAuditParams): Promise<void> {
  try {
    const col = await platformCollection("auditLogs");
    const entry: Omit<AuditLogDoc, "_id"> = {
      tenantId: params.tenantId,
      category: params.category,
      action: params.action,
      outcome: params.outcome,
      actor: {
        type: params.actor.type,
        id: params.actor.id,
        email: params.actor.email?.toLowerCase(),
      },
      target: params.target,
      metadata: params.metadata ? (redact(params.metadata) as Record<string, unknown>) : undefined,
      requestId: params.requestId,
      ipHash: hashIp(params.ip),
      createdAt: new Date(),
    };

    await col.insertOne(entry as AuditLogDoc);
  } catch (err) {
    // Audit logging failure should not crash the main business operation, but should be logged to stdout
    console.error("Failed to write audit log entry:", err);
  }
}
