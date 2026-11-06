import { useEffect, useState, useRef } from 'react';
import { Send, ShieldCheck, Sparkles, Package, ArrowLeft, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchConversation, fetchMessages, fetchProduct, fetchSellerProfile,
  sendMessage, respondToOrder,
} from '@/lib/dataApi';
import { verifyOrderSource } from '@/lib/aiEngine';
import { formatCurrency } from '@/lib/format';
import OrderCard from '@/components/OrderCard';
import type {
  Conversation, ChatMessageRow, Product, DraftTransactionData,
} from '@/lib/types';
import type { View } from '@/components/AppShell';

interface Props {
  conversationId: string;
  onBack: (v: View) => void;
  onOpenTransaction: (id: string) => void;
}

export default function TradeChat({ conversationId, onBack, onOpenTransaction }: Props) {
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [sellerName, setSellerName] = useState('');
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const [orderAmount, setOrderAmount] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const conv = await fetchConversation(conversationId);
        setConversation(conv);
        if (conv) {
          const [msgs, prod, seller] = await Promise.all([
            fetchMessages(conversationId),
            fetchProduct(conv.product_id),
            fetchSellerProfile(conv.seller_id),
          ]);
          setMessages(msgs);
          setProduct(prod);
          setSellerName(seller?.display_name ?? 'Seller');
        }
      } catch {
        setActionError('This conversation could not be loaded.');
      }
      setLoading(false);
    })();
  }, [conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const isBuyer = conversation?.buyer_id === user?.id;
  const isSeller = conversation?.seller_id === user?.id;

  async function refreshMessages() {
    if (!conversation) return;
    setMessages(await fetchMessages(conversation.id));
  }

  async function handleSend() {
    const msg = input.trim();
    if (!msg || busy || !user || !conversation) return;
    setInput('');
    setBusy(true);
    setActionError(null);
    try {
      await sendMessage(conversation.id, user.id, 'user', msg);
      await refreshMessages();
    } catch {
      setInput(msg);
      setActionError('Your message could not be sent. Please try again.');
    }
    setBusy(false);
  }

  function openOrderForm() {
    if (!product) return;
    setOrderAmount((product.price_cents / 100).toFixed(2));
    setActionError(null);
    setOrderFormOpen(true);
  }

  async function handleCreateOrder() {
    if (!user || !conversation || !product || busy) return;
    const dollars = Number(orderAmount);
    const amountCents = Math.round(dollars * 100);
    if (!Number.isFinite(dollars) || amountCents <= 0) {
      setActionError('Enter an amount greater than zero.');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const check = verifyOrderSource(
        amountCents,
        product.title,
        product.price_cents,
        messages.map((m) => m.content),
      );
      const draft: DraftTransactionData = {
        vendor_name: sellerName,
        vendor_handle: null,
        description: `Purchase: ${product.title}`,
        amount_cents: amountCents,
        currency: product.currency,
        ai_reasoning: check.ai_reasoning,
        source_text: check.source_text,
        proof_verified: check.proof_verified,
        order_status: 'pending',
      };
      await sendMessage(
        conversation.id,
        user.id,
        'assistant',
        `Order created for ${formatCurrency(amountCents, product.currency)}. Waiting for the buyer to approve.`,
        draft,
      );
      await refreshMessages();
      setOrderFormOpen(false);
      setOrderAmount('');
    } catch {
      setActionError('The order could not be created. Please try again.');
    }
    setBusy(false);
  }

  async function handleRespond(messageId: string, accept: boolean) {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    let transactionId: string | null = null;
    try {
      transactionId = await respondToOrder(messageId, accept);
      await refreshMessages();
    } catch {
      setActionError(accept
        ? 'The order could not be approved. Please try again.'
        : 'The order could not be declined. Please try again.');
    }
    setBusy(false);
    if (accept && transactionId) onOpenTransaction(transactionId);
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-base-200 bg-white">
          <div className="h-8 w-48 bg-base-100 rounded animate-pulse" />
        </div>
        <div className="flex-1 p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-base-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!conversation || !product) {
    return (
      <div className="p-8 text-center">
        <p className="text-ink-500">Conversation not found.</p>
        <button onClick={() => onBack('chats')} className="btn-ghost mt-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>
    );
  }

  const canCreateOrder = isSeller && !conversation.transaction_id;

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 lg:px-6 py-3 border-b border-base-200 bg-white flex-shrink-0">
        <button onClick={() => onBack('chats')} className="btn-ghost p-2 -ml-2">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-base-100 border border-base-200 flex items-center justify-center overflow-hidden flex-shrink-0">
          {product.image_url ? (
            <img src={product.image_url} alt={product.title} className="product-img" />
          ) : (
            <Package className="w-5 h-5 text-ink-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900 truncate">{product.title}</p>
          <p className="text-xs text-ink-400 truncate">
            {formatCurrency(product.price_cents, product.currency)} · {sellerName}
          </p>
        </div>
        <span className="badge-rail text-[10px]">
          <ShieldCheck className="w-3 h-3" /> Escrow
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-rail-50 border border-rail-200 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-rail-500" />
              </div>
              <div className="max-w-[80%] rounded-2xl bg-white border border-base-200 px-4 py-3">
                <p className="text-sm text-ink-700 leading-relaxed">
                  {isBuyer
                    ? `Chat with the seller about "${product.title}". When you agree on a price, the seller can create an order here for you to approve and hold in escrow.`
                    : `A buyer is interested in "${product.title}". Agree on a price in the chat, then create an order for them to approve.`}
                </p>
              </div>
            </div>
          )}

          {messages.map((m) => (
            m.draft_transaction ? (
              <div key={m.id} className="flex gap-3 animate-fade-in">
                <div className="w-8 h-8 rounded-lg bg-rail-50 border border-rail-200 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-rail-500" />
                </div>
                <OrderCard
                  msg={m}
                  draft={m.draft_transaction}
                  isBuyer={isBuyer ?? false}
                  busy={busy}
                  onRespond={handleRespond}
                  onOpenTransaction={onOpenTransaction}
                />
              </div>
            ) : (
              <MessageBubble key={m.id} msg={m} isOwn={m.sender_id === user?.id} />
            )
          ))}

          {busy && (
            <div className="text-sm text-ink-400 px-2 animate-fade-in">Working…</div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-base-200 p-4 bg-white flex-shrink-0">
        <div className="max-w-3xl mx-auto space-y-3">
          {actionError && <p className="text-xs text-ember-600 px-2">{actionError}</p>}

          {canCreateOrder && !orderFormOpen && (
            <div>
              <button onClick={openOrderForm} disabled={busy} className="btn-secondary text-sm">
                <Plus className="w-4 h-4" /> Create order
              </button>
            </div>
          )}

          {canCreateOrder && orderFormOpen && (
            <div className="rounded-2xl border border-rail-200 bg-rail-50/40 p-4 space-y-3 animate-slide-up">
              <p className="text-sm font-semibold text-ink-900">Create an order for the buyer</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center flex-1 rounded-xl bg-white border border-base-300 px-3 focus-within:border-rail-400">
                  <span className="text-sm text-ink-400">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={orderAmount}
                    onChange={(e) => setOrderAmount(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-ink-800 outline-none py-2.5 px-1 tabular-nums"
                  />
                </div>
                <button onClick={handleCreateOrder} disabled={busy} className="btn-primary">
                  Send order
                </button>
                <button onClick={() => setOrderFormOpen(false)} disabled={busy} className="btn-ghost">
                  Cancel
                </button>
              </div>
              <p className="text-[11px] text-ink-400">
                The amount is checked against the listing and what was said in the chat.
              </p>
            </div>
          )}

          <div className="flex items-end gap-2 rounded-2xl bg-base-50 border border-base-300 p-2 focus-within:border-rail-400 focus-within:ring-2 focus-within:ring-rail-500/10 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isBuyer ? 'Message the seller…' : 'Message the buyer…'}
              rows={1}
              className="flex-1 bg-transparent text-sm text-ink-800 placeholder:text-ink-400 resize-none outline-none px-2 py-2.5 max-h-32"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || busy}
              className="w-10 h-10 rounded-xl bg-rail-600 flex items-center justify-center text-white hover:bg-rail-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, isOwn }: { msg: ChatMessageRow; isOwn: boolean }) {
  if (isOwn) {
    return (
      <div className="flex gap-3 flex-row-reverse animate-fade-in">
        <div className="w-8 h-8 rounded-lg bg-base-100 border border-base-200 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-ink-500">U</span>
        </div>
        <div className="max-w-[80%] rounded-2xl bg-rail-600 px-4 py-3">
          <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-lg bg-base-100 border border-base-200 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-ink-500">P</span>
      </div>
      <div className="max-w-[80%] rounded-2xl bg-white border border-base-200 px-4 py-3">
        <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
      </div>
    </div>
  );
}
