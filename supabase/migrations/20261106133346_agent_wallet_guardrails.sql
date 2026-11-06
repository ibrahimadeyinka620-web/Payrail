/*
# AgentPay: time-bound agent tokens, guarded payment requests, owner approvals

Adds the operational firewall for autonomous agents. The owner issues a
token that expires in 1, 7 or 30 days. An agent submits payment requests
through a gateway that enforces hardcoded limits. Requests that pass wait
for owner approval, which opens an escrow hold.

## 1. New tables
- `agent_tokens`: one row per issued token. Only a SHA-256 hash of the token
  is stored, so the plaintext is shown to the owner once and never persisted.
  Includes a label, expiry, revoked flag and merchant whitelist.
- `agent_payment_requests`: every payment request the gateway receives, with
  its status (pending_approval, approved, declined, blocked), the exact
  source_context text that justifies it, and the block reason when refused.

## 2. Modified tables / functions
- `advance_transaction`: now also works for trades that have no chat
  conversation (agent-funded trades). Without a conversation, the owner can
  confirm delivery or void from the authorized or under_review stage. Chat
  trades behave exactly as before.

## 3. Functions
- `decide_agent_payment(request_id, approve)`: owner-only. Re-checks token
  expiry and revocation at approval time, so an expired or revoked token halts
  the payment. On approval it opens an escrow hold and writes escrow and audit
  entries.

## 4. Security
- RLS is enabled on both new tables. Owners can only see and manage their own
  tokens and requests. Token inserts must set owner_id to the caller.
- Requests are created only by the gateway, which uses the service role.
  The app cannot insert them directly.
- Decision and trade-action functions remain SECURITY DEFINER with checks on
  the caller's identity. EXECUTE is granted to authenticated only.

## 5. Notes
- No tables, columns or existing data are dropped or changed in type.
- Every statement is idempotent.
*/

CREATE TABLE IF NOT EXISTS agent_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  expires_at timestamptz NOT NULL,
  merchant_whitelist text[] NOT NULL DEFAULT '{}',
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_tokens_owner_idx ON agent_tokens (owner_id);

ALTER TABLE agent_tokens ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON agent_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE ON agent_tokens TO service_role;

DROP POLICY IF EXISTS "select_own_agent_tokens" ON agent_tokens;
CREATE POLICY "select_own_agent_tokens" ON agent_tokens FOR SELECT
  TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "insert_own_agent_tokens" ON agent_tokens;
CREATE POLICY "insert_own_agent_tokens" ON agent_tokens FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "update_own_agent_tokens" ON agent_tokens;
CREATE POLICY "update_own_agent_tokens" ON agent_tokens FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS agent_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES agent_tokens(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_name text NOT NULL DEFAULT '',
  merchant_handle text NOT NULL DEFAULT '',
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',
  description text NOT NULL DEFAULT '',
  source_context text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('pending_approval', 'approved', 'declined', 'blocked')),
  block_reason text,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE INDEX IF NOT EXISTS agent_payment_requests_owner_idx ON agent_payment_requests (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_payment_requests_token_idx ON agent_payment_requests (token_id, created_at DESC);

ALTER TABLE agent_payment_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON agent_payment_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON agent_payment_requests TO service_role;

DROP POLICY IF EXISTS "select_own_agent_requests" ON agent_payment_requests;
CREATE POLICY "select_own_agent_requests" ON agent_payment_requests FOR SELECT
  TO authenticated USING (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION decide_agent_payment(p_request_id uuid, p_approve boolean)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req agent_payment_requests%ROWTYPE;
  v_token agent_tokens%ROWTYPE;
  v_txn_id uuid;
BEGIN
  SELECT * INTO v_req FROM agent_payment_requests WHERE id = p_request_id;
  IF NOT FOUND OR v_req.owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;

  IF v_req.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'This request has already been decided';
  END IF;

  IF NOT p_approve THEN
    UPDATE agent_payment_requests
      SET status = 'declined', decided_at = now()
      WHERE id = p_request_id;
    RETURN NULL;
  END IF;

  SELECT * INTO v_token FROM agent_tokens WHERE id = v_req.token_id;
  IF v_token.revoked OR v_token.expires_at <= now() THEN
    UPDATE agent_payment_requests
      SET status = 'blocked',
          block_reason = 'Agent token expired or was revoked before approval. Payment halted.',
          decided_at = now()
      WHERE id = p_request_id;
    RETURN NULL;
  END IF;

  INSERT INTO transactions (
    user_id, vendor_name, description, amount_cents, currency, status,
    ai_request, ai_reasoning, source_text, proof_verified
  ) VALUES (
    v_req.owner_id,
    v_req.vendor_name,
    v_req.description,
    v_req.amount_cents,
    v_req.currency,
    'authorized',
    v_req.description,
    'Agent payment request approved by the owner.',
    v_req.source_context,
    false
  )
  RETURNING id INTO v_txn_id;

  INSERT INTO escrow_events (transaction_id, event_type, amount_cents, detail)
  VALUES (v_txn_id, 'authorized', v_req.amount_cents, 'Owner approved the agent request. Funds held in escrow.');

  INSERT INTO audit_timeline (transaction_id, step, actor, title, detail, metadata)
  VALUES (
    v_txn_id, 'ai_extraction', 'ai', 'Source text cross-referenced',
    v_req.source_context,
    jsonb_build_object('token_id', v_req.token_id, 'request_id', v_req.id)
  );

  INSERT INTO audit_timeline (transaction_id, step, actor, title, detail, metadata)
  VALUES (
    v_txn_id, 'paypal_authorize', 'paypal', 'PayPal authorization initiated',
    'Funds are held in escrow until delivery is verified and the owner confirms.',
    jsonb_build_object('amount_cents', v_req.amount_cents, 'paypal_action', 'authorize')
  );

  UPDATE agent_payment_requests
    SET status = 'approved', transaction_id = v_txn_id, decided_at = now()
    WHERE id = p_request_id;

  RETURN v_txn_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION decide_agent_payment(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION decide_agent_payment(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION advance_transaction(p_transaction_id uuid, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn transactions%ROWTYPE;
  v_conv conversations%ROWTYPE;
  v_has_conv boolean;
  v_is_buyer boolean;
  v_is_seller boolean;
BEGIN
  SELECT * INTO v_txn FROM transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade not found';
  END IF;

  SELECT * INTO v_conv FROM conversations WHERE transaction_id = p_transaction_id LIMIT 1;
  v_has_conv := FOUND;

  v_is_buyer := v_txn.user_id = auth.uid();
  v_is_seller := v_has_conv AND v_conv.seller_id = auth.uid();

  IF NOT v_is_buyer AND NOT v_is_seller THEN
    RAISE EXCEPTION 'You are not a party to this trade';
  END IF;

  IF p_action = 'mark_delivered' THEN
    IF NOT v_is_seller OR v_txn.status <> 'authorized' THEN
      RAISE EXCEPTION 'The seller can only mark a held trade as delivered';
    END IF;
    UPDATE transactions SET status = 'under_review' WHERE id = p_transaction_id;
    INSERT INTO escrow_events (transaction_id, event_type, amount_cents, detail)
    VALUES (p_transaction_id, 'delivered', v_txn.amount_cents, 'Seller marked the work as delivered. Waiting for buyer confirmation.');
    INSERT INTO audit_timeline (transaction_id, step, actor, title, detail, metadata)
    VALUES (
      p_transaction_id, 'deliverable_upload', 'vendor', 'Marked as delivered',
      'The seller says the work has been delivered. The buyer can now confirm.',
      jsonb_build_object('amount_cents', v_txn.amount_cents)
    );

  ELSIF p_action = 'confirm_delivery' THEN
    IF NOT v_is_buyer OR v_txn.status NOT IN ('under_review', 'authorized')
       OR (v_txn.status = 'authorized' AND v_has_conv) THEN
      RAISE EXCEPTION 'The buyer can only confirm a trade that has been marked as delivered';
    END IF;
    UPDATE transactions SET status = 'captured' WHERE id = p_transaction_id;
    INSERT INTO escrow_events (transaction_id, event_type, amount_cents, detail)
    VALUES (p_transaction_id, 'captured', v_txn.amount_cents, 'Buyer confirmed delivery. Funds released to seller.');
    INSERT INTO audit_timeline (transaction_id, step, actor, title, detail, metadata)
    VALUES (
      p_transaction_id, 'fund_capture', 'paypal', 'Final PayPal capture closed',
      'Buyer confirmed delivery. Funds were released to the seller.',
      jsonb_build_object('amount_cents', v_txn.amount_cents, 'paypal_action', 'capture')
    );

  ELSIF p_action = 'void' THEN
    IF NOT v_is_buyer OR v_txn.status NOT IN ('authorized', 'under_review') THEN
      RAISE EXCEPTION 'This trade can no longer be voided';
    END IF;
    UPDATE transactions SET status = 'voided' WHERE id = p_transaction_id;
    INSERT INTO escrow_events (transaction_id, event_type, amount_cents, detail)
    VALUES (p_transaction_id, 'voided', v_txn.amount_cents, 'Buyer voided the trade. Held funds returned to buyer.');
    INSERT INTO audit_timeline (transaction_id, step, actor, title, detail, metadata)
    VALUES (
      p_transaction_id, 'fund_void', 'user', 'Authorization voided',
      'Held funds released back to the buyer. Escrow closed.',
      jsonb_build_object('amount_cents', v_txn.amount_cents, 'paypal_action', 'void')
    );

  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION advance_transaction(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION advance_transaction(uuid, text) TO authenticated;
