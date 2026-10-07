-- 0002_email_links.sql — the emailed sign-in link's single-use token store.
--
-- service.email_links owns this table; 0001_registry.sql left it out
-- deliberately (its comment on accounts.email notes the link is mailed to that
-- address, workflow 13). An HMAC-signed id is mailed inside the link; the row
-- stores only the opaque id, never the signing secret, so a database leak
-- yields no usable link without the server's ESTANTE_LINK_SECRET — strictly
-- stronger than the invitations pattern, which stores a hash of a raw secret
-- token because the token is the secret (refinement Decisions).
--
-- The row is the single-use and expiry guard, enforced race-free by one atomic
-- statement at redeem:
--   UPDATE email_login_links SET consumed_at = now()
--   WHERE id = $1 AND consumed_at IS NULL AND expires_at > now()
--   RETURNING account_id
-- Zero rows returned — unknown id, already consumed, or expired — is the 401.
-- A deleted account takes its outstanding links with it (cascade).
CREATE TABLE email_login_links (
    id          text        PRIMARY KEY,
    account_id  uuid        NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    expires_at  timestamptz NOT NULL,
    consumed_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_login_links_account_id_idx ON email_login_links (account_id);
