package sync

// go-git, read-only (design §3.2 "Never a push"; Decisions 3, 7, 8): a bare
// repository per book, brought up to date by asking the remote for
// refs/heads/main over smart HTTP's upload-pack and writing what comes down;
// and a commit read without a working tree. This file opens upload-pack
// sessions only — there is no code path here, or anywhere in the package, to
// the other service, and no call to go-git's push.
//
// The session cookie is set per request by an AuthMethod, and only after the
// URL has been checked to be the session's own origin. A git failure never
// leaves the package as an error: a pass reports it as the book's status.

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/format/packfile"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/protocol/packp"
	"github.com/go-git/go-git/v5/plumbing/protocol/packp/capability"
	"github.com/go-git/go-git/v5/plumbing/protocol/packp/sideband"
	"github.com/go-git/go-git/v5/plumbing/transport"
	githttp "github.com/go-git/go-git/v5/plumbing/transport/http"
)

// mainRef is the one ref a book has that the reader reads (and fetches with
// +refs/heads/main:refs/heads/main).
const mainRef = plumbing.ReferenceName("refs/heads/main")

// errEmpty: the remote has no main yet (a book made but never pushed).
var errEmpty = errors.New("empty")

// cookieAuth is the session as a go-git http.AuthMethod: it adds
// Cookie: estante_session=<token> to each request it is asked to. String
// names it without the token.
type cookieAuth struct{ token string }

var _ githttp.AuthMethod = (*cookieAuth)(nil)

func (a *cookieAuth) Name() string   { return "estante-session" }
func (a *cookieAuth) String() string { return "estante-session cookie" }
func (a *cookieAuth) SetAuth(r *http.Request) {
	r.AddCookie(&http.Cookie{Name: cookieName, Value: a.token})
}

// sameOrigin resolves link against origin and reports whether the result has
// exactly the origin's scheme, host and port (and carries no credentials of
// its own) — the only URLs the session may go to (design §10).
func sameOrigin(origin *url.URL, link string) (*url.URL, bool) {
	u, err := url.Parse(link)
	if err != nil {
		return nil, false
	}
	u = origin.ResolveReference(u)
	if u.User != nil || u.Opaque != "" {
		return nil, false
	}
	if !strings.EqualFold(u.Scheme, origin.Scheme) || !strings.EqualFold(u.Hostname(), origin.Hostname()) {
		return nil, false
	}
	return u, portOf(u) == portOf(origin)
}

func portOf(u *url.URL) string {
	if p := u.Port(); p != "" {
		return p
	}
	switch strings.ToLower(u.Scheme) {
	case "https":
		return "443"
	case "http":
		return "80"
	}
	return ""
}

// parseOrigin reads the session's origin: http or https, a host, no path to
// speak of and no credentials.
func parseOrigin(origin string) (*url.URL, error) {
	u, err := url.Parse(origin)
	if err != nil || u.Host == "" || u.User != nil ||
		(!strings.EqualFold(u.Scheme, "https") && !strings.EqualFold(u.Scheme, "http")) {
		return nil, errors.New("sync: the session's origin is not an http(s) origin")
	}
	return &url.URL{Scheme: strings.ToLower(u.Scheme), Host: u.Host}, nil
}

// gitClient fetches over smart HTTP with the session's cookie.
type gitClient struct {
	tr   transport.Transport
	auth *cookieAuth
}

func newGitClient(c *http.Client, token string) *gitClient {
	return &gitClient{tr: githttp.NewClient(c), auth: &cookieAuth{token: token}}
}

// fetchMain asks u for its main and writes what repo lacks of it, then moves
// repo's main to it — objects first, the ref last, so a failure leaves the
// previous head. It answers the head, or errEmpty when the remote has none.
// Nothing is ever pruned: an earlier snapshot keeps reading its commit.
func (g *gitClient) fetchMain(ctx context.Context, repo *git.Repository, u *url.URL) (plumbing.Hash, error) {
	ep, err := transport.NewEndpoint(u.String())
	if err != nil {
		return plumbing.ZeroHash, err
	}
	sess, err := g.tr.NewUploadPackSession(ep, g.auth)
	if err != nil {
		return plumbing.ZeroHash, err
	}
	defer sess.Close()
	ar, err := sess.AdvertisedReferencesContext(ctx)
	if errors.Is(err, transport.ErrEmptyRemoteRepository) {
		return plumbing.ZeroHash, errEmpty
	}
	if err != nil {
		return plumbing.ZeroHash, err
	}
	head, ok := ar.References[mainRef.String()]
	if !ok || head.IsZero() {
		return plumbing.ZeroHash, errEmpty
	}
	if _, err := repo.CommitObject(head); err != nil {
		req := packp.NewUploadPackRequestFromCapabilities(ar.Capabilities)
		if ar.Capabilities.Supports(capability.NoProgress) {
			if err := req.Capabilities.Set(capability.NoProgress); err != nil {
				return plumbing.ZeroHash, err
			}
		}
		req.Wants = []plumbing.Hash{head}
		if have, err := localHead(repo); err == nil {
			req.Haves = []plumbing.Hash{have}
		}
		if err := g.uploadPack(ctx, sess, repo, req); err != nil {
			return plumbing.ZeroHash, err
		}
		if _, err := repo.CommitObject(head); err != nil {
			return plumbing.ZeroHash, fmt.Errorf("the pack lacks the head: %w", io.ErrUnexpectedEOF)
		}
	}
	if err := repo.Storer.SetReference(plumbing.NewHashReference(mainRef, head)); err != nil {
		return plumbing.ZeroHash, err
	}
	return head, nil
}

func (g *gitClient) uploadPack(ctx context.Context, sess transport.UploadPackSession, repo *git.Repository, req *packp.UploadPackRequest) (err error) {
	resp, err := sess.UploadPack(ctx, req)
	if errors.Is(err, transport.ErrEmptyUploadPackRequest) {
		return nil
	}
	if err != nil {
		return err
	}
	defer func() {
		if cerr := resp.Close(); err == nil {
			err = cerr
		}
	}()
	var rd io.Reader = resp
	switch {
	case req.Capabilities.Supports(capability.Sideband64k):
		rd = sideband.NewDemuxer(sideband.Sideband64k, resp)
	case req.Capabilities.Supports(capability.Sideband):
		rd = sideband.NewDemuxer(sideband.Sideband, resp)
	}
	return packfile.UpdateObjectStorage(repo.Storer, rd)
}

// isClone reports whether dir holds a bare repository (renamed into place
// only once complete, so its presence means a whole clone).
func isClone(dir string) bool {
	_, err := os.Stat(dir + "/HEAD")
	return err == nil
}

// initBare makes an empty bare repository at dir whose HEAD names main.
func initBare(dir string) (*git.Repository, error) {
	repo, err := git.PlainInit(dir, true)
	if err != nil {
		return nil, err
	}
	if err := repo.Storer.SetReference(plumbing.NewSymbolicReference(plumbing.HEAD, mainRef)); err != nil {
		return nil, err
	}
	return repo, nil
}

// localHead is repo's main.
func localHead(repo *git.Repository) (plumbing.Hash, error) {
	ref, err := repo.Reference(mainRef, true)
	if err != nil {
		return plumbing.ZeroHash, err
	}
	return ref.Hash(), nil
}

// headOf is the main of the clone at dir, zero when there is none.
func headOf(dir string) plumbing.Hash {
	if !isClone(dir) {
		return plumbing.ZeroHash
	}
	repo, err := git.PlainOpen(dir)
	if err != nil {
		return plumbing.ZeroHash
	}
	h, err := localHead(repo)
	if err != nil {
		return plumbing.ZeroHash
	}
	return h
}

// treeAt is the tree of commit head in the repository at dir.
func treeAt(dir string, head plumbing.Hash) (*object.Tree, error) {
	repo, err := git.PlainOpen(dir)
	if err != nil {
		return nil, err
	}
	c, err := repo.CommitObject(head)
	if err != nil {
		return nil, err
	}
	return c.Tree()
}

// blobPaths lists every blob path in tree, sorted.
func blobPaths(tree *object.Tree) ([]string, error) {
	var paths []string
	err := tree.Files().ForEach(func(f *object.File) error {
		paths = append(paths, f.Name)
		return nil
	})
	sort.Strings(paths)
	return paths, err
}

// readBlob reads the file at path in tree.
func readBlob(tree *object.Tree, path string) ([]byte, error) {
	f, err := tree.File(path)
	if err != nil {
		return nil, err
	}
	rd, err := f.Reader()
	if err != nil {
		return nil, err
	}
	defer rd.Close()
	return io.ReadAll(rd)
}
