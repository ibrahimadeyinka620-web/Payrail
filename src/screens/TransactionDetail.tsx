import { useEffect, useState, useRef } from 'react';
import {
  ArrowLeft, ShieldCheck, Lock, CheckCircle2, XCircle,
  Upload, ScanSearch, ArrowRight, FileText, Sparkles,
  Vault, ShieldAlert, Package, type LucideIcon,
} from 'lucide-react';
import {
  fetchTransaction, fetchEscrowEvents, fetchDeliverables, fetchAuditTimeline,
  updateTransactionStatus, addEscrowEvent, addAuditEntry,
  createDeliverable, updateDeliverableVerdict,
} from '@/lib/dataApi';
import { reviewDeliverable } from '@/lib/aiEngine';
import { formatCurrency, formatDateTime, timeAgo } from '@/lib/format';
import { STATUS_META, statusBadgeClass, EVENT_LABELS } from '@/lib/statusMeta';
import { STATUS_ICONS } from '@/lib/statusIcons';
import type { Transaction, EscrowEvent, Deliverable, AuditTimelineEntry } from '@/lib/types';
import type { View } from '@/components/AppShell';

interface Props {
  transactionId: string;
  onBack: (v: View) => void;
}

export default function TransactionDetail({ transactionId, onBack }: Props) {
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [events, setEvents] = useState<EscrowEvent[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [timeline, setTimeline] = useState<AuditTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [disputeSummary, setDisputeSummary] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadAll() {
    const [t, e, d, a] = await Promise.all([
      fetchTransaction(transactionId),
      fetchEscrowEvents(transactionId),
      fetchDeliverables(transactionId),
      fetchAuditTimeline(transactionId),
    ]);
    setTxn(t);
    setEvents(e);
    setDeliverables(d);
    setTimeline(a);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, [transactionId]);

  async function handleAuthorize() {
    if (!txn) return;
    setBusy(true);
    await updateTransactionStatus(txn.id, 'authorized');
    await addEscrowEvent(txn.id, 'authorized', txn.amount_cents, `Funds authorized and held via PayPal Auth (simulated). ${formatCurrency(txn.amount_cents, txn.currency)} held in escrow.`);
    await addAuditEntry(txn.id, {
      step: 'paypal_authorize',
      actor: 'paypal',
      title: 'Funds authorized & held',
      detail: `PayPal Auth & Capture: ${formatCurrency(txn.amount_cents, txn.currency)} authorized (held, not captured). Seller notified that funds are secured.`,
      metadata: { amount_cents: txn.amount_cents, paypal_action: 'authorize' },
    });
    await loadAll();
    setBusy(false);
  }

  async function handleVoid() {
    if (!txn) return;
    setBusy(true);
    await updateTransactionStatus(txn.id, 'voided');
    await addEscrowEvent(txn.id, 'voided', txn.amount_cents, 'Authorization voided. Held funds returned to buyer.');
    await addAuditEntry(txn.id, {
      step: 'fund_void',
      actor: 'user',
      title: 'Authorization voided',
      detail: 'Held funds released back to the buyer. Escrow closed.',
      metadata: { amount_cents: txn.amount_cents, paypal_action: 'void' },
    });
    await loadAll();
    setBusy(false);
  }

  async function handleDeliverableUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !txn) return;
    setBusy(true);

    const storagePath = `deliverables/${txn.id}/${file.name}`;
    const del = await createDeliverable(txn.id, file.name, storagePath, file.type, file.size);

    await addEscrowEvent(txn.id, 'deliverable_uploaded', null, `Seller uploaded "${file.name}" (${(file.size / 1024).toFixed(1)} KB).`);
    await addAuditEntry(txn.id, {
      step: 'deliverable_upload',
      actor: 'vendor',
      title: 'Deliverable uploaded',
      detail: `File "${file.name}" uploaded for review.`,
      metadata: { filename: file.name, size_bytes: file.size, mime_type: file.type },
    });

    await updateTransactionStatus(txn.id, 'under_review');
    await loadAll();
    setBusy(false);

    await runReview(del);
  }

  async function runReview(del: Deliverable) {
    if (!txn) return;
    setReviewing(true);
    await addEscrowEvent(txn.id, 'review_started', null, 'AI began analyzing the deliverable.');
    await addAuditEntry(txn.id, {
      step: 'ai_review',
      actor: 'ai',
      title: 'AI review started',
      detail: 'AI is analyzing the uploaded deliverable against the agreed description.',
    });
    await loadAll();

    await new Promise((r) => setTimeout(r, 1800));

    const result = reviewDeliverable(del.filename, txn.description);
    await updateDeliverableVerdict(del.id, result.verdict, result.notes);

    if (result.verdict === 'passed') {
      await addEscrowEvent(txn.id, 'review_passed', null, result.notes);
      await addAuditEntry(txn.id, {
        step: 'ai_review',
        actor: 'ai',
        title: 'AI: deliverable verified',
        detail: result.notes,
        metadata: { verdict: 'passed', deliverable_id: del.id },
      });
      await updateTransactionStatus(txn.id, 'captured');
      await addEscrowEvent(txn.id, 'captured', txn.amount_cents, 'Funds captured and released to seller after successful verification.');
      await addAuditEntry(txn.id, {
        step: 'fund_capture',
        actor: 'paypal',
        title: 'Funds captured & released',
        detail: `PayPal Capture: ${formatCurrency(txn.amount_cents, txn.currency)} captured from authorization and released to seller.`,
        metadata: { amount_cents: txn.amount_cents, paypal_action: 'capture' },
      });
    } else {
      await addEscrowEvent(txn.id, 'review_failed', null, result.notes);
      await addAuditEntry(txn.id, {
        step: 'ai_review',
        actor: 'ai',
        title: 'AI: deliverable rejected',
        detail: result.notes,
        metadata: { verdict: 'rejected', deliverable_id: del.id },
      });
      await updateTransactionStatus(txn.id, 'deliverable_pending');
    }

    await loadAll();
    setReviewing(false);
  }

  async function handleDispute() {
    if (!txn) return;
    setBusy(true);
    await addAuditEntry(txn.id, {
      step: 'note',
      actor: 'user',
      title: 'Trade flagged for dispute',
      detail: 'Buyer flagged this trade for dispute resolution. AI generated a summary from the conversation and audit trail.',
      metadata: { disputed: true },
    });
    await new Promise((r) => setTimeout(r, 1200));
    const summary = `Dispute analysis for trade "${txn.description}" with ${txn.vendor_name} (${formatCurrency(txn.amount_cents, txn.currency)}). The trade was initiated from a chat conversation and the AI verified the amount against the product listing. ${timeline.length} audit events recorded. The deliverable has ${deliverables.length} file(s) uploaded. Recommendation: review the deliverable against the agreed description. If the deliverable does not match, void the escrow to return funds to the buyer. If it partially matches, negotiate a partial refund through the chat.`;
    setDisputeSummary(summary);
    await loadAll();
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-base-100 rounded-lg animate-pulse" />
        <div className="h-48 bg-base-100 rounded-2xl animate-pulse" />
        <div className="h-64 bg-base-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!txn) {
    return (
      <div className="p-8 text-center">
        <p className="text-ink-500">Order not found.</p>
        <button onClick={() => onBack('orders')} className="btn-ghost mt-4">
          <ArrowLeft className="w-4 h-4" /> Back to orders
        </button>
      </div>
    );
  }

  const meta = STATUS_META[txn.status];
  const StatusIcon = STATUS_ICONS[txn.status];
  const isHeld = ['authorized', 'deliverable_pending', 'under_review'].includes(txn.status);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <button onClick={() => onBack('orders')} className="btn-ghost -ml-2">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div className="card p-6 animate-fade-in">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              meta.color === 'mint' ? 'bg-mint-50 border border-mint-200'
              : meta.color === 'amber' ? 'bg-amber-50 border border-amber-200'
              : meta.color === 'ember' ? 'bg-ember-50 border border-ember-200'
              : 'bg-base-100 border border-base-200'
            }`}>
              <StatusIcon className="w-6 h-6 text-ink-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink-900">{txn.vendor_name}</h1>
              <p className="text-sm text-ink-500">{txn.description}</p>
              <p className="text-xs text-ink-400 mt-1">Created {timeAgo(txn.created_at)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-ink-900 tabular-nums">
              {formatCurrency(txn.amount_cents, txn.currency)}
            </p>
            <span className={statusBadgeClass(meta.color)}>
              <StatusIcon className="w-3 h-3" /> {meta.label}
            </span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left — actions / escrow status */}
        <div className="space-y-6">
          {/* AI proof */}
          <div className={`card p-5 ${txn.proof_verified ? 'border-rail-200' : 'border-ember-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              {txn.proof_verified ? (
                <ShieldCheck className="w-4 h-4 text-rail-500" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-ember-500" />
              )}
              <p className="text-sm font-bold text-ink-900">AI verification</p>
            </div>
            {txn.source_text && (
              <div className="rounded-lg bg-base-50 border border-base-200 p-3 mb-3">
                <p className="text-xs text-ink-400 mb-1">Source</p>
                <p className="text-sm text-ink-700 leading-relaxed">{txn.source_text}</p>
              </div>
            )}
            {txn.ai_reasoning && (
              <p className="text-xs text-ink-500 leading-relaxed">{txn.ai_reasoning}</p>
            )}
          </div>

          {/* Escrow widget */}
          {isHeld && (
            <div className="card p-5 border-amber-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <Vault className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-ink-900">Funds in escrow</p>
                  <p className="text-xs text-ink-400">Held via PayPal Auth &amp; Capture</p>
                </div>
              </div>
              <div className="text-center py-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-2xl font-bold text-amber-600 tabular-nums">
                  {formatCurrency(txn.amount_cents, txn.currency)}
                </p>
                <p className="text-xs text-amber-600/70 mt-1">Authorized — not yet captured</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="card p-5">
            <p className="section-title mb-4">Actions</p>
            {txn.status === 'awaiting_approval' && (
              <button onClick={handleAuthorize} disabled={busy} className="btn-amber w-full">
                <Lock className="w-4 h-4" /> Authorize &amp; hold {formatCurrency(txn.amount_cents, txn.currency)}
              </button>
            )}
            {txn.status === 'authorized' && (
              <div className="space-y-3">
                <p className="text-xs text-ink-500 leading-relaxed">
                  Funds are held. The seller should now upload the deliverable for AI verification.
                </p>
                <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-primary w-full">
                  <Upload className="w-4 h-4" /> Upload deliverable
                </button>
                <button onClick={handleVoid} disabled={busy} className="btn-danger w-full">
                  <XCircle className="w-4 h-4" /> Void &amp; return funds
                </button>
              </div>
            )}
            {txn.status === 'deliverable_pending' && (
              <div className="space-y-3">
                <p className="text-xs text-ink-500">
                  Previous deliverable was rejected. Upload a corrected one.
                </p>
                <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-primary w-full">
                  <Upload className="w-4 h-4" /> Re-upload deliverable
                </button>
                <button onClick={handleVoid} disabled={busy} className="btn-danger w-full">
                  <XCircle className="w-4 h-4" /> Void &amp; return funds
                </button>
              </div>
            )}
            {txn.status === 'under_review' && (
              <div className="text-center py-4">
                <ScanSearch className="w-8 h-8 text-rail-500 mx-auto mb-2 animate-pulse" />
                <p className="text-sm text-rail-600 font-medium">AI is reviewing…</p>
                <p className="text-xs text-ink-400 mt-1">This takes a few seconds.</p>
              </div>
            )}
            {txn.status === 'captured' && (
              <div className="text-center py-4">
                <CheckCircle2 className="w-8 h-8 text-mint-500 mx-auto mb-2" />
                <p className="text-sm text-mint-600 font-medium">Funds released to seller</p>
                <p className="text-xs text-ink-400 mt-1">Escrow complete.</p>
              </div>
            )}
            {txn.status === 'voided' && (
              <div className="text-center py-4">
                <XCircle className="w-8 h-8 text-ember-500 mx-auto mb-2" />
                <p className="text-sm text-ember-600 font-medium">Authorization voided</p>
                <p className="text-xs text-ink-400 mt-1">Funds returned to buyer.</p>
              </div>
            )}
            {txn.status === 'draft' && (
              <div className="text-center py-4">
                <ShieldAlert className="w-8 h-8 text-ember-400/60 mx-auto mb-2" />
                <p className="text-sm text-ink-600 font-medium">Draft (unverified)</p>
                <button onClick={handleVoid} disabled={busy} className="btn-danger w-full mt-3">
                  <XCircle className="w-4 h-4" /> Discard draft
                </button>
              </div>
            )}
            <input ref={fileRef} type="file" onChange={handleDeliverableUpload} className="hidden" />
          </div>

          {/* Deliverables */}
          {deliverables.length > 0 && (
            <div className="card p-5">
              <p className="section-title mb-4">Deliverables</p>
              <div className="space-y-2">
                {deliverables.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-base-50 border border-base-200">
                    <FileText className="w-4 h-4 text-ink-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink-800 truncate">{d.filename}</p>
                      <p className="text-xs text-ink-400">{timeAgo(d.uploaded_at)}</p>
                    </div>
                    {d.ai_verdict === 'passed' && <CheckCircle2 className="w-4 h-4 text-mint-500" />}
                    {d.ai_verdict === 'rejected' && <XCircle className="w-4 h-4 text-ember-500" />}
                    {d.ai_verdict === 'pending' && <ScanSearch className="w-4 h-4 text-rail-500 animate-pulse" />}
                  </div>
                ))}
              </div>
              {deliverables[deliverables.length - 1]?.ai_notes && (
                <div className="mt-3 rounded-lg bg-base-50 border border-base-200 p-3">
                  <p className="text-xs text-ink-400 mb-1">AI notes:</p>
                  <p className="text-xs text-ink-600 leading-relaxed">
                    {deliverables[deliverables.length - 1].ai_notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Dispute resolution — unique to Payrail */}
          {isHeld && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <p className="text-sm font-bold text-ink-900">Dispute resolution</p>
              </div>
              <p className="text-xs text-ink-500 leading-relaxed mb-3">
                Not happy with the deliverable? Flag the trade and the AI will generate a
                dispute summary from the conversation and audit trail to help resolve it fairly.
              </p>
              <button
                onClick={() => handleDispute()}
                disabled={busy}
                className="btn-secondary w-full text-sm"
              >
                <ShieldAlert className="w-4 h-4" /> Flag this trade
              </button>
              {disputeSummary && (
                <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-4 animate-slide-up">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <p className="text-xs font-semibold text-amber-700">AI dispute summary</p>
                  </div>
                  <p className="text-xs text-amber-700/80 leading-relaxed">{disputeSummary}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right — timeline + events */}
        <div className="space-y-6">
          {/* Escrow events */}
          <div className="card p-5">
            <p className="section-title mb-4">Escrow Events</p>
            {events.length === 0 ? (
              <p className="text-sm text-ink-400 py-4 text-center">No escrow events yet.</p>
            ) : (
              <div className="space-y-3">
                {events.map((e) => (
                  <div key={e.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full ${
                        e.event_type === 'captured' || e.event_type === 'review_passed' ? 'bg-mint-400'
                        : e.event_type === 'voided' || e.event_type === 'review_failed' ? 'bg-ember-400'
                        : 'bg-amber-400'
                      }`} />
                      {events.indexOf(e) < events.length - 1 && (
                        <div className="w-px flex-1 bg-base-200 my-1" />
                      )}
                    </div>
                    <div className="pb-3 flex-1">
                      <p className="text-sm font-medium text-ink-800">{EVENT_LABELS[e.event_type]}</p>
                      {e.detail && <p className="text-xs text-ink-400 mt-0.5 leading-relaxed">{e.detail}</p>}
                      <p className="text-[10px] text-ink-400 mt-1">{formatDateTime(e.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit timeline */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="section-title">Audit Trail</p>
              <ExportTimeline timeline={timeline} txn={txn} />
            </div>
            <div className="space-y-3">
              {timeline.map((entry, i) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      entry.actor === 'ai' ? 'bg-rail-50 text-rail-600 border border-rail-200'
                      : entry.actor === 'paypal' ? 'bg-amber-50 text-amber-600 border border-amber-200'
                      : entry.actor === 'vendor' ? 'bg-base-100 text-ink-500 border border-base-200'
                      : entry.actor === 'user' ? 'bg-mint-50 text-mint-600 border border-mint-200'
                      : 'bg-base-100 text-ink-400 border border-base-200'
                    }`}>
                      {entry.actor === 'ai' ? <Sparkles className="w-3 h-3" /> : entry.actor.charAt(0).toUpperCase()}
                    </div>
                    {i < timeline.length - 1 && <div className="w-px flex-1 bg-base-200 my-1" />}
                  </div>
                  <div className="pb-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-ink-800">{entry.title}</p>
                      <span className="text-[10px] text-ink-400 uppercase tracking-wider">{entry.actor}</span>
                    </div>
                    {entry.detail && <p className="text-xs text-ink-400 mt-0.5 leading-relaxed">{entry.detail}</p>}
                    <p className="text-[10px] text-ink-400 mt-1">{formatDateTime(entry.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {reviewing && (
        <div className="fixed bottom-6 right-6 card px-4 py-3 flex items-center gap-3 animate-slide-up">
          <ScanSearch className="w-5 h-5 text-rail-500 animate-pulse" />
          <div>
            <p className="text-sm font-medium text-ink-800">AI reviewing deliverable…</p>
            <p className="text-xs text-ink-400">Verifying against agreed scope</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ExportTimeline({ timeline, txn }: { timeline: AuditTimelineEntry[]; txn: Transaction }) {
  function exportJSON() {
    const payload = {
      transaction: {
        id: txn.id,
        vendor: txn.vendor_name,
        amount_cents: txn.amount_cents,
        currency: txn.currency,
        status: txn.status,
        created_at: txn.created_at,
      },
      audit_trail: timeline.map((e) => ({
        step: e.step,
        actor: e.actor,
        title: e.title,
        detail: e.detail,
        metadata: e.metadata,
        timestamp: e.created_at,
      })),
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payrail-audit-${txn.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button onClick={exportJSON} className="btn-ghost text-xs py-1.5 px-2.5">
      <ArrowRight className="w-3 h-3" /> Export
    </button>
  );
}
