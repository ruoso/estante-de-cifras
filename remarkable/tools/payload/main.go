// Command payload lays out a release of the reader, the files the release
// workflow publishes on GitHub (.github/workflows/reader-release.yml;
// docs/remarkable-reader.md §8, §9):
//
//	payload --folder armv7=DIR --folder arm64=DIR --backend-version V --release N --out DIR
//	payload digest DIR...
//
// The first form reads each architecture's AppLoad folder as tools/appfolder
// assembled it (the parent of estante/) — the backend, the screens and the
// music code — checks them complete, their bundle as the reader checks it and
// both carrying the same screens and bundle, and writes into --out a
// .tar.gz of each folder and the release's manifest.json naming each with
// its SHA-256 and the release's number. What is installed and what updates
// itself are the same bytes.
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

const usage = `usage: payload --folder armv7=DIR --folder arm64=DIR --backend-version V --release N --out DIR
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
	fs.StringVar(&o.BackendVersion, "backend-version", "", "")
	fs.IntVar(&o.Release, "release", 0, "")
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
		o.BackendVersion == "" || o.Release == 0 || o.Out == "" {
		fmt.Fprintln(stderr, usage)
		return 2
	}
	if err := build(o); err != nil {
		fmt.Fprintf(stderr, "payload: %v\n", err)
		return 1
	}
	return 0
}
