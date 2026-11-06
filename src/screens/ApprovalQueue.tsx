import { useEffect, useState } from 'react';
import { Quote, ShieldAlert, Check, X, Loader2 } from 'lucide-react';
import { fetchAgentRequests, decideAgentPayment } from '@/lib/agentApi';
import { formatCurrency, timeAgo } from '@/lib/format';
import type { AgentPaymentRequest } from '@/lib/types';

interface ApprovalQueueProps {
  onOpenTransaction: (id: string) => void;
}

export default function ApprovalQueue({ onOpenTransaction }: ApprovalQueueProps) {
  const [requests, setRequests] = useState<AgentPaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setRequests(await fetchAgentRequests());
      setError(null);
    } catch {
      setError('Could not load payment requests. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(req: AgentPaymentRequest, approve: boolean) {
    setBusyId(req.id);
    setError(null);
    try {
      const txnId = await decideAgentPayment(req.id, approve);
      await load();
      if (approve && txnId) onOpenTransaction(txnId);
    } catch {
      setError('This request could not be updated. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  const pending = requests.filter((r) => r.status === 'pending_approval');
  const blocked = requests.filter((r) => r.status === 'blocked');

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">Approvals</h1>
        <p className="text-sm text-ink-500 mt-1">
          Check each payment against the exact text it cites before you approve. Approved payments are held in escrow.
        </p>
      </div>

      {error && <p className="text-sm text-ember-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-ink-400">Loading requests...</p>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-ink-800">Waiting for your decision ({pending.length})</h2>
            {pending.length === 0 && <p className="text-sm text-ink-400">Nothing waiting. New agent requests appear here.</p>}
            {pending.map((req) => (
              <article key={req.id} className="bg-white rounded-2xl border border-base-200 p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-ink-900 truncate">{req.vendor_name}</p>
                    <p className="text-xs text-ink-400">
                      {req.merchant_handle} · Requested {timeAgo(req.created_at)}
                    </p>
                    <p className="text-sm text-ink-600 mt-1">{req.description}</p>
                  </div>
                  <p className="text-lg font-bold text-ink-900 flex-shrink-0">
                    {formatCurrency(req.amount_cents, req.currency)}
                  </p>
                </div>

                <div className="rounded-xl bg-rail-50 border border-rail-200 p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rail-700 mb-2">
                    <Quote className="w-3.5 h-3.5" />
                    Source text the agent cited
                  </p>
                  <mark className="block whitespace-pre-wrap rounded-lg bg-amber-100 px-3 py-2 text-sm leading-relaxed text-ink-900 border-l-4 border-amber-400">
                    {req.source_context}
                  </mark>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => decide(req, false)}
                    disabled={busyId === req.id}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-base-200 text-sm font-medium text-ink-600 hover:text-ember-600 hover:border-ember-200 disabled:opacity-50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Decline
                  </button>
                  <button
                    onClick={() => decide(req, true)}
                    disabled={busyId === req.id}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rail-600 text-white text-sm font-semibold hover:bg-rail-700 disabled:opacity-50 transition-colors"
                  >
                    {busyId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Approve and hold funds
                  </button>
                </div>
              </article>
            ))}
          </section>

          {blocked.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-ink-800">Blocked by guardrails ({blocked.length})</h2>
              {blocked.map((req) => (
                <div key={req.id} className="bg-white rounded-2xl border border-ember-200 p-5 flex items-start gap-4">
                  <ShieldAlert className="w-5 h-5 text-ember-600 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">
                      {req.vendor_name} · {formatCurrency(req.amount_cents, req.currency)}
                    </p>
                    <p className="text-sm text-ember-700">{req.block_reason}</p>
                    <p className="text-xs text-ink-400 mt-1 truncate">Cited: "{req.source_context}"</p>
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
