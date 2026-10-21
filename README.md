
this is ai generated too lazy to write it


VOID / SYSTEMS

VOID / SYSTEMS is a personal portfolio built around interactive projects, technical experiments, and tools I've been working on. It combines a minimal interface with a few more complex features, including a 3D watch viewer, an inventory prototype, a historical data analysis tool, and a browser-based Doom port.

Projects

Watch Lab

An interactive 3D viewer for two mechanical watch movements: the ETA 6497-1 and TMI NH35A.

The viewer lets you inspect individual components, hide or isolate parts, toggle labels, change camera views, adjust lighting and playback speed, and use the explode and reset controls. The models are intended for visual exploration rather than manufacturing.

Product System

A small interactive system built around a simple feedback loop: observation, testing, evidence, and decision-making.

Each action updates the diagram and its current state. Reset restores the initial setup.

Air/Ground Stores

A browser-based inventory prototype for managing sample stock records.

Features include adding, editing and deleting records, searching, filtering by store, checking stock status, viewing record counts, and exporting data to CSV.

Records are stored in the browser's "localStorage" where available. They aren't shared between visitors or devices, and the included sample data is fictional.

Horology Clock

An analog clock paired with a digital display, both based on the visitor's local device time. The display refreshes when the browser tab becomes visible again.

Dock of Doom

A Doom port integrated directly into the portfolio using a WebAssembly runtime derived from WebDOOM and PrBoom.

The integration includes the game runtime, shareware episode data, loading and error screens, keyboard handling, fullscreen controls, and a way to return to the portfolio.

Game initialization still needs to be verified in a real browser. The current implementation requires WebAssembly, WebGL, gzip support through "DecompressionStream", and an HTTP or HTTPS environment. Opening the site directly through "file://" isn't supported.

Touchscreen controls also need separate consideration before the game can be considered fully playable on mobile.

Commercial Doom game data isn't included. See the licensing notes below before redistributing the project.

Market Analysis

An interactive chart for exploring historical data over time.

It includes date selection, a history slider, a selected-observation marker, a reference series, the custom ζ-Field indicator, configurable analysis windows and thresholds, smoothing controls, and CSV import.

The default monthly dataset covering 2000–2024 is synthetic demo data, not real historical market data.

About the ζ-Field

The ζ-Field is a custom indicator developed for this project to experiment with historical data. It isn't the Riemann zeta function, a standard financial statistic, or a validated trading signal.

The calculation compares each new change against a rolling window of previous changes, standardizes the result against that history, and smooths it using a configurable memory value.

The calculation follows these steps:

1. For an entirely positive series, calculate percentage log returns: "x_t = 100 × ln(P_t / P_(t−1))". If the series contains zero or negative values, use absolute changes instead: "x_t = P_t − P_(t−1)".
2. Calculate the mean and population standard deviation using only the previous "w" changes. The current observation is excluded from its own baseline.
3. Standardize the current change against that baseline when sufficient history is available and the standard deviation is above a small numerical tolerance.
4. Smooth the standardized value using "ζ_t = (1 − λ) z_t + λ ζ_(t−1)".
5. Display a research flag when the result crosses the configured threshold. The flag is informational and doesn't execute trades or provide trading recommendations.

The default window is 20 previous changes, with a configurable range of 5–60. The default threshold is 1.5, and the default field memory is 0.25. Memory is limited to the range 0–0.9.

The indicator needs a complete history window before it can calculate a value. If the history is insufficient or the baseline has zero variance, the result remains unavailable rather than being filled with an invented value. After an unavailable period, the first valid observation initializes the smoothed field.

The calculations are causal: future observations don't affect previously calculated ζ-Field values.

CSV import

CSV files are processed locally in the browser and aren't uploaded to a server.

The parser supports quoted fields, comma-, semicolon-, and tab-separated files, ISO dates, year-month dates, common European dates, and unambiguous US dates. The first column is treated as the date, and numeric columns after it can be selected for analysis.

Duplicate dates and invalid or missing dates are rejected. Missing or non-numeric values in the selected series are skipped and counted. European decimal-comma files generally need semicolons as column separators.

Running locally

No build step or backend is required.

You'll need Python installed. From the project directory, run:

python -m http.server 8000

Then open "http://localhost:8000/" (http://localhost:8000/) in your browser.

Use a local HTTP server instead of opening "index.html" directly. This is important for ES modules, WebAssembly, and model loading.

The Watch Lab uses Three.js "0.180.0" through a jsDelivr import map, so that feature requires an internet connection. The portfolio, inventory, market analysis, and bundled Doom runtime don't require a backend.

Publishing with GitHub Pages

1. Commit the project files to the repository root, or to the configured "docs" publishing directory.
2. Open Settings → Pages and select the branch and folder containing "index.html".
3. Keep the directory structure intact, including "assets/", "css/", "js/", "models/", and "licenses/".
4. Wait for the deployment to finish, then open the published project URL.
5. Test the main features and check the browser console for missing assets, WebAssembly errors, and other loading issues.

Keep asset paths relative. Paths such as "/assets/" or "/js/" can break when the site is published under a GitHub Pages repository subpath.

A successful deployment doesn't guarantee that Doom initializes correctly. Test the game separately after publishing.

Running the checks

The project uses Node.js 20 or newer. The existing checks don't require an npm package installation.

npm test
npm run verify
npm run check:syntax

- "npm test" runs the automated tests for CSV handling, date parsing, missing and duplicate records, rolling-window calculations, future-data exclusion, zero variance, smoothing, and runtime asset fingerprints.
- "npm run verify" checks the project structure and the main interface components, including the Watch Lab and interactive instruments.
- "npm run check:syntax" checks the JavaScript files for syntax errors.

These checks help catch code and integration problems, but they don't replace testing in a real browser. Doom's startup and rendering still need to be verified on desktop and mobile.

Licensing and third-party code

The Doom integration uses MIT-licensed WebDOOM wrapper code and includes PrBoom/Doom source covered by GPL terms.

The upstream source files, licenses, and build metadata supplied with the project are preserved under "licenses/WebDOOM-source/".

Before redistributing the project, review:

- "licenses/WEBDOOM-NOTICE.md"
- "THIRD-PARTY-NOTICES.md"
- The original license files under "licenses/WebDOOM-source/"

The included game data contains the shareware episode 1 WAD and the required PrBoom support data. Commercial Doom, Doom II, TNT, Plutonia, and Ultimate Doom data are not included.

The shareware redistribution history described in the project notices shouldn't be treated as blanket permission for every jurisdiction or commercial use.

Notes

This project brings together several different experiments in one portfolio, so individual features have different levels of completeness. In particular, the Doom integration still needs real-browser testing, and the 3D watch models are visual reconstructions rather than manufacturing-ready CAD.

The goal is to keep the site self-contained where possible, make the interactive parts easy to explore, and document the limitations instead of hiding them.
