import { useState } from 'react';
import { ShieldCheck, Lock, Mail, User, ArrowRight, Zap, EyeOff, Eye, Store } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    if (mode === 'signup' && !displayName.trim()) {
      setError('Please enter your name.');
      setBusy(false);
      return;
    }
    const { error: err } =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, displayName.trim());
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-base-50">
      {/* Left — brand / value prop panel */}
      <div className="relative lg:w-1/2 flex flex-col justify-between p-8 lg:p-14 overflow-hidden bg-ink-900">
        <div className="absolute top-0 left-0 w-96 h-96 bg-rail-500/20 rounded-full blur-3xl -translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl translate-x-1/4 translate-y-1/4" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rail-600 flex items-center justify-center shadow-glow">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight text-white">Payrail</p>
            <p className="text-xs text-ink-300 -mt-0.5">Escrow marketplace</p>
          </div>
        </div>

        <div className="relative z-10 my-12 lg:my-0 max-w-md">
          <h1 className="text-3xl lg:text-4xl font-bold leading-tight text-white mb-4">
            Buy and sell with <span className="text-rail-400">escrow-protected</span> trust.
          </h1>
          <p className="text-ink-300 text-base lg:text-lg leading-relaxed">
            Browse the marketplace, chat with sellers, and let the AI co-pilot draft the
            transaction. Funds are held in escrow and released only on delivery confirmation.
          </p>

          <div className="mt-8 space-y-4">
            {[
              { icon: Store, title: 'Chat-based trading', desc: 'Negotiate in chat. The AI drafts the transaction from your conversation.' },
              { icon: Lock, title: 'Funds held in escrow', desc: 'Money is authorized and held — released only when delivery is confirmed.' },
              { icon: ShieldCheck, title: 'AI-verified delivery', desc: 'The AI reviews the deliverable before funds are captured.' },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-base-800 border border-base-700 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-4 h-4 text-rail-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-xs text-ink-400 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-ink-500">
          Built for PayPal · Auth &amp; Capture escrow · AI delivery verification
        </p>
      </div>

      {/* Right — auth form */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-14 bg-base-50">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-ink-900">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-sm text-ink-400 mt-1">
              {mode === 'signin'
                ? 'Sign in to start trading with escrow protection.'
                : 'Join the escrow-protected marketplace in minutes.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">Display name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                  <input
                    className="input pl-11"
                    placeholder="Alex Chen"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  type="email"
                  className="input pl-11"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input pl-11 pr-11"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-ember-50 border border-ember-200 px-4 py-3 text-sm text-ember-600 animate-fade-in">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              {!busy && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-ink-400">
            {mode === 'signin' ? (
              <>
                New to Payrail?{' '}
                <button
                  onClick={() => { setMode('signup'); setError(null); }}
                  className="text-rail-600 font-semibold hover:text-rail-500 transition-colors"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => { setMode('signin'); setError(null); }}
                  className="text-rail-600 font-semibold hover:text-rail-500 transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
