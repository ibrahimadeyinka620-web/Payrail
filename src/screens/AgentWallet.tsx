import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, Copy, Check, Ban } from 'lucide-react';
import { issueAgentToken, fetchAgentTokens, revokeAgentToken, TOKEN_LIFETIMES } from '@/lib/agentApi';
import { formatDateTime, timeAgo } from '@/lib/format';
import type { AgentToken } from '@/lib/types';

export default function AgentWallet() {
  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [lifetime, setLifetime] = useState<number>(7);
  const [merchants, setMerchants] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      setTokens(await fetchAgentTokens());
      setError(null);
    } catch {
      setError('Could not load your agent tokens. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleIssue(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const whitelist = merchants
        .split(',')
        .map((m) => m.trim().toLowerCase())
        .filter(Boolean);
      const { token, secret } = await issueAgentToken(label.trim(), lifetime, whitelist);
      setTokens((prev) => [token, ...prev]);
      setNewSecret(secret);
      setLabel('');
      setMerchants('');
    } catch {
      setError('Could not issue the token. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await revokeAgentToken(id);
      setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, revoked: true } : t)));
    } catch {
      setError('Could not revoke that token. Please try again.');
    }
  }

  async function copySecret() {
    if (!newSecret) return;
    await navigator.clipboard.writeText(newSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const now = Date.now();

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">Agent Wallet</h1>
        <p className="text-sm text-ink-500 mt-1">
          Give an agent a time-limited token. Every payment it requests is checked against your limits:
          $100 per payment, $500 per day, and your merchant list.
        </p>
      </div>

      <form onSubmit={handleIssue} className="bg-white rounded-2xl border border-base-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-ink-800">Issue a new token</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-ink-600">Label</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Video editing agent"
              maxLength={80}
              className="w-full rounded-xl border border-base-200 px-3 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-rail-400"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-ink-600">Valid for</span>
            <select
              value={lifetime}
              onChange={(e) => setLifetime(Number(e.target.value))}
              className="w-full rounded-xl border border-base-200 px-3 py-2.5 text-sm text-ink-900 bg-white focus:outline-none focus:ring-2 focus:ring-rail-400"
            >
              {TOKEN_LIFETIMES.map((t) => (
                <option key={t.days} value={t.days}>{t.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-600">Approved merchants (comma separated)</span>
          <input
            value={merchants}
            onChange={(e) => setMerchants(e.target.value)}
            placeholder="studio-kite, pixelforge"
            className="w-full rounded-xl border border-base-200 px-3 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-rail-400"
          />
        </label>
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-400">Payments to merchants not on this list are blocked.</p>
          <button
            type="submit"
            disabled={submitting || !label.trim()}
            className="px-5 py-2.5 rounded-xl bg-rail-600 text-white text-sm font-semibold hover:bg-rail-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Issuing...' : 'Issue token'}
          </button>
        </div>
      </form>

      {newSecret && (
        <div className="rounded-2xl border border-mint-200 bg-mint-50 p-5 space-y-3">
          <p className="text-sm font-semibold text-ink-900">Copy this token now. It will not be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-white border border-base-200 px-3 py-2 text-xs text-ink-800">
              {newSecret}
            </code>
            <button
              onClick={copySecret}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-base-200 text-xs font-medium text-ink-700 hover:bg-base-100 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button onClick={() => setNewSecret(null)} className="text-xs text-ink-500 hover:text-ink-800">
            I have saved it
          </button>
        </div>
      )}

      {error && <p className="text-sm text-ember-600">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-800">Your tokens</h2>
        {loading ? (
          <p className="text-sm text-ink-400">Loading tokens...</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-ink-400">No tokens yet. Issue one above to let an agent request payments.</p>
        ) : (
          tokens.map((t) => {
            const expired = new Date(t.expires_at).getTime() <= now;
            const active = !t.revoked && !expired;
            return (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-base-200 p-5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-rail-50 border border-rail-200 flex items-center justify-center flex-shrink-0">
                    <KeyRound className="w-4 h-4 text-rail-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900 truncate">{t.label}</p>
                    <p className="text-xs text-ink-400 truncate">
                      {t.token_prefix}... · Created {timeAgo(t.created_at)} · Expires {formatDateTime(t.expires_at)}
                    </p>
                    <p className="text-xs text-ink-500 truncate">
                      Merchants: {t.merchant_whitelist.length ? t.merchant_whitelist.join(', ') : 'none'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      active ? 'bg-mint-50 text-mint-700' : 'bg-base-200 text-ink-500'
                    }`}
                  >
                    {t.revoked ? 'Revoked' : expired ? 'Expired' : 'Active'}
                  </span>
                  {active && (
                    <button
                      onClick={() => handleRevoke(t.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ember-600 transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
