import type { TransactionStatus, EscrowEventType } from '@/lib/types';

export const STATUS_META: Record<
  TransactionStatus,
  { label: string; color: 'rail' | 'amber' | 'mint' | 'ember' | 'ink'; icon: string }
> = {
  draft: { label: 'Draft', color: 'ink', icon: 'FileEdit' },
  awaiting_approval: { label: 'Awaiting Approval', color: 'amber', icon: 'ShieldAlert' },
  authorized: { label: 'Funds Held', color: 'amber', icon: 'Lock' },
  deliverable_pending: { label: 'Awaiting Delivery', color: 'amber', icon: 'PackageOpen' },
  under_review: { label: 'Awaiting Confirmation', color: 'rail', icon: 'PackageCheck' },
  captured: { label: 'Funds Released', color: 'mint', icon: 'CheckCircle2' },
  voided: { label: 'Voided', color: 'ember', icon: 'XCircle' },
  expired: { label: 'Expired', color: 'ink', icon: 'TimerOff' },
};

export const EVENT_LABELS: Record<EscrowEventType, string> = {
  authorized: 'Funds Authorized (Held)',
  delivered: 'Marked as Delivered',
  captured: 'Funds Captured & Released',
  voided: 'Authorization Voided',
  expired: 'Escrow Expired',
};

export function statusBadgeClass(color: string): string {
  switch (color) {
    case 'rail': return 'badge-rail';
    case 'amber': return 'badge-amber';
    case 'mint': return 'badge-mint';
    case 'ember': return 'badge-ember';
    default: return 'badge-ink';
  }
}
