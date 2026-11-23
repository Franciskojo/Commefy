"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCart } from "./CartContext";
import { ShoppingBag, Search, User, Menu, X } from "lucide-react";

export function Header({
  storeName,
  storeSlug,
  logoUrl,
  primaryColor = "#4f46e5",
}: {
  storeName: string;
  storeSlug: string;
  logoUrl?: string;
  primaryColor?: string;
}) {
  const { totalCount, openCart } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 transition-shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Brand / Logo */}
        <Link href={`/store/${storeSlug}`} className="flex items-center gap-3 shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} className="h-10 w-auto object-contain rounded-md" />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              {storeName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="font-extrabold text-xl tracking-tight text-slate-900">{storeName}</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-8">
          <Link
            href={`/store/${storeSlug}`}
            className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            Home
          </Link>
          <Link
            href={`/store/${storeSlug}/products`}
            className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            All Products
          </Link>
          <Link
            href={`/store/${storeSlug}/about`}
            className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            About Us
          </Link>
          <Link
            href={`/store/${storeSlug}/contact`}
            className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            Contact
          </Link>
        </nav>

        {/* Right Action Icons */}
        <div className="flex items-center gap-3">
          <Link
            href={`/store/${storeSlug}/account`}
            className="p-2.5 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors"
            title="Customer Account"
          >
            <User className="w-5 h-5" />
          </Link>

          {/* Cart Trigger Button */}
          <button
            onClick={openCart}
            className="relative p-2.5 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="View Shopping Cart"
          >
            <ShoppingBag className="w-5 h-5" />
            {totalCount > 0 && (
              <span
                className="absolute -top-1 -right-1 text-white text-[11px] font-bold h-5 min-w-5 px-1 rounded-full flex items-center justify-center animate-pulse"
                style={{ backgroundColor: primaryColor }}
              >
                {totalCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white px-4 pt-3 pb-6 space-y-3">
          <Link
            href={`/store/${storeSlug}`}
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-semibold text-slate-700 hover:bg-slate-50 rounded-lg"
          >
            Home
          </Link>
          <Link
            href={`/store/${storeSlug}/products`}
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-semibold text-slate-700 hover:bg-slate-50 rounded-lg"
          >
            All Products
          </Link>
          <Link
            href={`/store/${storeSlug}/about`}
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-semibold text-slate-700 hover:bg-slate-50 rounded-lg"
          >
            About Us
          </Link>
          <Link
            href={`/store/${storeSlug}/contact`}
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-semibold text-slate-700 hover:bg-slate-50 rounded-lg"
          >
            Contact
          </Link>
          <Link
            href={`/store/${storeSlug}/account`}
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-semibold text-slate-700 hover:bg-slate-50 rounded-lg"
          >
            Customer Account
          </Link>
        </div>
      )}
    </header>
  );
}
