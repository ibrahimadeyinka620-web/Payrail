import { useEffect, useState, useRef } from 'react';
import {
  Send, ShieldCheck, ShieldAlert, CheckCircle2, Sparkles,
  ArrowRight, Lock, ArrowLeft, Package,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchConversation, fetchMessages, fetchProduct, fetchSellerProfile,
  sendMessage, createTransaction, addAuditEntry, updateConversation,
} from '@/lib/dataApi';
import { draftTransaction } from '@/lib/aiEngine';
import { formatCurrency } from '@/lib/format';
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
  const [pendingDraft, setPendingDraft] = useState<DraftTransactionData | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
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
      setLoading(false);
    })();
  }, [conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || busy || !user || !conversation || !product) return;
    setInput('');
    setBusy(true);

    // Save user message
    await sendMessage(conversation.id, user.id, 'user', msg);
    const userMsg: ChatMessageRow = {
      id: crypto.randomUUID(),
      conversation_id: conversation.id,
      sender_id: user.id,
      role: 'user',
      content: msg,
      draft_transaction: null,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);

    // Simulate AI thinking
    await new Promise((r) => setTimeout(r, 800));

    const result = draftTransaction(msg, product.title, product.price_cents, sellerName);

    const assistantMsg: ChatMessageRow = {
      id: crypto.randomUUID(),
      conversation_id: conversation.id,
      sender_id: conversation.seller_id,
      role: 'assistant',
      content: result.reasoning,
      draft_transaction: result.draft ?? null,
      created_at: new Date().toISOString(),
    };
    await sendMessage(conversation.id, conversation.seller_id, 'assistant', result.reasoning, result.draft ?? null);
    setMessages((m) => [...m, assistantMsg]);

    if (result.draft) {
      setPendingDraft(result.draft);
    }
    setBusy(false);
  }

  async function handleApprove() {
    if (!pendingDraft || !conversation || !user) return;
    setBusy(true);
    const txn = await createTransaction({
      vendor_name: pendingDraft.vendor_name,
      vendor_handle: pendingDraft.vendor_handle,
      description: pendingDraft.description,
      amount_cents: pendingDraft.amount_cents,
      currency: pendingDraft.currency,
      status: 'awaiting_approval',
      ai_request: messages.find((m) => m.role === 'user')?.content ?? '',
      ai_reasoning: pendingDraft.ai_reasoning,
      source_text: `Conversation about "${product?.title ?? 'product'}"`,
      source_filename: null,
      proof_verified: pendingDraft.proof_verified,
    });

    await addAuditEntry(txn.id, {
      step: 'user_request',
      actor: 'user',
      title: 'Trade initiated from chat',
      detail: messages.find((m) => m.role === 'user')?.content ?? '',
    });
    await addAuditEntry(txn.id, {
      step: 'ai_extraction',
      actor: 'ai',
      title: 'AI drafted transaction from conversation',
      detail: pendingDraft.ai_reasoning,
      metadata: {
        amount_cents: pendingDraft.amount_cents,
        proof_verified: pendingDraft.proof_verified,
        product_title: product?.title,
      },
    });

    await updateConversation(conversation.id, {
      transaction_id: txn.id,
      status: 'negotiated',
    });

    setBusy(false);
    onOpenTransaction(txn.id);
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

  const isBuyer = conversation.buyer_id === user?.id;

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
          {/* Welcome message */}
          {messages.length === 0 && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-rail-50 border border-rail-200 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-rail-500" />
              </div>
              <div className="max-w-[80%] rounded-2xl bg-white border border-base-200 px-4 py-3">
                <p className="text-sm text-ink-700 leading-relaxed">
                  Hi{isBuyer ? '' : ''}! I'm your AI trade co-pilot. {isBuyer
                    ? `Tell the seller you're interested in "${product.title}" and make an offer. I'll draft an escrow transaction once you agree on a price.`
                    : `A buyer is interested in your "${product.title}". Chat with them and I'll help draft the transaction.`}
                </p>
              </div>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} currentUserId={user?.id ?? ''} draft={m.draft_transaction} />
          ))}

          {pendingDraft && (
            <DraftCard
              draft={pendingDraft}
              productName={product.title}
              onApprove={handleApprove}
              onDiscard={() => setPendingDraft(null)}
              busy={busy}
            />
          )}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-ink-400 px-2 animate-fade-in">
              <Sparkles className="w-4 h-4 text-rail-500 animate-pulse" />
              Analyzing conversation and drafting transaction…
            </div>
          )}
        </div>
      </div>

      {/* Suggestion chips */}
      {messages.length === 0 && (
        <div className="px-4 lg:px-6 pb-2 max-w-3xl mx-auto w-full">
          <div className="flex flex-wrap gap-2">
            {isBuyer ? [
              `I'll take the ${product.title} for ${formatCurrency(product.price_cents, product.currency)}`,
              `Is the ${product.title} still available?`,
            ] : [
              `Yes, it's available!`,
              `The price is firm at ${formatCurrency(product.price_cents, product.currency)}`,
            ].map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-base-100 border border-base-300 text-ink-500 hover:text-rail-600 hover:border-rail-300 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-base-200 p-4 bg-white flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          {pendingDraft && (
            <div className="mb-3 flex items-center gap-3">
              <button
                onClick={handleApprove}
                disabled={busy}
                className="btn-primary"
              >
                <CheckCircle2 className="w-4 h-4" /> Create escrow <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPendingDraft(null)}
                className="btn-ghost"
              >
                Discard draft
              </button>
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
          <p className="text-[11px] text-ink-400 mt-2 px-2">
            The AI co-pilot monitors the chat and drafts a transaction when a price is agreed.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  msg, currentUserId, draft,
}: { msg: ChatMessageRow; currentUserId: string; draft: DraftTransactionData | null }) {
  const isUser = msg.role === 'user' && msg.sender_id === currentUserId;
  const isAssistant = msg.role === 'assistant';

  if (isAssistant) {
    return (
      <div className="flex gap-3 animate-fade-in">
        <div className="w-8 h-8 rounded-lg bg-rail-50 border border-rail-200 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-rail-500" />
        </div>
        <div className="max-w-[80%] rounded-2xl bg-white border border-base-200 px-4 py-3">
          <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          {draft && (
            <div className="mt-3 pt-3 border-t border-base-200">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-rail-500" />
                <span className="text-xs font-semibold text-rail-600">Draft transaction ready</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-500">{draft.vendor_name}</span>
                <span className="font-bold text-ink-900 tabular-nums">
                  {formatCurrency(draft.amount_cents, draft.currency)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

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

function DraftCard({
  draft, productName, onApprove, onDiscard, busy,
}: {
  draft: DraftTransactionData;
  productName: string;
  onApprove: () => void;
  onDiscard: () => void;
  busy: boolean;
}) {
  return (
    <div className="card p-5 animate-slide-up border-rail-200">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-rail-50 border border-rail-200 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-rail-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-ink-900">Transaction ready for escrow</p>
          <p className="text-xs text-ink-400">
            The AI verified the amount against the product listing.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-base-50 border border-base-200 p-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-500">Product</span>
            <span className="text-ink-800 font-medium">{productName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Seller</span>
            <span className="text-ink-800 font-medium">{draft.vendor_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Amount</span>
            <span className="text-ink-900 font-bold text-base tabular-nums">
              {formatCurrency(draft.amount_cents, draft.currency)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-3 text-xs text-mint-600">
        <CheckCircle2 className="w-3.5 h-3.5" /> Amount verified from conversation context
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button onClick={onApprove} disabled={busy} className="btn-primary flex-1">
          <Lock className="w-4 h-4" /> Create escrow & hold funds
        </button>
        <button onClick={onDiscard} className="btn-ghost">
          Discard
        </button>
      </div>
    </div>
  );
}
