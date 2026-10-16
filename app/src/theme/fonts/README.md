# Self-hosted typefaces (shell.fonts)

The faces the three themes are drawn with (`docs/mockups/theme.css`), served
from the app's own origin and precached by the service worker. No CDN.

Each family directory holds the `woff2` files and the `LICENSE` file shipped
in its Fontsource package, both **byte-for-byte as published**. The packages
were fetched with `npm pack` into a scratch directory, not installed: `app/`
has no dependency on them. The `woff2` files are Google Fonts' published
`latin` and `latin-ext` subsets, normal style only. They are **not
re-subset, renamed or re-encoded**. That keeps this app an unmodified
redistributor under the OFL, so each family keeps its own name (some upstream
releases declare a Reserved Font Name). To update a family, take the new
package's files whole. Never edit a font file here.

`theme.css` declares one `@font-face` per file, with the package's own
`unicode-range` and `font-weight` (a range for the variable `wght` files),
`font-display: swap`, and a relative `url()` so Vite fingerprints the file
into `assets/`.

All seven licenses were checked before the files were committed. Every one is
the **SIL Open Font License 1.1**, which permits redistributing the fonts
bundled with software. Atkinson Hyperlegible's original release came under a
Braille Institute license. The Google Fonts release redistributed here is
under OFL 1.1, as its `LICENSE` file states.

| Directory | Family (`font-family`) | Source package | Files | License | Copyright (from the package's LICENSE) | Reserved Font Name |
|---|---|---|---|---|---|---|
| `figtree/` | Figtree | `@fontsource-variable/figtree@5.3.0` | variable `wght` (300–900), latin + latin-ext | SIL OFL 1.1 | Copyright 2022 The Figtree Project Authors (https://github.com/erikdkennedy/figtree) | none declared |
| `jetbrains-mono/` | JetBrains Mono | `@fontsource-variable/jetbrains-mono@5.3.0` | variable `wght` (100–800), latin + latin-ext | SIL OFL 1.1 | Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono) | none declared |
| `source-sans-3/` | Source Sans 3 | `@fontsource-variable/source-sans-3@5.3.1` | variable `wght` (200–900), latin + latin-ext | SIL OFL 1.1 | Google Inc. (as shipped; the upstream release is Copyright Adobe) | none in the package's license file; upstream reserves "Source" |
| `fraunces/` | Fraunces | `@fontsource-variable/fraunces@5.3.0` | variable `wght` (100–900), latin + latin-ext | SIL OFL 1.1 | Copyright 2020 The Fraunces Project Authors (github.com/undercasetype/Fraunces) | none declared |
| `ibm-plex-mono/` | IBM Plex Mono | `@fontsource/ibm-plex-mono@5.3.0` | static 400 and 600, latin + latin-ext | SIL OFL 1.1 | Copyright 2017 IBM Corp. All rights reserved. | none in the package's license file; upstream reserves "Plex" |
| `atkinson-hyperlegible/` | Atkinson Hyperlegible | `@fontsource/atkinson-hyperlegible@5.3.0` | static 400 and 700, latin + latin-ext | SIL OFL 1.1 | Copyright 2020 Braille Institute of America, Inc. | none declared |
| `atkinson-hyperlegible-mono/` | Atkinson Hyperlegible Mono | `@fontsource-variable/atkinson-hyperlegible-mono@5.3.0` | variable `wght` (200–800), latin + latin-ext | SIL OFL 1.1 | Copyright 2020-2024 The Atkinson Hyperlegible Mono Project Authors (https://github.com/googlefonts/atkinson-hyperlegible-next-mono) | none declared |

## Precache budget

18 `woff2` files, 385,184 bytes (about 376 KiB) in total. The largest is
60,088 bytes, well under workbox's 2 MiB per-file limit. Per family: Source
Sans 3 88,960; Fraunces 70,204; IBM Plex Mono 58,004; JetBrains Mono 55,600;
Atkinson Hyperlegible 53,488; Figtree 30,436; Atkinson Hyperlegible Mono
28,492.

Glyphs outside the subsets (♯ ♭ ∆, most arrows) fall back to the system
stack glyph by glyph. That is why every `--font-*` token keeps its stack.
