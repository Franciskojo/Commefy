import { notFound, redirect } from "next/navigation";
import { resolveStorefrontTenant } from "@/lib/tenant/resolve";
import { tenantDb } from "@/lib/db/scoped";
import { confirmOrderPayment } from "@/features/checkout/service";

export default async function OrderConfirmCallbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reference?: string; trxref?: string; token?: string }>;
}) {
  const { slug } = await params;
  const { reference, trxref, token } = await searchParams;
  const paymentReference = reference || trxref;

  if (!paymentReference) {
    notFound();
  }

  const tenant = await resolveStorefrontTenant(slug);
  const db = await tenantDb(tenant._id);

  const payment = await db.payments.findOne({ reference: paymentReference });
  if (!payment) {
    notFound();
  }

  try {
    await confirmOrderPayment({
      tenantId: tenant._id,
      reference: paymentReference,
    });
  } catch (err) {
    console.error("Order payment confirmation warning:", err);
  }

  const targetUrl = `/store/${slug}/orders/${payment.orderId.toHexString()}${
    token ? `?token=${encodeURIComponent(token)}` : ""
  }`;
  redirect(targetUrl);
}

