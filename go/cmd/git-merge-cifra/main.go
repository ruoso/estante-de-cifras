// Command git-merge-cifra is the cifra.md git merge driver (spec §11.14): one
// static binary a computer runs as a git merge driver, so a book stays
// mergeable on a clone that has no JavaScript runtime (DIRECTION §3.6). It is a
// thin os.Args + file wrapper over cifra.Merge; it knows nothing of HTTP, the
// service, or the app.
//
// Configure it (§11.14):
//
//	[merge "cifra"]
//	    name = cifra three-way merge
//	    driver = git-merge-cifra %O %A %B %P
//
// with `*.cifra.md merge=cifra` and `*.setlist.md merge=cifra` in
// .gitattributes. git calls it with the four placeholders:
//
//	%O  base   the merge base (an empty file when there is none)
//	%A  ours   the current side — and the file the driver writes the result to
//	%B  theirs the other side
//	%P  path   the file's path, which fixes song vs setlist (`.setlist.md`)
//
// It writes the result to %A and exits 0; writes the marked text to %A and
// exits 1 when something conflicts; and leaves %A as it is, explains on standard
// error and exits 1 when an input is not UTF-8 or holds a conflict marker (an
// `unresolved` conflict), or when the file was deleted on one side and changed
// on the other. A wrong argument count prints a usage line and exits 2.
//
// Standard error carries only which sides and line numbers — never song text
// (DIRECTION's logging rule; §11.14).
package main

import (
	"fmt"
	"os"
	"strings"

	cifra "github.com/ruoso/cifra.md/go"
)

const usage = "usage: git-merge-cifra %O %A %B %P (base ours theirs path)"

func readFile(path string) []byte {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	return data
}

func run(args []string) int {
	if len(args) != 4 {
		fmt.Fprintln(os.Stderr, usage)
		return 2
	}
	basePath, oursPath, theirsPath, path := args[0], args[1], args[2], args[3]
	setlist := strings.HasSuffix(path, ".setlist.md")
	outcome, err := cifra.Merge(readFile(basePath), readFile(oursPath), readFile(theirsPath), setlist)
	if err != nil {
		fmt.Fprintf(os.Stderr, "%s: %v\n", path, err)
		return 1
	}
	if outcome.Result != nil {
		if err := os.WriteFile(oursPath, []byte(*outcome.Result), 0o644); err != nil {
			fmt.Fprintf(os.Stderr, "%s: %v\n", path, err)
			return 1
		}
		return 0
	}
	if outcome.Deleted {
		_ = os.Remove(oursPath)
		return 0
	}
	for _, c := range outcome.Conflicts {
		kind, _ := c["kind"].(string)
		switch {
		case kind == "file" && c["unreadable"] != nil:
			fmt.Fprintf(os.Stderr, "%s: not UTF-8 (%s); not merged\n", path, joinSides(c["unreadable"]))
		case kind == "unresolved":
			fmt.Fprintf(os.Stderr, "%s: conflict markers left in %s; not merged, resolve them first\n", path, markedWhere(c))
		case kind == "file":
			fmt.Fprintf(os.Stderr, "%s: deleted by %v and changed by the other side; not merged\n", path, c["deleted"])
		}
	}
	if outcome.Marked != nil {
		if err := os.WriteFile(oursPath, []byte(*outcome.Marked), 0o644); err != nil {
			fmt.Fprintf(os.Stderr, "%s: %v\n", path, err)
			return 1
		}
		fmt.Fprintf(os.Stderr, "%s: %d conflict(s)\n", path, len(outcome.Conflicts))
	}
	return 1
}

// joinSides renders the unreadable-sides list ("base"/"ours"/"theirs"), in that
// order, as the reference does.
func joinSides(v any) string {
	arr, _ := v.([]any)
	var out []string
	for _, side := range []string{"base", "ours", "theirs"} {
		for _, x := range arr {
			if s, ok := x.(string); ok && s == side {
				out = append(out, side)
			}
		}
	}
	return strings.Join(out, ", ")
}

// markedWhere names each marked input and the 1-based number of its first
// marker line, in base/ours/theirs order (§11.4), never the line's text.
func markedWhere(c map[string]any) string {
	var out []string
	for _, side := range []string{"base", "ours", "theirs"} {
		if v, ok := c[side]; ok {
			out = append(out, fmt.Sprintf("%s (line %v)", side, v))
		}
	}
	return strings.Join(out, ", ")
}

func main() {
	os.Exit(run(os.Args[1:]))
}
