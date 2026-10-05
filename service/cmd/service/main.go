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

	handler, err := server.Handler(logger, cfg.AppRoot)
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
