// Command payload lays out the reader's device payload, the files the site
// serves under /device/ (reader.payload; docs/remarkable-reader.md §8, §9):
//
//	payload --device DIR --folder armv7=DIR --folder arm64=DIR --backend-version V --out DIR
//	payload digest DIR...
//
// The first form reads the app's built device bundle (--device, app/dist/device)
// and each architecture's AppLoad folder as tools/appfolder assembled it (the
// parent of estante/), and writes into --out the content-hashed bundle, the
// compiled QML and both backends, a .tar.gz of each folder, and the manifest
// naming every one of them with its SHA-256. The backend and the rcc are read
// out of the folders, so what is served and what is installed cannot drift.
//
// The second prints the backend's version: a digest of the Go sources under
// the given module trees and of the Go toolchain, which the Dockerfile stamps
// into the backend as main.version.
//
// It runs on the build host only: it sits outside ./cmd/..., so it is never
// cross-built or shipped.
package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
)

const usage = `usage: payload --device DIR --folder armv7=DIR --folder arm64=DIR --backend-version V --out DIR
       payload digest DIR...`

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

func run(args []string, stdout, stderr io.Writer) int {
	if len(args) > 0 && args[0] == "digest" {
		if len(args) < 2 {
			fmt.Fprintln(stderr, usage)
			return 2
		}
		v, err := digest(args[1:])
		if err != nil {
			fmt.Fprintf(stderr, "payload: %v\n", err)
			return 1
		}
		fmt.Fprintln(stdout, v)
		return 0
	}

	fs := flag.NewFlagSet("payload", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	o := options{Folders: map[string]string{}}
	fs.StringVar(&o.Device, "device", "", "")
	fs.StringVar(&o.BackendVersion, "backend-version", "", "")
	fs.StringVar(&o.Out, "out", "", "")
	fs.Func("folder", "", func(v string) error {
		arch, dir, ok := strings.Cut(v, "=")
		if !ok || arch == "" || dir == "" {
			return errors.New("want ARCH=DIR")
		}
		if _, dup := o.Folders[arch]; dup {
			return fmt.Errorf("--folder %s given twice", arch)
		}
		o.Folders[arch] = dir
		return nil
	})
	if fs.Parse(args) != nil || fs.NArg() != 0 ||
		o.Device == "" || o.BackendVersion == "" || o.Out == "" {
		fmt.Fprintln(stderr, usage)
		return 2
	}
	if err := build(o); err != nil {
		fmt.Fprintf(stderr, "payload: %v\n", err)
		return 1
	}
	return 0
}
