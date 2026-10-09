# VOID / SYSTEMS

An experimental portfolio site with an animated silk substrate, distinct project labs, and a local 3D watch-movement inspector.

## What is included

- Silk surface with a WebGL shader and a moving 2D satin-wave fallback. Both run independently of scroll, respond gently to pointer/scroll input and respect reduced-motion preferences.
- Separate role environments and project case studies.
- A single responsive Three.js Watch Lab with two selectable bundled CAD conversions: ETA 6497-1 and Seiko/TMI NH35A. Unbundled procedural study entries have been removed from the selector.
- Watch controls for play/pause, speed, lighting, component selection, labels, isolate, perspective/orthographic views, reset and an exploded assembly slider.
- One in-site Watch Lab entry point, available from the hero, Horology section, navigation menu, and direct `#watch-lab` URL. Desktop uses the selector rail; mobile uses a native dropdown. Movement selection, inspection, labels, isolation and explosion stay in that single panel; no separate dead inspector page remains.

## Accuracy notes

The two selectable models are imported CAD reconstructions, not manufacturing-ready or factory-verified assets. Component names and presentation finishes may be provisional. Caliber specifications are sourced from manufacturer documentation where available. The `data/MODEL-SOURCES.md` guide describes the bundled assets and relevant license checks.

The supplied ETA 6497-1 assembly loads automatically when Watch Lab opens; the NH35A conversion is also bundled locally. The ETA GLB has separately named part objects sourced from the STEP assembly and presentation finishes for rhodium/steel, brass/gold and ruby-bearing assemblies. The winding stem is shortened in this visual edition so it does not dominate the viewport; use the original STEP file for source geometry. These models are visual references, not manufacturing CAD, and source redistribution terms should be verified before public deployment.

The explode system expands every selectable component centroid proportionally away from the movement centre in 3D space, preserving the source assembly's relative directions and spacing ratios while increasing their distances. Concentric components receive a small deterministic 3D offset so they remain inspectable rather than overlapping. Components retain their orientation; parent-local translation handles nested GLTF transforms. Camera framing reserves space for the full exploded spread.

## Run locally

Serve this folder over HTTP (ES modules and model loading should not be opened through `file://`):

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000/>. Three.js is pinned to version `0.180.0` from jsDelivr and mapped via an import map so add-on modules can resolve the `three` package in browsers.

## Credits and licenses

The ETA 6497-1 converted model is bundled from the file supplied by the site owner; verify the upstream creator’s license/redistribution terms before public redistribution. Read `data/MODEL-SOURCES.md` before reusing external models or code.

## Verification

Run the local checks with Node.js:

```bash
node tools/verify-project.mjs
find js -name '*.js' -print0 | xargs -0 -n1 node --check
```

These checks cover shader precision and edge coverage, liquid-satin shader/fallback behavior, bundled model assets, proportional 3D explode offsets, inspector selection, the bundled movement selector, animation wiring, and control paths. They do not validate the generated geometry against factory drawings.
