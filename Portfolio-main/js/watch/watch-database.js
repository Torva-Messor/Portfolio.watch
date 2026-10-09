export const CALIBERS = {
  'eta-6497-1': {
    manufacturer: 'ETA / Unitas',
    caliber: '6497-1',
    family: '6497',
    type: 'Manual winding',
    diameter: '36.60 mm',
    thickness: '4.50 mm',
    beatRate: '18,000 A/h · 2.5 Hz',
    jewels: '17',
    powerReserve: 'Typical 52 h (46 h minimum)',
    winding: 'Manual',
    complications: 'Small seconds at 9 o’clock',
    model: 'Imported STEP-to-GLB CAD reconstruction',
    source: 'ETA technical data: https://portal.eta.ch/en/mecaline/6497-1-6497-1-5.html',
    license: 'The bundled mesh is a converted community CAD reconstruction, not a factory-issued part catalogue. Confirm source redistribution terms before public release.'
  },
  'seiko-nh35': {
    manufacturer: 'Seiko Instruments / TMI',
    caliber: 'NH35A',
    family: 'NH series',
    type: 'Automatic · bidirectional winding, hand-windable',
    diameter: '27.40 mm (outside) · 29.36 mm casing',
    thickness: '5.32 mm',
    beatRate: '21,600 A/h · 3 Hz',
    jewels: '24',
    powerReserve: 'More than 41 h',
    winding: 'Automatic and manual; hacking seconds',
    complications: 'Central seconds and date; these are reference specs, not simulated',
    model: 'Community STEP reconstruction; 13 separately selectable solid bodies',
    source: 'TMI official NH series: https://www.timemodule.com/en/product_line_up/mechanical/mechanical/mechanical_NH0_NH3/',
    license: 'The bundled mesh came from the user-supplied Marathon OS STEP file; labels and material finishes are provisional. Confirm source redistribution terms before public release.'
  }
};
