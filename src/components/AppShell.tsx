import { type ReactNode } from 'react';
import {
  ShieldCheck, Store, Package, MessageSquare, Settings, LogOut,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export type View = 'marketplace' | 'orders' | 'chats' | 'settings';

interface NavItem {
  id: View;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { id: 'marketplace', label: 'Marketplace', icon: Store },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'chats', label: 'Chats', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface AppShellProps {
  current: View;
  onNavigate: (v: View) => void;
  children: ReactNode;
}

export default function AppShell({ current, onNavigate, children }: AppShellProps) {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen flex bg-base-100">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r border-base-200 bg-white flex flex-col">
        <div className="px-5 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rail-600 flex items-center justify-center shadow-glow">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight text-ink-900">Payrail</p>
            <p className="text-[10px] text-ink-400 -mt-0.5 uppercase tracking-wider">Escrow marketplace</p>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-2">
          {NAV.map((item) => {
            const active = current === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-rail-50 text-rail-700 border border-rail-200'
                    : 'text-ink-500 hover:text-ink-800 hover:bg-base-100 border border-transparent'
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-base-200">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-base-100">
            <div className="w-8 h-8 rounded-full bg-rail-100 border border-rail-200 flex items-center justify-center text-xs font-bold text-rail-600 flex-shrink-0">
              {(profile?.display_name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink-800 truncate">
                {profile?.display_name || 'User'}
              </p>
              <p className="text-[10px] text-ink-400 truncate">
                {profile?.paypal_connected ? profile.paypal_handle : 'PayPal not linked'}
              </p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 mt-2 rounded-xl text-sm font-medium text-ink-500 hover:text-ember-600 hover:bg-ember-50 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-base-200 bg-white/80 backdrop-blur-xl flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink-700">
              {NAV.find((n) => n.id === current)?.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-mint-400 animate-pulse-ring" />
              <span className="relative rounded-full w-2 h-2 bg-mint-400" />
            </span>
            Sandbox mode
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
