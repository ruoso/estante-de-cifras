package cifra

// Small helpers on the order-preserving Object used by the song reader and the
// layout engine. The reader mirrors the reference's dict manipulation closely —
// setting, reading, deleting and reordering keys — so it needs Delete and a few
// typed getters beside model.go's Set/Get. (objString and objArray live in
// setlist.go; these add the song reader's int/object/bool accessors.)

import "encoding/json"

// Delete removes a key, preserving the order of the remaining keys. A key the
// object does not hold is a no-op. It is the Object twin of Python's dict.pop.
func (o *Object) Delete(key string) {
	if _, ok := o.vals[key]; !ok {
		return
	}
	delete(o.vals, key)
	for i, k := range o.keys {
		if k == key {
			o.keys = append(o.keys[:i], o.keys[i+1:]...)
			break
		}
	}
}

// Has reports whether the object holds the key (Python's `key in d`).
func (o *Object) Has(key string) bool {
	_, ok := o.vals[key]
	return ok
}

// oint reads an int value (stored as a Go int, or a json.Number when the value
// came through DecodeModel).
func oint(o *Object, key string) (int, bool) {
	v, ok := o.Get(key)
	if !ok {
		return 0, false
	}
	switch n := v.(type) {
	case int:
		return n, true
	case json.Number:
		i, err := n.Int64()
		if err != nil {
			return 0, false
		}
		return int(i), true
	}
	return 0, false
}

// oobj reads a nested object value, or nil when absent or not an object.
func oobj(o *Object, key string) *Object {
	if v, ok := o.Get(key); ok {
		if obj, ok := v.(*Object); ok {
			return obj
		}
	}
	return nil
}

// obool reads a bool value (false when absent or not a bool).
func obool(o *Object, key string) bool {
	if v, ok := o.Get(key); ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return false
}

// reorderObject rebuilds o with the given keys first, in that order, then the
// remaining keys in their current order. Keys in `first` that o does not hold
// are skipped. It is the Object twin of the reference's measure-key reordering
// in layout.converge.
func reorderObject(o *Object, first ...string) {
	inFirst := map[string]bool{}
	type kv struct {
		k string
		v any
	}
	var ordered []kv
	for _, k := range first {
		if o.Has(k) {
			v, _ := o.Get(k)
			ordered = append(ordered, kv{k, v})
			inFirst[k] = true
		}
	}
	for _, k := range o.Keys() {
		if !inFirst[k] {
			v, _ := o.Get(k)
			ordered = append(ordered, kv{k, v})
		}
	}
	o.keys = o.keys[:0]
	o.vals = map[string]any{}
	for _, p := range ordered {
		o.Set(p.k, p.v)
	}
}
