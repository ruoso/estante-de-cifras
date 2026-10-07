// Package cifra is cifra.md for Go: the hook's implementation of the format
// and (later) git-merge-cifra for computers. A second, independent
// implementation of the cifra.md specification, held to the same corpus as the
// Python reference and the JavaScript twin — agreement is by the corpus, byte
// for byte, not by shared code (DIRECTION §3.6).
//
// This landing ships the model type and its serialiser (model.go) and the
// corpus-facing operations as stubs (cifra.go). The reader, writer, setlists,
// versions and merge fill them in, held by the corpus harness in
// internal/corpus.
package cifra

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// Object is a JSON object whose keys keep their insertion (read) order. The
// corpus treats key order — including the order of a song's `properties` — as
// part of the model, so the model may not be a Go map, whose iteration order is
// random and whose keys encoding/json re-sorts. The later reader builds its
// models out of this type and Dumps them with Encode.
type Object struct {
	keys []string
	vals map[string]any
}

// NewObject returns an empty object.
func NewObject() *Object {
	return &Object{vals: map[string]any{}}
}

// Set stores v under key, appending key to the order the first time it is seen.
// A value is one of: *Object, []any, string, json.Number, bool, or nil.
func (o *Object) Set(key string, v any) {
	if o.vals == nil {
		o.vals = map[string]any{}
	}
	if _, ok := o.vals[key]; !ok {
		o.keys = append(o.keys, key)
	}
	o.vals[key] = v
}

// Get returns the value under key and whether it is present.
func (o *Object) Get(key string) (any, bool) {
	v, ok := o.vals[key]
	return v, ok
}

// Keys returns the keys in insertion order. The returned slice is a copy.
func (o *Object) Keys() []string {
	out := make([]string, len(o.keys))
	copy(out, o.keys)
	return out
}

// Len returns the number of keys.
func (o *Object) Len() int { return len(o.keys) }

// Without returns a copy of the object with the named keys dropped, the order
// of the remaining keys preserved. It is how the corpus's sixth check compares
// two models apart from `diagnostics` and `sungAt`, which describe a text, not
// a model (corpus/README.md).
func (o *Object) Without(drop ...string) *Object {
	skip := map[string]bool{}
	for _, k := range drop {
		skip[k] = true
	}
	out := NewObject()
	for _, k := range o.keys {
		if skip[k] {
			continue
		}
		out.Set(k, o.vals[k])
	}
	return out
}

// Model is the order-preserving representation of a parsed song or setlist: a
// JSON object. The corpus's top-level models are always objects.
type Model = *Object

// DecodeModel parses JSON bytes into an order-preserving model: objects become
// *Object with keys in file order, arrays []any, numbers json.Number (so they
// round-trip to the exact source token), and strings, booleans and null their
// Go selves. It is how the harness loads the corpus's stored *.json models; the
// reader produces models directly rather than through it.
func DecodeModel(data []byte) (Model, error) {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	v, err := decodeValue(dec)
	if err != nil {
		return nil, err
	}
	if dec.More() {
		return nil, fmt.Errorf("cifra: trailing JSON after top-level value")
	}
	obj, ok := v.(*Object)
	if !ok {
		return nil, fmt.Errorf("cifra: top-level JSON value is not an object")
	}
	return obj, nil
}

func decodeValue(dec *json.Decoder) (any, error) {
	tok, err := dec.Token()
	if err != nil {
		return nil, err
	}
	return decodeFrom(dec, tok)
}

func decodeFrom(dec *json.Decoder, tok json.Token) (any, error) {
	if delim, ok := tok.(json.Delim); ok {
		switch delim {
		case '{':
			obj := NewObject()
			for dec.More() {
				keyTok, err := dec.Token()
				if err != nil {
					return nil, err
				}
				key, ok := keyTok.(string)
				if !ok {
					return nil, fmt.Errorf("cifra: object key is not a string")
				}
				val, err := decodeValue(dec)
				if err != nil {
					return nil, err
				}
				obj.Set(key, val)
			}
			if _, err := dec.Token(); err != nil { // consume '}'
				return nil, err
			}
			return obj, nil
		case '[':
			arr := []any{}
			for dec.More() {
				val, err := decodeValue(dec)
				if err != nil {
					return nil, err
				}
				arr = append(arr, val)
			}
			if _, err := dec.Token(); err != nil { // consume ']'
				return nil, err
			}
			return arr, nil
		default:
			return nil, fmt.Errorf("cifra: unexpected delimiter %q", delim)
		}
	}
	return tok, nil // string, json.Number, bool, or nil
}

// Encode serialises a model value the one way the corpus pins, reproducing
// Python's json.dumps(value, indent=2, ensure_ascii=False) byte for byte: a
// two-space indent, ": " and ",\n" separators, HTML escaping off (so "<", ">"
// and "&" are emitted raw), characters outside ASCII emitted as raw UTF-8, and
// no trailing newline. Dump (in the harness) adds the single final newline.
//
// encoding/json cannot do this: it re-sorts map keys and escapes "<", ">" and
// "&". So Encode walks the order-preserving model itself.
func Encode(v any) []byte {
	var b strings.Builder
	encodeValue(&b, v, 0)
	return []byte(b.String())
}

func encodeValue(b *strings.Builder, v any, depth int) {
	switch val := v.(type) {
	case *Object:
		encodeObject(b, val, depth)
	case []any:
		encodeArray(b, val, depth)
	case string:
		encodeString(b, val)
	case json.Number:
		b.WriteString(string(val))
	case bool:
		if val {
			b.WriteString("true")
		} else {
			b.WriteString("false")
		}
	case nil:
		b.WriteString("null")
	case int:
		b.WriteString(strconv.Itoa(val))
	case int64:
		b.WriteString(strconv.FormatInt(val, 10))
	default:
		// A value the model should never carry. Render it the way
		// encoding/json would, so Encode never silently drops a field; a
		// mismatch then shows up as a corpus failure rather than a panic.
		raw, _ := json.Marshal(val)
		b.Write(raw)
	}
}

func encodeObject(b *strings.Builder, o *Object, depth int) {
	if o.Len() == 0 {
		b.WriteString("{}")
		return
	}
	b.WriteString("{\n")
	inner := strings.Repeat("  ", depth+1)
	for i, k := range o.keys {
		if i > 0 {
			b.WriteString(",\n")
		}
		b.WriteString(inner)
		encodeString(b, k)
		b.WriteString(": ")
		encodeValue(b, o.vals[k], depth+1)
	}
	b.WriteByte('\n')
	b.WriteString(strings.Repeat("  ", depth))
	b.WriteByte('}')
}

func encodeArray(b *strings.Builder, a []any, depth int) {
	if len(a) == 0 {
		b.WriteString("[]")
		return
	}
	b.WriteString("[\n")
	inner := strings.Repeat("  ", depth+1)
	for i, el := range a {
		if i > 0 {
			b.WriteString(",\n")
		}
		b.WriteString(inner)
		encodeValue(b, el, depth+1)
	}
	b.WriteByte('\n')
	b.WriteString(strings.Repeat("  ", depth))
	b.WriteByte(']')
}

// encodeString writes a JSON string literal the way json.dumps(ensure_ascii=
// False) does: escape the quote, the backslash, the five short control escapes
// and any other control byte below 0x20 as \u00xx (lowercase); emit everything
// else — non-ASCII bytes and the HTML characters "<", ">", "&" among them — raw.
// Iterating bytes is correct: every escaped character is a single ASCII byte,
// and the bytes of a multibyte UTF-8 rune are all >= 0x80 and pass through.
func encodeString(b *strings.Builder, s string) {
	b.WriteByte('"')
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch c {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\n':
			b.WriteString(`\n`)
		case '\r':
			b.WriteString(`\r`)
		case '\t':
			b.WriteString(`\t`)
		case '\b':
			b.WriteString(`\b`)
		case '\f':
			b.WriteString(`\f`)
		default:
			if c < 0x20 {
				const hex = "0123456789abcdef"
				b.WriteString(`\u00`)
				b.WriteByte(hex[c>>4])
				b.WriteByte(hex[c&0xf])
			} else {
				b.WriteByte(c)
			}
		}
	}
	b.WriteByte('"')
}
