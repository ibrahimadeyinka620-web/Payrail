import {
  FileEdit, ShieldAlert, Lock, PackageOpen, ScanSearch,
  CheckCircle2, XCircle, TimerOff, type LucideIcon,
} from 'lucide-react';
import type { TransactionStatus } from '@/lib/types';

export const STATUS_ICONS: Record<TransactionStatus, LucideIcon> = {
  draft: FileEdit,
  awaiting_approval: ShieldAlert,
  authorized: Lock,
  deliverable_pending: PackageOpen,
  under_review: ScanSearch,
  captured: CheckCircle2,
  voided: XCircle,
  expired: TimerOff,
};
