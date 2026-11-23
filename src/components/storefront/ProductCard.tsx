"use client";

import React from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { useCart } from "./CartContext";
import { ShoppingBag, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ProductCardProps {
  storeSlug: string;
  currency: string;
  product: {
    _id: string;
    name: string;
    slug: string;
    brand?: string;
    priceMin: number;
    featured?: boolean;
    ratingAvg?: number;
    ratingCount?: number;
    images?: { url: string; alt: string }[];
    variants: {
      _id: string;
      title: string;
      price: number;
      salePrice?: number;
    }[];
  };
}

export function ProductCard({ storeSlug, currency, product }: ProductCardProps) {
  const { addItem } = useCart();
  const primaryImage = product.images?.[0]?.url;
  const firstVariant = product.variants[0];

  const hasSale = firstVariant?.salePrice !== undefined && firstVariant.salePrice < firstVariant.price;
  const displayPrice = hasSale ? firstVariant.salePrice! : firstVariant?.price || product.priceMin;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!firstVariant) return;

    addItem({
      productId: product._id,
      variantId: firstVariant._id,
      name: product.name,
      variantTitle: firstVariant.title,
      price: displayPrice,
      quantity: 1,
      imageUrl: primaryImage,
    });
  };

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hover:shadow-xl hover:border-slate-200 transition-all duration-300 flex flex-col">
      {/* Product Image */}
      <Link href={`/store/${storeSlug}/products/${product.slug}`} className="block relative aspect-square bg-slate-100 overflow-hidden">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ShoppingBag className="w-12 h-12" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {hasSale && <Badge variant="danger">Sale</Badge>}
          {product.featured && <Badge variant="default">Featured</Badge>}
        </div>

        {/* Quick Add Overlay on Desktop Hover */}
        <div className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
          <button
            onClick={handleQuickAdd}
            className="w-full py-2.5 px-4 bg-white/95 backdrop-blur-xs text-slate-900 rounded-xl font-semibold text-xs shadow-md hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Quick Add
          </button>
        </div>
      </Link>

      {/* Product Information */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {product.brand && (
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
              {product.brand}
            </p>
          )}
          <Link href={`/store/${storeSlug}/products/${product.slug}`}>
            <h3 className="font-semibold text-slate-900 text-base group-hover:text-indigo-600 transition-colors line-clamp-2">
              {product.name}
            </h3>
          </Link>

          {/* Rating */}
          {product.ratingCount ? (
            <div className="flex items-center gap-1 mt-1.5">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-semibold text-slate-700">
                {(product.ratingAvg! / 100).toFixed(1)}
              </span>
              <span className="text-xs text-slate-400">({product.ratingCount})</span>
            </div>
          ) : null}
        </div>

        {/* Price and Mobile Add Button */}
        <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-slate-900">
              {formatMoney(displayPrice, currency)}
            </span>
            {hasSale && (
              <span className="text-xs text-slate-400 line-through">
                {formatMoney(firstVariant.price, currency)}
              </span>
            )}
          </div>

          <button
            onClick={handleQuickAdd}
            className="lg:hidden p-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            aria-label="Add to cart"
          >
            <ShoppingBag className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
