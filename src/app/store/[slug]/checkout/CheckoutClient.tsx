"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/storefront/CartContext";
import { formatMoney } from "@/lib/money";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getQuoteAction, submitCheckoutAction } from "./actions";
import { ShieldCheck, Lock, AlertCircle, ArrowLeft, ShoppingBag, ChevronDown } from "lucide-react";
import Link from "next/link";

interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  methods: {
    id: string;
    name: string;
    rate: number;
    freeOver?: number;
    minDays?: number;
    maxDays?: number;
  }[];
}

export function CheckoutClient({
  storeSlug,
  currency = "USD",
  shippingZones = [],
}: {
  storeSlug: string;
  currency?: string;
  shippingZones?: ShippingZone[];
}) {
  const router = useRouter();
  const { items } = useCart();

  // Form states
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("US");
  const [phone, setPhone] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState("standard");
  const [discountCode, setDiscountCode] = useState("");
  const [showMobileSummary, setShowMobileSummary] = useState(false);

  const [quote, setQuote] = useState<any>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available shipping methods for current country
  const currentZone =
    shippingZones.find((z) => z.countries.includes(country.toUpperCase())) ||
    shippingZones.find((z) => z.countries.includes("*")) ||
    shippingZones[0];

  const availableMethods = currentZone?.methods || [
    { id: "standard", name: "Standard Shipping", rate: 500 },
  ];

  // Refresh server quote on change
  useEffect(() => {
    if (items.length === 0) return;

    let isCurrent = true;
    setIsLoadingQuote(true);

    getQuoteAction({
      storeSlug,
      items: items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
      })),
      discountCode: discountCode || undefined,
      country,
      shippingMethodId,
    }).then((res) => {
      if (isCurrent) {
        setIsLoadingQuote(false);
        if (res.success && res.quote) {
          setQuote(res.quote);
          setErrorMessage(null);
        } else {
          setErrorMessage(res.error || "Could not calculate quote");
        }
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [items, country, shippingMethodId, storeSlug]);

  const handleApplyDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!discountCode.trim()) return;

    setIsLoadingQuote(true);
    getQuoteAction({
      storeSlug,
      items: items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
      })),
      discountCode: discountCode.trim(),
      country,
      shippingMethodId,
    }).then((res) => {
      setIsLoadingQuote(false);
      if (res.success && res.quote) {
        setQuote(res.quote);
        if (!res.quote.appliedDiscount) {
          setErrorMessage("Discount code is invalid or has expired");
        } else {
          setErrorMessage(null);
        }
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await submitCheckoutAction({
      storeSlug,
      email,
      name,
      line1,
      city,
      region,
      postalCode,
      country,
      phone,
      shippingMethodId,
      discountCode: quote?.appliedDiscount ? quote.appliedDiscount.code : undefined,
      items: items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
      })),
    });

    setIsSubmitting(false);

    if (res.success && res.redirectUrl) {
      // Clear cart locally and redirect to payment/confirmation
      localStorage.removeItem("sf_cart_items");
      window.location.href = res.redirectUrl;
    } else {
      setErrorMessage(res.error || "Failed to process checkout. Please try again.");
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto py-24 text-center">
        <ShoppingBag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Your cart is empty</h2>
        <p className="text-sm text-slate-500 mb-6">You have no items in your cart to checkout.</p>
        <Link href={`/store/${storeSlug}/products`}>
          <Button>Return to Store</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <Link
          href={`/store/${storeSlug}/products`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Return to shopping
        </Link>
        <h1 className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">Express Checkout</h1>
      </div>

      {errorMessage && (
        <div className="mb-8 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Mobile Collapsible Order Summary Bar */}
      <div className="lg:hidden mb-6 border border-slate-200 rounded-2xl bg-slate-50/80 overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setShowMobileSummary(!showMobileSummary)}
          className="w-full px-4 py-3.5 flex items-center justify-between text-left focus:outline-none"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ShoppingBag className="w-4 h-4 text-indigo-600" />
            <span>{showMobileSummary ? "Hide order summary" : "Show order summary"}</span>
            <ChevronDown
              className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                showMobileSummary ? "rotate-180" : ""
              }`}
            />
          </div>
          <span className="text-base font-extrabold text-slate-900">
            {formatMoney(quote?.total || items.reduce((s, i) => s + i.price * i.quantity, 0), currency)}
          </span>
        </button>

        {showMobileSummary && (
          <div className="p-4 border-t border-slate-200/80 space-y-4 bg-white animate-in slide-in-from-top-1">
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.variantId} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 shrink-0 overflow-hidden flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate text-xs">{item.name}</p>
                      <p className="text-[11px] text-slate-500">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 shrink-0 text-xs">
                    {formatMoney(item.price * item.quantity, currency)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">
                  {formatMoney(quote?.subtotal || items.reduce((s, i) => s + i.price * i.quantity, 0), currency)}
                </span>
              </div>
              {quote?.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>-{formatMoney(quote.discountTotal, currency)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{quote?.shippingTotal === 0 ? "FREE" : formatMoney(quote?.shippingTotal || 0, currency)}</span>
              </div>
              {quote?.taxTotal > 0 && (
                <div className="flex justify-between">
                  <span>Estimated Tax</span>
                  <span>{formatMoney(quote.taxTotal, currency)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Shipping & Details */}
        <div className="lg:col-span-7 space-y-8">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>1. Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Email Address *"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                helperText="We'll send your order confirmation and tracking details here."
              />
              <Input
                label="Phone Number (Optional)"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <CardTitle>2. Shipping Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Recipient Full Name *"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
              />
              <Input
                label="Street Address *"
                required
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                placeholder="123 Main Street, Apt 4B"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="City *"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="New York"
                />
                <Input
                  label="State / Province"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="NY"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Postal Code *"
                  required
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="10001"
                />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Country *</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="US">United States (US)</option>
                    <option value="CA">Canada (CA)</option>
                    <option value="GB">United Kingdom (GB)</option>
                    <option value="NG">Nigeria (NG)</option>
                    <option value="GH">Ghana (GH)</option>
                    <option value="KE">Kenya (KE)</option>
                    <option value="ZA">South Africa (ZA)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Method */}
          <Card>
            <CardHeader>
              <CardTitle>3. Delivery Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {availableMethods.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                    shippingMethodId === m.id
                      ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shippingMethod"
                      value={m.id}
                      checked={shippingMethodId === m.id}
                      onChange={() => setShippingMethodId(m.id)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{m.name}</p>
                      {m.minDays && m.maxDays && (
                        <p className="text-xs text-slate-500">
                          Estimated {m.minDays}-{m.maxDays} business days
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="font-bold text-sm text-slate-900">
                    {m.rate === 0 ? "FREE" : formatMoney(m.rate, currency)}
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right: Order Summary */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="sticky top-28 bg-slate-50/50">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Item List */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.variantId} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-lg bg-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingBag className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{item.name}</p>
                        <p className="text-xs text-slate-500">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <span className="font-bold text-slate-900 shrink-0">
                      {formatMoney(item.price * item.quantity, currency)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Promo code input */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    placeholder="Discount code"
                    className="flex-1 uppercase rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleApplyDiscount}>
                    Apply
                  </Button>
                </div>
                {quote?.appliedDiscount && (
                  <p className="text-xs font-semibold text-emerald-600 mt-1.5">
                    ✓ Promo code applied: {quote.appliedDiscount.code}
                  </p>
                )}
              </div>

              {/* Totals Breakdown */}
              <div className="pt-4 border-t border-slate-200 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-medium text-slate-900">
                    {formatMoney(quote?.subtotal || items.reduce((s, i) => s + i.price * i.quantity, 0), currency)}
                  </span>
                </div>

                {quote?.discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span className="font-medium">-{formatMoney(quote.discountTotal, currency)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600">
                  <span>Shipping</span>
                  <span className="font-medium text-slate-900">
                    {quote?.shippingTotal === 0 ? "FREE" : formatMoney(quote?.shippingTotal || 0, currency)}
                  </span>
                </div>

                {quote?.taxTotal > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Estimated Tax</span>
                    <span className="font-medium text-slate-900">{formatMoney(quote.taxTotal, currency)}</span>
                  </div>
                )}

                <div className="flex justify-between text-base font-black text-slate-900 pt-3 border-t border-slate-200">
                  <span>Total Due</span>
                  <span>{formatMoney(quote?.total || 0, currency)}</span>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                isLoading={isSubmitting || isLoadingQuote}
                className="w-full py-4 text-base font-bold shadow-lg"
              >
                <Lock className="w-4 h-4 mr-2" /> Pay Now & Complete Order
              </Button>

              <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" /> Guaranteed 256-bit encrypted checkout
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
