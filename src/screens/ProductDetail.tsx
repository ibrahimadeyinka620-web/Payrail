import { useEffect, useState } from 'react';
import {
  ArrowLeft, ShieldCheck, MessageSquare, Lock, Sparkles, Package, Tag,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchProduct, fetchSellerProfile, createConversation } from '@/lib/dataApi';
import { fetchSellerTrust, type TrustScore } from '@/lib/trustScore';
import { formatCurrency } from '@/lib/format';
import type { Product } from '@/lib/types';
import type { View } from '@/components/AppShell';

interface Props {
  productId: string;
  onBack: (v: View) => void;
  onOpenChat: (conversationId: string) => void;
}

export default function ProductDetail({ productId, onBack, onOpenChat }: Props) {
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [sellerName, setSellerName] = useState<string>('');
  const [trust, setTrust] = useState<TrustScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await fetchProduct(productId);
      setProduct(p);
      if (p) {
        const [profile, trustScore] = await Promise.all([
          fetchSellerProfile(p.seller_id),
          fetchSellerTrust(p.seller_id),
        ]);
        setSellerName(profile?.display_name ?? 'Seller');
        setTrust(trustScore);
      }
      setLoading(false);
    })();
  }, [productId]);

  async function handleStartChat() {
    if (!product || !user) return;
    setStarting(true);
    try {
      const conv = await createConversation(user.id, product.seller_id, product.id);
      onOpenChat(conv.id);
    } catch (e) {
      console.error(e);
    }
    setStarting(false);
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="h-8 w-32 bg-base-100 rounded-lg animate-pulse mb-6" />
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="aspect-square bg-base-100 rounded-2xl animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 bg-base-100 rounded animate-pulse" />
            <div className="h-6 w-1/4 bg-base-100 rounded animate-pulse" />
            <div className="h-24 bg-base-100 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center">
        <p className="text-ink-500">Product not found.</p>
        <button onClick={() => onBack('marketplace')} className="btn-ghost mt-4">
          <ArrowLeft className="w-4 h-4" /> Back to marketplace
        </button>
      </div>
    );
  }

  const isOwnProduct = product.seller_id === user?.id;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <button onClick={() => onBack('marketplace')} className="btn-ghost -ml-2 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to marketplace
      </button>

      <div className="grid lg:grid-cols-2 gap-8 animate-fade-in">
        {/* Image */}
        <div className="aspect-square rounded-2xl bg-base-100 border border-base-200 overflow-hidden flex items-center justify-center">
          {product.image_url ? (
            <img src={product.image_url} alt={product.title} className="product-img" />
          ) : (
            <Package className="w-20 h-20 text-ink-300" />
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="badge-rail">
              <ShieldCheck className="w-3 h-3" /> Escrow protected
            </span>
            {product.category && (
              <span className="badge-ink">
                <Tag className="w-3 h-3" /> {product.category}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold text-ink-900 mb-2">{product.title}</h1>
          <p className="text-lg font-bold text-rail-600 mb-4 tabular-nums">
            {formatCurrency(product.price_cents, product.currency)}
          </p>

          <div className="rounded-xl bg-base-50 border border-base-200 p-4 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">Description</p>
            <p className="text-sm text-ink-600 leading-relaxed whitespace-pre-wrap">
              {product.description || 'No description provided.'}
            </p>
          </div>

          <div className="rounded-xl bg-white border border-base-200 p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rail-100 border border-rail-200 flex items-center justify-center text-sm font-bold text-rail-600">
                {sellerName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink-800">{sellerName}</p>
                <p className="text-xs text-ink-400">Seller</p>
              </div>
              {trust && trust.completedTrades > 0 && (
                <div className="text-right">
                  <span className={`text-xs font-bold ${trust.trustColor}`}>{trust.trustLabel}</span>
                  <p className="text-[10px] text-ink-400">{trust.completedTrades} trades</p>
                </div>
              )}
            </div>
            {trust && trust.completedTrades > 0 && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-base-200">
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-ink-400">Trust score</span>
                    <span className="text-xs font-bold text-ink-700">{trust.rating}/5</span>
                  </div>
                  <div className="h-1.5 bg-base-200 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-rail-500 rounded-full" style={{ width: `${(trust.rating / 5) * 100}%` }} />
                  </div>
                </div>
                <span className="text-[10px] text-ink-400">
                  {formatCurrency(trust.totalVolumeCents)} volume
                </span>
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="rounded-xl bg-rail-50 border border-rail-200 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-rail-500" />
              <p className="text-sm font-semibold text-rail-700">How trade works</p>
            </div>
            <div className="space-y-2 text-xs text-rail-700/80">
              <div className="flex items-start gap-2">
                <span className="font-bold text-rail-600">1.</span>
                <span>Chat with the seller about the item</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-rail-600">2.</span>
                <span>AI co-pilot drafts a transaction from your conversation</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-rail-600">3.</span>
                <span>Funds are held in escrow, released on delivery confirmation</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {isOwnProduct ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-sm font-semibold text-amber-700">This is your listing</p>
                <p className="text-xs text-amber-600/80">You can't buy your own product.</p>
              </div>
            </div>
          ) : product.status !== 'active' ? (
            <div className="rounded-xl bg-base-100 border border-base-200 p-4 text-center">
              <p className="text-sm text-ink-500">This product is no longer available.</p>
            </div>
          ) : (
            <button
              onClick={handleStartChat}
              disabled={starting}
              className="btn-primary w-full"
            >
              <MessageSquare className="w-4 h-4" />
              {starting ? 'Starting chat…' : 'Chat with seller'}
              {!starting && <ArrowLeft className="w-4 h-4 rotate-180" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
