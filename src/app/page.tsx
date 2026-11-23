import Link from "next/link";
import { LandingHeader } from "@/components/landing/LandingHeader";
import {
  ShieldCheck,
  Building2,
  Lock,
  Layers,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  Zap,
  Cpu,
  BarChart3,
  Globe,
  CreditCard,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white font-sans">
      {/* Top Navigation */}
      <LandingHeader />

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[450px] bg-indigo-600/15 blur-[160px] rounded-full pointer-events-none" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[300px] bg-violet-600/10 blur-[130px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Next-Generation Multi-Tenant Commerce Architecture</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.08]">
            The sovereign engine for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400">
              modern commerce brands.
            </span>
          </h1>

          <p className="max-w-3xl mx-auto text-lg sm:text-xl text-slate-400 font-normal leading-relaxed">
            StoreForge empowers merchants and platforms with isolated tenant query boundaries, server-authoritative checkout quotes, atomic real-time inventory locking, and unified multi-gateway payments.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/auth/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3.5 text-base rounded-2xl shadow-xl shadow-indigo-600/30">
                <ShoppingBag className="w-5 h-5 mr-2" /> Start Free 14-Day Trial
              </Button>
            </Link>

            <Link href="/platform" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-slate-700 hover:bg-slate-900 text-slate-300 hover:text-white px-7 py-3.5 text-base rounded-2xl">
                <ShieldCheck className="w-5 h-5 mr-2 text-indigo-400" /> Platform Super-Admin
              </Button>
            </Link>
          </div>

          <div className="pt-8 flex flex-wrap justify-center items-center gap-6 sm:gap-10 text-xs text-slate-500 font-mono">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Strict Tenant Scoping
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Argon2id & TOTP MFA
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> AES-256-GCM Envelope Encryption
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Paystack & Stripe Rails
            </span>
          </div>
        </div>
      </section>

      {/* Feature Architecture Matrix */}
      <section id="architecture" className="scroll-mt-20 py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-900 bg-slate-950/50">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <Badge variant="neutral" className="font-mono text-xs text-indigo-400 border-indigo-500/20">
              CORE CAPABILITIES
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Engineered with production-grade rigor at every boundary.
            </h2>
            <p className="text-slate-400 text-sm">
              No shortcuts. Every layer is hardened against cross-tenant data leakage, concurrency races, and financial rounding drift.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-4 hover:border-indigo-500/50 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Guaranteed Tenant Isolation</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                TenantScopedCollection wrapper injects tenantId into every query, insert, and update. Cross-tenant pipeline aggregation stages like $lookup and $unionWith are strictly prohibited.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-4 hover:border-violet-500/50 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-violet-600/10 text-violet-400 flex items-center justify-center border border-violet-500/20">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Atomic Inventory Locking</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Stock is reserved atomically via MongoDB write filters during checkout. Background cron automatically returns unfulfilled holds to the shelf after 30 minutes.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-4 hover:border-pink-500/50 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-pink-600/10 text-pink-400 flex items-center justify-center border border-pink-500/20">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Server-Authoritative Pricing</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Clients never calculate price totals. Minor units (cents), tax rates, coupon rules, and tiered shipping weights are computed exclusively on the server with round-half-up math.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tenant Isolation Section */}
      <section id="tenancy" className="scroll-mt-20 py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-900">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <Badge variant="neutral" className="font-mono text-xs text-indigo-400 border-indigo-500/20">
              DEFENSE-IN-DEPTH TENANCY
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Zero cross-tenant data leakage by architectural design.
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Every store operates inside a cryptographically and logically isolated boundary. Developers cannot accidentally query across stores because raw tenant collections are restricted at the compiler and linter level.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Mandatory Scoped Collection Wrapper</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    All tenant queries pass through <code className="text-indigo-300 font-mono">tenantDb(tenantId)</code>, which overrides any client-supplied <code className="text-indigo-300 font-mono">tenantId</code> and blocks unsafe aggregation stages (<code className="text-indigo-300 font-mono">$lookup</code>, <code className="text-indigo-300 font-mono">$unionWith</code>, <code className="text-indigo-300 font-mono">$merge</code>).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Host & Custom Domain Verification</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Storefronts resolve strictly from verified subdomains or DNS TXT-verified custom domains—never trusting unverified headers or client parameters.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Per-Store Customer Sessions & RBAC</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Shoppers receive tenant-scoped session cookies (<code className="text-emerald-300 font-mono">sf_c_&lt;tenantId&gt;</code>) while merchant staff permissions are validated against active store memberships on every request.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <span className="text-slate-400">src/lib/db/scoped.ts</span>
                <Badge variant="success">ENFORCED</Badge>
              </div>
              <pre className="text-slate-300 overflow-x-auto leading-relaxed">
{`// Every query automatically enforces tenantId
const db = await tenantDb(tenant._id);

// Injects { tenantId: ObjectId("...") }
// Caller cannot override or bypass tenantId
const products = await db.products
  .find({ status: "active" })
  .toArray();

// Compound index: { tenantId: 1, slug: 1 }
// Cross-tenant $lookup / $unionWith -> Throws FORBIDDEN`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Rails Section */}
      <section id="payments" className="scroll-mt-20 py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-900 bg-slate-950/50">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <Badge variant="neutral" className="font-mono text-xs text-indigo-400 border-indigo-500/20">
              MULTI-GATEWAY PAYMENT RAILS
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Unified checkout across Stripe, Paystack, and Mock rails.
            </h2>
            <p className="text-slate-400 text-sm">
              Each merchant brings their own gateway credentials, encrypted at rest with AES-256-GCM envelope encryption and verified via signed webhooks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-7 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Paystack & Stripe Adapters</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Plug-and-play provider interface supporting regional and global currencies (`USD`, `EUR`, `GBP`, `NGN`, `GHS`, `KES`, `ZAR`) in integer minor units.
              </p>
            </div>

            <div className="p-7 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">AES-256-GCM Key Vault</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Merchant secret keys and webhook secrets are encrypted with authenticated Additional Authenticated Data (`tenant:&lt;id&gt;:secretKey`) before touching MongoDB.
              </p>
            </div>

            <div className="p-7 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Idempotent Webhook Engine</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                HMAC-SHA256 / SHA512 signature verification with replay protection, amount mismatch guards, and atomic inventory commit on payment confirmation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Stores Showcase */}
      <section id="demo" className="scroll-mt-20 py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-900">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <Badge variant="neutral" className="font-mono text-xs text-indigo-400 border-indigo-500/20">
                LIVE DEMOS
              </Badge>
              <h2 className="text-3xl font-extrabold text-white tracking-tight mt-2">
                Explore Pre-Seeded Reference Stores
              </h2>
            </div>
            <p className="text-sm text-slate-400 max-w-md">
              Experience the consumer storefront, real-time cart drawer, dynamic variant selection, and payment checkout flow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 space-y-6">
              <div className="flex items-center justify-between">
                <span className="font-black text-2xl text-white tracking-tight">Apex Gear</span>
                <Badge variant="success">OUTDOOR & TECHNICAL</Badge>
              </div>
              <p className="text-sm text-slate-300">
                High-performance alpine packs, waterproof shells, and titanium camp stoves featuring multi-attribute variant selections and stock counters.
              </p>
              <div className="flex items-center gap-4 pt-2">
                <Link href="/store/apex-gear">
                  <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
                    Visit Apex Gear <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </Link>
                <Link href="/admin/apex-gear">
                  <Button variant="outline" className="border-slate-700 text-slate-300 hover:text-white">
                    Merchant Admin
                  </Button>
                </Link>
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-violet-950/40 to-slate-900 border border-violet-500/30 space-y-6">
              <div className="flex items-center justify-between">
                <span className="font-black text-2xl text-white tracking-tight">Luxe Apparel</span>
                <Badge variant="neutral" className="text-violet-300 border-violet-500/30">MINIMALIST FASHION</Badge>
              </div>
              <p className="text-sm text-slate-300">
                Tailored cashmere knitwear, oversized blazers, and Italian leather accessories with curated imagery, size selectors, and instant cart reviews.
              </p>
              <div className="flex items-center gap-4 pt-2">
                <Link href="/store/luxe-apparel">
                  <Button className="bg-violet-600 hover:bg-violet-500 text-white font-bold">
                    Visit Luxe Apparel <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </Link>
                <Link href="/admin/luxe-apparel">
                  <Button variant="outline" className="border-slate-700 text-slate-300 hover:text-white">
                    Merchant Admin
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-12 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="font-bold text-white">StoreForge</span>
            <span>— Enterprise Multi-Tenant E-Commerce Platform</span>
          </div>

          <div className="flex items-center gap-6 text-slate-400">
            <Link href="/auth/login" className="hover:text-white">Merchant Login</Link>
            <Link href="/auth/register" className="hover:text-white">Register Store</Link>
            <Link href="/platform" className="hover:text-white">Super-Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
