import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_SINGLE_TRANSACTION_CENTS = 10_000;
const DAILY_VELOCITY_CENTS = 50_000;
const MIN_SOURCE_CONTEXT_LENGTH = 10;
const MAX_TEXT_LENGTH = 2_000;

interface PaymentRequestBody {
  token: string;
  vendor_name: string;
  merchant_handle: string;
  amount_cents: number;
  currency?: string;
  description: string;
  source_context: string;
}

interface AgentTokenRow {
  id: string;
  owner_id: string;
  expires_at: string;
  revoked: boolean;
  merchant_whitelist: string[];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isNonEmptyString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function parseBody(raw: unknown): PaymentRequestBody | string {
  if (typeof raw !== "object" || raw === null) return "Request body must be a JSON object";
  const b = raw as Record<string, unknown>;
  if (!isNonEmptyString(b.token, 200)) return "token is required";
  if (!isNonEmptyString(b.vendor_name, 120)) return "vendor_name is required";
  if (!isNonEmptyString(b.merchant_handle, 120)) return "merchant_handle is required";
  if (!isNonEmptyString(b.description, MAX_TEXT_LENGTH)) return "description is required";
  if (!isNonEmptyString(b.source_context, MAX_TEXT_LENGTH)) return "source_context is required";
  if (
    typeof b.amount_cents !== "number" ||
    !Number.isInteger(b.amount_cents) ||
    b.amount_cents <= 0
  ) {
    return "amount_cents must be a positive whole number";
  }
  return {
    token: b.token.trim(),
    vendor_name: b.vendor_name.trim(),
    merchant_handle: b.merchant_handle.trim().toLowerCase(),
    amount_cents: b.amount_cents,
    currency: typeof b.currency === "string" && b.currency.length === 3 ? b.currency.toUpperCase() : "USD",
    description: b.description.trim(),
    source_context: b.source_context.trim(),
  };
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function findBlockReason(
  token: AgentTokenRow,
  body: PaymentRequestBody,
  spentLast24hCents: number,
): string | null {
  if (token.revoked) return "Agent token has been revoked.";
  if (new Date(token.expires_at).getTime() <= Date.now()) return "Agent token has expired.";
  if (body.source_context.length < MIN_SOURCE_CONTEXT_LENGTH) {
    return "Payment needs the exact source text that justifies it.";
  }
  if (body.amount_cents > MAX_SINGLE_TRANSACTION_CENTS) {
    return `Amount exceeds the single transaction cap of $${MAX_SINGLE_TRANSACTION_CENTS / 100}.`;
  }
  const whitelist = token.merchant_whitelist.map((m) => m.toLowerCase());
  if (!whitelist.includes(body.merchant_handle)) {
    return `Merchant "${body.merchant_handle}" is not on the approved list.`;
  }
  if (spentLast24hCents + body.amount_cents > DAILY_VELOCITY_CENTS) {
    return `Would exceed the daily budget of $${DAILY_VELOCITY_CENTS / 100}.`;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const raw = await req.json().catch(() => null);
    const parsed = parseBody(raw);
    if (typeof parsed === "string") return json({ error: parsed }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const tokenHash = await sha256Hex(parsed.token);
    const { data: tokenRow, error: tokenError } = await supabase
      .from("agent_tokens")
      .select("id, owner_id, expires_at, revoked, merchant_whitelist")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (tokenError) throw tokenError;
    if (!tokenRow) return json({ error: "Unknown agent token" }, 401);

    const token = tokenRow as AgentTokenRow;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent, error: recentError } = await supabase
      .from("agent_payment_requests")
      .select("amount_cents")
      .eq("token_id", token.id)
      .in("status", ["pending_approval", "approved"])
      .gte("created_at", since);
    if (recentError) throw recentError;
    const spent = (recent ?? []).reduce((sum, r) => sum + (r.amount_cents as number), 0);

    const blockReason = findBlockReason(token, parsed, spent);

    const { data: inserted, error: insertError } = await supabase
      .from("agent_payment_requests")
      .insert({
        token_id: token.id,
        owner_id: token.owner_id,
        vendor_name: parsed.vendor_name,
        merchant_handle: parsed.merchant_handle,
        amount_cents: parsed.amount_cents,
        currency: parsed.currency,
        description: parsed.description,
        source_context: parsed.source_context,
        status: blockReason ? "blocked" : "pending_approval",
        block_reason: blockReason,
      })
      .select("id, status, block_reason")
      .single();
    if (insertError) throw insertError;

    if (blockReason) {
      return json({ request_id: inserted.id, status: "blocked", reason: blockReason }, 403);
    }
    return json({ request_id: inserted.id, status: "pending_approval" }, 202);
  } catch (err) {
    console.error("agent-gateway failed", err);
    return json({ error: "Payment gateway unavailable. Please try again." }, 500);
  }
});
