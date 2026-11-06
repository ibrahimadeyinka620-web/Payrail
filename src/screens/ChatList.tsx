import { useEffect, useState } from 'react';
import { MessageSquare, ArrowRight, Package, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchConversations, fetchProduct, fetchSellerProfile, fetchMessages,
} from '@/lib/dataApi';
import { formatCurrency, timeAgo } from '@/lib/format';
import type { Conversation, Product, ChatMessageRow } from '@/lib/types';
import type { View } from '@/components/AppShell';

interface Props {
  onNavigate: (v: View) => void;
  onOpenChat: (conversationId: string) => void;
}

interface ChatListItem {
  conv: Conversation;
  product: Product | null;
  sellerName: string;
  lastMessage: ChatMessageRow | null;
}

export default function ChatList({ onNavigate: _onNavigate, onOpenChat }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const convs = await fetchConversations(user.id);
        const enriched: ChatListItem[] = await Promise.all(
          convs.map(async (conv) => {
            const [product, seller, msgs] = await Promise.all([
              fetchProduct(conv.product_id),
              fetchSellerProfile(conv.seller_id),
              fetchMessages(conv.id),
            ]);
            return {
              conv,
              product,
              sellerName: seller?.display_name ?? 'Seller',
              lastMessage: msgs[msgs.length - 1] ?? null,
            };
          })
        );
        setItems(enriched);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-ink-900">Chats</h1>
        <p className="text-sm text-ink-500 mt-1">
          Your trade conversations with buyers and sellers.
        </p>
      </div>

      <div className="card p-6 animate-slide-up">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-base-100 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-base-100 border border-base-200 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-6 h-6 text-ink-400" />
            </div>
            <p className="text-sm font-medium text-ink-600">No conversations yet</p>
            <p className="text-xs text-ink-400 mt-1">
              Conversations with sellers will show up here once a trade starts.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(({ conv, product, sellerName, lastMessage }) => (
              <button
                key={conv.id}
                onClick={() => onOpenChat(conv.id)}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-base-50 border border-base-200 hover:border-base-300 hover:bg-white transition-all text-left group"
              >
                <div className="w-11 h-11 rounded-xl bg-white border border-base-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {product?.image_url ? (
                    <img src={product.image_url} alt={product.title} className="product-img" />
                  ) : (
                    <Package className="w-5 h-5 text-ink-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-800 truncate">
                    {product?.title ?? 'Product'}
                  </p>
                  <p className="text-xs text-ink-400 truncate">
                    {lastMessage
                      ? lastMessage.content.slice(0, 60)
                      : `Chat with ${sellerName}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {product && (
                    <span className="text-sm font-bold text-ink-700 tabular-nums">
                      {formatCurrency(product.price_cents, product.currency)}
                    </span>
                  )}
                  {conv.transaction_id && (
                    <span className="badge-rail text-[10px]">Escrow</span>
                  )}
                  <span className="text-xs text-ink-400">{timeAgo(conv.updated_at)}</span>
                  <ArrowRight className="w-4 h-4 text-ink-300 group-hover:text-ink-500 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
