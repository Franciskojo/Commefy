"use client";

import React from "react";
import Link from "next/link";
import { useCart } from "./CartContext";
import { formatMoney } from "@/lib/money";
import { X, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CartDrawer({
  storeSlug,
  currency = "USD",
}: {
  storeSlug: string;
  currency?: string;
}) {
  const { items, isOpen, closeCart, updateQuantity, removeItem, totalCount, subtotal } = useCart();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={closeCart}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-slate-900">Your Cart ({totalCount})</h2>
            </div>
            <button
              onClick={closeCart}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12">
                <ShoppingBag className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-base font-medium text-slate-700">Your shopping cart is empty</p>
                <p className="text-sm mt-1">Add items from the store to begin checkout.</p>
                <Button variant="outline" size="sm" className="mt-6" onClick={closeCart}>
                  Continue Shopping
                </Button>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.variantId}
                  className="flex gap-4 p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
                >
                  <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900 truncate">{item.name}</h4>
                    {item.variantTitle && (
                      <p className="text-xs text-slate-500 mt-0.5">{item.variantTitle}</p>
                    )}
                    <p className="text-sm font-medium text-indigo-600 mt-1">
                      {formatMoney(item.price, currency)}
                    </p>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-slate-200 rounded-md">
                        <button
                          onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                          className="px-2 py-0.5 text-slate-600 hover:bg-slate-100 text-sm font-medium"
                        >
                          -
                        </button>
                        <span className="px-2 text-xs font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                          className="px-2 py-0.5 text-slate-600 hover:bg-slate-100 text-sm font-medium"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.variantId)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer with Checkout */}
          {items.length > 0 && (
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Subtotal</span>
                <span className="text-lg font-bold text-slate-900">
                  {formatMoney(subtotal, currency)}
                </span>
              </div>
              <p className="text-xs text-slate-500">Shipping and taxes calculated at checkout.</p>

              <Link
                href={`/store/${storeSlug}/checkout`}
                onClick={closeCart}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20"
              >
                Proceed to Checkout
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
