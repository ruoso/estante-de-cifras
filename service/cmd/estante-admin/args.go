package main

import (
	"errors"
	"fmt"

	"github.com/google/uuid"

	"estantedecifras.app/service/internal/admin"
)

// usage is the one-line form printed on a parse error, so the operator sees how
// to invoke the command (refinement Constraints §1).
const usage = `usage: estante-admin <take-down|withdraw-invitations|remove-members> <bookId> --reason "<text>"`

// command is a parsed invocation: the action to run, the book it targets, and the
// operator's reason. It is the pure result of parseArgs — main maps action to the
// admin function and opens the pool.
type command struct {
	action admin.Action
	bookID string
	reason string
}

// actionsBySubcommand maps the three hyphenated subcommands the operator types to
// the admin.Action (and book_notices.action) they run. It is the command contract
// the unit test pins against the CHECK in migration 0004.
var actionsBySubcommand = map[string]admin.Action{
	"take-down":            admin.ActionTakeDown,
	"withdraw-invitations": admin.ActionWithdrawInvitations,
	"remove-members":       admin.ActionRemoveMembers,
}

// parseArgs parses the command line (os.Args[1:]) into a command, or returns an
// error describing what was wrong. The shape is a subcommand, a book id, and a
// required non-empty --reason (accepted as "--reason text" or "--reason=text"):
//
//	estante-admin take-down <bookId> --reason "<text>"
//
// An unknown action, a missing or non-UUID book id, or a missing/empty reason is
// an error and changes nothing (refinement Constraints §1); the pure parse keeps
// that contract testable without a database or a main.
func parseArgs(argv []string) (command, error) {
	if len(argv) == 0 {
		return command{}, errors.New("no action given\n" + usage)
	}

	action, ok := actionsBySubcommand[argv[0]]
	if !ok {
		return command{}, fmt.Errorf("unknown action %q\n%s", argv[0], usage)
	}

	var (
		bookID     string
		haveBook   bool
		reason     string
		haveReason bool
	)
	rest := argv[1:]
	for i := 0; i < len(rest); i++ {
		arg := rest[i]
		switch {
		case arg == "--reason":
			if i+1 >= len(rest) {
				return command{}, errors.New("--reason needs a value\n" + usage)
			}
			reason = rest[i+1]
			haveReason = true
			i++
		case len(arg) > len("--reason=") && arg[:len("--reason=")] == "--reason=":
			reason = arg[len("--reason="):]
			haveReason = true
		case !haveBook:
			bookID = arg
			haveBook = true
		default:
			return command{}, fmt.Errorf("unexpected argument %q\n%s", arg, usage)
		}
	}

	if !haveBook {
		return command{}, errors.New("no book id given\n" + usage)
	}
	if _, err := uuid.Parse(bookID); err != nil {
		return command{}, fmt.Errorf("book id %q is not a valid id\n%s", bookID, usage)
	}
	if !haveReason || reason == "" {
		return command{}, errors.New("a non-empty --reason is required\n" + usage)
	}

	return command{action: action, bookID: bookID, reason: reason}, nil
}
