export type TransactionStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'authorized'
  | 'deliverable_pending'
  | 'under_review'
  | 'captured'
  | 'voided'
  | 'expired';

export type EscrowEventType =
  | 'authorized'
  | 'delivered'
  | 'captured'
  | 'voided'
  | 'expired';

export type TimelineStep =
  | 'user_request'
  | 'ai_extraction'
  | 'paypal_authorize'
  | 'deliverable_upload'
  | 'ai_review'
  | 'fund_capture'
  | 'fund_void'
  | 'note';

export type TimelineActor = 'user' | 'ai' | 'paypal' | 'vendor' | 'system';

export type ProductStatus = 'active' | 'sold' | 'paused';

export type ConversationStatus = 'open' | 'negotiated' | 'escrow_held' | 'completed' | 'closed';

export interface Profile {
  id: string;
  display_name: string;
  paypal_handle: string | null;
  paypal_connected: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  vendor_name: string;
  vendor_handle: string | null;
  description: string;
  amount_cents: number;
  currency: string;
  status: TransactionStatus;
  ai_request: string;
  ai_reasoning: string | null;
  source_text: string | null;
  source_filename: string | null;
  proof_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface EscrowEvent {
  id: string;
  transaction_id: string;
  event_type: EscrowEventType;
  amount_cents: number | null;
  detail: string | null;
  created_at: string;
}

export interface AuditTimelineEntry {
  id: string;
  transaction_id: string;
  step: TimelineStep;
  actor: TimelineActor;
  title: string;
  detail: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Product {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  image_url: string | null;
  category: string | null;
  stock: number | null;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  transaction_id: string | null;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  role: 'user' | 'assistant';
  content: string;
  draft_transaction: DraftTransactionData | null;
  created_at: string;
}

export type OrderStatus = 'pending' | 'approved' | 'declined';

export interface DraftTransactionData {
  vendor_name: string;
  vendor_handle: string | null;
  description: string;
  amount_cents: number;
  currency: string;
  ai_reasoning: string;
  source_text: string;
  proof_verified: boolean;
  order_status: OrderStatus;
  transaction_id?: string;
}

export type AgentRequestStatus = 'pending_approval' | 'approved' | 'declined' | 'blocked';

export interface AgentToken {
  id: string;
  owner_id: string;
  label: string;
  token_prefix: string;
  expires_at: string;
  merchant_whitelist: string[];
  revoked: boolean;
  created_at: string;
}

export interface AgentPaymentRequest {
  id: string;
  token_id: string;
  owner_id: string;
  vendor_name: string;
  merchant_handle: string;
  amount_cents: number;
  currency: string;
  description: string;
  source_context: string;
  status: AgentRequestStatus;
  block_reason: string | null;
  transaction_id: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface ConversationWithDetails extends Conversation {
  product?: Product;
  messages?: ChatMessageRow[];
  transaction?: Transaction | null;
}

export interface TransactionWithDetails extends Transaction {
  escrow_events?: EscrowEvent[];
  audit_timeline?: AuditTimelineEntry[];
}
