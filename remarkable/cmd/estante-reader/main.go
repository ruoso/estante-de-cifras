// Command estante-reader is the reMarkable reader's backend: the binary
// AppLoad runs as the app folder's backend/entry (docs/remarkable-reader.md
// §3). For now it only answers --version; later tasks add subcommands as
// cases of run's dispatch.
package main

import (
	"fmt"
	"io"
	"os"
)

// version is stamped at link time with -ldflags "-X main.version=<v>".
var version = "dev"

const usage = "usage: estante-reader --version"

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

// run dispatches on args and returns the process exit status. It never
// prints song text or secrets: only the version and the usage line.
func run(args []string, stdout, stderr io.Writer) int {
	if len(args) == 1 {
		switch args[0] {
		case "--version", "-version":
			fmt.Fprintf(stdout, "estante-reader %s\n", version)
			return 0
		}
	}
	fmt.Fprintln(stderr, usage)
	return 2
}
