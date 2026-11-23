"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { registerAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Store, User, Mail, Lock, Sparkles, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerAction, {});
  const [storeName, setStoreName] = useState("");

  const suggestedSlug = storeName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              SF
            </div>
            <span className="text-2xl font-black text-white tracking-tight">StoreForge</span>
          </Link>
          <h2 className="mt-4 text-2xl font-extrabold text-white tracking-tight">Create your digital storefront</h2>
          <p className="mt-1 text-sm text-slate-400">Launch a multi-tenant, production-grade e-commerce store in seconds</p>
        </div>

        <Card className="bg-slate-900/80 border-slate-800/80 backdrop-blur-xl shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg text-white">Merchant Registration</CardTitle>
            <CardDescription className="text-slate-400">
              Includes a 14-day full feature trial with isolated tenant storage
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state?.error && (
              <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                {state.error}
              </div>
            )}

            <form action={formAction} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Store Name *</label>
                <div className="relative">
                  <Store className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    name="storeName"
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Apex Apparel"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Store Subdomain / Slug *</label>
                <div className="flex rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950/60 focus-within:ring-2 focus-within:ring-indigo-500">
                  <input
                    name="desiredSlug"
                    type="text"
                    required
                    defaultValue={suggestedSlug}
                    key={suggestedSlug}
                    placeholder="apex-apparel"
                    className="flex-1 px-3.5 py-2.5 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                  />
                  <span className="px-3.5 py-2.5 bg-slate-800/80 text-xs text-slate-400 font-mono flex items-center">
                    .storeforge.com
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Owner Full Name *</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      name="ownerName"
                      type="text"
                      required
                      placeholder="Jane Doe"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Default Currency</label>
                  <select
                    name="currency"
                    defaultValue="USD"
                    className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                    <option value="NGN">NGN (₦) - Nigerian Naira</option>
                    <option value="KES">KES (KSh) - Kenyan Shilling</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Owner Work Email *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    name="ownerEmail"
                    type="email"
                    required
                    placeholder="founder@example.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Password * (min 8 chars)</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    name="password"
                    type="password"
                    required
                    placeholder="••••••••••••"
                    autoComplete="new-password"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/30"
                >
                  {isPending ? (
                    "Provisioning your store..."
                  ) : (
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> Create Store & Launch Admin
                    </span>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t border-slate-800/80 pt-4 text-center">
            <p className="text-xs text-slate-400">
              Already have a StoreForge account?{" "}
              <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4">
                Sign in
              </Link>
            </p>
            <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Isolated MongoDB
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Stripe / Paystack Ready
              </span>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
