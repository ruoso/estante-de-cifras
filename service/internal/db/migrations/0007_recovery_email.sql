-- 0007_recovery_email.sql — the recovery email's verification links.
--
-- service.recovery_email owns this table. A signed-in owner asks for a link to
-- an address; opening it writes accounts.email then and only then (workflow 13
-- §The recovery email: verify, then write). The token mailed in the link is the
-- emailed sign-in link's own format — an HMAC-signed opaque id under
-- ESTANTE_LINK_SECRET — and the row stores only that id, beside the address it
-- would confirm (lowercased). A table of its own, not a purpose column on
-- email_login_links, so a verification token is structurally unable to redeem
-- as a sign-in: its id is not in that table (refinement Decisions).
--
-- The confirm locks the row (SELECT … FOR UPDATE) joined to its account,
-- decides (expired, consumed, taken by another account, or confirm), and on a
-- confirm marks the row consumed and writes the address, all in one
-- transaction. A refusal for an address another account holds rolls back, so
-- the link stays unconsumed. A new request replaces the account's earlier
-- unconsumed rows; the latest unconsumed row is the "pending" address the
-- owner reads back. A deleted account takes its links with it (cascade).
CREATE TABLE recovery_email_links (
    id          text        PRIMARY KEY,
    account_id  uuid        NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    address     text        NOT NULL,
    expires_at  timestamptz NOT NULL,
    consumed_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recovery_email_links_account_id_idx ON recovery_email_links (account_id);
