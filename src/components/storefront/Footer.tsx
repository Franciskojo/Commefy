import React from "react";
import Link from "next/link";
import { ShieldCheck, Truck, RotateCcw, Headphones } from "lucide-react";

export function Footer({
  storeName,
  storeSlug,
  tagline,
  contactEmail,
}: {
  storeName: string;
  storeSlug: string;
  tagline?: string;
  contactEmail?: string;
}) {
  return (
    <footer className="bg-slate-950 text-slate-400 mt-24">
      {/* Trust Badges */}
      <div className="border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Secure Payments</h4>
              <p className="text-xs text-slate-400 mt-0.5">Encrypted transactions</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-indigo-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Fast Delivery</h4>
              <p className="text-xs text-slate-400 mt-0.5">Tracked shipments</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-indigo-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Easy Returns</h4>
              <p className="text-xs text-slate-400 mt-0.5">14-day return policy</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-indigo-400">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Customer Support</h4>
              <p className="text-xs text-slate-400 mt-0.5">Dedicated assistance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">{storeName}</h3>
          <p className="text-sm text-slate-400">
            {tagline || "Providing quality products with exceptional customer service and secure shopping."}
          </p>
          {contactEmail && (
            <p className="text-xs text-slate-400">
              Support: <a href={`mailto:${contactEmail}`} className="text-indigo-400 hover:underline">{contactEmail}</a>
            </p>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Shop</h4>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link href={`/store/${storeSlug}/products`} className="hover:text-white transition-colors">
                All Products
              </Link>
            </li>
            <li>
              <Link href={`/store/${storeSlug}/products?sort=best_selling`} className="hover:text-white transition-colors">
                Best Sellers
              </Link>
            </li>
            <li>
              <Link href={`/store/${storeSlug}/products?featured=true`} className="hover:text-white transition-colors">
                Featured
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Policies</h4>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link href={`/store/${storeSlug}/policies/privacy`} className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href={`/store/${storeSlug}/policies/terms`} className="hover:text-white transition-colors">
                Terms of Service
              </Link>
            </li>
            <li>
              <Link href={`/store/${storeSlug}/policies/shipping`} className="hover:text-white transition-colors">
                Shipping & Returns
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">StoreForge</h4>
          <p className="text-xs text-slate-400 mb-3">
            Powered by StoreForge Multi-Tenant E-Commerce SaaS.
          </p>
          <Link
            href="/"
            className="inline-flex text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            Create your own online store &rarr;
          </Link>
        </div>
      </div>

      <div className="border-t border-slate-900 py-6 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} {storeName}. All rights reserved.
      </div>
    </footer>
  );
}
