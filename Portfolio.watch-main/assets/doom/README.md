# WebDOOM integration

This directory contains the supplied WebDOOM / PrBoom-derived browser runtime, integrated into the portfolio as a same-origin iframe.

- `doom1.js` — upstream-generated Emscripten/JavaScript glue with a small, documented integration patch for relative paths and compressed data.
- `doom1.wasm` — the supplied WebAssembly engine build.
- `doom1.data.gz` — a gzip-compressed data package containing `prboom.wad` and the DOOM shareware episode 1 `doom1.wad` only. Separate MP3 soundtrack/SFX files and commercial DOOM II data were deliberately excluded.
- `index.html`, `index.js`, `index.css` — accessible loader/control UI, focus-aware keyboard behavior, fullscreen, status reporting, and a return-to-portfolio message.

Start the game from the overlay. Keyboard focus is transferred to the game canvas after initialization; Escape releases pointer lock in the browser. Use **RETURN TO PORTFOLIO** to close the portfolio instrument. The game may run without the externally sourced soundtrack and sound-effect pack that accompanied the original WebDOOM archive.

The runtime loads files relative to this directory. It does not assume the origin-root path `/`, so it can be deployed under a GitHub Pages project path. Serve the site over HTTP(S), not `file://`.

License and attribution details are in [`../../licenses/WEBDOOM-NOTICE.md`](../../licenses/WEBDOOM-NOTICE.md) and [`../../licenses/WebDOOM-source/`](../../licenses/WebDOOM-source/). The engine is not a C# rewrite; preserving the existing browser-compatible WebAssembly port avoids a new runtime and build dependency.
