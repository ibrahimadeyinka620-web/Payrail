import { useState } from 'react';
import { Link2, Check, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Onboarding() {
  const { profile, updateProfile } = useAuth();
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleConnect() {
    setBusy(true);
    const cleanHandle = handle.trim().replace(/^@/, '');
    await updateProfile({
      paypal_connected: true,
      paypal_handle: cleanHandle || 'sandbox-user@paypal.example',
    });
    setBusy(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-base-50">
      <div className="card max-w-md w-full p-8 animate-slide-up">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-rail-50 border border-rail-200 flex items-center justify-center">
            <Link2 className="w-6 h-6 text-rail-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink-900">Connect PayPal</h2>
            <p className="text-sm text-ink-400">Link your account to start trading</p>
          </div>
        </div>

        <p className="text-sm text-ink-500 leading-relaxed mb-6">
          Payrail uses PayPal's Auth &amp; Capture API to hold funds in escrow. Enter your
          PayPal handle to connect — you can change this later in settings.
        </p>

        <div className="space-y-4">
          <div>
            <label className="label">PayPal handle (optional)</label>
            <input
              className="input"
              placeholder="sandbox-user@paypal.example"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
          </div>

          <div className="rounded-xl bg-base-100 border border-base-200 px-4 py-3 text-xs text-ink-500 leading-relaxed">
            <strong className="text-ink-700">Sandbox mode:</strong> No real PayPal account needed.
            All authorize / capture actions are simulated for this demo.
          </div>

          <button onClick={handleConnect} className="btn-primary w-full" disabled={busy}>
            {busy ? 'Connecting…' : 'Connect & continue'}
            {!busy && <ArrowRight className="w-4 h-4" />}
          </button>

          <button
            onClick={() => updateProfile({ paypal_connected: true, paypal_handle: 'sandbox-user@paypal.example' })}
            className="btn-ghost w-full"
          >
            Skip for now
          </button>
        </div>

        {profile?.display_name && (
          <p className="mt-6 text-center text-xs text-ink-400">
            Signed in as {profile.display_name}
          </p>
        )}
      </div>
    </div>
  );
}
