# WebDOOM / PrBoom notices and data scope

## Engine and wrapper

This portfolio integrates the supplied [WebDOOM](https://github.com/UstymUkhman/WebDOOM) project by Ustym Ukhman, which is based on the PrBoom DOOM source port. The supplied archive includes both a `LICENSE` (MIT, for WebDOOM-specific project code) and `COPYING` (GNU GPL version 2 for covered PrBoom/DOOM engine source). Their full original texts are preserved under [`WebDOOM-source/`](./WebDOOM-source/).

The upstream Emscripten-generated `doom1.js` glue is retained with a dated integration patch. It has **not** been rewritten to disguise its provenance. The patch loads runtime files relative to the embedded page and expands the compressed data package in the browser. The supplied `doom1.wasm` is included unchanged. Corresponding PrBoom source and the upstream build/configuration files are included in `WebDOOM-source/`.

## Game data

Only the DOOM shareware episode 1 data (`doom1.wad`) and the PrBoom support PWAD are included, inside `assets/doom/doom1.data.gz`. The compressed payload is a reduced subset of the user-supplied `doom1.data` package. The external music/SFX packs and the commercial `doom2.wad` package have been excluded. This is **not** a blanket assertion that every asset from the original WebDOOM distribution is freely redistributable.

The shareware WAD is separate from the GPL engine. An archived clarification attributed to id Software's John Carmack describes the DOOM shareware WAD as freely distributable; see the historical record in [Debian's `doom-wad-shareware` copyright notice](https://sources.debian.org/src/doom-wad-shareware/1.9.fixed-4/debian/copyright/). The original shareware license language has been debated and includes limits on commercial exploitation, so verify the licensing terms against your intended use and jurisdiction before treating it as legal advice. This project does not include commercial DOOM, DOOM II, TNT, Plutonia, or Ultimate DOOM IWADs.

## Other credits

- id Software — original DOOM game and engine authorship.
- PrBoom contributors — source-port engine; see `WebDOOM-source/AUTHORS` and `WebDOOM-source/COPYING`.
- Ustym Ukhman — WebDOOM wrapper/project code; see `WebDOOM-source/LICENSE`.

The source project and assets are provided as-is without warranty. See the preserved upstream licenses for their exact terms.
