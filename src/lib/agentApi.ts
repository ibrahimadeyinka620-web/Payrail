import { supabase } from '@/lib/supabase';
import type { AgentToken, AgentPaymentRequest, AuditTimelineEntry } from '@/lib/types';

export const TOKEN_LIFETIMES = [
  { days: 1, label: '1 day' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
] as const;

export interface IssuedToken {
  token: AgentToken;
  secret: string;
}

function randomSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `apt_${hex}`;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function issueAgentToken(
  label: string,
  lifetimeDays: number,
  merchantWhitelist: string[]
): Promise<IssuedToken> {
  const secret = randomSecret();
  const expiresAt = new Date(Date.now() + lifetimeDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('agent_tokens')
    .insert({
      label,
      token_hash: await sha256Hex(secret),
      token_prefix: secret.slice(0, 12),
      expires_at: expiresAt,
      merchant_whitelist: merchantWhitelist,
    })
    .select('*')
    .single();
  if (error) throw error;
  return { token: data as AgentToken, secret };
}

export async function fetchAgentTokens(): Promise<AgentToken[]> {
  const { data, error } = await supabase
    .from('agent_tokens')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as AgentToken[];
}

export async function revokeAgentToken(id: string): Promise<void> {
  const { error } = await supabase
    .from('agent_tokens')
    .update({ revoked: true })
    .eq('id', id);
  if (error) throw error;
}

export async function fetchAgentRequests(): Promise<AgentPaymentRequest[]> {
  const { data, error } = await supabase
    .from('agent_payment_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as AgentPaymentRequest[];
}

export async function decideAgentPayment(requestId: string, approve: boolean): Promise<string | null> {
  const { data, error } = await supabase.rpc('decide_agent_payment', {
    p_request_id: requestId,
    p_approve: approve,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function fetchOwnerAuditEntries(): Promise<(AuditTimelineEntry & { trade_name: string | null })[]> {
  const { data, error } = await supabase
    .from('audit_timeline')
    .select('*, transactions(vendor_name)')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const { transactions, ...entry } = row as AuditTimelineEntry & {
      transactions: { vendor_name: string } | null;
    };
    return { ...entry, trade_name: transactions?.vendor_name ?? null };
  });
}
