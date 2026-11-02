package protocol

// unit — the AppLoad wire (reader.protocol; docs/remarkable-reader.md §6, the
// wire paragraph; rm-appload src/protocol.h and src/management.cpp at
// df974a6). Each test runs over a real SOCK_SEQPACKET socketpair: one end a
// Conn, the other a raw peer playing AppLoad's side, sending and receiving
// separate records as AppLoad's two send calls and two reads do.

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"sync"
	"syscall"
	"testing"
	"time"
)

// peer is AppLoad's end of the socket: a raw fd.
type peer struct {
	t  *testing.T
	fd int
}

// pair makes a socketpair; sndbuf, when above zero, is set on the Conn's end
// before NewConn reads it back.
func pair(t *testing.T, sndbuf int) (*Conn, *peer) {
	t.Helper()
	fds, err := syscall.Socketpair(syscall.AF_UNIX, syscall.SOCK_SEQPACKET|syscall.SOCK_CLOEXEC, 0)
	if err != nil {
		t.Fatalf("socketpair: %v", err)
	}
	if sndbuf > 0 {
		if err := syscall.SetsockoptInt(fds[0], syscall.SOL_SOCKET, syscall.SO_SNDBUF, sndbuf); err != nil {
			t.Fatalf("set SO_SNDBUF: %v", err)
		}
	}
	c := wrap(t, fds[0])
	syscall.Close(fds[0])
	p := &peer{t: t, fd: fds[1]}
	// A test that would hang reads a timeout instead.
	tv := syscall.NsecToTimeval(int64(5 * time.Second))
	if err := syscall.SetsockoptTimeval(p.fd, syscall.SOL_SOCKET, syscall.SO_RCVTIMEO, &tv); err != nil {
		t.Fatalf("set SO_RCVTIMEO: %v", err)
	}
	t.Cleanup(func() { c.Close(); syscall.Close(p.fd) })
	return c, p
}

// wrap makes a Conn of a duplicate of fd (the caller keeps fd), closed at
// the test's end.
func wrap(t *testing.T, fd int) *Conn {
	t.Helper()
	dup, err := syscall.Dup(fd)
	if err != nil {
		t.Fatalf("dup: %v", err)
	}
	f := os.NewFile(uintptr(dup), "conn")
	fc, err := net.FileConn(f) // duplicates again; f's own fd is closed below
	f.Close()
	if err != nil {
		t.Fatalf("FileConn: %v", err)
	}
	c, err := NewConn(fc.(*net.UnixConn))
	if err != nil {
		t.Fatalf("NewConn: %v", err)
	}
	t.Cleanup(func() { c.Close() })
	return c
}

func header(typ, length int32) []byte {
	b := make([]byte, 8)
	binary.NativeEndian.PutUint32(b[0:4], uint32(typ))
	binary.NativeEndian.PutUint32(b[4:8], uint32(length))
	return b
}

// record sends one record.
func (p *peer) record(b []byte) {
	p.t.Helper()
	if err := syscall.Sendmsg(p.fd, b, nil, nil, 0); err != nil {
		p.t.Fatalf("peer send: %v", err)
	}
}

// message sends a message as AppLoad's sendMessageTo does: a header record,
// then a payload record.
func (p *peer) message(typ int32, payload string) {
	p.t.Helper()
	p.record(header(typ, int32(len(payload))))
	p.record([]byte(payload))
}

// read receives one record (up to max bytes) and reports whether it was
// truncated.
func (p *peer) read(max int) ([]byte, bool) {
	p.t.Helper()
	buf := make([]byte, max)
	n, _, flags, _, err := syscall.Recvmsg(p.fd, buf, nil, 0)
	if err != nil {
		p.t.Fatalf("peer receive: %v", err)
	}
	return buf[:n], flags&syscall.MSG_TRUNC != 0
}

// readMessage receives a header record and its payload record.
func (p *peer) readMessage() (int32, []byte) {
	p.t.Helper()
	h, trunc := p.read(64)
	if len(h) != 8 || trunc {
		p.t.Fatalf("peer: header record of %d bytes (truncated %v), want 8", len(h), trunc)
	}
	typ := int32(binary.NativeEndian.Uint32(h[0:4]))
	length := int(int32(binary.NativeEndian.Uint32(h[4:8])))
	body, trunc := p.read(length + 1)
	if len(body) != length || trunc {
		p.t.Fatalf("peer: payload record of %d bytes, header says %d", len(body), length)
	}
	return typ, body
}

// Pins management.cpp L37–58 (a message is two send calls) and design §6's
// wire paragraph: Receive reads the header record, then the payload record.
func TestReceiveTwoRecords(t *testing.T) {
	c, p := pair(t, 0)
	p.message(TypeOpen, `{"view":"shelf"}`)
	f, err := c.Receive()
	if err != nil {
		t.Fatalf("Receive: %v", err)
	}
	if f.Type != TypeOpen || string(f.Payload) != `{"view":"shelf"}` {
		t.Fatalf("got %d %q", f.Type, f.Payload)
	}
}

// Pins protocol.h's PacketHeader and §3.2's native order: Send writes exactly
// an 8-byte record of the type and length, then exactly the payload.
func TestSendTwoRecords(t *testing.T) {
	c, p := pair(t, 0)
	payload := []byte(`{"paired":true}`)
	if err := c.Send(Frame{Type: TypeState, Payload: payload}); err != nil {
		t.Fatalf("Send: %v", err)
	}
	h, trunc := p.read(64)
	if trunc || !bytes.Equal(h, header(TypeState, int32(len(payload)))) {
		t.Fatalf("header record %v, want %v", h, header(TypeState, int32(len(payload))))
	}
	body, trunc := p.read(1024)
	if trunc || !bytes.Equal(body, payload) {
		t.Fatalf("payload record %q, want %q", body, payload)
	}
}

// Pins management.cpp L135–158: AppLoad binds and listens, the backend
// connects to the path it was given as argv[1].
func TestDialConnectsToArgvPath(t *testing.T) {
	path := filepath.Join(t.TempDir(), "appload.sock")
	l, err := net.ListenUnix("unixpacket", &net.UnixAddr{Name: path, Net: "unixpacket"})
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer l.Close()

	type side struct {
		conn *net.UnixConn
		err  error
	}
	accepted := make(chan side, 1)
	go func() {
		uc, err := l.AcceptUnix()
		accepted <- side{uc, err}
	}()

	c, err := Dial(path)
	if err != nil {
		t.Fatalf("Dial: %v", err)
	}
	defer c.Close()
	s := <-accepted
	if s.err != nil {
		t.Fatalf("accept: %v", s.err)
	}
	appload := s.conn
	defer appload.Close()
	appload.SetDeadline(time.Now().Add(5 * time.Second))

	// AppLoad → backend.
	appload.Write(header(TypeHello, 2))
	appload.Write([]byte(`{}`))
	m, err := c.Next()
	if err != nil || m != (Hello{}) {
		t.Fatalf("Next: %v %v", m, err)
	}

	// Backend → AppLoad.
	if err := c.Write(ShapesShown{Shown: true}); err != nil {
		t.Fatalf("Write: %v", err)
	}
	h := make([]byte, 64)
	n, err := appload.Read(h)
	if err != nil || !bytes.Equal(h[:n], header(TypeShapesShown, 14)) {
		t.Fatalf("header %v %v", h[:n], err)
	}
	n, err = appload.Read(h)
	if err != nil || string(h[:n]) != `{"shown":true}` {
		t.Fatalf("payload %q %v", h[:n], err)
	}
}

// Pins MAX_MESSAGE_LENGTH and AppLoad ending the connection on a length above
// it (management.cpp L188–191); a negative length is a broken frame.
func TestReceiveRefusesOverLimit(t *testing.T) {
	c, p := pair(t, 0)
	p.record(header(TypeOpen, MaxPayload+1))
	if _, err := c.Receive(); !errors.Is(err, ErrTooLarge) {
		t.Fatalf("Receive: %v, want ErrTooLarge", err)
	}
	if err := c.Send(Frame{Type: TypeHello, Payload: []byte(`{}`)}); !errors.Is(err, ErrTooLarge) {
		t.Fatalf("Send after: %v, want the same error", err)
	}
	// The Conn closed its end: the peer reads the end of the connection.
	if b, _ := p.read(64); len(b) != 0 {
		t.Fatalf("peer read %v after close, want end of connection", b)
	}

	c, p = pair(t, 0)
	p.record(header(TypeOpen, -1))
	if _, err := c.Receive(); !errors.Is(err, ErrFrame) {
		t.Fatalf("Receive of negative length: %v, want ErrFrame", err)
	}
}

// Pins management.cpp L192: the payload record is read only when the length
// is above zero.
func TestReceiveZeroLength(t *testing.T) {
	c, p := pair(t, 0)
	p.record(header(TypeHello, 0))
	p.message(TypeSync, `{}`)
	f, err := c.Receive()
	if err != nil || f.Type != TypeHello || len(f.Payload) != 0 {
		t.Fatalf("first Receive: %d %q %v", f.Type, f.Payload, err)
	}
	f, err = c.Receive()
	if err != nil || f.Type != TypeSync || string(f.Payload) != `{}` {
		t.Fatalf("second Receive: %d %q %v", f.Type, f.Payload, err)
	}
}

// Pins the Constraints' receiving rules: a header record not exactly 8 bytes
// and a payload record whose size differs from the header are ErrFrame, and
// terminal.
func TestReceiveBadRecords(t *testing.T) {
	cases := []struct {
		name string
		send func(p *peer)
	}{
		{"header of 12 bytes", func(p *peer) { p.record(append(header(TypeOpen, 2), 0, 0, 0, 0)) }},
		{"header of 4 bytes", func(p *peer) { p.record([]byte{1, 0, 0, 0}) }},
		{"payload shorter", func(p *peer) { p.record(header(TypeOpen, 10)); p.record([]byte(`{}`)) }},
		{"payload longer", func(p *peer) { p.record(header(TypeOpen, 2)); p.record([]byte(`{"view":"shelf"}`)) }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, p := pair(t, 0)
			tc.send(p)
			_, err := c.Receive()
			if !errors.Is(err, ErrFrame) {
				t.Fatalf("Receive: %v, want ErrFrame", err)
			}
			if _, again := c.Receive(); again != err {
				t.Fatalf("later Receive: %v, want the same %v", again, err)
			}
			if _, again := c.Next(); again != err {
				t.Fatalf("later Next: %v, want the same %v", again, err)
			}
			if again := c.Write(Hello{}); again != err {
				t.Fatalf("later Write: %v, want the same %v", again, err)
			}
		})
	}
}

// Pins §6: a zero-length payload is never sent — nothing is written, and the
// next message is the next record the peer reads.
func TestSendRefusesEmpty(t *testing.T) {
	c, p := pair(t, 0)
	if err := c.Send(Frame{Type: TypeState}); !errors.Is(err, ErrEmpty) {
		t.Fatalf("Send: %v, want ErrEmpty", err)
	}
	if err := c.Send(Frame{Type: TypeState, Payload: []byte{}}); !errors.Is(err, ErrEmpty) {
		t.Fatalf("Send: %v, want ErrEmpty", err)
	}
	if err := c.Write(Settings{Version: "1"}); err != nil {
		t.Fatalf("Write: %v", err)
	}
	if typ, _ := p.readMessage(); typ != TypeSettings {
		t.Fatalf("peer read type %d, want %d", typ, TypeSettings)
	}
}

// Pins MAX_MESSAGE_LENGTH on the sending side: refused, nothing written.
func TestSendRefusesOverLimit(t *testing.T) {
	c, p := pair(t, 0)
	if err := c.Send(Frame{Type: TypeSheet, Payload: make([]byte, MaxPayload+1)}); !errors.Is(err, ErrTooLarge) {
		t.Fatalf("Send: %v, want ErrTooLarge", err)
	}
	c.Write(Sync{})
	if typ, body := p.readMessage(); typ != TypeSync || string(body) != `{}` {
		t.Fatalf("peer read %d %q, want the next message", typ, body)
	}
}

// Pins §6 "never leaving a header without its payload": a payload above the
// socket's send bound is refused before the header, and the stream stays in
// step.
func TestSendRefusesOverSocketBuffer(t *testing.T) {
	c, p := pair(t, 4096)
	big := bytes.Repeat([]byte("a"), 64<<10)
	if err := c.Send(Frame{Type: TypeSheet, Payload: big}); !errors.Is(err, ErrTooLarge) {
		t.Fatalf("Send: %v, want ErrTooLarge", err)
	}
	if err := c.Write(Pairing{Offline: true}); err != nil {
		t.Fatalf("Write after refusal: %v", err)
	}
	typ, body := p.readMessage()
	if typ != TypePairing || string(body) != `{"offline":true}` {
		t.Fatalf("peer read %d %q", typ, body)
	}
}

// Pins the send mutex: concurrent senders never interleave a header and
// another's payload.
func TestSendsDoNotInterleave(t *testing.T) {
	c, p := pair(t, 0)
	const senders, each = 16, 50
	var wg sync.WaitGroup
	errs := make(chan error, senders)
	for g := 0; g < senders; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			typ := int32(100 + g)
			payload := bytes.Repeat([]byte(fmt.Sprintf("type %d;", typ)), g+1)
			for i := 0; i < each; i++ {
				if err := c.Send(Frame{Type: typ, Payload: payload}); err != nil {
					errs <- err
					return
				}
			}
		}(g)
	}
	for i := 0; i < senders*each; i++ {
		typ, body := p.readMessage()
		want := bytes.Repeat([]byte(fmt.Sprintf("type %d;", typ)), int(typ-100)+1)
		if !bytes.Equal(body, want) {
			t.Fatalf("message %d: header type %d followed by %q", i, typ, body)
		}
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatalf("Send: %v", err)
	}
}

// Pins protocol.h L3–5 and management.cpp L17–35, L60–79: AppLoad's −2, −3
// (the count of frontends in decimal) and −1 (close, then the socket closes).
func TestSystemMessages(t *testing.T) {
	c, p := pair(t, 0)
	p.message(TypeAttached, "x")
	p.message(TypeAttached, "1")
	p.message(TypeDetached, "0")
	p.message(TypeTerminate, "close")
	syscall.Close(p.fd)
	p.fd = -1

	var pe *PayloadError
	if _, err := c.Next(); !errors.As(err, &pe) || pe.Type != TypeAttached {
		t.Fatalf("Next of a bad count: %v, want a *PayloadError for -2", err)
	}
	for _, want := range []Message{Attached{Frontends: 1}, Detached{Frontends: 0}, Terminate{}} {
		m, err := c.Next()
		if err != nil || m != want {
			t.Fatalf("Next: %#v %v, want %#v", m, err, want)
		}
	}
	if _, err := c.Next(); err != io.EOF {
		t.Fatalf("Next after close: %v, want io.EOF", err)
	}
}

// Pins that the backend never sends AppLoad's system types.
func TestSendRefusesNegativeType(t *testing.T) {
	c, _ := pair(t, 0)
	if err := c.Send(Frame{Type: TypeTerminate, Payload: []byte("close")}); !errors.Is(err, ErrType) {
		t.Fatalf("Send: %v, want ErrType", err)
	}
	if err := c.Write(Attached{Frontends: 1}); !errors.Is(err, ErrType) {
		t.Fatalf("Write: %v, want ErrType", err)
	}
}

// Pins Decision 10: Close cancels a blocked Receive, as net.Conn's does.
func TestCloseUnblocksReceive(t *testing.T) {
	c, _ := pair(t, 0)
	done := make(chan error, 1)
	go func() {
		_, err := c.Receive()
		done <- err
	}()
	time.Sleep(50 * time.Millisecond)
	if err := c.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}
	select {
	case err := <-done:
		if !errors.Is(err, ErrClosed) {
			t.Fatalf("Receive: %v, want ErrClosed", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Receive still blocked after Close")
	}
	if _, err := c.Receive(); !errors.Is(err, ErrClosed) {
		t.Fatalf("later Receive: %v, want ErrClosed", err)
	}
}
