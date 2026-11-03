package sync

// unit — reading the home book by its format (reader.sync;
// docs/home-book-format.md §2.1, §2.3, §4.2, §4.5): the shelf in the web app's
// fill order, songs.json per NFC ref, and the instrument files handed to the
// engine untouched.

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"

	"golang.org/x/text/unicode/norm"
)

func ids(shelf []shelfEntry) []string {
	out := []string{}
	for _, e := range shelf {
		out = append(out, e.ID)
	}
	return out
}

// TestShelfOrder pins format §4.2 and the web app's fillQueue order: position
// ascending, a book without one last, ties by id.
func TestShelfOrder(t *testing.T) {
	raw := shelfJSON(
		shelfBook{id: "d", link: "https://x.test/git/d"},
		shelfBook{id: "c", link: "https://x.test/git/c", position: 2},
		shelfBook{id: "b", link: "https://x.test/git/b", position: 2},
		shelfBook{id: "a", link: "https://x.test/git/a"},
		shelfBook{id: "e", link: "https://x.test/git/e", position: -1},
		shelfBook{id: "f", link: "https://x.test/git/f", position: 10},
	)
	got := ids(readShelf([]byte(raw)))
	want := []string{"e", "b", "c", "f", "a", "d"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("order %v, want %v", got, want)
	}
}

// TestShelfLeavesOutLocalTombstonedAndLinkless pins format §4.2 and design
// §5.2: a local-only book is never on the reader; a tombstoned link, an
// entry without a link or with an empty one leaves; label, role and owner
// come through when live.
func TestShelfLeavesOutLocalTombstonedAndLinkless(t *testing.T) {
	raw := `{
  "books": {
    "live": {
      "label": {"at": "2026-10-06T12:00:00.000Z", "value": "Turma de quarta"},
      "link": {"at": "2026-10-06T12:00:00.000Z", "value": "https://x.test/git/live"},
      "owner": {"at": "2026-10-06T12:00:00.000Z", "value": "Ana Lima"},
      "role": {"at": "2026-10-06T12:00:00.000Z", "value": "reader"}
    },
    "tombstoned": {
      "label": {"at": "2026-10-06T12:00:00.000Z", "value": "Gone"},
      "link": {"at": "2026-10-06T12:00:00.000Z", "value": null}
    },
    "linkless": {
      "label": {"at": "2026-10-06T12:00:00.000Z", "value": "No link"}
    },
    "emptylink": {
      "link": {"at": "2026-10-06T12:00:00.000Z", "value": ""}
    },
    "labeltombstoned": {
      "label": {"at": "2026-10-06T12:00:00.000Z", "value": null},
      "link": {"at": "2026-10-06T12:00:00.000Z", "value": "https://x.test/git/lt"}
    }
  },
  "local": {
    "device-1": {
      "local-book": {
        "position": {"at": "2026-10-06T12:00:00.000Z", "value": 0},
        "title": {"at": "2026-10-06T12:00:00.000Z", "value": "My songs"}
      }
    }
  }
}
`
	shelf := readShelf([]byte(raw))
	if got := ids(shelf); !reflect.DeepEqual(got, []string{"labeltombstoned", "live"}) {
		t.Fatalf("shelf %v, want labeltombstoned and live", got)
	}
	live := shelf[1]
	if live.Label != "Turma de quarta" || live.Role != "reader" || live.Owner != "Ana Lima" || live.link != "https://x.test/git/live" {
		t.Errorf("live %+v", live)
	}
	if shelf[0].Label != "" {
		t.Errorf("a tombstoned label came through: %q", shelf[0].Label)
	}
}

// TestSongsJSON pins format §4.5 and §2.3: the transposition, the variation
// per tuning, a tombstone absent, and an NFD path found by its NFC ref.
func TestSongsJSON(t *testing.T) {
	nfc := norm.NFC.String("b1/Canções/Construção.cifra.md")
	nfd := norm.NFD.String("b1/Canções/Construção.cifra.md")
	if nfc == nfd {
		t.Fatal("the test's path has no decomposable letter")
	}
	raw := `{
  "` + nfc + `": {
    "transposition": {"at": "2026-10-06T12:00:00.000Z", "value": -3},
    "variation": {
      "E2 A2 D3 G3 B3 E4": {"at": "2026-10-06T12:00:00.000Z", "value": "v-open"},
      "G4 C4 E4 A4": {"at": "2026-10-06T12:00:00.000Z", "value": null}
    }
  },
  "b1/tombstoned.cifra.md": {
    "transposition": {"at": "2026-10-06T12:00:00.000Z", "value": null}
  },
  "b1/variation-only.cifra.md": {
    "variation": {"G4 C4 E4 A4": {"at": "2026-10-06T12:00:00.000Z", "value": "v-uke"}}
  }
}
`
	sn := emptySnapshot()
	sn.songs = readSongs([]byte(raw))
	got, ok := sn.Songs(nfd)
	if !ok {
		t.Fatal("the NFD path was not found by its NFC ref")
	}
	want := SongState{Transposition: -3, Variation: map[string]string{"E2 A2 D3 G3 B3 E4": "v-open"}}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("song %+v, want %+v", got, want)
	}
	if _, ok := sn.Songs("b1/tombstoned.cifra.md"); ok {
		t.Error("a tombstoned transposition reads as saved")
	}
	if got, ok := sn.Songs("b1/variation-only.cifra.md"); !ok || got.Transposition != 0 || got.Variation["G4 C4 E4 A4"] != "v-uke" {
		t.Errorf("variation only: %+v %v", got, ok)
	}
	// What Songs answers is a copy.
	got.Variation["E2 A2 D3 G3 B3 E4"] = "changed"
	if again, _ := sn.Songs(nfc); again.Variation["E2 A2 D3 G3 B3 E4"] != "v-open" {
		t.Error("the snapshot's state changed through an answer")
	}
}

// TestAbsentFilesReadAsEmpty pins format §2.1: an absent file reads as {}.
func TestAbsentFilesReadAsEmpty(t *testing.T) {
	if got := readShelf(nil); len(got) != 0 {
		t.Errorf("shelf %v", got)
	}
	if got := readSongs(nil); len(got) != 0 {
		t.Errorf("songs %v", got)
	}
	files := (&Syncer{}).instrumentFiles(homeFiles{})
	for name, raw := range map[string]json.RawMessage{
		"instruments": files.Instruments, "preferences": files.Preferences,
		"shapes": files.Shapes, "defaultShapes": files.DefaultShapes,
	} {
		if string(raw) != "{}" {
			t.Errorf("%s: %s, want {}", name, raw)
		}
	}
	if got := readHome(t.TempDir()); len(got) != 0 {
		t.Errorf("a directory with no clone read %d files", len(got))
	}
}

// TestMalformedFilesTolerated pins that what does not read is absent, never
// a failure: a non-register, a non-integer transposition, a file that is not
// JSON or not a map.
func TestMalformedFilesTolerated(t *testing.T) {
	songs := readSongs([]byte(`{
  "b1/bare.cifra.md": {"transposition": 2},
  "b1/half.cifra.md": {"transposition": {"at": "2026-10-06T12:00:00.000Z", "value": 2.5}},
  "b1/string.cifra.md": {"transposition": {"at": "2026-10-06T12:00:00.000Z", "value": "2"}},
  "b1/badat.cifra.md": {"transposition": {"at": "yesterday", "value": 2}},
  "b1/extra.cifra.md": {"transposition": {"at": "2026-10-06T12:00:00.000Z", "value": 2, "x": 1}},
  "b1/notamap.cifra.md": [1, 2],
  "b1/good.cifra.md": {"transposition": {"at": "2026-10-06T12:00:00.000Z", "value": 4}, "variation": "x"}
}`))
	if len(songs) != 1 || songs["b1/good.cifra.md"].Transposition != 4 {
		t.Errorf("songs %+v, want good only", songs)
	}
	for _, raw := range []string{"not json", "[1,2]", `"x"`, `{"books": [1]}`, `{"books": {"a": {"link": "https://x.test/a"}}}`} {
		if got := readShelf([]byte(raw)); len(got) != 0 {
			t.Errorf("shelf %q read %v", raw, ids(got))
		}
		_ = readSongs([]byte(raw))
	}
	files := (&Syncer{}).instrumentFiles(homeFiles{instrumentsFile: []byte("not json"), shapesFile: []byte("[1]")})
	if string(files.Instruments) != "{}" || string(files.Shapes) != "{}" {
		t.Errorf("malformed instrument files crossed as %s and %s", files.Instruments, files.Shapes)
	}
}

// TestInstrumentFilesGoToTheEngine pins the home-book read of the note: the
// fake Engine receives exactly the four files (instrument in use, my shapes,
// the cache table), absent as {}, and Load gets its answer.
func TestInstrumentFilesGoToTheEngine(t *testing.T) {
	instruments := []byte(`{"u1": {"definition": {"at": "2026-10-06T12:00:00.000Z", "value": {"catalogId": "ukulele", "fretCount": 15, "label": "Uke", "tuning": "G4 C4 E4 A4"}}}}` + "\n")
	preferences := []byte(`{"instrumentInUse": {"at": "2026-10-06T12:00:00.000Z", "value": "u1"}}` + "\n")
	cache := []byte(`{"u1": {"G4 C4 E4 A4": {"defaults-1": {"at": "2026-10-06T12:00:00.000Z", "value": {"fingerprint": "f", "shapes": {}}}}}}` + "\n")
	eng := newFakeEngine()
	s := &Syncer{eng: eng}
	home := homeFiles{instrumentsFile: instruments, preferencesFile: preferences, defaultShapesFile: cache, songsFile: []byte(`{}`)}
	if err := s.loadInstrument(context.Background(), home); err != nil {
		t.Fatal(err)
	}
	if len(eng.files) != 1 {
		t.Fatalf("%d Instrument calls, want 1", len(eng.files))
	}
	got := eng.files[0]
	for name, pair := range map[string][2]string{
		"instruments":   {string(got.Instruments), string(instruments)},
		"preferences":   {string(got.Preferences), string(preferences)},
		"shapes":        {string(got.Shapes), "{}"},
		"defaultShapes": {string(got.DefaultShapes), string(cache)},
	} {
		if pair[0] != pair[1] {
			t.Errorf("%s: %s, want %s", name, pair[0], pair[1])
		}
	}
	if len(eng.loads) != 1 || string(eng.loads[0][0]) != string(eng.answer.Entry) || string(eng.loads[0][1]) != string(eng.answer.Table) {
		t.Errorf("loads %s, want the Instrument answer", eng.loads)
	}
	// The same files again: nothing asked, nothing loaded.
	if err := s.loadInstrument(context.Background(), home); err != nil {
		t.Fatal(err)
	}
	if len(eng.files) != 1 || len(eng.loads) != 1 {
		t.Errorf("unchanged files asked %d and loaded %d", len(eng.files), len(eng.loads))
	}
}
