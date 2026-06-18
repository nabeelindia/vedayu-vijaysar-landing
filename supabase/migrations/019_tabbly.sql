-- Add tags array to orders (used by Tabbly webhook to record call outcomes)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Retry queue for failed Tabbly outbound calls
CREATE TABLE IF NOT EXISTS tabbly_call_retries (
  id           bigserial    PRIMARY KEY,
  order_id     text         NOT NULL REFERENCES orders(order_id),
  attempt      int          NOT NULL DEFAULT 1 CHECK (attempt BETWEEN 1 AND 3),
  scheduled_at timestamptz  NOT NULL,
  status       text         NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'fired', 'exhausted', 'skipped')),
  last_error   text,
  fired_at     timestamptz,
  created_at   timestamptz  DEFAULT now(),
  updated_at   timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tabbly_retries_pending_idx
  ON tabbly_call_retries(scheduled_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS tabbly_retries_order_idx
  ON tabbly_call_retries(order_id);
