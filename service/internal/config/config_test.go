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

// TestLoadDefaultsPortWhenUnset pins the config-from-the-environment half of
// the .tji note: the default listen port when PORT is unset (DIRECTION §3.3's
// container/Railway deployment model).
func TestLoadDefaultsPortWhenUnset(t *testing.T) {
	cfg, err := Load(envFrom(nil))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.Port != DefaultPort {
		t.Errorf("Port = %d, want default %d", cfg.Port, DefaultPort)
	}
}

// TestLoadHonoursPort pins that an explicit PORT overrides the default.
func TestLoadHonoursPort(t *testing.T) {
	cfg, err := Load(envFrom(map[string]string{"PORT": "3000"}))
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
	cfg, err := Load(envFrom(map[string]string{"PORT": ""}))
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
	_, err := Load(envFrom(map[string]string{"PORT": "eighty"}))
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
	if _, err := Load(envFrom(map[string]string{"PORT": "70000"})); err == nil {
		t.Fatal("Load: want error for out-of-range PORT, got nil")
	}
	if _, err := Load(envFrom(map[string]string{"PORT": "0"})); err == nil {
		t.Fatal("Load: want error for port 0, got nil")
	}
}
