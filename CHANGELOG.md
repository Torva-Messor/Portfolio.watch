# Changelog

## Portfolio integration — 2026-10-15

- Replaced the Doom placeholder with the supplied WebDOOM/PrBoom-derived JavaScript + WebAssembly engine, relative asset loading, compressed shareware data, startup/progress/error UI, keyboard focus, fullscreen and return-to-portfolio integration. Commercial DOOM II data and external soundtrack/effects packs are not included. Browser gameplay remains unverified because this environment blocks local browser navigation.
- Added interactive historical Market Analysis with date picker and slider, linked chart selection/metrics, reference series, custom provisional ζ-Field, model controls, synthetic demo observations and local CSV import/validation.
- Documented the causal rolling model, baseline window, units, smoothing parameter, degeneracy behavior and the fact that it is neither the Riemann zeta function nor a validated trading signal.
- Implemented Air/Ground local CRUD, search/filter, counts, low-stock status and CSV export with browser-local persistence messaging and fictional sample data.
- Kept the Product System's compact loop synchronized with state, iteration and reset actions; synchronized the watch dial and digital display from local time and refreshed on tab visibility changes.
- Added Node unit tests, project/source/asset checks, JavaScript syntax validation, an optional browser smoke harness, deployment instructions, attribution notices and a video-annotation checklist.
- Preserved third-party engine/source provenance and license notices rather than disguising or obfuscating upstream code. No C# rewrite was introduced because it would add a runtime/build burden without improving this browser integration.
- Video-only layout changes and X-marked deletions remain unverified: `1000123590.mp4` was not among the supplied files.
