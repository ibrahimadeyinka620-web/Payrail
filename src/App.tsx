import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import AuthScreen from '@/screens/AuthScreen';
import Onboarding from '@/screens/Onboarding';
import AppShell, { type View } from '@/components/AppShell';
import Marketplace from '@/screens/Marketplace';
import Orders from '@/screens/Orders';
import ChatList from '@/screens/ChatList';
import TradeChat from '@/screens/TradeChat';
import ProductDetail from '@/screens/ProductDetail';
import TransactionDetail from '@/screens/TransactionDetail';
import Settings from '@/screens/Settings';

type Overlay =
  | { kind: 'none' }
  | { kind: 'product'; productId: string }
  | { kind: 'chat'; conversationId: string }
  | { kind: 'transaction'; transactionId: string };

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [view, setView] = useState<View>('marketplace');
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100">
        <div className="w-8 h-8 border-2 border-rail-200 border-t-rail-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  if (user && profile && !profile.paypal_connected) return <Onboarding />;

  function navigate(v: View) {
    setOverlay({ kind: 'none' });
    setView(v);
  }

  function openProduct(id: string) {
    setOverlay({ kind: 'product', productId: id });
  }

  function openChat(id: string) {
    setOverlay({ kind: 'chat', conversationId: id });
  }

  function openTransaction(id: string) {
    setOverlay({ kind: 'transaction', transactionId: id });
  }

  // Full-screen overlays (product detail, trade chat, transaction detail)
  if (overlay.kind === 'product') {
    return (
      <AppShell current="marketplace" onNavigate={navigate}>
        <ProductDetail
          productId={overlay.productId}
          onBack={navigate}
          onOpenChat={openChat}
        />
      </AppShell>
    );
  }

  if (overlay.kind === 'chat') {
    return (
      <AppShell current="chats" onNavigate={navigate}>
        <TradeChat
          conversationId={overlay.conversationId}
          onBack={navigate}
          onOpenTransaction={openTransaction}
        />
      </AppShell>
    );
  }

  if (overlay.kind === 'transaction') {
    return (
      <AppShell current="orders" onNavigate={navigate}>
        <TransactionDetail
          transactionId={overlay.transactionId}
          onBack={navigate}
        />
      </AppShell>
    );
  }

  return (
    <AppShell current={view} onNavigate={navigate}>
      {view === 'marketplace' && <Marketplace onNavigate={navigate} onOpenProduct={openProduct} />}
      {view === 'orders' && <Orders onNavigate={navigate} onOpenTransaction={openTransaction} />}
      {view === 'chats' && <ChatList onNavigate={navigate} onOpenChat={openChat} />}
      {view === 'settings' && <Settings />}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
