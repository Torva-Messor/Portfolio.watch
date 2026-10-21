# Implementation checklist / video annotations

**Reference limitation:** `1000123590.mp4` was named in the task but was not present among the accessible supplied files. The checklist below covers the explicit written requirements and relevant existing project review notes. Video-only annotations, every marked `X`, and visual comparison against the recording remain unverified until the video itself is supplied.

| Requirement | Status | Implementation / evidence |
|---|---|---|
| Inspect the complete annotated video and enumerate every marker | BLOCKED | Video file absent from the available uploads; no claim is made that its annotations were reviewed. |
| Treat every marked `X` as a deletion | UNVERIFIED | Cannot identify video-only `X` marks without the recording. Existing retired inspector code remains absent. |
| Preserve the quiet, minimal portfolio identity and existing sections | IMPLEMENTED FROM SOURCE | Existing site typography, palette, nav, case-study shell, 3D Watch Lab and local asset conventions retained. |
| Product System diagram compactness, iteration control, reset, state synchronization | IMPLEMENTED | Iteration/run/reset handlers update state text, loop dot, active node and iteration count. |
| Air/Ground local demonstration | IMPLEMENTED | Add, edit, remove, search, store filter, visible and low/empty counts, status tags, CSV export, local persistence with session-only fallback. Sample rows remain identified as fictional. |
| Watch dial and digital local time | IMPLEMENTED | The dial and digital time derive from the visitor's device-local `Date`; visibility return refreshes the clock immediately. |
| Interactive historical Market Analysis | IMPLEMENTED | Date picker, observation slider, selected-date marker, reference series, ζ-Field series, analysis window, threshold and damping controls. |
| ζ-Field mathematical definition and caveat | IMPLEMENTED | Provisional, documented causal model in `js/quant-analysis.js`; explicitly distinguished from the Riemann zeta function and labelled illustrative. |
| CSV handling and validation | IMPLEMENTED | Quoted CSV, escaped quotes, BOM, CRLF, comma/semicolon/tab delimiters, European decimal comma, common dates, duplicate/invalid dates, missing values, insufficient history and zero variance handled. |
| Actual WebDOOM runtime (not a fake game) | INTEGRATED; RUNTIME NOT VERIFIED | Supplied Emscripten JS/WASM runtime and reduced shareware data subset wired into the Doom instrument; commercial DOOM II data omitted. Static archive checks pass; actual game initialization remains unverified because browser navigation was blocked. |
| Doom loading/errors, focus, fullscreen, return to portfolio, subpath paths | IMPLEMENTED IN SOURCE; BROWSER CHECK BLOCKED | Local status/progress and error UI; native fullscreen where available; keyboard focus; return-to-portfolio message; relative paths. Actual control behavior remains untested in a browser. |
| C# rewrite | NOT USED | Existing WebAssembly engine is technically the better fit; a C# runtime would add complexity without a benefit for the requested integration. |
| Setup / GitHub Pages | IMPLEMENTED | See `README.md`; relative assets and no mandatory server-side backend. |
| Other video-only text, spacing, deletion or layout changes | UNVERIFIED | Cannot validate or invent changes not available in the supplied source or written instructions. |
