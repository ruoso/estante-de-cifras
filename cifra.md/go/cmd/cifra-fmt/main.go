// Command cifra-fmt writes cifra.md documents in their canonical form (spec
// §8), the form a book's pre-receive hook requires of every commit. Like
// crosscheck it is a thin wrapper over the package's Parse/Write: it adds no
// parsing or writing of its own, so what it writes is exactly what the hook
// accepts.
//
// A file named *.setlist.md is read as a setlist (§10); anything else as a
// song. Standard input is a song unless -setlist is given.
//
//	cifra-fmt [flags] [file ...]
//
//	-w        write the canonical text back to each file instead of to stdout
//	-l        list the files that are not canonical; write nothing
//	-setlist  read standard input as a setlist
//	-q        do not print the reader's diagnostics
//	-u        report unknown tokens (words in the chart that are not chords)
//
// The reader's diagnostics (unknown notation, a stray repeat mark, a property
// given twice, ...) go to stderr as file:line: code: message, because each is
// something the canonical form keeps, drops or reads differently from what the
// author may have meant. They do not change the exit status.
//
// An unknown token is not a diagnostic (§2.9): the reader keeps it silently,
// which is right for `fine` or `(solo)` but hides a chord the grammar cannot
// read. With -u each distinct one is reported, in first-seen order, as
// file: unknown: token, and it sets the exit status to 1.
//
// Exit status: 0 on success; 1 if a file could not be read, written or
// formatted; with -l, 1 also when any file is not canonical; with -u, 1 also
// when any file holds an unknown token.
//
//	go run ./cmd/cifra-fmt -w song.cifra.md   (run from go/)
package main

import (
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	cifra "github.com/ruoso/cifra.md/go"
)

type options struct {
	write, list, setlist, quiet, unknown bool
}

// result is what formatting one document gives.
type result struct {
	out      []byte
	diags    []*cifra.Object
	unknowns []string
}

func isSetlist(name string) bool { return strings.HasSuffix(name, ".setlist.md") }

// format returns the canonical text of src, the reader's diagnostics and the
// document's distinct unknown tokens.
func format(src []byte, setlist bool) (result, error) {
	var (
		model cifra.Model
		out   []byte
		err   error
	)
	if setlist {
		model, err = cifra.ParseSetlist(src)
	} else {
		model, err = cifra.Parse(src)
	}
	if err != nil {
		return result{}, err
	}
	if setlist {
		out, err = cifra.WriteSetlist(model)
	} else {
		out, err = cifra.Write(model)
	}
	if err != nil {
		return result{}, err
	}
	// The writer's output must itself be canonical; if it is not, the hook
	// would still refuse it, so say so rather than write it.
	canonical := cifra.IsCanonical(out)
	if setlist {
		canonical = cifra.IsCanonicalSetlist(out)
	}
	if !canonical {
		return result{}, fmt.Errorf("the written text is not canonical (a writer bug)")
	}
	r := result{out: out, diags: diagnostics(model)}
	if !setlist {
		r.unknowns = unknownTokens(model)
	}
	return r, nil
}

// unknownTokens walks the model in document order and returns the text of
// every distinct unknown-token item (§2.9), first-seen first.
func unknownTokens(model cifra.Model) []string {
	var out []string
	seen := map[string]bool{}
	var walk func(v any)
	walk = func(v any) {
		switch x := v.(type) {
		case *cifra.Object:
			if field(x, "type") == "unknown" {
				if t := field(x, "text"); !seen[t] {
					seen[t] = true
					out = append(out, t)
				}
			}
			for _, k := range x.Keys() {
				if k == "diagnostics" {
					continue
				}
				child, _ := x.Get(k)
				walk(child)
			}
		case []any:
			for _, child := range x {
				walk(child)
			}
		}
	}
	walk(model)
	return out
}

func diagnostics(model cifra.Model) []*cifra.Object {
	v, ok := model.Get("diagnostics")
	if !ok {
		return nil
	}
	list, _ := v.([]any)
	out := make([]*cifra.Object, 0, len(list))
	for _, d := range list {
		if o, ok := d.(*cifra.Object); ok {
			out = append(out, o)
		}
	}
	return out
}

func field(o *cifra.Object, key string) string {
	v, ok := o.Get(key)
	if !ok || v == nil {
		return ""
	}
	return fmt.Sprint(v)
}

func report(name string, diags []*cifra.Object) {
	for _, d := range diags {
		loc := name
		if line := field(d, "line"); line != "" {
			loc += ":" + line
		}
		fmt.Fprintf(os.Stderr, "%s: %s: %s\n", loc, field(d, "code"), field(d, "message"))
	}
}

func run(args []string, stdin io.Reader, stdout io.Writer) int {
	fs := flag.NewFlagSet("cifra-fmt", flag.ContinueOnError)
	var opt options
	fs.BoolVar(&opt.write, "w", false, "write the canonical text back to each file")
	fs.BoolVar(&opt.list, "l", false, "list the files that are not canonical")
	fs.BoolVar(&opt.setlist, "setlist", false, "read standard input as a setlist")
	fs.BoolVar(&opt.quiet, "q", false, "do not print the reader's diagnostics")
	fs.BoolVar(&opt.unknown, "u", false, "report unknown tokens")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	files := fs.Args()

	// unknown reports a document's unknown tokens and says whether it had any.
	unknown := func(name string, r result) bool {
		if !opt.unknown {
			return false
		}
		for _, t := range r.unknowns {
			fmt.Fprintf(os.Stderr, "%s: unknown: %s\n", name, t)
		}
		return len(r.unknowns) > 0
	}

	if len(files) == 0 {
		if opt.write {
			fmt.Fprintln(os.Stderr, "cifra-fmt: -w needs files")
			return 2
		}
		src, err := io.ReadAll(stdin)
		if err != nil {
			fmt.Fprintf(os.Stderr, "cifra-fmt: %v\n", err)
			return 1
		}
		r, err := format(src, opt.setlist)
		if err != nil {
			fmt.Fprintf(os.Stderr, "cifra-fmt: <stdin>: %v\n", err)
			return 1
		}
		if !opt.quiet {
			report("<stdin>", r.diags)
		}
		status := 0
		if unknown("<stdin>", r) {
			status = 1
		}
		if opt.list {
			if string(r.out) != string(src) {
				fmt.Fprintln(stdout, "<stdin>")
				return 1
			}
			return status
		}
		stdout.Write(r.out)
		return status
	}

	status := 0
	for _, name := range files {
		src, err := os.ReadFile(name)
		if err != nil {
			fmt.Fprintf(os.Stderr, "cifra-fmt: %v\n", err)
			status = 1
			continue
		}
		r, err := format(src, isSetlist(name))
		if err != nil {
			fmt.Fprintf(os.Stderr, "cifra-fmt: %s: %v\n", name, err)
			status = 1
			continue
		}
		if !opt.quiet {
			report(name, r.diags)
		}
		if unknown(name, r) {
			status = 1
		}
		out := r.out
		changed := string(out) != string(src)
		switch {
		case opt.list:
			if changed {
				fmt.Fprintln(stdout, name)
				status = 1
			}
		case opt.write:
			if changed {
				info, err := os.Stat(name)
				mode := os.FileMode(0o644)
				if err == nil {
					mode = info.Mode().Perm()
				}
				if err := os.WriteFile(name, out, mode); err != nil {
					fmt.Fprintf(os.Stderr, "cifra-fmt: %v\n", err)
					status = 1
				}
			}
		default:
			stdout.Write(out)
		}
	}
	return status
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdin, os.Stdout))
}
