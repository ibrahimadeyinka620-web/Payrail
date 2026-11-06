import { useEffect, useState } from 'react';
import {
  Lock, CheckCircle2, XCircle, ArrowRight, TrendingUp,
  ShieldAlert, Clock, Package, Plus, Store,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchTransactions } from '@/lib/dataApi';
import { formatCurrency, timeAgo } from '@/lib/format';
import { STATUS_META, statusBadgeClass } from '@/lib/statusMeta';
import { STATUS_ICONS } from '@/lib/statusIcons';
import type { Transaction } from '@/lib/types';
import type { View } from '@/components/AppShell';

interface Props {
  onNavigate: (v: View) => void;
  onOpenTransaction: (id: string) => void;
}

export default function Orders({ onNavigate, onOpenTransaction }: Props) {
  const { profile } = useAuth();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    fetchTransactions()
      .then(setTxns)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const heldCents = txns
    .filter((t) => t.status === 'authorized' || t.status === 'deliverable_pending' || t.status === 'under_review')
    .reduce((sum, t) => sum + t.amount_cents, 0);
  const releasedCents = txns.filter((t) => t.status === 'captured').reduce((s, t) => s + t.amount_cents, 0);
  const voidedCents = txns.filter((t) => t.status === 'voided').reduce((s, t) => s + t.amount_cents, 0);
  const pendingApprovals = txns.filter((t) => t.status === 'awaiting_approval').length;

  const stats = [
    { label: 'In escrow', value: formatCurrency(heldCents), icon: Lock, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200' },
    { label: 'Released', value: formatCurrency(releasedCents), icon: CheckCircle2, color: 'text-mint-500', bg: 'bg-mint-50 border-mint-200' },
    { label: 'Returned', value: formatCurrency(voidedCents), icon: XCircle, color: 'text-ember-500', bg: 'bg-ember-50 border-ember-200' },
    { label: 'Pending', value: String(pendingApprovals), icon: ShieldAlert, color: 'text-rail-500', bg: 'bg-rail-50 border-rail-200' },
  ];

  const activeStatuses = ['awaiting_approval', 'authorized', 'deliverable_pending', 'under_review'];
  const filtered = tab === 'all' ? txns : tab === 'active' ? txns.filter((t) => activeStatuses.includes(t.status)) : txns.filter((t) => ['captured', 'voided', 'expired'].includes(t.status));

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Greeting */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-ink-900">
          Welcome back, {profile?.display_name || 'there'}.
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          Your escrow-protected trades at a glance.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={s.label} className={`card p-5 animate-slide-up`} style={{ animationDelay: `${i * 40}ms` }}>
            <div className={`w-9 h-9 rounded-lg ${s.bg} border flex items-center justify-center mb-3`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold text-ink-900 tabular-nums">{s.value}</p>
            <p className="text-xs text-ink-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('marketplace')} className="btn-primary text-sm">
          <Store className="w-4 h-4" /> Browse marketplace
        </button>
      </div>

      {/* Orders list */}
      <div className="card p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            {(['all', 'active', 'completed'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  tab === t ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-base-100'
                }`}
              >
                {t === 'all' ? 'All' : t === 'active' ? 'Active' : 'Completed'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-base-100 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-base-100 border border-base-200 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-ink-400" />
            </div>
            <p className="text-sm font-medium text-ink-600">No orders yet</p>
            <p className="text-xs text-ink-400 mt-1 mb-4">
              Browse the marketplace and start a trade to see orders here.
            </p>
            <button onClick={() => onNavigate('marketplace')} className="btn-primary">
              <TrendingUp className="w-3.5 h-3.5" /> Browse marketplace
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => {
              const meta = STATUS_META[t.status];
              const Icon = STATUS_ICONS[t.status];
              return (
                <button
                  key={t.id}
                  onClick={() => onOpenTransaction(t.id)}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-base-50 border border-base-200 hover:border-base-300 hover:bg-white transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-lg bg-white border border-base-200 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-ink-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-800 truncate">
                      {t.vendor_name}
                    </p>
                    <p className="text-xs text-ink-400 truncate">
                      {t.description} · {timeAgo(t.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={statusBadgeClass(meta.color)}>{meta.label}</span>
                    <span className="text-sm font-bold text-ink-900 tabular-nums">
                      {formatCurrency(t.amount_cents, t.currency)}
                    </span>
                    <ArrowRight className="w-4 h-4 text-ink-300 group-hover:text-ink-500 transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
