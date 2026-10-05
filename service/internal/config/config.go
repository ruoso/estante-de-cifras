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

// Config is the service's configuration. Today it carries only the listen
// port the skeleton needs; later service tasks extend it (the Postgres DSN in
// service.schema, the volume path in service.books, the email provider and
// session secrets in sign-in).
type Config struct {
	// Port is the TCP port the HTTP server binds. Railway injects PORT and
	// expects the process to bind it (DIRECTION §3.3), so the service deploys
	// with no platform-specific glue.
	Port int
}

// Load builds a Config from an environment lookup (os.LookupEnv in
// production, a map in tests). An unparseable or out-of-range value is a
// start-up error with a clear message, never a silent fallback to the
// default.
func Load(lookup func(string) (string, bool)) (Config, error) {
	cfg := Config{Port: DefaultPort}

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
