// Command crosscheck is the Go driver of the cross-implementation comparison
// (DIRECTION §3.6, format.cross_check). It is a THIN wrapper: it reads every
// input document in <in-dir> and, for each, writes the three artefacts the
// tool compares into <out-dir>, using only the Parse/Write the package already
// exposes and the same serialisation the corpus harness uses
// (go/internal/corpus/harness.go). It adds no parsing, writing or
// serialisation logic of its own.
//
//	NNNN.input.json       Encode(Parse(input))         the input model
//	NNNN.canonical.EXT    Write(Parse(input))          the canonical text
//	NNNN.canonical.json   Encode(Parse(canonical))     the canonical model
//
// EXT is .cifra.md for a song and .setlist.md for a setlist, branched on the
// input's extension exactly as the reference merge driver does.
//
//	go run ./cmd/crosscheck <in-dir> <out-dir>   (run from go/)
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	cifra "github.com/ruoso/cifra.md/go"
)

// dump is the corpus serialisation: two-space indent, non-ASCII as itself, one
// trailing newline — cifra.Encode reproduces json.dumps(indent=2,
// ensure_ascii=False) byte for byte, and this is the whole of what the corpus
// harness's Dump does, so the three implementations' bytes compare directly
// (corpus/README.md).
func dump(model cifra.Model) []byte {
	return append(cifra.Encode(model), '\n')
}

func artefacts(src []byte, setlist bool) (inputJSON, canonical, canonJSON []byte, err error) {
	var model cifra.Model
	if setlist {
		model, err = cifra.ParseSetlist(src)
	} else {
		model, err = cifra.Parse(src)
	}
	if err != nil {
		return nil, nil, nil, err
	}
	if setlist {
		canonical, err = cifra.WriteSetlist(model)
	} else {
		canonical, err = cifra.Write(model)
	}
	if err != nil {
		return nil, nil, nil, err
	}
	var canonModel cifra.Model
	if setlist {
		canonModel, err = cifra.ParseSetlist(canonical)
	} else {
		canonModel, err = cifra.Parse(canonical)
	}
	if err != nil {
		return nil, nil, nil, err
	}
	return dump(model), canonical, dump(canonModel), nil
}

func run(args []string) int {
	if len(args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: crosscheck <in-dir> <out-dir>")
		return 2
	}
	inDir, outDir := args[0], args[1]

	entries, err := os.ReadDir(inDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "crosscheck: %v\n", err)
		return 1
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)

	for _, file := range names {
		var ext string
		var setlist bool
		switch {
		case strings.HasSuffix(file, ".setlist.md"):
			ext, setlist = ".setlist.md", true
		case strings.HasSuffix(file, ".cifra.md"):
			ext, setlist = ".cifra.md", false
		default:
			continue
		}
		name := strings.TrimSuffix(file, ext)

		src, err := os.ReadFile(filepath.Join(inDir, file))
		if err != nil {
			fmt.Fprintf(os.Stderr, "crosscheck: %s: %v\n", file, err)
			return 1
		}
		inputJSON, canonical, canonJSON, err := artefacts(src, setlist)
		if err != nil {
			fmt.Fprintf(os.Stderr, "crosscheck: %s: %v\n", file, err)
			return 1
		}
		outputs := [...]struct {
			suffix string
			data   []byte
		}{
			{".input.json", inputJSON},
			{".canonical" + ext, canonical},
			{".canonical.json", canonJSON},
		}
		for _, o := range outputs {
			if err := os.WriteFile(filepath.Join(outDir, name+o.suffix), o.data, 0o644); err != nil {
				fmt.Fprintf(os.Stderr, "crosscheck: %s: %v\n", name+o.suffix, err)
				return 1
			}
		}
	}
	return 0
}

func main() {
	os.Exit(run(os.Args[1:]))
}
