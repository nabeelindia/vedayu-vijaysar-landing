-- Allow 'failed' status for tabbly_call_retries (rows where the trigger call itself errored)
ALTER TABLE tabbly_call_retries
  DROP CONSTRAINT IF EXISTS tabbly_call_retries_status_check;

ALTER TABLE tabbly_call_retries
  ADD CONSTRAINT tabbly_call_retries_status_check
  CHECK (status IN ('pending', 'fired', 'failed', 'exhausted', 'skipped'));
