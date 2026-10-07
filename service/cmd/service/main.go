// Command service is the one binary: it loads its config from the
// environment, builds the HTTP handler (the health check behind the
// request-logging middleware), and serves it with graceful shutdown on
// SIGINT/SIGTERM. Later service.* tasks extend the config and register their
// routes on the mux this frame assembles (DIRECTION §3.6).
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"estantedecifras.app/service/internal/config"
	"estantedecifras.app/service/internal/db"
	"estantedecifras.app/service/internal/mail"
	"estantedecifras.app/service/internal/server"
)

func main() {
	if err := run(); err != nil {
		// Start-up errors go to stderr, never a body — see server.LogRequests
		// for the request-time rule.
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg, err := config.Load(os.LookupEnv)
	if err != nil {
		return err
	}

	// The registry's Postgres pool, opened and migrated before the server
	// accepts traffic. On a single instance (DIRECTION §3.4) start-up migration
	// is race-free; a migration error is fatal (the skeleton's fail-fast rule),
	// so the service never serves against a half-built schema. A start-up
	// timeout keeps a down or wedged database from hanging boot forever.
	pool, err := db.Open(context.Background(), cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	migrateCtx, cancelMigrate := context.WithTimeout(context.Background(), 30*time.Second)
	err = db.Migrate(migrateCtx, pool)
	cancelMigrate()
	if err != nil {
		return err
	}

	// The sign-in API's collaborators: the pool it reads accounts and writes
	// links and sessions against, the SMTP mailer that posts the sign-in link
	// (to the dev catcher in compose), the signing secret, and the public
	// origin the mailed link is built on (service.email_links).
	api := &server.APIDeps{
		DB:            pool,
		Mailer:        mail.NewSMTP(cfg.SMTPAddr, cfg.MailFrom),
		LinkSecret:    []byte(cfg.LinkSecret),
		PublicBaseURL: cfg.PublicBaseURL,
	}

	handler, err := server.Handler(logger, cfg.AppRoot, pool, api)
	if err != nil {
		return err
	}

	srv := &http.Server{
		Addr:    net.JoinHostPort("", strconv.Itoa(cfg.Port)),
		Handler: handler,
	}

	// A container is stopped by signal on every deploy and every
	// `docker compose down`; wiring Shutdown once, in the frame, means no
	// later task has to retrofit it (DIRECTION §3.3).
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	serveErr := make(chan error, 1)
	go func() {
		logger.LogAttrs(ctx, slog.LevelInfo, "listening", slog.Int("port", cfg.Port))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serveErr <- err
			return
		}
		serveErr <- nil
	}()

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
		stop() // restore default signal handling for a second, impatient signal
		logger.LogAttrs(context.Background(), slog.LevelInfo, "shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	}
}
