import React from "react";
import Link from "next/link";
import { resolveStorefrontTenant } from "@/lib/tenant/resolve";
import { tenantDb } from "@/lib/db/scoped";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin, ArrowLeft, Headphones, Clock } from "lucide-react";

export default async function StorefrontContactPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveStorefrontTenant(slug);
  const db = await tenantDb(tenant._id);
  const settings = await db.storeSettings.findOne({});

  const storeName = settings?.storeName || tenant.name;
  const contactEmail = settings?.contact?.email || `support@${tenant.slug}.storeforge.io`;
  const contactPhone = settings?.contact?.phone;
  const contactAddress = settings?.contact?.address;
  const primaryColor = settings?.branding?.primaryColor || "#4f46e5";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div>
        <Link
          href={`/store/${slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to {storeName}
        </Link>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-3 tracking-tight">
          Contact {storeName}
        </h1>
        <p className="text-slate-600 mt-2 max-w-2xl">
          Have a question about an order, product availability, or shipping? Reach out to our team below.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white mb-2"
              style={{ backgroundColor: primaryColor }}
            >
              <Mail className="w-5 h-5" />
            </div>
            <CardTitle>Email Support</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>Send us an email anytime and we will respond within 1 business day.</p>
            <a
              href={`mailto:${contactEmail}`}
              className="inline-block font-bold text-indigo-600 hover:underline break-all pt-1"
            >
              {contactEmail}
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white mb-2"
              style={{ backgroundColor: primaryColor }}
            >
              <Phone className="w-5 h-5" />
            </div>
            <CardTitle>Phone & Hours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            {contactPhone ? (
              <>
                <p>Call our customer care line during business hours:</p>
                <a href={`tel:${contactPhone}`} className="inline-block font-bold text-slate-900 pt-1">
                  {contactPhone}
                </a>
              </>
            ) : (
              <p className="flex items-center gap-2 text-slate-500">
                <Clock className="w-4 h-4 shrink-0" /> Mon – Fri, 9:00 AM – 6:00 PM
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white mb-2"
              style={{ backgroundColor: primaryColor }}
            >
              <MapPin className="w-5 h-5" />
            </div>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            {contactAddress ? (
              <p className="font-medium text-slate-800">{contactAddress}</p>
            ) : (
              <p>Online storefront with tracked delivery to your doorstep.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <Headphones className="w-5 h-5 text-indigo-600" />
            <CardTitle>Order & Shipping Inquiries</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600 leading-relaxed">
          <p>
            If you are inquiring about an existing order, please include your <strong>Order Number</strong> and the email address used at checkout so we can assist you faster.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <a href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Support Inquiry - ${storeName}`)}`}>
              <Button style={{ backgroundColor: primaryColor }} className="text-white font-semibold">
                <Mail className="w-4 h-4 mr-2" /> Email Customer Support
              </Button>
            </a>
            <Link href={`/store/${slug}/policies/shipping`}>
              <Button variant="outline">View Shipping & Returns Policy</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

