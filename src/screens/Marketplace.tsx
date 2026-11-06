import { useEffect, useState } from 'react';
import { Search, ShieldCheck, Sparkles, ArrowRight, Package } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchProducts, fetchSellerProfile } from '@/lib/dataApi';
import { fetchTrustForSellers, type TrustScore } from '@/lib/trustScore';
import { formatCurrency } from '@/lib/format';
import type { Product } from '@/lib/types';
import type { View } from '@/components/AppShell';

interface Props {
  onNavigate: (v: View) => void;
  onOpenProduct: (id: string) => void;
}

export default function Marketplace({ onNavigate: _onNavigate, onOpenProduct }: Props) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
  const [trustScores, setTrustScores] = useState<Record<string, TrustScore>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts(user?.id)
      .then(async (prods) => {
        setProducts(prods);
        const names: Record<string, string> = {};
        await Promise.all(
          Array.from(new Set(prods.map((p) => p.seller_id))).map(async (sid) => {
            const profile = await fetchSellerProfile(sid);
            if (profile) names[sid] = profile.display_name;
          })
        );
        setSellerNames(names);
        const trust = await fetchTrustForSellers(Array.from(new Set(prods.map((p) => p.seller_id))));
        setTrustScores(trust);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id]);

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];

  const filtered = products.filter((p) => {
    if (category && p.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Hero */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-rail-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-rail-600">AI-escrow marketplace</span>
        </div>
        <h1 className="text-3xl font-bold text-ink-900 mb-2">
          Buy from sellers you can trust.
        </h1>
        <p className="text-ink-500 text-base max-w-2xl">
          Browse listings, chat with sellers, and let the AI co-pilot draft the transaction.
          Funds are held in escrow and released only on delivery confirmation.
        </p>
      </div>

      {/* Search + categories */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            className="input pl-11"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {categories.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setCategory(null)}
              className={`text-xs px-3 py-2 rounded-full font-medium transition-all ${
                !category ? 'bg-rail-600 text-white' : 'bg-white text-ink-500 border border-base-300 hover:bg-base-100'
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`text-xs px-3 py-2 rounded-full font-medium transition-all ${
                  category === c ? 'bg-rail-600 text-white' : 'bg-white text-ink-500 border border-base-300 hover:bg-base-100'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card p-0 overflow-hidden">
              <div className="aspect-square bg-base-100 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 bg-base-100 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-base-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 rounded-2xl bg-base-100 border border-base-200 flex items-center justify-center mx-auto mb-4">
            <Package className="w-6 h-6 text-ink-400" />
          </div>
          <p className="text-sm font-medium text-ink-600">No products found</p>
          <p className="text-xs text-ink-400 mt-1">
            {search ? 'Try a different search term.' : 'Be the first to list a product in Settings.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((product, i) => (
            <button
              key={product.id}
              onClick={() => onOpenProduct(product.id)}
              className="card-hover p-0 overflow-hidden text-left animate-slide-up"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Product image */}
              <div className="aspect-square bg-base-100 overflow-hidden relative">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    className="product-img transition-transform duration-300 hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-10 h-10 text-ink-300" />
                  </div>
                )}
                {/* Escrow badge */}
                <div className="absolute top-3 left-3">
                  <span className="badge bg-white/90 backdrop-blur-sm text-rail-700 border border-rail-200 text-[10px]">
                    <ShieldCheck className="w-3 h-3" /> Escrow
                  </span>
                </div>
              </div>

              {/* Product info */}
              <div className="p-4">
                <p className="text-sm font-semibold text-ink-900 truncate">{product.title}</p>
                <p className="text-xs text-ink-400 mt-0.5 truncate">
                  {sellerNames[product.seller_id] ?? 'Seller'}
                  {product.category && ` · ${product.category}`}
                </p>
                {trustScores[product.seller_id] && trustScores[product.seller_id].completedTrades > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    <span className={`text-[10px] font-semibold ${trustScores[product.seller_id].trustColor}`}>
                      {trustScores[product.seller_id].trustLabel}
                    </span>
                    <span className="text-[10px] text-ink-300">
                      · {trustScores[product.seller_id].completedTrades} trades
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-3">
                  <p className="text-lg font-bold text-ink-900 tabular-nums">
                    {formatCurrency(product.price_cents, product.currency)}
                  </p>
                  {product.stock !== null && product.stock <= 5 && product.stock > 0 && (
                    <span className="text-[10px] text-amber-600 font-medium">
                      {product.stock} left
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
