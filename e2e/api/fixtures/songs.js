import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Purpose-written fixtures: songs written for the harness, never anyone's
// copyrighted words (the standing copyright rule; the e2e_api refinement,
// Constraints). Exported as { filename, content } so a test can write the song
// into its own working directory and commit it with either git client.

function load(filename) {
  const path = fileURLToPath(new URL(filename, import.meta.url));
  return { filename, content: readFileSync(path, 'utf8') };
}

// An original cifra.md song (the chorus even names the harness).
export const sampleSong = load('the-tuning-song.cifra.md');
