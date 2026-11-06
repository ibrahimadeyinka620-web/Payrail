import { supabase } from '@/lib/supabase';
import type { Transaction } from '@/lib/types';

export interface TrustScore {
  completedTrades: number;
  totalVolumeCents: number;
  rating: number; // 0-5 stars
  trustLevel: 'new' | 'verified' | 'trusted' | 'expert';
  trustLabel: string;
  trustColor: string;
}

const LEVELS: { threshold: number; level: TrustScore['trustLevel']; label: string; color: string }[] = [
  { threshold: 0, level: 'new', label: 'New trader', color: 'text-ink-400' },
  { threshold: 3, level: 'verified', label: 'Verified', color: 'text-rail-600' },
  { threshold: 10, level: 'trusted', label: 'Trusted', color: 'text-mint-600' },
  { threshold: 25, level: 'expert', label: 'Expert', color: 'text-amber-600' },
];

export function computeTrustScore(completedTrades: number, totalVolumeCents: number): TrustScore {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (completedTrades >= l.threshold) level = l;
  }
  const rating = Math.min(5, 3 + completedTrades * 0.2);

  return {
    completedTrades,
    totalVolumeCents,
    rating: Math.round(rating * 10) / 10,
    trustLevel: level.level,
    trustLabel: level.label,
    trustColor: level.color,
  };
}

export async function fetchSellerTrust(sellerId: string): Promise<TrustScore> {
  // Count products listed by this seller
  const { count: productsCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', sellerId);

  // Count completed transactions where this user was the buyer (user_id)
  const { data: txns } = await supabase
    .from('transactions')
    .select('amount_cents, status')
    .eq('user_id', sellerId);

  type TxnSummary = Pick<Transaction, 'amount_cents' | 'status'>;
  const completed = ((txns ?? []) as TxnSummary[]).filter((t) => t.status === 'captured');
  const totalVolume = completed.reduce((s, t) => s + t.amount_cents, 0);

  // Factor in products listed as activity
  const activityScore = completed.length + Math.min(5, (productsCount ?? 0));

  return computeTrustScore(activityScore, totalVolume);
}

export async function fetchTrustForSellers(sellerIds: string[]): Promise<Record<string, TrustScore>> {
  const result: Record<string, TrustScore> = {};
  await Promise.all(
    sellerIds.map(async (id) => {
      result[id] = await fetchSellerTrust(id);
    })
  );
  return result;
}
