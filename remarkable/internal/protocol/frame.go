// Package protocol is the reader's side of AppLoad's backend socket
// (docs/remarkable-reader.md §3.2, §6): the wire exactly as rm-appload
// implements it (src/protocol.h, src/management.cpp at df974a6), and over it
// the reader's own message table as typed Go values encoded as JSON.
//
// The wire. AppLoad listens on a SOCK_SEQPACKET unix socket and passes its
// path as the backend's argv[1]; the backend connects (Dial). A message is two
// records: an 8-byte header (int32 type, int32 length, native byte order) and,
// when the length is above zero, one payload record of exactly that length.
// A length above MaxPayload ends the connection, as AppLoad does. AppLoad's
// own types are −1 (terminate), −2 (a frontend attached) and −3 (one
// detached).
//
// Two traps shape Send. An empty payload record reads as the end of the
// connection on the other side, and AppLoad's reader expects none for length
// 0, so Send refuses an empty payload. The kernel refuses a record larger than
// the socket's send buffer, so Send checks the payload against that bound
// before it writes the header: a refused send never leaves a header without
// its payload.
//
// Protocol errors (a broken frame, an oversized length) are terminal: the
// Conn closes and every later call returns the same error. A payload that is
// not valid JSON for its type (*PayloadError) loses that message only.
//
// This package is plumbing: no dispatch, no state beyond the socket, and it
// logs nothing. No error carries a payload's bytes — no song text in an
// error (§10).
package protocol

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"syscall"
)

// MaxPayload is AppLoad's MAX_MESSAGE_LENGTH (src/protocol.h): 10 MiB.
const MaxPayload = 10485760

// AppLoad's system message types (src/protocol.h).
const (
	TypeTerminate int32 = -1 // MESSAGE_SYSTEM_TERMINATE
	TypeAttached  int32 = -2 // MESSAGE_SYSTEM_NEW_COORDINATOR
	TypeDetached  int32 = -3 // MESSAGE_SYSTEM_LOST_COORDINATOR
)

// headerSize is sizeof(struct PacketHeader): two native ints.
const headerSize = 8

// sendBufferWanted is the send buffer Dial asks for; the kernel caps it at
// net.core.wmem_max, and the bound Send checks is what is read back.
const sendBufferWanted = 4 << 20

// recordOverhead is what Linux keeps of the send buffer for itself: a unix
// SEQPACKET record above sk_sndbuf − 32 is refused with EMSGSIZE
// (unix_dgram_sendmsg).
const recordOverhead = 32

// The package's errors, each usable with errors.Is. The errors returned wrap
// them with what failed, never with a payload's bytes.
var (
	// ErrFrame: a record of the wrong size — a header not exactly 8 bytes, a
	// negative length, or a payload record whose size differs from its
	// header's length. Terminal.
	ErrFrame = errors.New("protocol: malformed frame")
	// ErrTooLarge: a length above MaxPayload received (terminal), or a payload
	// above MaxPayload or the socket's send bound refused by Send before
	// anything is written (not terminal).
	ErrTooLarge = errors.New("protocol: message too large")
	// ErrEmpty: Send refused an empty payload; nothing was written.
	ErrEmpty = errors.New("protocol: empty payload")
	// ErrType: Send refused a negative (AppLoad system) type.
	ErrType = errors.New("protocol: system message types are AppLoad's to send")
	// ErrUnknownType: Decode was given a type not in the message table.
	ErrUnknownType = errors.New("protocol: unknown message type")
	// ErrClosed: the Conn was closed.
	ErrClosed = errors.New("protocol: connection closed")
)

// Frame is one message as it travels: its type and its payload bytes.
type Frame struct {
	Type    int32
	Payload []byte
}

// Conn is one connection to AppLoad. Receive is for one reading goroutine;
// Send may be called from any number of goroutines (header and payload are
// written under one lock, so records never interleave).
type Conn struct {
	uc        *net.UnixConn
	sendBound int

	recvMu sync.Mutex
	sendMu sync.Mutex

	stateMu sync.Mutex
	err     error // terminal: once set, every call returns it
}

// Dial connects to AppLoad's socket at path (the backend's argv[1]), asks
// for a 4 MiB send buffer, and wraps the connection.
func Dial(path string) (*Conn, error) {
	uc, err := net.DialUnix("unixpacket", nil, &net.UnixAddr{Name: path, Net: "unixpacket"})
	if err != nil {
		return nil, fmt.Errorf("protocol: dial: %w", err)
	}
	if err := uc.SetWriteBuffer(sendBufferWanted); err != nil {
		uc.Close()
		return nil, fmt.Errorf("protocol: set send buffer: %w", err)
	}
	c, err := NewConn(uc)
	if err != nil {
		uc.Close()
		return nil, err
	}
	return c, nil
}

// NewConn wraps a SEQPACKET unix connection already open. It reads the
// socket's effective send buffer once (SO_SNDBUF) for the bound Send checks;
// it does not change it.
func NewConn(uc *net.UnixConn) (*Conn, error) {
	raw, err := uc.SyscallConn()
	if err != nil {
		return nil, fmt.Errorf("protocol: socket: %w", err)
	}
	var sndbuf int
	var serr error
	if err := raw.Control(func(fd uintptr) {
		sndbuf, serr = syscall.GetsockoptInt(int(fd), syscall.SOL_SOCKET, syscall.SO_SNDBUF)
	}); err != nil {
		return nil, fmt.Errorf("protocol: socket: %w", err)
	}
	if serr != nil {
		return nil, fmt.Errorf("protocol: read send buffer: %w", serr)
	}
	return &Conn{uc: uc, sendBound: sndbuf - recordOverhead}, nil
}

// failed returns the terminal error, if any.
func (c *Conn) failed() error {
	c.stateMu.Lock()
	defer c.stateMu.Unlock()
	return c.err
}

// fail makes err terminal (unless one already is), closes the socket, and
// returns the terminal error.
func (c *Conn) fail(err error) error {
	c.stateMu.Lock()
	defer c.stateMu.Unlock()
	if c.err == nil {
		c.err = err
		c.uc.Close()
	}
	return c.err
}

// Close closes the connection; a Receive blocked on it returns ErrClosed, and
// so does every later call.
func (c *Conn) Close() error {
	c.stateMu.Lock()
	defer c.stateMu.Unlock()
	if c.err != nil {
		return nil
	}
	c.err = ErrClosed
	return c.uc.Close()
}

// ioFail turns a socket error into the terminal error: the Conn's own
// (ErrClosed after Close) when it was closed under the call, otherwise the
// error wrapped with the operation.
func (c *Conn) ioFail(op string, err error) error {
	if errors.Is(err, io.EOF) {
		return c.fail(io.EOF)
	}
	if errors.Is(err, net.ErrClosed) {
		if e := c.failed(); e != nil {
			return e
		}
	}
	return c.fail(fmt.Errorf("protocol: %s: %w", op, err))
}

// Receive reads one message: the header record and, when its length is above
// zero, the payload record. End of connection is io.EOF.
func (c *Conn) Receive() (Frame, error) {
	c.recvMu.Lock()
	defer c.recvMu.Unlock()
	if err := c.failed(); err != nil {
		return Frame{}, err
	}

	var hdr [headerSize]byte
	n, _, flags, _, err := c.uc.ReadMsgUnix(hdr[:], nil)
	if err != nil {
		return Frame{}, c.ioFail("receive header", err)
	}
	truncated := flags&syscall.MSG_TRUNC != 0
	if n == 0 && !truncated {
		// An empty record and the peer's close read alike: the end.
		return Frame{}, c.fail(io.EOF)
	}
	if n != headerSize || truncated {
		return Frame{}, c.fail(fmt.Errorf("%w: header record not %d bytes", ErrFrame, headerSize))
	}

	typ := int32(binary.NativeEndian.Uint32(hdr[0:4]))
	length := int32(binary.NativeEndian.Uint32(hdr[4:8]))
	switch {
	case length < 0:
		return Frame{}, c.fail(fmt.Errorf("%w: negative length", ErrFrame))
	case length > MaxPayload:
		return Frame{}, c.fail(fmt.Errorf("%w: length %d above %d", ErrTooLarge, length, MaxPayload))
	case length == 0:
		// AppLoad reads no payload record for length 0 (management.cpp).
		return Frame{Type: typ, Payload: []byte{}}, nil
	}

	buf := make([]byte, int(length)+1)
	n, _, flags, _, err = c.uc.ReadMsgUnix(buf, nil)
	if err != nil {
		if errors.Is(err, io.EOF) {
			return Frame{}, c.fail(fmt.Errorf("%w: connection ended before the payload", ErrFrame))
		}
		return Frame{}, c.ioFail("receive payload", err)
	}
	if n != int(length) || flags&syscall.MSG_TRUNC != 0 {
		return Frame{}, c.fail(fmt.Errorf("%w: payload record differs from its header's length %d", ErrFrame, length))
	}
	return Frame{Type: typ, Payload: buf[:n]}, nil
}

// Send writes one message: the header record, then the payload record. It
// refuses a negative type (ErrType), an empty payload (ErrEmpty), and a
// payload above MaxPayload or the socket's send bound (ErrTooLarge), each
// before anything is written.
func (c *Conn) Send(f Frame) error {
	if err := c.failed(); err != nil {
		return err
	}
	if f.Type < 0 {
		return fmt.Errorf("%w: type %d", ErrType, f.Type)
	}
	size := len(f.Payload)
	if size == 0 {
		return ErrEmpty
	}
	if size > MaxPayload {
		return fmt.Errorf("%w: payload of %d bytes above %d", ErrTooLarge, size, MaxPayload)
	}
	if size > c.sendBound {
		return fmt.Errorf("%w: payload of %d bytes above the socket's send bound %d", ErrTooLarge, size, c.sendBound)
	}

	var hdr [headerSize]byte
	binary.NativeEndian.PutUint32(hdr[0:4], uint32(f.Type))
	binary.NativeEndian.PutUint32(hdr[4:8], uint32(int32(size)))

	c.sendMu.Lock()
	defer c.sendMu.Unlock()
	if err := c.failed(); err != nil {
		return err
	}
	if _, err := c.uc.Write(hdr[:]); err != nil {
		return c.ioFail("send header", err)
	}
	if _, err := c.uc.Write(f.Payload); err != nil {
		// A header without its payload desynchronises the stream: terminal.
		return c.ioFail("send payload", err)
	}
	return nil
}

// Next receives messages until one in the table arrives, skipping the types
// it does not know. A *PayloadError loses one message; the Conn continues.
func (c *Conn) Next() (Message, error) {
	for {
		f, err := c.Receive()
		if err != nil {
			return nil, err
		}
		m, err := Decode(f)
		if errors.Is(err, ErrUnknownType) {
			continue
		}
		return m, err
	}
}

// Write encodes m and sends it.
func (c *Conn) Write(m Message) error {
	f, err := Encode(m)
	if err != nil {
		return err
	}
	return c.Send(f)
}
