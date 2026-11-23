"use client";

import React, { useState } from "react";
import { formatMoney } from "@/lib/money";
import { useCart } from "./CartContext";
import { ShoppingBag, Check, Shield, Truck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ProductDetailProps {
  storeSlug: string;
  currency: string;
  primaryColor?: string;
  product: {
    _id: string;
    name: string;
    slug: string;
    description: string;
    brand?: string;
    images: { url: string; alt: string }[];
    variants: {
      _id: string;
      sku: string;
      title: string;
      options: Record<string, string>;
      price: number;
      salePrice?: number;
      stockAvailable: number;
    }[];
  };
}

export function ProductDetailClient({ storeSlug, currency, primaryColor = "#4f46e5", product }: ProductDetailProps) {
  const { addItem } = useCart();
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedAnimation, setAddedAnimation] = useState(false);

  const selectedVariant = product.variants[selectedVariantIndex] || product.variants[0];
  const hasSale =
    selectedVariant?.salePrice !== undefined && selectedVariant.salePrice < selectedVariant.price;
  const activePrice = hasSale ? selectedVariant.salePrice! : selectedVariant?.price || 0;

  const inStock = selectedVariant ? selectedVariant.stockAvailable > 0 : false;

  const handleAddToCart = () => {
    if (!selectedVariant || !inStock) return;

    addItem({
      productId: product._id,
      variantId: selectedVariant._id,
      name: product.name,
      variantTitle: selectedVariant.title,
      price: activePrice,
      quantity,
      imageUrl: product.images[selectedImageIndex]?.url || product.images[0]?.url,
    });

    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
      {/* Product Images Gallery */}
      <div className="space-y-4">
        <div className="aspect-square rounded-2xl bg-slate-100 overflow-hidden border border-slate-100 shadow-sm relative">
          {product.images[selectedImageIndex]?.url ? (
            <img
              src={product.images[selectedImageIndex].url}
              alt={product.images[selectedImageIndex].alt || product.name}
              className="w-full h-full object-cover transition-all duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <ShoppingBag className="w-20 h-20" />
            </div>
          )}

          {hasSale && (
            <div className="absolute top-4 left-4">
              <Badge variant="danger">On Sale</Badge>
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {product.images.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {product.images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImageIndex(idx)}
                className={`w-20 h-20 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                  selectedImageIndex === idx ? "border-indigo-600 ring-2 ring-indigo-600/20" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <img src={img.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Details & Purchase Form */}
      <div className="space-y-6">
        <div>
          {product.brand && (
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block mb-1">
              {product.brand}
            </span>
          )}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {product.name}
          </h1>

          <div className="flex items-baseline gap-3 mt-4">
            <span className="text-3xl font-black text-slate-900">
              {formatMoney(activePrice, currency)}
            </span>
            {hasSale && (
              <span className="text-lg text-slate-400 line-through">
                {formatMoney(selectedVariant.price, currency)}
              </span>
            )}
          </div>
        </div>

        {/* Stock Status Indicator */}
        <div className="flex items-center gap-2">
          {inStock ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-semibold text-emerald-700">
                In Stock ({selectedVariant.stockAvailable} available)
              </span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-sm font-semibold text-rose-700">Out of Stock</span>
            </>
          )}
        </div>

        {/* Variant Selectors */}
        {product.variants.length > 1 && (
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <label className="block text-sm font-semibold text-slate-900">Choose Option:</label>
            <div className="flex flex-wrap gap-2.5">
              {product.variants.map((v, idx) => (
                <button
                  key={v._id}
                  onClick={() => setSelectedVariantIndex(idx)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer ${
                    selectedVariantIndex === idx
                      ? "border-indigo-600 bg-indigo-50/60 text-indigo-950 ring-2 ring-indigo-600/20 font-semibold"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {v.title}
                  <span className="ml-2 text-xs opacity-75">{formatMoney(v.salePrice || v.price, currency)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity & Add to Cart */}
        <div className="flex items-center gap-4 pt-4">
          <div className="flex items-center border border-slate-300 rounded-xl bg-white p-1">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1 || !inStock}
              className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-lg text-lg font-bold disabled:opacity-40"
            >
              -
            </button>
            <span className="w-12 text-center font-bold text-slate-900">{quantity}</span>
            <button
              onClick={() => setQuantity(Math.min(selectedVariant?.stockAvailable || 10, quantity + 1))}
              disabled={!inStock || quantity >= (selectedVariant?.stockAvailable || 10)}
              className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-lg text-lg font-bold disabled:opacity-40"
            >
              +
            </button>
          </div>

          <Button
            size="lg"
            disabled={!inStock}
            onClick={handleAddToCart}
            className="flex-1 py-4 text-base font-bold shadow-lg cursor-pointer"
            style={{ backgroundColor: primaryColor }}
          >
            {addedAnimation ? (
              <>
                <Check className="w-5 h-5 text-white" /> Added to Cart!
              </>
            ) : inStock ? (
              <>
                <ShoppingBag className="w-5 h-5" /> Add to Cart
              </>
            ) : (
              "Sold Out"
            )}
          </Button>
        </div>

        {/* Product Description */}
        <div className="pt-8 border-t border-slate-100 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Description</h3>
          <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
            {product.description}
          </div>
        </div>

        {/* Trust & Guarantee Box */}
        <div className="grid grid-cols-3 gap-3 pt-6 border-t border-slate-100 text-center">
          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <Shield className="w-5 h-5 text-indigo-600 mx-auto" />
            <p className="text-xs font-bold text-slate-900">Secure Store</p>
            <p className="text-[11px] text-slate-500">256-bit encryption</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <Truck className="w-5 h-5 text-indigo-600 mx-auto" />
            <p className="text-xs font-bold text-slate-900">Fast Shipping</p>
            <p className="text-[11px] text-slate-500">Tracked delivery</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <RotateCcw className="w-5 h-5 text-indigo-600 mx-auto" />
            <p className="text-xs font-bold text-slate-900">Easy Returns</p>
            <p className="text-[11px] text-slate-500">14-day policy</p>
          </div>
        </div>
      </div>
    </div>
  );
}
