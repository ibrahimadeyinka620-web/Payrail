/*
# Payrail: Zero-Trust AI Financial Co-Pilot & Semantic Escrow

This migration creates the full data model for Payrail, a zero-trust AI payment
co-pilot with semantic escrow. It models the complete lifecycle of a guarded
transaction: AI-drafted from a source document, approved via "show-your-work"
proof, authorized (held) in escrow, verified against a deliverable, and finally
captured or voided — with every step recorded in an immutable audit timeline.

## 1. New Tables

### profiles
- `id` (uuid, PK, matches auth.users.id)
- `display_name` (text) — name shown in the app
- `paypal_handle` (text, nullable) — connected PayPal handle (simulated)
- `paypal_connected` (boolean, default false) — whether PayPal "connected"
- `created_at` (timestamptz)

### transactions
- `id` (uuid, PK)
- `user_id` (uuid, FK auth.users, default auth.uid()) — owner / payer
- `vendor_name`, `vendor_handle`, `description`, `amount_cents` (integer), `currency`
- `status` (text) — draft | awaiting_approval | authorized | deliverable_pending | under_review | captured | voided | expired
- `ai_request`, `ai_reasoning`, `source_text`, `source_filename`, `proof_verified`
- `created_at`, `updated_at`

### escrow_events
- Append-only lifecycle log: authorized | deliverable_uploaded | review_started | review_passed | review_failed | captured | voided | expired

### deliverables
- Vendor-uploaded deliverable with AI Vision verdict (passed | rejected | pending) and notes

### audit_timeline
- Immutable append-only audit trail with step, actor, title, detail, metadata (jsonb)

## 2. Security
- RLS on every table; grants to authenticated only (sign-in required).
- Ownership scoping via auth.uid() = user_id (direct or via EXISTS on transactions).
- Four separate policies per table.
*/

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  paypal_handle text,
  paypal_connected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT SELECT, UPDATE ON profiles TO service_role;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- transactions
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_name text NOT NULL DEFAULT '',
  vendor_handle text,
  description text NOT NULL DEFAULT '',
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'draft',
  ai_request text NOT NULL DEFAULT '',
  ai_reasoning text,
  source_text text,
  source_filename text,
  proof_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON transactions TO service_role;
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_transactions" ON transactions;
CREATE POLICY "insert_own_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_transactions" ON transactions;
CREATE POLICY "update_own_transactions" ON transactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_transactions" ON transactions;
CREATE POLICY "delete_own_transactions" ON transactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- escrow_events
CREATE TABLE IF NOT EXISTS escrow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  amount_cents integer,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE escrow_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON escrow_events TO authenticated;
GRANT SELECT, INSERT ON escrow_events TO service_role;
CREATE INDEX IF NOT EXISTS idx_escrow_events_transaction_id ON escrow_events(transaction_id);

DROP POLICY IF EXISTS "select_own_escrow_events" ON escrow_events;
CREATE POLICY "select_own_escrow_events" ON escrow_events FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM transactions t WHERE t.id = escrow_events.transaction_id AND t.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_escrow_events" ON escrow_events;
CREATE POLICY "insert_own_escrow_events" ON escrow_events FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM transactions t WHERE t.id = escrow_events.transaction_id AND t.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_escrow_events" ON escrow_events;
CREATE POLICY "update_own_escrow_events" ON escrow_events FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM transactions t WHERE t.id = escrow_events.transaction_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM transactions t WHERE t.id = escrow_events.transaction_id AND t.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_escrow_events" ON escrow_events;
CREATE POLICY "delete_own_escrow_events" ON escrow_events FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM transactions t WHERE t.id = escrow_events.transaction_id AND t.user_id = auth.uid()));

-- deliverables
CREATE TABLE IF NOT EXISTS deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  filename text NOT NULL DEFAULT '',
  storage_path text NOT NULL DEFAULT '',
  mime_type text,
  size_bytes integer,
  ai_verdict text NOT NULL DEFAULT 'pending',
  ai_notes text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON deliverables TO authenticated;
GRANT SELECT, INSERT, UPDATE ON deliverables TO service_role;
CREATE INDEX IF NOT EXISTS idx_deliverables_transaction_id ON deliverables(transaction_id);

DROP POLICY IF EXISTS "select_own_deliverables" ON deliverables;
CREATE POLICY "select_own_deliverables" ON deliverables FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM transactions t WHERE t.id = deliverables.transaction_id AND t.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_deliverables" ON deliverables;
CREATE POLICY "insert_own_deliverables" ON deliverables FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM transactions t WHERE t.id = deliverables.transaction_id AND t.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_deliverables" ON deliverables;
CREATE POLICY "update_own_deliverables" ON deliverables FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM transactions t WHERE t.id = deliverables.transaction_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM transactions t WHERE t.id = deliverables.transaction_id AND t.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_deliverables" ON deliverables;
CREATE POLICY "delete_own_deliverables" ON deliverables FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM transactions t WHERE t.id = deliverables.transaction_id AND t.user_id = auth.uid()));

-- audit_timeline
CREATE TABLE IF NOT EXISTS audit_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  step text NOT NULL,
  actor text NOT NULL DEFAULT 'system',
  title text NOT NULL DEFAULT '',
  detail text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_timeline ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_timeline TO authenticated;
GRANT SELECT, INSERT ON audit_timeline TO service_role;
CREATE INDEX IF NOT EXISTS idx_audit_timeline_transaction_id ON audit_timeline(transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_timeline_created ON audit_timeline(created_at);

DROP POLICY IF EXISTS "select_own_audit_timeline" ON audit_timeline;
CREATE POLICY "select_own_audit_timeline" ON audit_timeline FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM transactions t WHERE t.id = audit_timeline.transaction_id AND t.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_audit_timeline" ON audit_timeline;
CREATE POLICY "insert_own_audit_timeline" ON audit_timeline FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM transactions t WHERE t.id = audit_timeline.transaction_id AND t.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_audit_timeline" ON audit_timeline;
CREATE POLICY "update_own_audit_timeline" ON audit_timeline FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM transactions t WHERE t.id = audit_timeline.transaction_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM transactions t WHERE t.id = audit_timeline.transaction_id AND t.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_audit_timeline" ON audit_timeline;
CREATE POLICY "delete_own_audit_timeline" ON audit_timeline FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM transactions t WHERE t.id = audit_timeline.transaction_id AND t.user_id = auth.uid()));

-- updated_at trigger for transactions
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
