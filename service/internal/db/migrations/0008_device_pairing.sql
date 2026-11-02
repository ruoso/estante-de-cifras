-- 0008_device_pairing.sql — pairing a device, and a read-only session
-- (reader.device_pairing; docs/remarkable-reader.md §5.1; workflow 13
-- §Pairing a reMarkable).
--
-- A session gains a kind (NULL for a browser, whose row is described by
-- `device`; 'remarkable' for a paired reader) and a read-only scope: a
-- read-only session is refused every write by the service's deny-by-default
-- guard and by the push gate (refinement Constraints 7, 8).
ALTER TABLE sessions
    ADD COLUMN kind      text    NULL CHECK (kind IN ('remarkable')),
    ADD COLUMN read_only boolean NOT NULL DEFAULT false;

-- device_pairings — one row per begun pairing. The six-character code and the
-- poll token are stored only as SHA-256 hex, never in the clear (the
-- invitation precedent). A code is approvable until expires_at (ten minutes
-- from begin); approve, in one transaction under FOR UPDATE, mints the
-- read-only session (session_id) and marks the row approved, so a second
-- approval is "used". Poll delivers the session once (delivered_at), within
-- ten minutes of approval; past that it answers expired and revokes the
-- undelivered session. An approving account's deletion takes its pairings
-- with it; begin deletes rows a day past their expiry (no background job).
CREATE TABLE device_pairings (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash       text        NOT NULL UNIQUE,
    poll_token_hash text        NOT NULL UNIQUE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    expires_at      timestamptz NOT NULL,
    approved_by     uuid        NULL REFERENCES accounts (id) ON DELETE CASCADE,
    approved_at     timestamptz NULL,
    session_id      uuid        NULL REFERENCES sessions (id) ON DELETE SET NULL,
    delivered_at    timestamptz NULL
);

CREATE INDEX device_pairings_expires_at_idx ON device_pairings (expires_at);
