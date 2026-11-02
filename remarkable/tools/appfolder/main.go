// Command appfolder assembles the reader's AppLoad folder for one
// architecture (reader.app_folder; docs/remarkable-reader.md §2, §3.1):
//
//	appfolder --arch armv7|arm64 --backend FILE --qml DIR --rcc TOOL --out DIR
//
// writes DIR/estante/ with exactly manifest.json, icon.png, resources.rcc
// (every file under --qml but its tests/ and harness/, compiled by TOOL as
// `rcc --binary --compress-algo zlib`) and backend/entry (FILE, mode 0755,
// refused unless it is an ELF for the architecture). It runs on the build
// host only: it sits outside ./cmd/..., so it is never cross-built or
// shipped. It stamps no version (that is reader.payload's).
package main

import (
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
)

const usage = "usage: appfolder --arch armv7|arm64 --backend FILE --qml DIR --rcc TOOL --out DIR"

func main() {
	os.Exit(run(os.Args[1:], os.Stderr, execRCC))
}

func run(args []string, stderr io.Writer, rcc rccFunc) int {
	fs := flag.NewFlagSet("appfolder", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var o options
	fs.StringVar(&o.Arch, "arch", "", "")
	fs.StringVar(&o.Backend, "backend", "", "")
	fs.StringVar(&o.QML, "qml", "", "")
	fs.StringVar(&o.RCC, "rcc", "", "")
	fs.StringVar(&o.Out, "out", "", "")
	if fs.Parse(args) != nil || fs.NArg() != 0 ||
		o.Arch == "" || o.Backend == "" || o.QML == "" || o.RCC == "" || o.Out == "" {
		fmt.Fprintln(stderr, usage)
		return 2
	}
	if err := build(o, rcc); err != nil {
		fmt.Fprintf(stderr, "appfolder: %v\n", err)
		return 1
	}
	return 0
}

// execRCC runs Qt's rcc: zlib, which every Qt reads (Qt 6's rcc may default
// to zstd; refinement Decision 7).
func execRCC(tool, qrc, out string) error {
	cmd := exec.Command(tool, "--binary", "--compress-algo", "zlib", "-o", out, qrc)
	cmd.Stdout = os.Stderr
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
