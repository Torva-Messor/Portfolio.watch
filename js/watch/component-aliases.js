/**
 * Multilingual aliases for common watch-movement components.
 * Original CAD node names are never changed: aliases are used for recognition
 * and concise English display labels only.
 */
export const COMPONENT_ALIASES = Object.freeze({
  // Keep the most specific groups first in COMPONENT_ALIAS_ORDER below.
  movementAssembly: [
    'ml01 werk montiert einbaufertig',
    'werk montiert einbaufertig',
    'assembled movement',
    'movement assembly',
    'mouvement assemblé',
    'uhrwerk montiert'
  ],
  mainPlate: [
    'main plate', 'mainplate', 'base plate', 'baseplate', 'bottom plate',
    'grundplatine', 'hauptplatine', 'werkplatte', 'platine principale',
    'platine de base', 'platine de mouvement', 'platina base'
  ],
  wheelTrainBridge: [
    'wheel train bridge', 'train bridge', 'gear train bridge',
    'räderbrücke', 'raederbruecke', 'brücke räderwerk',
    'pont de rouage', 'pont du rouage'
  ],
  balanceBridge: [
    'balance bridge', 'balance cock', 'unruhbrücke', 'unruhbruecke',
    'balancierbrücke', 'pont de balancier', 'coq de balancier'
  ],
  barrelBridge: [
    'barrel bridge', 'federhausbrücke', 'federhausbruecke',
    'pont de barillet', 'barillet bridge'
  ],
  palletBridge: [
    'pallet bridge', 'ankerbrücke', 'ankerbruecke',
    'pont d ancre', 'pont d’ancre'
  ],
  minuteBridge: [
    'minute bridge', 'minutes bridge', 'minutenbrücke', 'minutenbruecke',
    'zeigerwerksbrücke', 'zeigerwerksbruecke', 'pont de minuterie'
  ],
  bridge: ['bridge', 'brücke', 'brucke', 'pont', 'puente'],
  balanceAssembly: [
    'balance assembly', 'balance complete', 'unruh montiert',
    'unruh montiert vorreguliert', 'balancier assemblé', 'balancier monte'
  ],
  balanceWheel: [
    'balance wheel', 'balance', 'unruhreif', 'unruhwelle', 'unruh',
    'balancier', 'balancier spiral', 'roue de balancier'
  ],
  palletFork: ['pallet fork', 'anker', 'ankerkörper', 'ankerkorper', 'ancre', 'fourchette'],
  escapeWheel: [
    'escape wheel', 'hemmungsrad', 'gangrad', 'gangrad niv20.5',
    'roue d échappement', 'roue d’échappement'
  ],
  barrel: ['barrel', 'mainspring barrel', 'federhaus', 'barillet'],
  mainspring: ['mainspring', 'zugfeder', 'spiral moteur', 'ressort moteur'],
  rotor: ['rotor', 'automatic rotor', 'schwungrotor', 'masse oscillante'],
  windingStem: ['winding stem', 'aufzugswelle', 'tige de remontoir'],
  windingBridge: ['winding bridge', 'aufzugsbrücke', 'aufzugsbruecke', 'pont de remontoir'],
  shockProtection: [
    'shock protection', 'shock indication', 'incabloc', 'stoßsicherung',
    'stossicherung', 'antichoc'
  ],
  settingLever: ['setting lever', 'zeigerstellhebel', 'winkelhebel', 'bascule'],
  ratchetWheel: ['ratchet wheel', 'sperrrad', 'rochet'],
  crownWheel: ['crown wheel', 'kronrad', 'roue de couronne'],
  click: ['click', 'sperrklinke', 'cliquet']
});

const COMPONENT_ALIAS_ORDER = [
  'movementAssembly', 'mainPlate', 'wheelTrainBridge', 'balanceBridge',
  'barrelBridge', 'palletBridge', 'minuteBridge', 'windingBridge',
  'shockProtection', 'balanceAssembly', 'balanceWheel', 'palletFork',
  'escapeWheel', 'mainspring', 'barrel', 'windingStem', 'ratchetWheel',
  'crownWheel', 'settingLever', 'click', 'rotor', 'bridge'
];

const ENGLISH_LABELS = Object.freeze({
  movementAssembly: 'Movement assembly',
  mainPlate: 'Main plate',
  wheelTrainBridge: 'Wheel-train bridge',
  balanceBridge: 'Balance bridge',
  barrelBridge: 'Barrel bridge',
  palletBridge: 'Pallet bridge',
  minuteBridge: 'Minute-work bridge',
  windingBridge: 'Winding bridge',
  bridge: 'Bridge',
  balanceAssembly: 'Balance assembly',
  balanceWheel: 'Balance wheel',
  palletFork: 'Pallet fork',
  escapeWheel: 'Escape wheel',
  barrel: 'Barrel',
  mainspring: 'Mainspring',
  rotor: 'Rotor',
  windingStem: 'Winding stem',
  shockProtection: 'Shock protection',
  settingLever: 'Setting lever',
  ratchetWheel: 'Ratchet wheel',
  crownWheel: 'Crown wheel',
  click: 'Click'
});

export function normalizeComponentName(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchesAlias(normalizedName, normalizedAlias) {
  if (!normalizedAlias) return false;
  // Match complete normalized phrases, not arbitrary substrings such as
  // "pont" inside an unrelated word. CAD names often have prefixes/suffixes.
  return normalizedName === normalizedAlias ||
    ` ${normalizedName} `.includes(` ${normalizedAlias} `);
}

export function componentMatches(value, aliasGroup) {
  const normalizedName = normalizeComponentName(value);
  const aliases = COMPONENT_ALIASES[aliasGroup] || [];
  return aliases.some(alias => matchesAlias(normalizedName, normalizeComponentName(alias)));
}

export function componentKeyForName(value) {
  for (const key of COMPONENT_ALIAS_ORDER) {
    if (componentMatches(value, key)) return key;
  }
  return null;
}

export function componentLabelForName(value) {
  const key = componentKeyForName(value);
  return key ? ENGLISH_LABELS[key] : String(value || 'Component');
}

export function componentDescriptionForName(value) {
  const key = componentKeyForName(value);
  const descriptions = {
    movementAssembly: 'Imported assembled movement CAD model.',
    mainPlate: 'Main supporting plate for the movement.',
    wheelTrainBridge: 'Bridge supporting parts of the gear train.',
    balanceBridge: 'Bridge supporting the balance assembly.',
    barrelBridge: 'Bridge supporting the mainspring barrel assembly.',
    palletBridge: 'Bridge supporting the pallet-fork assembly.',
    minuteBridge: 'Bridge supporting the minute-work components.',
    windingBridge: 'Bridge supporting winding components.',
    balanceAssembly: 'Balance assembly; original CAD component names are retained.',
    balanceWheel: 'Oscillating balance component of the regulating organ.',
    palletFork: 'Pallet fork in the escapement.',
    escapeWheel: 'Escape wheel in the escapement.',
    barrel: 'Mainspring barrel assembly.',
    mainspring: 'Mainspring that stores energy for the movement.',
    rotor: 'Automatic winding rotor.',
    windingStem: 'Stem used to wind or set the movement.',
    shockProtection: 'Shock-protection assembly around a jewel bearing.',
    settingLever: 'Lever associated with the hand-setting mechanism.',
    ratchetWheel: 'Ratchet wheel in the winding train.',
    crownWheel: 'Crown wheel in the winding train.',
    click: 'Click that restrains the ratchet wheel.'
  };
  return descriptions[key] || 'Imported ML01 CAD component. Original source name is retained.';
}
