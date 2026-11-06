import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Lock, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { ChatMessageRow, DraftTransactionData } from '@/lib/types';

interface Props {
  msg: ChatMessageRow;
  draft: DraftTransactionData;
  isBuyer: boolean;
  busy: boolean;
  onRespond: (messageId: string, accept: boolean) => void;
  onOpenTransaction: (transactionId: string) => void;
}

export default function OrderCard({ msg, draft, isBuyer, busy, onRespond, onOpenTransaction }: Props) {
  const amount = formatCurrency(draft.amount_cents, draft.currency);

  return (
    <div className="card p-5 animate-slide-up border-rail-200 max-w-md">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-rail-50 border border-rail-200 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-rail-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-ink-900">Order for {draft.vendor_name}</p>
          <p className="text-xs text-ink-400">{draft.description}</p>
        </div>
        <p className="text-lg font-bold text-ink-900 tabular-nums">{amount}</p>
      </div>

      <div className="rounded-xl bg-base-50 border border-base-200 p-3">
        <p className="text-xs text-ink-400 mb-1">Source check</p>
        <p className="text-sm text-ink-700 leading-relaxed">{draft.source_text}</p>
      </div>

      <div className={`flex items-center gap-1.5 mt-3 text-xs ${draft.proof_verified ? 'text-mint-600' : 'text-ember-600'}`}>
        {draft.proof_verified ? (
          <><CheckCircle2 className="w-3.5 h-3.5" /> Amount verified against the chat or listing</>
        ) : (
          <><ShieldAlert className="w-3.5 h-3.5" /> Amount could not be verified. Check it before approving.</>
        )}
      </div>

      <div className="mt-4">
        {draft.order_status === 'pending' && isBuyer && (
          <div className="flex items-center gap-3">
            <button onClick={() => onRespond(msg.id, true)} disabled={busy} className="btn-primary flex-1">
              <Lock className="w-4 h-4" /> Approve & hold funds
            </button>
            <button onClick={() => onRespond(msg.id, false)} disabled={busy} className="btn-ghost">
              Decline
            </button>
          </div>
        )}
        {draft.order_status === 'pending' && !isBuyer && (
          <p className="text-xs text-ink-500">Waiting for the buyer to approve this order.</p>
        )}
        {draft.order_status === 'approved' && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-mint-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Approved. Funds are held in escrow.
            </p>
            {draft.transaction_id && (
              <button onClick={() => onOpenTransaction(draft.transaction_id!)} className="btn-secondary text-xs py-1.5">
                View escrow <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        {draft.order_status === 'declined' && (
          <p className="text-xs text-ember-600 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> Declined. No funds were moved.
          </p>
        )}
      </div>
    </div>
  );
}
