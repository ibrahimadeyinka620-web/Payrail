import { supabase } from '@/lib/supabase';
import type {
  Transaction, EscrowEvent, AuditTimelineEntry,
  Product, Conversation, ChatMessageRow, DraftTransactionData,
} from '@/lib/types';

// ─── Transactions ──────────────────────────────────────────

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Transaction[];
}

export async function fetchTransaction(id: string): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Transaction | null;
}

export async function fetchEscrowEvents(transactionId: string): Promise<EscrowEvent[]> {
  const { data, error } = await supabase
    .from('escrow_events')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as EscrowEvent[];
}

export async function fetchAuditTimeline(transactionId: string): Promise<AuditTimelineEntry[]> {
  const { data, error } = await supabase
    .from('audit_timeline')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as AuditTimelineEntry[];
}

export async function addAuditEntry(
  transactionId: string,
  entry: { step: AuditTimelineEntry['step']; actor: AuditTimelineEntry['actor']; title: string; detail?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  const { error } = await supabase
    .from('audit_timeline')
    .insert({
      transaction_id: transactionId,
      step: entry.step,
      actor: entry.actor,
      title: entry.title,
      detail: entry.detail ?? null,
      metadata: entry.metadata ?? {},
    });
  if (error) throw error;
}

export async function advanceTransaction(
  transactionId: string,
  action: 'mark_delivered' | 'confirm_delivery' | 'void'
): Promise<void> {
  const { error } = await supabase.rpc('advance_transaction', {
    p_transaction_id: transactionId,
    p_action: action,
  });
  if (error) throw error;
}

// ─── Products ──────────────────────────────────────────────

export async function fetchProducts(excludeSellerId?: string): Promise<Product[]> {
  let q = supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (excludeSellerId) {
    q = q.neq('seller_id', excludeSellerId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data as Product[];
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Product | null;
}

export async function fetchMyProducts(sellerId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Product[];
}

export async function createProduct(
  input: Omit<Product, 'id' | 'seller_id' | 'created_at' | 'updated_at' | 'status'> & { status?: string }
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({ ...input, status: input.status ?? 'active' })
    .select('*')
    .single();
  if (error) throw error;
  return data as Product;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── Conversations & Messages ─────────────────────────────

export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data as Conversation[];
}

export async function fetchConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Conversation | null;
}

export async function fetchConversationByTransaction(transactionId: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('transaction_id', transactionId)
    .maybeSingle();
  if (error) throw error;
  return data as Conversation | null;
}

export async function createConversation(
  buyerId: string,
  sellerId: string,
  productId: string
): Promise<Conversation> {
  // Check if a conversation already exists for this buyer+product
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('buyer_id', buyerId)
    .eq('product_id', productId)
    .maybeSingle();
  if (existing) return existing as Conversation;

  const { data, error } = await supabase
    .from('conversations')
    .insert({ buyer_id: buyerId, seller_id: sellerId, product_id: productId })
    .select('*')
    .single();
  if (error) throw error;
  return data as Conversation;
}

export async function fetchMessages(conversationId: string): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as ChatMessageRow[];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  role: 'user' | 'assistant',
  content: string,
  draftTransaction: DraftTransactionData | null = null
): Promise<ChatMessageRow> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      role,
      content,
      draft_transaction: draftTransaction,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ChatMessageRow;
}

export async function respondToOrder(messageId: string, accept: boolean): Promise<string | null> {
  const { data, error } = await supabase.rpc('respond_to_order', {
    p_message_id: messageId,
    p_accept: accept,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

// ─── Seller profile lookup ────────────────────────────────

export async function fetchSellerProfile(sellerId: string): Promise<{ display_name: string } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', sellerId)
    .maybeSingle();
  if (error) throw error;
  return data as { display_name: string } | null;
}
