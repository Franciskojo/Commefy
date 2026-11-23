"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
            SF
          </div>
          <div>
            <span className="text-xl font-black text-white tracking-tight">StoreForge</span>
            <span className="text-[10px] block font-mono text-indigo-400 font-semibold tracking-wider uppercase">
              Enterprise Multi-Tenant SaaS
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-400">
          <a href="#architecture" className="hover:text-white transition-colors">
            Architecture
          </a>
          <a href="#tenancy" className="hover:text-white transition-colors">
            Tenant Isolation
          </a>
          <a href="#payments" className="hover:text-white transition-colors">
            Payment Rails
          </a>
          <a href="#demo" className="hover:text-white transition-colors">
            Demo Stores
          </a>
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/auth/login">
            <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800/60 text-sm">
              Sign In
            </Button>
          </Link>
          <Link href="/auth/register">
            <Button className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/25">
              Launch Store
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <Link href="/auth/login" className="text-xs font-semibold text-slate-300 hover:text-white px-2 py-1">
            Sign In
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-indigo-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-2xl px-5 py-6 space-y-5 animate-in slide-in-from-top-2 duration-200 shadow-2xl">
          <nav className="flex flex-col space-y-1 font-semibold text-sm text-slate-300">
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-slate-900 hover:text-white transition-colors"
            >
              Architecture
            </a>
            <a
              href="#tenancy"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-slate-900 hover:text-white transition-colors"
            >
              Tenant Isolation
            </a>
            <a
              href="#payments"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-slate-900 hover:text-white transition-colors"
            >
              Payment Rails
            </a>
            <a
              href="#demo"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-slate-900 hover:text-white transition-colors"
            >
              Demo Stores
            </a>
          </nav>

          <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-2.5">
            <Link href="/auth/register" onClick={() => setMobileMenuOpen(false)} className="w-full">
              <Button className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-indigo-600/30">
                Launch Store
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
            <Link href="/platform" onClick={() => setMobileMenuOpen(false)} className="w-full">
              <Button variant="outline" className="w-full border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900 text-xs">
                <ShieldCheck className="w-4 h-4 mr-1.5 text-indigo-400" /> Platform Super-Admin
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
