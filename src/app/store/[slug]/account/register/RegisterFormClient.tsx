"use client";

import { useActionState } from "react";
import Link from "next/link";
import { customerRegisterAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Mail, Lock, User, ArrowRight } from "lucide-react";

export function RegisterFormClient({
  slug,
  storeName,
  primaryColor,
}: {
  slug: string;
  storeName: string;
  primaryColor: string;
}) {
  const [state, formAction, isPending] = useActionState(customerRegisterAction, {});

  return (
    <Card className="shadow-xl border-slate-200">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-slate-900">Create an account</CardTitle>
        <CardDescription>
          Sign up to enjoy express checkout, order tracking, and exclusive updates on {storeName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state?.error && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="slug" value={slug} />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Full Name *</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                name="name"
                type="text"
                required
                placeholder="Alex Morgan"
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Email Address *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                name="email"
                type="email"
                required
                placeholder="alex@example.com"
                autoComplete="email"
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Password * (min 8 chars)</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                name="password"
                type="password"
                required
                placeholder="••••••••••••"
                autoComplete="new-password"
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 pt-1 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              name="marketingOptIn"
              value="true"
              defaultChecked
              className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Keep me updated on new arrivals, sales, and special offers</span>
          </label>

          <Button
            type="submit"
            disabled={isPending}
            style={{ backgroundColor: primaryColor }}
            className="w-full text-white font-bold py-2.5 rounded-xl transition-all shadow-md mt-2"
          >
            {isPending ? "Creating account..." : "Complete Registration"}
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-center">
        <p className="text-xs text-slate-500">
          Already registered?{" "}
          <Link
            href={`/store/${slug}/account/login`}
            className="font-bold underline underline-offset-4 text-slate-900 hover:text-indigo-600"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
