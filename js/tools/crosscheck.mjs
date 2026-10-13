#!/usr/bin/env node
// The JavaScript driver of the cross-implementation comparison (DIRECTION §3.6,
// format.cross_check). It is a THIN wrapper: it reads every input document in
// <in-dir> and, for each, writes the three artefacts the tool compares into
// <out-dir>, using only the parse/write the library already exposes and the
// same serialisation the corpus harness uses (js/test/corpus/harness.js). It
// adds no parsing, writing or serialisation logic of its own.
//
//   NNNN.input.json       serialise(parse(input))      the input model
//   NNNN.canonical.EXT    write(parse(input))          the canonical text
//   NNNN.canonical.json   serialise(parse(canonical))  the canonical model
//
// EXT is .cifra.md for a song and .setlist.md for a setlist, branched on the
// input's extension exactly as the reference merge driver does.
//
//   node js/tools/crosscheck.mjs <in-dir> <out-dir>

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  parse,
  write,
  parseSetlist,
  writeSetlist,
} from "../src/index.js";

// The corpus serialisation: two-space indent, non-ASCII as itself, one trailing
// newline — identical to tools.corpus.dump and the Go driver's dump, so bytes
// compare directly (corpus/README.md).
function dump(model) {
  return JSON.stringify(model, null, 2) + "\n";
}

function artefacts(bytes, setlist) {
  const model = setlist ? parseSetlist(bytes) : parse(bytes);
  const canonical = setlist ? writeSetlist(model) : write(model);
  const canonModel = setlist ? parseSetlist(canonical) : parse(canonical);
  return {
    inputJson: dump(model),
    canonical,
    canonModel: dump(canonModel),
  };
}

function main(argv) {
  const [inDir, outDir] = argv;
  if (!inDir || !outDir) {
    process.stderr.write("usage: crosscheck.mjs <in-dir> <out-dir>\n");
    return 2;
  }
  for (const file of readdirSync(inDir).sort()) {
    let ext, setlist;
    if (file.endsWith(".setlist.md")) {
      ext = ".setlist.md";
      setlist = true;
    } else if (file.endsWith(".cifra.md")) {
      ext = ".cifra.md";
      setlist = false;
    } else {
      continue;
    }
    const name = file.slice(0, -ext.length);
    const bytes = readFileSync(path.join(inDir, file));
    const a = artefacts(bytes, setlist);
    writeFileSync(path.join(outDir, `${name}.input.json`), a.inputJson);
    writeFileSync(path.join(outDir, `${name}.canonical${ext}`), a.canonical);
    writeFileSync(path.join(outDir, `${name}.canonical.json`), a.canonModel);
  }
  return 0;
}

process.exit(main(process.argv.slice(2)));
