// Package config loads the service's start-up configuration from the
// environment, once, and fails fast on a bad value (DIRECTION §3.3). It is
// kept pure — Load takes an env lookup rather than reading the process
// environment itself — so it is unit-testable without touching os.Environ.
package config

import (
	"fmt"
	"strconv"
)

// DefaultPort is the TCP port bound when PORT is unset. The compose stack and
// the gate publish a host port and map it to this fixed internal port
// (scripts/gate, ESTANTE_HTTP_PORT), so the container's own bind stays a
// simple default.
const DefaultPort = 8080

// DefaultAppRoot is the directory the built PWA is read from when
// ESTANTE_APP_ROOT is unset. It is where the Dockerfile places app/dist
// (Dockerfile: COPY --from=app /app/dist /srv/app), so the deployed image
// needs no app-path configuration (service.serve_app).
const DefaultAppRoot = "/srv/app"

// DefaultBooksRoot is the volume directory the per-book bare repositories live
// under when ESTANTE_BOOKS_ROOT is unset (DIRECTION §3.3: one bare repository
// per book at /data/books/<id>.git). It is where the Dockerfile creates the
// mount point and compose mounts the books volume, so the deployed image needs
// no path configuration (service.books).
const DefaultBooksRoot = "/data/books"

// Config is the service's configuration. Today it carries the listen port the
// skeleton needs, the app-root the built PWA is served from, the Postgres DSN
// the registry lives behind, and the sign-in machinery's vars (the SMTP relay
// and sender, the public origin, and the link-signing secret —
// service.email_links); later service tasks extend it (the volume path in
// service.books).
type Config struct {
	// Port is the TCP port the HTTP server binds. Railway injects PORT and
	// expects the process to bind it (DIRECTION §3.3), so the service deploys
	// with no platform-specific glue.
	Port int

	// AppRoot is the directory the built PWA is served from (service.serve_app).
	// It defaults to DefaultAppRoot (the image's /srv/app) and is overridable
	// via ESTANTE_APP_ROOT so tests can point it at a fixture and dev can point
	// it at app/dist. ESTANTE_* is the service's own namespace for future vars
	// (the bind port stays plain PORT, which Railway injects).
	AppRoot string

	// BooksRoot is the volume directory the per-book bare repositories live
	// under (service.books; DIRECTION §3.3). It defaults to DefaultBooksRoot
	// (the image's /data/books, where the Dockerfile makes the mount point and
	// compose mounts the books volume) and is overridable via ESTANTE_BOOKS_ROOT
	// so behavior tests can point it at a throwaway directory. It is a path, not
	// a secret, and comes from config rather than any request.
	BooksRoot string

	// DatabaseURL is the Postgres DSN the connection pool and the start-up
	// migrator use (service.schema; DIRECTION §3.6 line 313 names pgx). It is
	// read from ESTANTE_DATABASE_URL and has no default — there is no sensible
	// stand-in for a database connection, and compose and scripts/gate always
	// provide it — so an empty value is left for the pool to reject at start-up,
	// never guessed. It carries a password and is never logged.
	DatabaseURL string

	// SMTPAddr is the host:port of the SMTP relay the sign-in link is handed to
	// (DIRECTION §3.6 lines 313–315). Read from ESTANTE_SMTP_ADDR; in
	// development and the e2e stack it is the Mailpit catcher (mail:1025).
	SMTPAddr string

	// MailFrom is the sender the sign-in mail is sent as. Read from
	// ESTANTE_MAIL_FROM.
	MailFrom string

	// PublicBaseURL is the origin the mailed link is built on —
	// ${PublicBaseURL}/sign-in/<token>, the address a user taps (workflow 13).
	// Read from ESTANTE_PUBLIC_BASE_URL.
	PublicBaseURL string

	// LinkSecret is the HMAC key the emailed sign-in token is signed with
	// (service.email_links Decisions). Read from ESTANTE_LINK_SECRET; it is
	// required — there is no insecure default, so a missing value fails start-up
	// rather than signing links with a guessable key. It is a secret and is
	// never logged.
	LinkSecret string

	// WebAuthnRPID is the passkey relying-party ID — the effective domain the
	// passkey is bound to (estantedecifras.app in production, localhost/127.0.0.1
	// in dev and the e2e stack). Read from ESTANTE_WEBAUTHN_RP_ID; it is required
	// and config-driven rather than derived from the request Host, which is
	// spoofable (service.passkeys Decision 5). The RP origins are derived from
	// PublicBaseURL.
	WebAuthnRPID string

	// WebAuthnStateSecret is the HMAC key the passkey begin→finish state token is
	// signed with (service.passkeys Decision 4). Read from
	// ESTANTE_WEBAUTHN_STATE_SECRET; it is required with no insecure default, a
	// single-purpose key never shared with LinkSecret. It is a secret and is
	// never logged.
	WebAuthnStateSecret string
}

// Load builds a Config from an environment lookup (os.LookupEnv in
// production, a map in tests). An unparseable or out-of-range value is a
// start-up error with a clear message, never a silent fallback to the
// default.
func Load(lookup func(string) (string, bool)) (Config, error) {
	cfg := Config{Port: DefaultPort, AppRoot: DefaultAppRoot, BooksRoot: DefaultBooksRoot}

	if raw, ok := lookup("ESTANTE_APP_ROOT"); ok && raw != "" {
		cfg.AppRoot = raw
	}

	if raw, ok := lookup("ESTANTE_BOOKS_ROOT"); ok && raw != "" {
		cfg.BooksRoot = raw
	}

	if raw, ok := lookup("ESTANTE_DATABASE_URL"); ok {
		cfg.DatabaseURL = raw
	}

	if raw, ok := lookup("ESTANTE_SMTP_ADDR"); ok {
		cfg.SMTPAddr = raw
	}

	if raw, ok := lookup("ESTANTE_MAIL_FROM"); ok {
		cfg.MailFrom = raw
	}

	if raw, ok := lookup("ESTANTE_PUBLIC_BASE_URL"); ok {
		cfg.PublicBaseURL = raw
	}

	// ESTANTE_LINK_SECRET is required: a missing or empty value is a start-up
	// error, never a guessable default, so links are always signed with a real
	// key (service.email_links Decisions; the ESTANTE_* namespace).
	if raw, ok := lookup("ESTANTE_LINK_SECRET"); ok && raw != "" {
		cfg.LinkSecret = raw
	} else {
		return Config{}, fmt.Errorf("config: ESTANTE_LINK_SECRET is required (the emailed sign-in link's signing key; no insecure default)")
	}

	// ESTANTE_WEBAUTHN_RP_ID is required: the passkey relying-party ID is
	// config-driven, never guessed from the request Host (service.passkeys
	// Decision 5).
	if raw, ok := lookup("ESTANTE_WEBAUTHN_RP_ID"); ok && raw != "" {
		cfg.WebAuthnRPID = raw
	} else {
		return Config{}, fmt.Errorf("config: ESTANTE_WEBAUTHN_RP_ID is required (the passkey relying-party ID; config-driven, not derived from Host)")
	}

	// ESTANTE_WEBAUTHN_STATE_SECRET is required: the passkey state token's
	// signing key, a single-purpose HMAC key with no insecure default
	// (service.passkeys Decision 4).
	if raw, ok := lookup("ESTANTE_WEBAUTHN_STATE_SECRET"); ok && raw != "" {
		cfg.WebAuthnStateSecret = raw
	} else {
		return Config{}, fmt.Errorf("config: ESTANTE_WEBAUTHN_STATE_SECRET is required (the passkey state token's signing key; no insecure default)")
	}

	if raw, ok := lookup("PORT"); ok && raw != "" {
		port, err := strconv.Atoi(raw)
		if err != nil {
			return Config{}, fmt.Errorf("config: PORT %q is not a number: %w", raw, err)
		}
		if port < 1 || port > 65535 {
			return Config{}, fmt.Errorf("config: PORT %d is out of range (want 1–65535)", port)
		}
		cfg.Port = port
	}

	return cfg, nil
}
