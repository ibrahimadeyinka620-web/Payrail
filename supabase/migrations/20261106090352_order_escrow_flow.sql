/*
# Order-to-escrow flow: seller orders, buyer approves, delivery releases payment

Replaces the document/deliverable-upload path with a chat-based order flow.

## 1. How the flow works
1. Buyer and seller chat about a product.
2. The seller creates an order (amount) in the chat. It is stored as a message with a pending order attached.
3. The buyer approves or declines the order.
   - Approve: a trade is created, funds are held in escrow (status "authorized"), and the chat links to it.
   - Decline: the order is marked declined and nothing moves.
4. The seller marks the work as delivered (status "under_review").
5. The buyer confirms delivery, which releases the funds (status "captured"), or voids before release (status "voided").

## 2. New functions
- `respond_to_order(message_id, accept)`: buyer-only. Creates the trade from the order stored in the chat, so the amount cannot be changed by the buyer. Returns the new trade id on approval, or null on decline.
- `advance_transaction(transaction_id, action)`: buyer or seller only, with each action limited to the right person and the right stage:
  - `mark_delivered` (seller, from authorized)
  - `confirm_delivery` (buyer, from under_review) - releases funds
  - `void` (buyer, from authorized or under_review) - returns funds
  Each action writes an escrow event and an audit entry.

## 3. Security changes
- Sellers can read the trades, escrow events and audit entries for conversations they are part of. Previously only the buyer could see them.
- Both functions are SECURITY DEFINER with a fixed search path. Execute is revoked from PUBLIC and anon, and granted to authenticated only.
- Both functions check the caller's identity themselves, because they bypass row-level security.

## 4. Notes
- No tables or columns are dropped. The old deliverables table stays in place but is no longer used by the app.
- Every statement is idempotent (CREATE OR REPLACE, DROP POLICY IF EXISTS).
*/

DROP POLICY IF EXISTS "select_seller_transactions" ON transactions;
CREATE POLICY "select_seller_transactions" ON transactions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.transaction_id = transactions.id AND c.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "select_seller_escrow_events" ON escrow_events;
CREATE POLICY "select_seller_escrow_events" ON escrow_events FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.transaction_id = escrow_events.transaction_id AND c.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "select_seller_audit_timeline" ON audit_timeline;
CREATE POLICY "select_seller_audit_timeline" ON audit_timeline FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.transaction_id = audit_timeline.transaction_id AND c.seller_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION respond_to_order(p_message_id uuid, p_accept boolean)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg messages%ROWTYPE;
  v_conv conversations%ROWTYPE;
  v_draft jsonb;
  v_amount integer;
  v_txn_id uuid;
BEGIN
  SELECT * INTO v_msg FROM messages WHERE id = p_message_id;
  IF NOT FOUND OR v_msg.draft_transaction IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  SELECT * INTO v_conv FROM conversations WHERE id = v_msg.conversation_id;
  IF NOT FOUND OR v_conv.buyer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the buyer can respond to this order';
  END IF;

  v_draft := v_msg.draft_transaction;
  IF COALESCE(v_draft->>'order_status', 'pending') <> 'pending' THEN
    RAISE EXCEPTION 'This order has already been answered';
  END IF;

  IF NOT p_accept THEN
    UPDATE messages
      SET draft_transaction = v_draft || jsonb_build_object('order_status', 'declined')
      WHERE id = p_message_id;
    RETURN NULL;
  END IF;

  v_amount := (v_draft->>'amount_cents')::integer;
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > 100000000 THEN
    RAISE EXCEPTION 'Invalid order amount';
  END IF;

  INSERT INTO transactions (
    user_id, vendor_name, description, amount_cents, currency, status,
    ai_request, ai_reasoning, source_text, proof_verified
  ) VALUES (
    v_conv.buyer_id,
    COALESCE(v_draft->>'vendor_name', ''),
    COALESCE(v_draft->>'description', ''),
    v_amount,
    COALESCE(v_draft->>'currency', 'USD'),
    'authorized',
    '',
    v_draft->>'ai_reasoning',
    v_draft->>'source_text',
    COALESCE((v_draft->>'proof_verified')::boolean, false)
  )
  RETURNING id INTO v_txn_id;

  INSERT INTO escrow_events (transaction_id, event_type, amount_cents, detail)
  VALUES (v_txn_id, 'authorized', v_amount, 'Buyer approved the order. Funds held in escrow.');

  INSERT INTO audit_timeline (transaction_id, step, actor, title, detail, metadata)
  VALUES (
    v_txn_id, 'user_request', 'user', 'Order approved by buyer',
    'The buyer approved the order created by the seller in chat.',
    jsonb_build_object('amount_cents', v_amount)
  );

  INSERT INTO audit_timeline (transaction_id, step, actor, title, detail, metadata)
  VALUES (
    v_txn_id, 'paypal_authorize', 'paypal', 'Funds authorized & held',
    'Funds are held in escrow until the seller delivers and the buyer confirms.',
    jsonb_build_object('amount_cents', v_amount, 'paypal_action', 'authorize')
  );

  UPDATE messages
    SET draft_transaction = v_draft || jsonb_build_object('order_status', 'approved', 'transaction_id', v_txn_id)
    WHERE id = p_message_id;

  UPDATE conversations
    SET transaction_id = v_txn_id, status = 'escrow_held'
    WHERE id = v_conv.id;

  RETURN v_txn_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION respond_to_order(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION respond_to_order(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION advance_transaction(p_transaction_id uuid, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn transactions%ROWTYPE;
  v_conv conversations%ROWTYPE;
  v_is_buyer boolean;
  v_is_seller boolean;
BEGIN
  SELECT * INTO v_txn FROM transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade not found';
  END IF;

  SELECT * INTO v_conv FROM conversations WHERE transaction_id = p_transaction_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade is not linked to a conversation';
  END IF;

  v_is_buyer := v_txn.user_id = auth.uid();
  v_is_seller := v_conv.seller_id = auth.uid();

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
    IF NOT v_is_buyer OR v_txn.status <> 'under_review' THEN
      RAISE EXCEPTION 'The buyer can only confirm a trade that has been marked as delivered';
    END IF;
    UPDATE transactions SET status = 'captured' WHERE id = p_transaction_id;
    INSERT INTO escrow_events (transaction_id, event_type, amount_cents, detail)
    VALUES (p_transaction_id, 'captured', v_txn.amount_cents, 'Buyer confirmed delivery. Funds released to seller.');
    INSERT INTO audit_timeline (transaction_id, step, actor, title, detail, metadata)
    VALUES (
      p_transaction_id, 'fund_capture', 'paypal', 'Funds captured & released',
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
