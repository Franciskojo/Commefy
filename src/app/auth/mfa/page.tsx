"use client";

import { useActionState } from "react";
import Link from "next/link";
import { verifyMfaAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { ShieldCheck, ArrowRight, KeyRound } from "lucide-react";

export default function MfaPage() {
  const [state, formAction, isPending] = useActionState(verifyMfaAction, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-indigo-600/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              SF
            </div>
            <span className="text-2xl font-black text-white tracking-tight">StoreForge</span>
          </Link>
          <h2 className="mt-4 text-xl font-bold text-white tracking-tight">Two-Factor Authentication</h2>
          <p className="mt-1 text-xs text-slate-400">Enter the verification code from your authenticator app</p>
        </div>

        <Card className="bg-slate-900/80 border-slate-800/80 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" /> Security Verification
            </CardTitle>
            <CardDescription className="text-slate-400">
              Your account requires two-factor verification to proceed
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
                <label className="text-xs font-semibold text-slate-300">6-Digit Code or Recovery Key</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    name="code"
                    type="text"
                    required
                    autoFocus
                    placeholder="123456 or xxxx-xxxx"
                    maxLength={10}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm font-mono tracking-widest text-center text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/25 mt-2"
              >
                {isPending ? "Verifying..." : "Verify Identity"}
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t border-slate-800/80 pt-4 text-center">
            <p className="text-xs text-slate-400">
              Need to switch accounts?{" "}
              <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4">
                Return to sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
