import "server-only";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { platformCollection } from "@/lib/db/collections";

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; id?: string }> {
  const env = getEnv();

  if (env.EMAIL_PROVIDER === "resend" && env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: params.to,
          subject: params.subject,
          text: params.text,
          html: params.html || params.text,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        logger.error("Resend API error", { status: res.status, err });
        return { success: false };
      }

      const data = await res.json();
      return { success: true, id: data.id };
    } catch (err) {
      logger.error("Failed to send email via Resend", { err });
      return { success: false };
    }
  }

  // Fallback: log provider (development & test)
  logger.info("Transactional Email Dispatched (log provider)", {
    to: params.to,
    subject: params.subject,
  });

  try {
    const col = await platformCollection("devEmails");
    await col.insertOne({
      _id: new (await import("mongodb")).ObjectId(),
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html || params.text,
      createdAt: new Date(),
    });
  } catch (err) {
    logger.warn("Could not save to devEmails collection", { err });
  }

  return { success: true, id: `mock-${Date.now()}` };
}
