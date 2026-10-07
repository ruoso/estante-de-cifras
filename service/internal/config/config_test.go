package config

import (
	"strings"
	"testing"
)

// envFrom turns a map into a lookup func of the shape Load takes, so tests
// never touch the real process environment.
func envFrom(vars map[string]string) func(string) (string, bool) {
	return func(key string) (string, bool) {
		v, ok := vars[key]
		return v, ok
	}
}

// withSecret returns a lookup set that always carries the one required var,
// ESTANTE_LINK_SECRET, plus any extras — so a test exercising another field
// gets a Config back rather than the missing-secret error. Extras override the
// default secret if they set it. A nil map means "just the secret".
func withSecret(extra map[string]string) map[string]string {
	out := map[string]string{"ESTANTE_LINK_SECRET": "a-test-link-secret"}
	for k, v := range extra {
		out[k] = v
	}
	return out
}

// TestLoadDefaultsPortWhenUnset pins the config-from-the-environment half of
// the .tji note: the default listen port when PORT is unset (DIRECTION §3.3's
// container/Railway deployment model).
func TestLoadDefaultsPortWhenUnset(t *testing.T) {
	cfg, err := Load(envFrom(withSecret(nil)))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.Port != DefaultPort {
		t.Errorf("Port = %d, want default %d", cfg.Port, DefaultPort)
	}
}

// TestLoadDefaultsAppRootWhenUnset pins that the app-root defaults to
// DefaultAppRoot (the image's /srv/app, where the Dockerfile placed app/dist)
// when ESTANTE_APP_ROOT is unset — so the deployed image needs no app-path
// configuration (DIRECTION §3.3; service.serve_app, the config seam).
func TestLoadDefaultsAppRootWhenUnset(t *testing.T) {
	cfg, err := Load(envFrom(withSecret(nil)))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.AppRoot != DefaultAppRoot {
		t.Errorf("AppRoot = %q, want default %q", cfg.AppRoot, DefaultAppRoot)
	}
}

// TestLoadHonoursAppRoot pins that an explicit ESTANTE_APP_ROOT overrides the
// default, so tests can point it at a fixture and dev at app/dist.
func TestLoadHonoursAppRoot(t *testing.T) {
	cfg, err := Load(envFrom(withSecret(map[string]string{"ESTANTE_APP_ROOT": "/tmp/app-dist"})))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.AppRoot != "/tmp/app-dist" {
		t.Errorf("AppRoot = %q, want /tmp/app-dist", cfg.AppRoot)
	}
}

// TestLoadTreatsEmptyAppRootAsUnset pins that an empty ESTANTE_APP_ROOT (an
// unset-but-present variable) falls back to the default rather than serving
// from an empty path.
func TestLoadTreatsEmptyAppRootAsUnset(t *testing.T) {
	cfg, err := Load(envFrom(withSecret(map[string]string{"ESTANTE_APP_ROOT": ""})))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.AppRoot != DefaultAppRoot {
		t.Errorf("AppRoot = %q, want default %q", cfg.AppRoot, DefaultAppRoot)
	}
}

// TestLoadReadsDatabaseURL pins that ESTANTE_DATABASE_URL is read into
// Config.DatabaseURL verbatim (the DSN config seam, config.go:24-27; the pgx
// Postgres client, DIRECTION §3.6 line 313). The value is carried, never
// parsed or defaulted here — the pool rejects a bad DSN at start-up.
func TestLoadReadsDatabaseURL(t *testing.T) {
	const dsn = "postgres://estante:estante@127.0.0.1:5432/estante?sslmode=disable"
	cfg, err := Load(envFrom(withSecret(map[string]string{"ESTANTE_DATABASE_URL": dsn})))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.DatabaseURL != dsn {
		t.Errorf("DatabaseURL = %q, want %q", cfg.DatabaseURL, dsn)
	}
}

// TestLoadDefaultsDatabaseURLEmptyWhenUnset pins that an unset
// ESTANTE_DATABASE_URL leaves DatabaseURL empty — there is no sensible default
// for a database connection, and compose/scripts/gate always provide it — so an
// empty value is left for the pool to reject, handled like the other vars.
func TestLoadDefaultsDatabaseURLEmptyWhenUnset(t *testing.T) {
	cfg, err := Load(envFrom(withSecret(nil)))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.DatabaseURL != "" {
		t.Errorf("DatabaseURL = %q, want empty when unset", cfg.DatabaseURL)
	}
}

// TestLoadReadsSignInVars pins the sign-in machinery's config seam
// (service.email_links; the ESTANTE_* namespace, config.go:26-27): the SMTP
// relay, the sender, and the public origin are read verbatim into Config.
func TestLoadReadsSignInVars(t *testing.T) {
	cfg, err := Load(envFrom(withSecret(map[string]string{
		"ESTANTE_SMTP_ADDR":       "mail:1025",
		"ESTANTE_MAIL_FROM":       "no-reply@estante.test",
		"ESTANTE_PUBLIC_BASE_URL": "https://estante.test",
	})))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.SMTPAddr != "mail:1025" {
		t.Errorf("SMTPAddr = %q, want mail:1025", cfg.SMTPAddr)
	}
	if cfg.MailFrom != "no-reply@estante.test" {
		t.Errorf("MailFrom = %q, want no-reply@estante.test", cfg.MailFrom)
	}
	if cfg.PublicBaseURL != "https://estante.test" {
		t.Errorf("PublicBaseURL = %q, want https://estante.test", cfg.PublicBaseURL)
	}
}

// TestLoadReadsLinkSecret pins that ESTANTE_LINK_SECRET is read into
// Config.LinkSecret — the HMAC key the emailed sign-in token is signed with.
func TestLoadReadsLinkSecret(t *testing.T) {
	cfg, err := Load(envFrom(map[string]string{"ESTANTE_LINK_SECRET": "super-secret"}))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.LinkSecret != "super-secret" {
		t.Errorf("LinkSecret = %q, want super-secret", cfg.LinkSecret)
	}
}

// TestLoadRejectsMissingLinkSecret pins the "no insecure default" rule: a
// missing ESTANTE_LINK_SECRET is a start-up error naming the variable, never a
// guessable default (service.email_links Decisions).
func TestLoadRejectsMissingLinkSecret(t *testing.T) {
	if _, err := Load(envFrom(nil)); err == nil {
		t.Fatal("Load: want error when ESTANTE_LINK_SECRET is unset, got nil")
	} else if !strings.Contains(err.Error(), "ESTANTE_LINK_SECRET") {
		t.Errorf("error %q does not name ESTANTE_LINK_SECRET", err)
	}
}

// TestLoadRejectsEmptyLinkSecret pins that an empty-but-present
// ESTANTE_LINK_SECRET is treated as missing, not as a valid empty key.
func TestLoadRejectsEmptyLinkSecret(t *testing.T) {
	if _, err := Load(envFrom(map[string]string{"ESTANTE_LINK_SECRET": ""})); err == nil {
		t.Fatal("Load: want error when ESTANTE_LINK_SECRET is empty, got nil")
	}
}

// TestLoadHonoursPort pins that an explicit PORT overrides the default.
func TestLoadHonoursPort(t *testing.T) {
	cfg, err := Load(envFrom(withSecret(map[string]string{"PORT": "3000"})))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.Port != 3000 {
		t.Errorf("Port = %d, want 3000", cfg.Port)
	}
}

// TestLoadTreatsEmptyPortAsUnset pins that an empty PORT (an unset-but-present
// variable, as a shell can leave it) falls back to the default rather than
// erroring on an empty number.
func TestLoadTreatsEmptyPortAsUnset(t *testing.T) {
	cfg, err := Load(envFrom(withSecret(map[string]string{"PORT": ""})))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.Port != DefaultPort {
		t.Errorf("Port = %d, want default %d", cfg.Port, DefaultPort)
	}
}

// TestLoadRejectsUnparseablePort pins the fail-fast rule: an unparseable PORT
// is a start-up error that names the variable, not a silent fallback.
func TestLoadRejectsUnparseablePort(t *testing.T) {
	_, err := Load(envFrom(withSecret(map[string]string{"PORT": "eighty"})))
	if err == nil {
		t.Fatal("Load: want error for unparseable PORT, got nil")
	}
	if !strings.Contains(err.Error(), "PORT") {
		t.Errorf("error %q does not name PORT", err)
	}
}

// TestLoadRejectsOutOfRangePort pins that a numeric but impossible port is
// rejected rather than bound.
func TestLoadRejectsOutOfRangePort(t *testing.T) {
	if _, err := Load(envFrom(withSecret(map[string]string{"PORT": "70000"}))); err == nil {
		t.Fatal("Load: want error for out-of-range PORT, got nil")
	}
	if _, err := Load(envFrom(withSecret(map[string]string{"PORT": "0"}))); err == nil {
		t.Fatal("Load: want error for port 0, got nil")
	}
}
