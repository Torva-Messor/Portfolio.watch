# VOID / SYSTEMS — portfolio and interactive labs

A static portfolio site with an animated silk substrate, project instruments, a 3D mechanical-watch viewer, a browser-local Air/Ground inventory prototype, a date-driven historical analysis lab, and an integrated WebDOOM / PrBoom-derived WebAssembly build.

## Included

- Responsive portfolio sections, reduced-motion-aware silk rendering, keyboard-friendly navigation, and local asset paths.
- **Watch Lab:** two bundled CAD conversions (ETA 6497-1 and TMI NH35A), component selection, isolation, labels, camera modes, playback, speed, lighting, reset and explode controls. These are visual reconstructions, not manufacturing-ready CAD.
- **Product System:** a compact observation → test → evidence → decision feedback loop. Each action updates the diagram and state label; Reset restores the initial state.
- **Air/Ground Stores:** browser-local add/edit/remove, search, store filter, stock status, record counts and CSV export. Sample records are fictional. Persistence uses this browser profile's `localStorage` where available; records are not shared between visitors or devices.
- **Horology clock:** the analog hands and digital display use the visitor's device-local time and refresh after the tab becomes visible again.
- **DOCK OF DOOM:** the supplied WebDOOM / PrBoom-derived JavaScript + WebAssembly engine, a shareware episode data package, keyboard/focus handling, fullscreen control, loading/error UI, and return-to-portfolio control. This integration is designed to load from a GitHub Pages project subpath; its actual game initialization was **not verified in the automated browser environment used for this package**. See [TEST-REPORT.md](TEST-REPORT.md) and [the Doom notice](licenses/WEBDOOM-NOTICE.md).
- **Market Analysis:** an interactive historical chart with a date picker, a history slider, selected-observation marker, reference series, ζ-Field, analysis window, threshold and smoothing/memory controls, plus local CSV import.

## Market Analysis: provisional ζ-Field definition

The name **ζ-Field** is a project-specific indicator label. It is **not** the Riemann zeta function and is not a standard financial statistic. The bundled model is provisional and illustrative; it is not a validated trading signal.

Given a date-ordered reference series of values `P_t`:

1. For an all-positive series, compute the change `x_t = 100 × ln(P_t / P_(t−1))`, a percentage log-return. If any value is zero or negative, consistently use `x_t = P_t − P_(t−1)` in the source series' units instead.
2. With analysis window `w`, estimate `μ_t` and population standard deviation `σ_t` from the **previous `w` changes only**: `x_(t−w), …, x_(t−1)`. The current change is excluded from its own reference baseline.
3. When a complete window exists and `σ_t` is greater than a small numerical tolerance, compute `z_t = (x_t − μ_t) / σ_t`. Otherwise the standardized value is unavailable. A zero-variance baseline is reported explicitly.
4. Smooth the standardized surprise into the custom field: `ζ_t = (1 − λ) z_t + λ ζ_(t−1)`, where the **field memory** `λ` is constrained to `[0, 0.9]`. After unavailable history, the first valid observation seeds the field with `z_t`.
5. The configurable threshold only produces a displayed research flag; no trade is executed or recommended.

The default window is 20 prior changes; the UI allows 5–60. The threshold defaults to 1.5. Field memory defaults to 0.25. At least `w` prior changes are required before ζ can be calculated, so the first eligible observation is after the initial reference value plus `w` complete changes. Calculations are causal: changing future observations cannot change a previously calculated ζ-Field point.

The default monthly series from 2000–2024 is **synthetic demo data**, not real historical prices. CSV files are read in the browser and never uploaded. The first column is treated as date; numeric value columns after it can be selected. Parser support includes quoted CSV fields, comma/semicolon/tab separators, ISO dates, year-month dates, common European dates, and unambiguous US dates. European decimal-comma CSV generally uses semicolons between columns. Duplicate dates and invalid/missing dates are errors; missing or non-numeric values in the selected series are skipped with a count. Insufficient history and zero variance remain visibly unavailable rather than being filled with invented values.

## Doom data, technical constraints and licensing

`assets/doom/doom1.js` and `assets/doom/doom1.wasm` are the supplied browser runtime; `assets/doom/doom1.data.gz` contains the PrBoom support PWAD and DOOM shareware episode 1 WAD. Commercial DOOM II data and separate external soundtrack/effects packages were deliberately excluded. Use a current browser with WebAssembly, WebGL and the `DecompressionStream` gzip API, over HTTP(S), not `file://`. The first initialization loads the local engine package. No C# rewrite was made: retaining the existing browser-compatible WebAssembly engine avoids an unnecessary runtime, engine reimplementation and build dependency.

The WebDOOM project uses MIT-licensed wrapper code and includes PrBoom/DOOM source covered by GPL terms. Full upstream `LICENSE`, `COPYING`, source files and build metadata supplied in the original archive are preserved under `licenses/WebDOOM-source/`. See `licenses/WEBDOOM-NOTICE.md` and `THIRD-PARTY-NOTICES.md` before redistribution. The game WAD is separate from the engine; the shareware redistribution history is documented in the notice, but do not treat that note as blanket permission for every jurisdiction or commercial use. No commercial DOOM, DOOM II, TNT, Plutonia or Ultimate DOOM IWAD is included.

The original generated Emscripten engine glue has a small dated integration patch for the relative path and gzip preload wrapper. Its upstream provenance is retained rather than disguising the engine source. See the preserved corresponding source and licenses before making derivative changes.

## Run locally

No build step or backend is required. From this directory run:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/>. ES modules, WebAssembly and model loading should be tested via HTTP(S), not `file://`.

Three.js is pinned to `0.180.0` using a jsDelivr import map. The watch lab therefore needs network access to that CDN; the portfolio, market analysis, inventory, and bundled Doom runtime do not need a backend.

## Publish on GitHub Pages

1. Commit the contents of this folder to the repository root (or copy them into the configured `/docs` publish folder).
2. In **Settings → Pages**, select the branch and folder that contains `index.html`.
3. Keep the directory layout intact, particularly `assets/`, `css/`, `js/`, `models/`, and `licenses/`.
4. Wait for the Pages deployment, then verify the published project URL, including its repository subpath. Do not rewrite relative asset URLs to `/assets/...` or `/js/...`.
5. Check browser DevTools for network and WebAssembly errors. The actual Doom initialization remains a post-deployment smoke-check item; see `TEST-REPORT.md`.

## Verification

Requires Node.js 20+; no npm package install is required:

```bash
npm test
npm run verify
npm run check:syntax
```

- `npm test` runs the `node:test` suite for CSV handling, date parsing, missing/duplicate records, rolling-window boundaries, future-data exclusion, zero variance, memory smoothing, and runtime asset fingerprints.
- `npm run verify` runs static architecture, component, Watch Lab and instrument checks.
- `npm run check:syntax` checks project JavaScript plus Doom loader syntax.
- `npm run smoke:browser` is an optional real-browser harness for Market Analysis, Product System, Air/Ground and Doom initialization if Chromium is available and operational. In the packaging environment Chromium launched but policy blocked navigation to the local HTTP test page (`ERR_BLOCKED_BY_ADMINISTRATOR`), so the browser test was blocked rather than passed; see `TEST-REPORT.md`.

## Attribution and other boundaries

- Read `licenses/WEBDOOM-NOTICE.md`, `licenses/WebDOOM-source/LICENSE` and `licenses/WebDOOM-source/COPYING` before distributing the Doom integration.
- Read `data/MODEL-SOURCES.md` before redistributing the bundled CAD conversions; check upstream model rights before any public redistribution.
- The watch models are presentation assets. Do not treat their component names or nominal specifications as factory validation.
- The portfolio/video reference `1000123590.mp4` was not present with the uploaded ZIPs. `VIDEO-ANNOTATION-CHECKLIST.md` records which written requests were implemented and which video-specific marks/deletions remain unverified.
