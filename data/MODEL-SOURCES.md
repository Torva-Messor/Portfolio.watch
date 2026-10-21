# Watch models, calibers and provenance

## Bundled visual models

- **ETA 6497-1** — `models/ETA-6497-1-Movement-Gold-Jewels.glb` is a web-display conversion from the ETA 6497-1 STEP reconstruction supplied by the site owner. It preserves separately selectable mesh instances and uses stylized brass/gold, steel/rhodium and ruby accents. Component labels reflect the source CAD, not a factory-issued part catalogue. Verify the source creator's redistribution terms before publishing the converted asset.
- **Seiko / TMI NH35A** — `models/Seiko-NH35-Movement.glb` is a web-display conversion of the NH35 STEP file supplied by the site owner from Marathon OS. It includes 13 separately selectable solid bodies. The imported source did not provide verified component labels, so names are neutral body-index descriptors rather than invented part names. The source listing warns that the model may not be fully accurate or production-ready. Verify the current source terms before publishing.
## Reference specifications

- **ETA / Unitas 6497-1** — 36.60 mm casing diameter, 4.50 mm movement height, manual winding, 18,000 alternations/hour (2.5 Hz full balance oscillations; 5 beats/s), 17 jewels, typical 52-hour reserve. Official source: <https://portal.eta.ch/en/mecaline/6497-1-6497-1-5.html>.
- **ETA / Unitas 6498-1** — same published diameter, height, rate and jewel count as the 6497-1, but the small-seconds placement/case orientation differs. Typical 52-hour reserve. Official source: <https://portal.eta.ch/en/mecaline/6498-1-6498-1-5.html>.
- **ETA 2824-2** — 25.60 mm diameter, 4.60 mm height, automatic winding, 28,800 vibrations/hour (4 Hz), 25 jewels, typical 42-hour reserve. Official source: <https://portal.eta.ch/en/2824-2-2824-2-5.html>.
- **Seiko/TMI NH35A** — 27.40 mm outside diameter, 29.36 mm casing diameter with spacer, 5.32 mm height, 21,600 vibrations/hour (3 Hz), 24 jewels, and more than 41 hours reserve. Manufacturer source: <https://www.timemodule.com/en/product_line_up/mechanical/mechanical/mechanical_NH0_NH3/>.

## Important limitations

The website is a visual CAD inspector, not a manufacturing CAD tool. Nominal caliber specifications come from manufacturer sources where linked. Imported STEP conversions preserve available source solids but do not infer missing engineering metadata. Presentation materials are not claims about original plating or jewel setting. The inspector can select and explode only objects already separate in the GLB; it cannot reconstruct missing part boundaries from a merged mesh.

