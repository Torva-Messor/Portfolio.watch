import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const TAU = Math.PI * 2;
const EXPLODE_SPREAD_FACTOR = 2.25;
const PRESSURE_ANGLE = 20 * Math.PI / 180;
const COLORS = {
  steel: 0x555650,
  polishedSteel: 0x99958b,
  brass: 0xb1955f,
  darkSteel: 0x32332f,
  plate: 0xc5c0b5,
  ruby: 0x873e48,
  paper: 0xf4f1ea,
  black: 0x222320
};

function metal(color, roughness = 0.3, metalness = 0.82) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function involute(angle) {
  return Math.tan(angle) - angle;
}

function gearGeometry(teeth, module, thickness = 0.09) {
  const pitchRadius = teeth * module / 2;
  const baseRadius = pitchRadius * Math.cos(PRESSURE_ANGLE);
  const tipRadius = pitchRadius + module;
  const rootRadius = Math.max(module * 0.35, pitchRadius - 1.25 * module);
  const toothPitch = TAU / teeth;
  const baseHalfWidth = Math.PI / (2 * teeth) + involute(PRESSURE_ANGLE);

  const halfWidth = radius => {
    if (radius <= baseRadius) return baseHalfWidth;
    const pressure = Math.acos(THREE.MathUtils.clamp(baseRadius / radius, -1, 1));
    return Math.PI / (2 * teeth) + involute(PRESSURE_ANGLE) - involute(pressure);
  };
  const shape = new THREE.Shape();
  let firstPoint = true;
  const point = (radius, angle) => {
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (firstPoint) {
      shape.moveTo(x, y);
      firstPoint = false;
    } else {
      shape.lineTo(x, y);
    }
  };

  for (let tooth = 0; tooth < teeth; tooth++) {
    const center = tooth * toothPitch;
    point(rootRadius, center - toothPitch * 0.42);
    point(baseRadius, center - halfWidth(baseRadius));

    for (let step = 1; step <= 7; step++) {
      const radius = baseRadius + (tipRadius - baseRadius) * step / 7;
      point(radius, center - halfWidth(radius));
    }

    const tipHalfWidth = halfWidth(tipRadius);
    for (let step = 1; step <= 4; step++) {
      const angle = center - tipHalfWidth + tipHalfWidth * 2 * step / 4;
      point(tipRadius, angle);
    }

    for (let step = 6; step >= 0; step--) {
      const radius = baseRadius + (tipRadius - baseRadius) * step / 7;
      point(radius, center + halfWidth(radius));
    }
    point(rootRadius, center + toothPitch * 0.42);
  }

  if (teeth >= 24) {
    const arborHole = new THREE.Path();
    arborHole.absarc(0, 0, Math.max(module * 0.7, pitchRadius * 0.105), 0, TAU, true);
    shape.holes.push(arborHole);

    const windowRadius = Math.min(module * 2.0, pitchRadius * 0.14);
    for (let window = 0; window < 4; window++) {
      const angle = window * TAU / 4 + Math.PI / 4;
      const hole = new THREE.Path();
      hole.absarc(
        Math.cos(angle) * pitchRadius * 0.52,
        Math.sin(angle) * pitchRadius * 0.52,
        windowRadius,
        0,
        TAU,
        true
      );
      shape.holes.push(hole);
    }
  }

  shape.closePath();
  const bevel = Math.min(module * 0.1, thickness * 0.12);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 2,
    steps: 1
  });
  geometry.translate(0, 0, -thickness / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function gearMesh(teeth, module, thickness, material, z, phase = 0) {
  const mesh = new THREE.Mesh(gearGeometry(teeth, module, thickness), material);
  mesh.position.z = z;
  mesh.rotation.z = phase;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const pitchRadius = teeth * module / 2;
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(Math.max(module * 1.15, pitchRadius * 0.12), Math.max(module * 1.15, pitchRadius * 0.12), thickness * 1.5, 24),
    material
  );
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0;
  mesh.add(hub);
  return mesh;
}

function meshPhase(centerA, centerB, teethA, teethB, phaseA = 0) {
  const direction = Math.atan2(centerB.y - centerA.y, centerB.x - centerA.x);
  const pitchA = TAU / teethA;
  const pitchB = TAU / teethB;
  let remainder = (direction - phaseA) % pitchA;
  if (remainder < 0) remainder += pitchA;
  return direction + Math.PI - pitchB / 2 + (teethA / teethB) * remainder;
}

function roundedBeam(length, radius, material, z = 0) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 5, 10), material);
  mesh.position.z = z;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}


// Split the CAD main plate into independently selectable sectors for exploded inspection.
// This is a presentation split of the imported mesh, not a claim that the factory plate
// is manufactured as four pieces. Original triangle surfaces/material finish are retained.
function splitMainPlateMesh(mesh, sectionCount = 4) {
  if (!mesh?.isMesh || !mesh.geometry?.attributes?.position || !mesh.parent) return [];
  const geometry = mesh.geometry;
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  const position = geometry.attributes.position;
  const indexArray = geometry.index ? geometry.index.array : null;
  const vertexCount = indexArray ? indexArray.length : position.count;
  const triangles = Array.from({ length: sectionCount }, () => []);
  const sectorWidth = TAU / sectionCount;

  for (let offset = 0; offset + 2 < vertexCount; offset += 3) {
    const ids = indexArray
      ? [indexArray[offset], indexArray[offset + 1], indexArray[offset + 2]]
      : [offset, offset + 1, offset + 2];
    const cx = (position.getX(ids[0]) + position.getX(ids[1]) + position.getX(ids[2])) / 3 - center.x;
    const cy = (position.getY(ids[0]) + position.getY(ids[1]) + position.getY(ids[2])) / 3 - center.y;
    let angle = Math.atan2(cy, cx);
    if (angle < 0) angle += TAU;
    triangles[Math.min(sectionCount - 1, Math.floor(angle / sectorWidth))].push(...ids);
  }

  const parent = mesh.parent;
  const sourceName = mesh.name || 'MAIN PLATE';
  const pieces = [];
  triangles.forEach((ids, sectionIndex) => {
    if (ids.length < 3) return;
    const pieceGeometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      if (!attribute?.array || attribute.isInterleavedBufferAttribute) continue;
      const ArrayType = attribute.array.constructor;
      const values = new ArrayType(ids.length * attribute.itemSize);
      for (let i = 0; i < ids.length; i++) {
        const sourceIndex = ids[i] * attribute.itemSize;
        const targetIndex = i * attribute.itemSize;
        for (let component = 0; component < attribute.itemSize; component++) {
          values[targetIndex + component] = attribute.array[sourceIndex + component];
        }
      }
      pieceGeometry.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized));
    }
    pieceGeometry.computeBoundingSphere();
    const piece = mesh.clone(false);
    piece.geometry = pieceGeometry;
    // Preserve the imported finish while keeping the split mesh straightforward to render.
    if (Array.isArray(mesh.material)) piece.material = mesh.material[0];
    piece.name = `${sourceName} / SECTION ${sectionIndex + 1}`;
    piece.userData = { ...mesh.userData, plateSection: sectionIndex + 1, part: piece.name };
    parent.add(piece);
    pieces.push(piece);
  });

  if (pieces.length > 1) {
    parent.remove(mesh);
  } else {
    pieces.forEach(piece => {
      piece.geometry.dispose();
      parent.remove(piece);
    });
    return [];
  }
  return pieces;
}

export class WatchViewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.wrap = canvas.parentElement;
    this.labelLayer = document.querySelector('#watch-label-layer');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.paper);

    this.perspectiveCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.perspectiveCamera.position.set(0, 0, 11.8);
    this.orthoCamera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
    this.orthoCamera.position.set(0, 0, 11.8);
    this.camera = this.perspectiveCamera;
    this.usingOrtho = false;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.enablePan = false;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 22;
    this.controls.target.set(0, 0, 0);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.ambient = new THREE.HemisphereLight(0xfaf8f2, 0x77746d, 1.75);
    this.scene.add(this.ambient);
    this.key = new THREE.DirectionalLight(0xffffff, 3.0);
    this.key.position.set(-4, 5, 9);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.key);
    this.rim = new THREE.DirectionalLight(0xe2d7c6, 1.45);
    this.rim.position.set(5, -2, 5);
    this.scene.add(this.rim);

    this.clock = new THREE.Clock();
    this.playing = true;
    this.speed = 1;
    this.explode = 0;
    this.light = 1;
    this.labels = false;
    this.isolate = false;
    this.selected = null;
    this.modelType = 'eta-6497-1';
    this.model = null;
    this.mixer = null;
    this.parts = [];
    this.labelsByPart = new Map();
    this.simTime = 0;
    this._beatIndex = -1;
    this._frame = 0;
    this._active = false;
    this._modelRequestId = 0;
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._resize = () => this.resize();
    this._onClick = event => this.pick(event.clientX, event.clientY);

    addEventListener('resize', this._resize, { passive: true });
    canvas.addEventListener('click', this._onClick);
    // Start empty while the selected bundled CAD model loads; do not flash a procedural study scene.
    this.resize();
  }

  addPart(name, position, explodeVector, description = '') {
    const part = new THREE.Group();
    part.name = name;
    part.position.set(position.x, position.y, position.z || 0);
    part.userData.part = name;
    part.userData.description = description || this.describePart(name);
    part.userData.explodeVector = new THREE.Vector3(explodeVector.x, explodeVector.y, explodeVector.z);
    part.userData.basePosition = part.position.clone();
    part.userData.originalVisible = true;
    this.root.add(part);
    this.parts.push(part);
    return part;
  }

  addJewel(name, position, size = 0.075) {
    const part = this.addPart(name, position, { x: position.x * 0.22, y: position.y * 0.22, z: 0.5 }, 'Ruby jewel bearing used to support a rotating arbor.');
    const stone = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 10), this.materials.ruby);
    stone.scale.z = 0.34;
    stone.position.z = 0.94;
    stone.castShadow = true;
    part.add(stone);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(size * 1.5, size * 1.5, 0.035, 24), this.materials.polishedSteel);
    seat.rotation.x = Math.PI / 2;
    seat.position.z = 0.91;
    part.add(seat);
    return part;
  }

  _buildProcedural(key) {
    this._clearModel();
    this.modelType = key;
    this.simTime = 0;
    this._beatIndex = -1;
    this.explode = 0;
    this.selected = null;
    this.isolate = false;
    this.materials = {
      steel: metal(COLORS.steel, 0.27, 0.88),
      polishedSteel: metal(COLORS.polishedSteel, 0.2, 0.9),
      brass: metal(COLORS.brass, 0.23, 0.9),
      dark: metal(COLORS.darkSteel, 0.31, 0.84),
      plate: metal(COLORS.plate, 0.38, 0.68),
      ruby: new THREE.MeshStandardMaterial({ color: COLORS.ruby, roughness: 0.15, metalness: 0.26, clearcoat: 0.8 })
    };

    const is2824 = key === 'eta-2824-2';
    const is6498 = key === 'eta-6498-1';
    const isEscapement = key === 'swiss-lever';
    const isDoubleTourbillon = key === 'double-tourbillon';
    const isTourbillon = key === 'tourbillon' || isDoubleTourbillon;
    const isMinuteRepeater = key === 'minute-repeater';
    const scale = is2824 ? 0.84 : isEscapement ? 1.05 : isTourbillon ? 0.94 : isMinuteRepeater ? 0.96 : 1;
    const turn = is6498 ? Math.PI / 2 : 0;
    const layoutPoint = (x, y) => {
      const point = new THREE.Vector2(x, y).multiplyScalar(scale).rotateAround(new THREE.Vector2(), turn);
      return { x: point.x, y: point.y, z: 0 };
    };
    const gearPosition = {
      barrel: layoutPoint(0.93, 0),
      center: layoutPoint(0, 0),
      third: layoutPoint(-0.85, 0),
      fourth: layoutPoint(-1.6015, -0.250023498895604),
      escape: layoutPoint(-2.252, -0.8426867675397811),
      balance: layoutPoint(-0.72, -1.15),
      pallet: layoutPoint(-1.58, -1.04)
    };

    const plate = this.addPart('MAIN PLATE', { x: 0, y: 0, z: -0.22 }, { x: 0, y: 0, z: -1.25 }, 'Main structural plate supporting the movement arbors and bridges.');
    const plateBody = new THREE.Mesh(new THREE.CylinderGeometry(3.02 * scale, 3.02 * scale, 0.24, 112), this.materials.plate);
    plateBody.rotation.x = Math.PI / 2;
    plateBody.castShadow = true;
    plateBody.receiveShadow = true;
    plate.add(plateBody);
    const plateRim = new THREE.Mesh(new THREE.TorusGeometry(2.95 * scale, 0.025, 8, 128), this.materials.polishedSteel);
    plateRim.position.z = 0.14;
    plate.add(plateRim);

    const barrelWheel = this.addPart('BARREL WHEEL', gearPosition.barrel, { x: 0.38, y: 0.1, z: 0.72 }, 'Barrel wheel driven by the mainspring barrel. Its tooth count sets the first train ratio.');
    barrelWheel.add(gearMesh(54, 0.03 * scale, 0.105, this.materials.brass, 0.12, 0));
    const barrelDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.48 * scale, 0.48 * scale, 0.12, 48), this.materials.brass);
    barrelDrum.rotation.x = Math.PI / 2;
    barrelDrum.position.z = 0.12;
    barrelWheel.add(barrelDrum);
    const springPoints = [];
    for (let step = 0; step <= 220; step++) {
      const u = step / 220;
      const angle = u * TAU * 3.8;
      const radius = (0.08 + u * 0.34) * scale;
      springPoints.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.205));
    }
    const mainspring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPoints), 220, 0.018 * scale, 5, false), this.materials.dark);
    barrelWheel.add(mainspring);

    const pairPhases = {
      centerPinion: meshPhase(gearPosition.barrel, gearPosition.center, 54, 8),
      thirdPinion: meshPhase(gearPosition.center, gearPosition.third, 60, 8),
      fourthPinion: meshPhase(gearPosition.third, gearPosition.fourth, 64, 8),
      escapePinion: meshPhase(gearPosition.fourth, gearPosition.escape, 80, 8)
    };

    const centerWheel = this.addPart('CENTER WHEEL / PINION', gearPosition.center, { x: 0.05, y: -0.12, z: 0.78 }, 'Compound arbor: the small pinion meshes with the barrel wheel while the center wheel drives the third wheel.');
    centerWheel.add(gearMesh(8, 0.03 * scale, 0.095, this.materials.steel, 0.12, pairPhases.centerPinion));
    centerWheel.add(gearMesh(60, 0.025 * scale, 0.105, this.materials.brass, 0.29, 0));
    const centerPin = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * scale, 0.045 * scale, 0.48, 16), this.materials.polishedSteel);
    centerPin.rotation.x = Math.PI / 2;
    centerPin.position.z = 0.28;
    centerWheel.add(centerPin);

    const thirdWheel = this.addPart('THIRD WHEEL / PINION', gearPosition.third, { x: -0.15, y: 0.1, z: 0.86 }, 'Compound arbor linking the center wheel to the fourth wheel.');
    thirdWheel.add(gearMesh(8, 0.025 * scale, 0.095, this.materials.steel, 0.29, pairPhases.thirdPinion));
    thirdWheel.add(gearMesh(64, 0.022 * scale, 0.105, this.materials.brass, 0.46, 0));
    const fourthWheel = this.addPart('FOURTH WHEEL / PINION', gearPosition.fourth, { x: -0.3, y: -0.13, z: 0.96 }, 'Fourth wheel arbor. The display model is geared for one revolution per minute at the nominal 6497 beat rate.');
    fourthWheel.add(gearMesh(8, 0.022 * scale, 0.095, this.materials.steel, 0.46, pairPhases.fourthPinion));
    fourthWheel.add(gearMesh(80, 0.02 * scale, 0.11, this.materials.brass, 0.63, 0));

    const escapeWheel = this.addPart('ESCAPE WHEEL / PINION', gearPosition.escape, { x: -0.42, y: -0.2, z: 1.08 }, 'Escape wheel advances by half a tooth per beat in this discrete kinematic study.');
    escapeWheel.add(gearMesh(8, 0.02 * scale, 0.095, this.materials.steel, 0.63, pairPhases.escapePinion));
    escapeWheel.add(gearMesh(15, 0.032 * scale, 0.115, this.materials.dark, 0.8, 0));
    const balance = this.addPart('BALANCE ASSEMBLY', { ...gearPosition.balance, z: 1.03 }, { x: -0.35, y: -0.42, z: 1.1 }, 'Regulating organ. It oscillates at half the beat frequency; inertia and torque are not solved here.');
    const balanceRadius = 0.56 * scale;
    const balanceRing = new THREE.Mesh(new THREE.TorusGeometry(balanceRadius, 0.042 * scale, 10, 72), this.materials.steel);
    balanceRing.castShadow = true;
    balance.add(balanceRing);
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(balanceRadius * 0.42, 0.025 * scale, 8, 48), this.materials.polishedSteel);
    balance.add(innerRing);
    for (let arm = 0; arm < 4; arm++) {
      const angle = arm * Math.PI / 2;
      const spoke = roundedBeam(balanceRadius * 1.55, 0.026 * scale, this.materials.steel, 0);
      spoke.rotation.z = angle;
      balance.add(spoke);
    }
    const balanceStaff = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * scale, 0.045 * scale, 0.4, 16), this.materials.brass);
    balanceStaff.rotation.x = Math.PI / 2;
    balanceStaff.position.z = 0.01;
    balance.add(balanceStaff);

    const springPointsForHairspring = [];
    for (let step = 0; step <= 300; step++) {
      const u = step / 300;
      const angle = u * TAU * 4.2;
      const radius = (0.055 + u * 0.24) * scale;
      springPointsForHairspring.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.08));
    }
    const hairspringGeometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(springPointsForHairspring),
      300,
      0.008 * scale,
      4,
      false
    );
    const hairspring = new THREE.Mesh(hairspringGeometry, this.materials.dark);
    hairspring.name = 'HAIRSPRING';
    hairspring.userData.basePositions = hairspringGeometry.attributes.position.array.slice();
    hairspring.userData.tubeSegments = 300;
    hairspring.userData.radialSegments = 4;
    balance.add(hairspring);
    balance.userData.hairspring = hairspring;

    const palletPosition = gearPosition.pallet;
    const pallet = this.addPart('PALLET FORK', { ...palletPosition, z: 0.96 }, { x: -0.48, y: -0.28, z: 1.05 }, 'Pallet fork alternates between locking and releasing the escape wheel.');
    const palletArm = roundedBeam(0.52 * scale, 0.045 * scale, this.materials.dark, 0.04);
    palletArm.position.set(0.15 * scale, 0, 0.04);
    pallet.add(palletArm);
    const forkTail = roundedBeam(0.38 * scale, 0.028 * scale, this.materials.dark, 0.04);
    forkTail.position.set(-0.22 * scale, -0.12 * scale, 0.04);
    forkTail.rotation.z = -0.85;
    pallet.add(forkTail);
    const palletStoneA = new THREE.Mesh(new THREE.BoxGeometry(0.085 * scale, 0.04 * scale, 0.04), this.materials.ruby);
    palletStoneA.position.set(0.39 * scale, 0.05 * scale, 0.09);
    palletStoneA.rotation.z = 0.22;
    pallet.add(palletStoneA);
    const palletStoneB = palletStoneA.clone();
    palletStoneB.position.set(-0.38 * scale, -0.23 * scale, 0.09);
    palletStoneB.rotation.z = -0.8;
    pallet.add(palletStoneB);

    const bridge = this.addPart(
      'BARREL BRIDGE',
      { x: 0.04 * scale, y: 0, z: 0.58 },
      { x: 0.02, y: 0.24, z: 0.92 },
      'Open bridge rails support the barrel, centre, and third-wheel arbors in this visual study.'
    );
    this._addBridgeRails(bridge, [gearPosition.barrel, gearPosition.center, gearPosition.third], 0.065 * scale);

    const trainBridge = this.addPart(
      'TRAIN BRIDGE',
      { x: -1.55 * scale, y: -0.35 * scale, z: 0.98 },
      { x: -0.18, y: -0.26, z: 1.04 },
      'Open bridge rails support the third, fourth, and escape-wheel arbors.'
    );
    this._addBridgeRails(trainBridge, [gearPosition.third, gearPosition.fourth, gearPosition.escape], 0.055 * scale);

    const cockCenter = new THREE.Vector2(
      (gearPosition.balance.x + gearPosition.pallet.x) * 0.5,
      (gearPosition.balance.y + gearPosition.pallet.y) * 0.5
    );
    const escapeBridge = this.addPart(
      'BALANCE COCK',
      { x: cockCenter.x, y: cockCenter.y, z: 1.02 },
      { x: -0.32, y: -0.24, z: 1.12 },
      'Slim balance cock links the balance support to the escapement side of the assembly.'
    );
    this._addBridgeRails(escapeBridge, [gearPosition.balance, gearPosition.pallet], 0.055 * scale);

    const screwLayout = [
      [-2.45, 1.75], [-0.25, 2.45], [1.75, 1.75], [2.45, -0.55],
      [1.2, -2.18], [-0.95, -2.15], [-2.45, -1.65]
    ];
    screwLayout.forEach(([x, y], index) => {
      const screw = this.addPart(`BRIDGE SCREW ${String(index + 1).padStart(2, '0')}`, { x: x * scale, y: y * scale, z: 1.18 }, { x: x * 0.09, y: y * 0.09, z: 0.88 }, 'Fastener retaining a bridge to the main plate.');
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.075 * scale, 0.075 * scale, 0.045, 24), this.materials.polishedSteel);
      head.rotation.x = Math.PI / 2;
      head.position.z = 0.02;
      screw.add(head);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.085 * scale, 0.012 * scale, 0.014), this.materials.dark);
      slot.position.z = 0.047;
      head.add(slot);
    });

    [gearPosition.barrel, gearPosition.center, gearPosition.third, gearPosition.fourth, gearPosition.escape, gearPosition.balance].forEach((position, index) => {
      this.addJewel(`JEWEL BEARING ${String(index + 1).padStart(2, '0')}`, { x: position.x, y: position.y, z: 0 }, 0.068 * scale);
    });

    if (key === 'eta-6497-1' || key === 'eta-6498-1') {
      const secondsPosition = gearPosition.fourth;
      const seconds = this.addPart(
        'SMALL SECONDS HAND',
        { x: secondsPosition.x, y: secondsPosition.y, z: 0.99 },
        { x: secondsPosition.x * 0.3, y: secondsPosition.y * 0.3, z: 1.08 },
        'Small seconds hand linked to the fourth-wheel arbor in the teaching train.'
      );
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.018 * scale, 0.55 * scale, 0.025), this.materials.dark);
      hand.position.y = 0.27 * scale;
      hand.castShadow = true;
      seconds.add(hand);
      const counterweight = new THREE.Mesh(new THREE.SphereGeometry(0.045 * scale, 12, 8), this.materials.brass);
      counterweight.position.y = -0.18 * scale;
      seconds.add(counterweight);
      this.secondsHand = seconds;
    } else if (is2824) {
      const seconds = this.addPart(
        'CENTRAL SECONDS HAND',
        { x: 0, y: 0, z: 1.34 },
        { x: 0.04, y: 0.02, z: 1.4 },
        'Central seconds display driven at the fourth-wheel rate in this simplified train study.'
      );
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.016 * scale, 1.42 * scale, 0.018), this.materials.dark);
      hand.position.y = 0.71 * scale;
      hand.castShadow = true;
      seconds.add(hand);
      const counterweight = new THREE.Mesh(new THREE.SphereGeometry(0.035 * scale, 12, 8), this.materials.brass);
      counterweight.position.y = -0.2 * scale;
      seconds.add(counterweight);
      this.secondsHand = seconds;
    } else {
      this.secondsHand = null;
    }

    this.minuteHand = this.addPart('MINUTE HAND', { x: 0, y: 0, z: 1.22 }, { x: 0.04, y: 0.02, z: 1.3 }, 'Minute hand driven from the center arbor in this accelerated-time display.');
    const minuteShape = new THREE.Mesh(new THREE.BoxGeometry(0.035 * scale, 1.15 * scale, 0.025), this.materials.dark);
    minuteShape.position.y = 0.58 * scale;
    this.minuteHand.add(minuteShape);
    const minuteCounterweight = new THREE.Mesh(new THREE.SphereGeometry(0.06 * scale, 12, 8), this.materials.brass);
    minuteCounterweight.position.y = -0.2 * scale;
    this.minuteHand.add(minuteCounterweight);

    this.hourHand = this.addPart('HOUR HAND', { x: 0, y: 0, z: 1.25 }, { x: 0.06, y: 0.04, z: 1.36 }, 'Hour hand turns at one twelfth of the minute-hand speed.');
    const hourShape = new THREE.Mesh(new THREE.BoxGeometry(0.07 * scale, 0.76 * scale, 0.028), this.materials.steel);
    hourShape.position.y = 0.38 * scale;
    this.hourHand.add(hourShape);

    if (is2824) this._addAutomaticRotor(scale);

    // A separate, selectable tourbillon regulator study. The cage revolves as one
    // assembly while its balance, escape wheel, pallet fork, cage and jewels remain
    // individually inspectable/explodable parts. It is explicitly a kinematic study,
    // not a claimed factory calibre or a torque-accurate simulation.
    if (isTourbillon) {
      const cagePosition = gearPosition.balance;
      const carrier = new THREE.Group();
      carrier.name = isDoubleTourbillon ? 'DOUBLE-AXIS OUTER CARRIER' : 'TOURBILLON CARRIER';
      carrier.position.set(cagePosition.x, cagePosition.y, 1.12);
      this.root.add(carrier);
      this.tourbillonOuterCage = isDoubleTourbillon ? carrier : null;
      const cageGroup = new THREE.Group();
      cageGroup.name = 'TOURBILLON ROTATING ASSEMBLY';
      carrier.add(cageGroup);
      this.tourbillonCage = cageGroup;

      const addCagePart = (name, position, explodeVector, description) => {
        const part = new THREE.Group();
        part.name = name;
        part.position.set(position.x || 0, position.y || 0, position.z || 0);
        part.userData.part = name;
        part.userData.description = description;
        part.userData.explodeVector = new THREE.Vector3(explodeVector.x, explodeVector.y, explodeVector.z);
        part.userData.originalVisible = true;
        cageGroup.add(part);
        this.parts.push(part);
        return part;
      };
      const cageRadius = 0.68 * scale;
      const carriage = addCagePart('TOURBILLON CAGE', {z:0.02}, {x:0.10,y:0.10,z:0.9}, 'Rotating carriage carrying the regulating organ and escapement around the fixed fourth-wheel axis. A conceptual 60-second rotation is shown.');
      const cageRing = new THREE.Mesh(new THREE.TorusGeometry(cageRadius, 0.035 * scale, 10, 96), this.materials.brass);
      cageRing.castShadow = true; cageRing.receiveShadow = true; carriage.add(cageRing);
      if (isDoubleTourbillon) {
        const gimbal = this.addPart('DOUBLE-AXIS OUTER GIMBAL', {x:cagePosition.x,y:cagePosition.y,z:1.12}, {x:0,y:0,z:0.9}, 'Outer carrier for the double-axis tourbillon study. It rotates around the plate axis while the inner cage turns around a perpendicular axis; kinematic demonstration only.');
        this.root.remove(gimbal);
        gimbal.position.set(0, 0, 0);
        carrier.add(gimbal);
        const gimbalRing = new THREE.Mesh(new THREE.TorusGeometry(cageRadius * 1.48, 0.038 * scale, 10, 96), this.materials.brass);
        gimbalRing.rotation.y = Math.PI / 2;
        gimbal.add(gimbalRing);
        for (const side of [-1, 1]) {
          const trunnion = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * scale, 0.07 * scale, 0.18 * scale, 24), this.materials.polishedSteel);
          trunnion.rotation.x = Math.PI / 2;
          trunnion.position.set(0, side * cageRadius * 1.48, 0);
          gimbal.add(trunnion);
        }
        this.doubleTourbillonGimbal = gimbal;
      }
      for (let arm=0; arm<3; arm++) {
        const spoke = roundedBeam(cageRadius * 1.78, 0.035 * scale, this.materials.polishedSteel, 0.015);
        spoke.rotation.z = arm * TAU/3;
        carriage.add(spoke);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055 * scale, 16, 10), this.materials.brass);
        cap.position.set(Math.cos(arm*TAU/3)*cageRadius*0.82, Math.sin(arm*TAU/3)*cageRadius*0.82, 0.06);
        carriage.add(cap);
      }
      const balancePart = addCagePart('TOURBILLON BALANCE', {z:0.105}, {x:-0.12,y:0.08,z:0.68}, 'Oscillating balance within the rotating cage; the oscillation and cage rotation are illustrative, not a solved hairspring model.');
      const balanceRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.30*scale, 0.028*scale, 10, 64), this.materials.steel);
      balancePart.add(balanceRing2);
      const balanceInner = new THREE.Mesh(new THREE.TorusGeometry(0.12*scale, 0.018*scale, 8, 48), this.materials.polishedSteel);
      balanceInner.position.z=0.018; balancePart.add(balanceInner);
      for(let i=0;i<4;i++){
        const beam=roundedBeam(0.56*scale,0.018*scale,this.materials.polishedSteel,0.018);
        beam.rotation.z=i*Math.PI/2; balancePart.add(beam);
      }
      const innerSpringPoints=[];
      for(let i=0;i<=160;i++){const u=i/160;const a=u*TAU*3.2;const r=(0.025+u*0.085)*scale;innerSpringPoints.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,0.045));}
      balancePart.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(innerSpringPoints),160,0.006*scale,4,false),this.materials.dark));
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.045*scale,0.045*scale,0.10,18),this.materials.ruby);
      staff.rotation.x=Math.PI/2; staff.position.z=0.04; balancePart.add(staff);

      const tourbillonEscape = addCagePart('TOURBILLON ESCAPE WHEEL', {z:0.06}, {x:0.12,y:-0.06,z:0.55}, 'Escape wheel carried inside the tourbillon cage. Tooth form is illustrative, not a production escapement profile.');
      tourbillonEscape.add(gearMesh(15,0.022*scale,0.065,this.materials.dark,0.045,0));
      const tourbillonPallet = addCagePart('TOURBILLON PALLET FORK', {z:0.14}, {x:-0.08,y:0.12,z:0.52}, 'Pallet fork shown within the cage; the mesh and lock/impulse sequence are not dynamically solved.');
      const palletArm2=roundedBeam(0.42*scale,0.028*scale,this.materials.polishedSteel,0.02);
      palletArm2.rotation.z=0.33; tourbillonPallet.add(palletArm2);
      const jewelA=new THREE.Mesh(new THREE.SphereGeometry(0.045*scale,16,10),this.materials.ruby); jewelA.scale.z=0.42; jewelA.position.set(0.18*scale,0.12*scale,0.06); tourbillonPallet.add(jewelA);
      const jewelB=jewelA.clone(); jewelB.position.set(-0.17*scale,-0.08*scale,0.06); tourbillonPallet.add(jewelB);
      const pivotJewel=addCagePart('TOURBILLON PIVOT JEWEL', {z:0.16}, {x:0.04,y:0.02,z:0.44}, 'Ruby-toned jewel bearing at the tourbillon carriage pivot.');
      const jewelMesh=new THREE.Mesh(new THREE.SphereGeometry(0.075*scale,20,12),this.materials.ruby); jewelMesh.scale.z=0.36; pivotJewel.add(jewelMesh);

      const fixedBridge = this.addPart('TOURBILLON BRIDGE', {x:cagePosition.x,y:cagePosition.y,z:1.92}, {x:0.10,y:0.12,z:1.15}, 'Fixed bridge spanning the tourbillon pivot; the bridge is deliberately kept stationary while the cage rotates below it.');
      const bridgeBar=roundedBeam(1.42*scale,0.075*scale,this.materials.steel,0);
      bridgeBar.rotation.z=Math.PI/2; bridgeBar.position.z=0; fixedBridge.add(bridgeBar);
      for (const side of [-1,1]) {
        const boss=new THREE.Mesh(new THREE.TorusGeometry(0.11*scale,0.025*scale,8,32),this.materials.polishedSteel);
        boss.position.set(0,side*0.58*scale,0.025); fixedBridge.add(boss);
      }

      // Avoid a duplicated, conventional balance/escapement outside the tourbillon.
      this.parts.forEach(part=>{
        if (['ESCAPE WHEEL / PINION','PALLET FORK','BALANCE ASSEMBLY','JEWEL BEARING 05','JEWEL BEARING 06'].includes(part.userData.part)) part.visible=false;
      });
    }

    // A selectable minute-repeater complication study: two concentric gongs,
    // two striking hammers, racks and stepped snail cams. This is original
    // educational geometry, not a reproduction of a specific calibre.
    if (isMinuteRepeater) {
      const gongOuter = new THREE.Mesh(new THREE.TorusGeometry(2.60 * scale, 0.028 * scale, 10, 144), this.materials.polishedSteel);
      gongOuter.name = 'MINUTE REPEATER / HIGH GONG';
      gongOuter.position.z = 1.48;
      gongOuter.castShadow = true; gongOuter.receiveShadow = true;
      const gongInner = new THREE.Mesh(new THREE.TorusGeometry(2.43 * scale, 0.028 * scale, 10, 144), this.materials.brass);
      gongInner.name = 'MINUTE REPEATER / LOW GONG';
      gongInner.position.z = 1.39;
      gongInner.castShadow = true; gongInner.receiveShadow = true;
      const highGongPart = this.addPart('REPEATER HIGH GONG', {x:0,y:0,z:0}, {x:0.22,y:0.10,z:0.95}, 'Higher-tone gong ring; the actual acoustic spectrum and case coupling are not simulated.');
      highGongPart.add(gongOuter);
      const lowGongPart = this.addPart('REPEATER LOW GONG', {x:0,y:0,z:0}, {x:-0.22,y:-0.10,z:0.88}, 'Lower-tone gong ring; it is a visual study and does not produce chime audio.');
      lowGongPart.add(gongInner);

      const addHammer = (name, position, angle, material, description) => {
        const hammer = this.addPart(name, position, {x:position.x * 0.11,y:position.y * 0.11,z:1.05}, description);
        const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.095 * scale, 0.095 * scale, 0.14, 24), this.materials.polishedSteel);
        pivot.rotation.x = Math.PI / 2; pivot.position.z = 0.03; hammer.add(pivot);
        const arm = roundedBeam(0.80 * scale, 0.055 * scale, material, 0.04);
        arm.rotation.z = angle; arm.position.set(0.25 * scale, 0.06 * scale, 0.04); hammer.add(arm);
        const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.09 * scale, 0.17 * scale, 4, 12), material);
        head.rotation.z = angle; head.position.set(0.56 * scale * Math.cos(angle), 0.56 * scale * Math.sin(angle), 0.08); hammer.add(head);
        const spring = roundedBeam(0.42 * scale, 0.025 * scale, this.materials.dark, 0.015);
        spring.rotation.z = angle + 0.55; spring.position.set(-0.17 * scale, -0.07 * scale, 0.025); hammer.add(spring);
        hammer.userData.repeaterHammer = true;
        return hammer;
      };
      addHammer('REPEATER HOUR HAMMER', {x:2.04 * scale,y:1.08 * scale,z:1.58}, -0.65, this.materials.brass, 'Hour striking hammer; motion is an illustrative demonstration and is not phase-accurate chime logic.');
      addHammer('REPEATER MINUTE HAMMER', {x:2.02 * scale,y:0.35 * scale,z:1.68}, 0.45, this.materials.polishedSteel, 'Minute striking hammer; its movement is visual only, with no acoustic output or strike-count computation.');

      const addRack = (name, x, y, z, length, teeth) => {
        const rack = this.addPart(name, {x:x * scale,y:y * scale,z}, {x:x * 0.14,y:y * 0.12,z:0.92}, 'Racking component in the repeater study. In a real repeater its travel is constrained by the time-piece racks and snail cams; those contacts are not solved here.');
        const rail = roundedBeam(length * scale, 0.045 * scale, this.materials.steel, 0.02);
        rail.rotation.z = -0.22; rail.position.x = length * scale * 0.12; rack.add(rail);
        for (let i=0;i<teeth;i++) {
          const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.055 * scale, 0.10 * scale, 0.06), this.materials.polishedSteel);
          tooth.position.set((i - (teeth - 1) / 2) * 0.105 * scale, -0.075 * scale, 0.045);
          tooth.rotation.z = -0.22; rack.add(tooth);
        }
        return rack;
      };
      addRack('REPEATER HOURS RACK', -1.88, 1.82, 1.60, 0.95, 7);
      addRack('REPEATER QUARTER RACK', -2.06, 1.10, 1.66, 0.82, 5);
      addRack('REPEATER MINUTES RACK', -1.88, 0.64, 1.72, 1.18, 9);

      const addSnail = (name, x, y, z, steps, material) => {
        const snail = this.addPart(name, {x:x * scale,y:y * scale,z}, {x:x * 0.10,y:y * 0.10,z:0.86}, 'Stepped snail cam used as a visual reference for selecting the strike count; it is not connected to a solved time-reading train.');
        for (let step=0; step<steps; step++) {
          const angle = step * TAU / steps;
          const r = (0.16 + 0.025 * step) * scale;
          const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.095 * scale, 0.12 * scale, 0.07), material);
          tooth.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0.035);
          tooth.rotation.z = angle; snail.add(tooth);
        }
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * scale,0.11 * scale,0.10,24), this.materials.brass);
        hub.rotation.x=Math.PI/2; hub.position.z=0.04; snail.add(hub);
        return snail;
      };
      addSnail('REPEATER HOUR SNAIL CAM', -1.55, 0.83, 1.52, 12, this.materials.brass);
      addSnail('REPEATER QUARTER SNAIL CAM', -1.08, 0.83, 1.57, 4, this.materials.brass);
      addSnail('REPEATER MINUTE SNAIL CAM', -0.61, 0.83, 1.62, 14, this.materials.polishedSteel);
      const repeaterBarrel = this.addPart('REPEATER BARREL / SPRING', {x:-2.10 * scale,y:-1.12 * scale,z:1.48}, {x:-0.16,y:-0.12,z:0.97}, 'Dedicated striking barrel and spring shown for the repeater complication study; torque and reserve are not simulated.');
      const repeaterDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.36 * scale,0.36 * scale,0.16,40),this.materials.brass);
      repeaterDrum.rotation.x=Math.PI/2; repeaterDrum.position.z=0.05; repeaterBarrel.add(repeaterDrum);
      const repeaterSpringPoints=[];
      for(let i=0;i<=110;i++){const u=i/110;const a=u*TAU*2.8;const r=(0.035+u*0.25)*scale;repeaterSpringPoints.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,0.14));}
      repeaterBarrel.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(repeaterSpringPoints),110,0.013*scale,5,false),this.materials.dark));
      const slide = this.addPart('REPEATER ACTUATING SLIDE', {x:-2.64 * scale,y:0.15 * scale,z:1.48}, {x:-0.13,y:0,z:0.82}, 'Case slide that initiates and winds the striking mechanism in a real repeater; this study does not simulate the all-or-nothing sequence.');
      const slideBody = new THREE.Mesh(new THREE.BoxGeometry(0.46*scale,0.10*scale,0.10),this.materials.polishedSteel); slideBody.rotation.z=Math.PI/2; slide.add(slideBody);
      const lock = this.addPart('REPEATER ALL-OR-NOTHING LOCK', {x:-2.40 * scale,y:-0.48 * scale,z:1.66}, {x:-0.12,y:-0.04,z:0.9}, 'Safety lever illustrating the all-or-nothing concept; interlocks and timing are not dynamically solved.');
      const lockArm = roundedBeam(0.62*scale,0.038*scale,this.materials.dark,0.03); lockArm.rotation.z=-0.45; lockArm.position.x=0.08*scale; lock.add(lockArm);
      const governor = this.addPart('REPEATER GOVERNOR', {x:-2.04 * scale,y:0.0,z:1.74}, {x:-0.12,y:0.1,z:0.94}, 'Centrifugal striking governor study: its geometry is displayed, but speed regulation and acoustic timing are not simulated.');
      const governorHub = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale,0.08 * scale,0.11,20),this.materials.dark);
      governorHub.rotation.x=Math.PI/2; governor.add(governorHub);
      for (let armIndex=0; armIndex<3; armIndex++) {
        const arm = roundedBeam(0.54 * scale, 0.035 * scale, this.materials.brass, 0.04);
        arm.rotation.z=armIndex*TAU/3; arm.position.x=Math.cos(armIndex*TAU/3)*0.20*scale; arm.position.y=Math.sin(armIndex*TAU/3)*0.20*scale; governor.add(arm);
      }
    }

    const screwCount = screwLayout.length;
    if (isEscapement) {
      this.parts.forEach(part => {
        const name = part.userData.part;
        const visible = ['MAIN PLATE', 'ESCAPE WHEEL / PINION', 'BALANCE ASSEMBLY', 'PALLET FORK', 'BALANCE COCK', 'JEWEL BEARING 05', 'JEWEL BEARING 06'].includes(name);
        part.visible = visible;
      });
      this.root.scale.setScalar(1.08);
    } else {
      this.root.scale.setScalar(1);
    }

    this._capturePartState();
    this._updateModelText(key, screwCount);
    this._updateLabels();
  }

  _addBridgeRails(part, points, radius) {
    const anchor = part.position;

    for (let index = 0; index < points.length - 1; index++) {
      const start = points[index];
      const end = points[index + 1];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      const beam = roundedBeam(length, radius, this.materials.steel, 0.02);
      beam.position.set((start.x + end.x) * 0.5 - anchor.x, (start.y + end.y) * 0.5 - anchor.y, 0.02);
      beam.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
      part.add(beam);
    }

    points.forEach(point => {
      const boss = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.65, radius * 0.34, 7, 24),
        this.materials.polishedSteel
      );
      boss.position.set(point.x - anchor.x, point.y - anchor.y, 0.04);
      boss.castShadow = true;
      part.add(boss);
    });
  }

  _addAutomaticRotor(scale) {
    const rotor = this.addPart('AUTOMATIC ROTOR', { x: 0, y: 0, z: 1.45 }, { x: 0.08, y: 0.06, z: 1.8 }, 'Automatic winding rotor. Its motion is illustrative rather than a solved winding model.');
    const weight = new THREE.Mesh(new THREE.RingGeometry(1.0 * scale, 2.18 * scale, 96, 1, Math.PI * 0.08, Math.PI * 1.62), this.materials.brass);
    weight.castShadow = true;
    rotor.add(weight);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.14 * scale, 1.0 * scale, 5, 16), this.materials.dark);
    arm.rotation.z = 0.25;
    arm.position.set(0.4 * scale, 0.15 * scale, 0.04);
    rotor.add(arm);
    const counterweight = new THREE.Mesh(new THREE.BoxGeometry(0.52 * scale, 0.3 * scale, 0.12), this.materials.dark);
    counterweight.rotation.z = -0.3;
    counterweight.position.set(1.52 * scale, 0.25 * scale, 0.07);
    rotor.add(counterweight);
    this.rotor = rotor;
  }

  _capturePartState() {
    // Explode is a proportional 3D dilation around the movement's centre, not a
    // stack of axial layers. Every selectable object keeps its rotation and shape;
    // its centroid moves farther from the centre by the same scale factor.
    this.root.updateMatrixWorld(true);
    const partName = part => part.userData.part || part.name || '';
    const boundsInRoot = object => {
      const world = new THREE.Box3().setFromObject(object);
      if (world.isEmpty()) return null;
      const points = [];
      for (const x of [world.min.x, world.max.x]) {
        for (const y of [world.min.y, world.max.y]) {
          for (const z of [world.min.z, world.max.z]) {
            points.push(this.root.worldToLocal(new THREE.Vector3(x, y, z)));
          }
        }
      }
      const result = new THREE.Box3().makeEmpty();
      points.forEach(point => result.expandByPoint(point));
      return result;
    };

    const datumParts = this.parts.filter(part => /main plate/i.test(partName(part)));
    const datumBounds = datumParts.reduce((combined, part) => {
      const bounds = boundsInRoot(part);
      if (bounds) combined.union(bounds);
      return combined;
    }, new THREE.Box3().makeEmpty());
    const hasDatum = !datumBounds.isEmpty();
    const assemblyBounds = boundsInRoot(this.remoteModel || this.root) || new THREE.Box3().setFromObject(this.root);
    const movementCenter = (hasDatum ? datumBounds : assemblyBounds).getCenter(new THREE.Vector3());
    const movementSize = assemblyBounds.getSize(new THREE.Vector3());
    const movementSpan = Math.max(movementSize.x, movementSize.y, movementSize.z, 1);
    const nearCenterThreshold = movementSpan * 0.045;
    const goldenAngle = 2.399963229728653;

    this.parts.forEach((part, index) => {
      part.userData.basePosition = part.position.clone();
      part.userData.baseRotation = part.rotation.clone();
      part.userData.originalVisible = part.visible;

      const bounds = boundsInRoot(part);
      if (!bounds) {
        part.userData.explodeVector = new THREE.Vector3();
        return;
      }

      const partCenter = bounds.getCenter(new THREE.Vector3());
      const radial = partCenter.clone().sub(movementCenter);
      const Z_EXPLODE_FACTOR = 10; // Increase for more depth

let displacementRoot = new THREE.Vector3(
  radial.x * 0.75,
  radial.y * 0.75,
  radial.z * Z_EXPLODE_FACTOR
).multiplyScalar(EXPLODE_SPREAD_FACTOR - 1);

      // Some concentric arbors share almost the same centroid. Give those only a
      // modest unique 3D nudge so they remain individually inspectable, rather than
      // leaving them perfectly coincident or forcing them into common Z layers.
      if (radial.length() < nearCenterThreshold) {
        const vertical = 1 - 2 * ((index + 0.5) / Math.max(1, this.parts.length));
        const horizontalRadius = Math.sqrt(Math.max(0, 1 - vertical * vertical));
        const direction = new THREE.Vector3(
          Math.cos(index * goldenAngle) * horizontalRadius,
          Math.sin(index * goldenAngle) * horizontalRadius,
          vertical
        ).normalize();
        const nudge = movementSpan * (0.085 + (index % 4) * 0.018);
        displacementRoot.addScaledVector(direction, nudge);
      }

      // Calculate the same root-space translation in each object's parent space.
      // This also works for CAD nodes nested beneath scaled GLTF groups.
      const worldOrigin = part.getWorldPosition(new THREE.Vector3());
      const rootOrigin = this.root.worldToLocal(worldOrigin.clone());
      const targetRoot = rootOrigin.add(displacementRoot);
      const targetWorld = this.root.localToWorld(targetRoot);
      const parent = part.parent || this.root;
      const baseParentPosition = parent.worldToLocal(worldOrigin.clone());
      const targetParentPosition = parent.worldToLocal(targetWorld);
      part.userData.explodeVector = targetParentPosition.sub(baseParentPosition);
    });
  }

  _clearModel() {
    this._clearLabels();
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    this.mixer?.stopAllAction();
    this.root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      list.forEach(material => {
        materials.add(material);
        Object.values(material).forEach(value => {
          if (value?.isTexture) textures.add(value);
        });
      });
    });
    geometries.forEach(geometry => geometry.dispose());
    textures.forEach(texture => texture.dispose());
    materials.forEach(material => material.dispose());
    this.root.clear();
    this.parts = [];
    this.selected = null;
    this.remoteModel = null;
    this.mixer = null;
    this.rotor = null;
    this.tourbillonCage = null;
    this.tourbillonOuterCage = null;
    this.doubleTourbillonGimbal = null;
    this.minuteHand = null;
    this.hourHand = null;
    this.secondsHand = null;
    this.tourbillonCage = null;
    this.materials = null;
    this.root.scale.setScalar(1);
  }

  _updateModelText(key) {
    const engine = document.querySelector('#watch-engine-label');
    const source = document.querySelector('#watch-source');
    const loader = document.querySelector('#watch-loader');
    const error = document.querySelector('#model-error');
    const labels = {
      'eta-6497-1': ['GLB / ETA 6497-1 CAD ASSEMBLY', 'Imported STEP reconstruction with individually selectable source-CAD meshes. Component names and presentation finishes are not factory-verified.'],
      'seiko-nh35': ['GLB / NH35A COMMUNITY CAD', 'Imported STEP reconstruction with 13 separately selectable solids. Some source component names and presentation finishes are provisional.']
    };
    if (engine) engine.textContent = labels[key]?.[0] || 'MOVEMENT ASSET';
    if (source) source.textContent = labels[key]?.[1] || '';
    if (loader) loader.hidden = true;
    if (error) error.hidden = true;
  }

  async setMovement(key) {
    const requestId = ++this._modelRequestId;
    this.explode = 0;
    this._clearSelection();

    // Every bundled CAD conversion is served from this site. No dead external
    // inspector route and no third-party runtime model URLs are needed.
    const bundledModels = {
      'eta-6497-1': new URL('../../models/ETA-6497-1-Movement-Gold-Jewels.glb', import.meta.url).href,
      'seiko-nh35': new URL('../../models/Seiko-NH35-Movement.glb', import.meta.url).href
    };
    const modelUrl = bundledModels[key];
    if (!modelUrl) {
      const error = document.querySelector('#model-error');
      if (error) {
        error.hidden = false;
        error.textContent = 'UNSUPPORTED MOVEMENT — CHOOSE A BUNDLED CAD ASSET';
      }
      return false;
    }
    return this.loadRemote(modelUrl, requestId, key);
  }

  async loadRemote(url, requestId = this._modelRequestId, movementKey = 'eta-6497-1') {
    this._clearModel();
    let loaded = false;
    const loaderMessage = document.querySelector('#watch-loader');
    const errorMessage = document.querySelector('#model-error');
    if (loaderMessage) {
      loaderMessage.hidden = false;
      loaderMessage.textContent = 'LOADING MODEL';
    }
    if (errorMessage) errorMessage.hidden = true;

    try {
      const gltf = await new GLTFLoader().loadAsync(url);
      if (requestId !== this._modelRequestId) {
        const geometries = new Set();
        const materials = new Set();
        gltf.scene.traverse(object => {
          if (object.geometry) geometries.add(object.geometry);
          if (object.material) {
            (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
          }
        });
        const textures = new Set();
        gltf.scene.traverse(object => {
          const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
          list.forEach(material => Object.values(material).forEach(value => {
            if (value?.isTexture) textures.add(value);
          }));
        });
        geometries.forEach(geometry => geometry.dispose());
        textures.forEach(texture => texture.dispose());
        materials.forEach(material => material.dispose());
        return null;
      }

      const model = gltf.scene;
      // Fit to the actual calibre body, not the optional winding stem. The stem is
      // retained, but it must not dictate the camera scale or shove the movement off-screen.
      model.updateMatrixWorld(true);
      let mainPlate = null;
      model.traverse(object => {
        if (!mainPlate && object.isMesh && /main plate/i.test(object.name || '')) mainPlate = object;
      });
      const overallBounds = new THREE.Box3().setFromObject(model);
      const anchorBounds = mainPlate ? new THREE.Box3().setFromObject(mainPlate) : overallBounds;
      const center = anchorBounds.getCenter(new THREE.Vector3());
      const size = anchorBounds.getSize(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z) || 1;
      // Make the main plate inspectable as four radial floating components in explode view.
      // The original model remains assembled when explode is at zero.
      if (mainPlate) {
        splitMainPlateMesh(mainPlate, 4);
      }
      const modelScale = 6.0 / maxDimension;
      model.scale.setScalar(modelScale);
      // Three.js applies node position after node scale, so the centering translation
      // must be scaled too. Otherwise CAD coordinates shift the assembly out of frame.
      model.position.copy(center).multiplyScalar(-modelScale);

      const pivot = new THREE.Group();
      pivot.name = 'WATCH MODEL PIVOT';
      pivot.add(model);
      this.root.add(pivot);
      this.remoteModel = pivot;

      if (gltf.animations.length) {
        this.mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach(clip => this.mixer.clipAction(clip).play());
      }

      this.root.updateMatrixWorld(true);
      const meshes = [];
      model.traverse(object => {
        if (object.isMesh) meshes.push(object);
      });
      meshes.forEach((mesh, index) => {
        const name = mesh.name?.trim() || `MODEL PART ${String(index + 1).padStart(2, '0')}`;
        mesh.userData.part = name;
        mesh.userData.description = movementKey === 'eta-6497-1'
          ? 'Selectable component from the supplied ETA 6497-1 STEP reconstruction. Finish is a presentation material; this is not factory CAD.'
          : movementKey === 'seiko-nh35'
            ? 'Selectable solid from the supplied NH35 STEP reconstruction. Source part names were not verified; the finish is stylistic, not a factory material claim.'
            : 'Selectable component in this movement study.';
        mesh.userData.originalVisible = mesh.visible;
        this.parts.push(mesh);
      });
      this.modelType = movementKey;
      this._capturePartState();
      const engine = document.querySelector('#watch-engine-label');
      const source = document.querySelector('#watch-source');
      const loader = document.querySelector('#watch-loader');
      const error = document.querySelector('#model-error');
      if (movementKey === 'eta-6497-1') {
        if (engine) engine.textContent = 'GLB / ETA 6497-1 ASSEMBLY';
        if (source) source.textContent = 'Converted from the supplied ETA 6497-1 STEP reconstruction. Components are individually selectable; names are source-CAD labels, not verified factory catalog names. Metal and ruby finishes are presentation materials.';
      } else if (movementKey === 'seiko-nh35') {
        this._updateModelText(movementKey);
        if (engine) engine.textContent = 'GLB / NH35A COMMUNITY CAD';
        if (source) source.textContent = 'Converted from the supplied Marathon OS STEP model. It contains 13 separate solid bodies; several parts retain neutral body-index names because the source did not provide verified manufacturer part names. Materials are stylized presentation finishes. Validate against TMI documentation before engineering use.';
      } else {
        this._updateModelText(movementKey);
      }
      if (loader) loader.hidden = true;
      if (error) error.hidden = true;
      loaded = true;
    } catch (error) {
      if (requestId !== this._modelRequestId) return null;
      console.warn('Unable to load the remote watch model.', error);
      if (errorMessage) {
        errorMessage.hidden = false;
        errorMessage.textContent = 'MODEL UNAVAILABLE — CHECK THE ASSET PATH OR NETWORK';
      }
      loaded = false;
    } finally {
      if (requestId === this._modelRequestId && loaderMessage) loaderMessage.hidden = true;
    }
    if (requestId === this._modelRequestId) this.resize();
    return requestId === this._modelRequestId ? loaded : null;
  }

  setPlaying(value) {
    this.playing = Boolean(value);
  }

  setSpeed(value) {
    this.speed = THREE.MathUtils.clamp(Number(value) || 0, 0, 3);
  }

  setLight(value) {
    this.light = THREE.MathUtils.clamp(Number(value) || 1, 0.4, 2);
    this.key.intensity = 3 * this.light;
    this.rim.intensity = 1.45 * this.light;
    this.ambient.intensity = 1.75 * this.light;
  }

  setExplode(value) {
    this.explode = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
    this.parts.forEach(part => {
      const base = part.userData.basePosition;
      const offset = part.userData.explodeVector;
      if (!base || !offset) return;
      part.position.copy(base).addScaledVector(offset, this.explode);
    });
    this._updateLabels();
  }

  reset() {
    this.setExplode(0);
    this.setSpeed(1);
    this.setLight(1);
    this.playing = true;
    this.isolate = false;
    this.labels = false;
    this._clearLabels();
    this._clearSelection();
    this.parts.forEach(part => {
      part.visible = part.userData.originalVisible ?? true;
      if (part.userData.basePosition) part.position.copy(part.userData.basePosition);
      if (part.userData.baseRotation) part.rotation.copy(part.userData.baseRotation);
    });
    this.simTime = 0;
    this._beatIndex = -1;
    this.usingOrtho = false;
    this.camera = this.perspectiveCamera;
    this.controls.object = this.camera;
    this.controls.reset();
    this.camera.position.set(0, 0, 11.8);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    if (this.parts.length) this._fitModelToCamera(false);
    this._updateLabels();
  }

  front() {
    if (this.parts.length) {
      this._fitModelToCamera(false);
      return;
    }
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, 0, 11.8);
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
  }

  togglePerspective() {
    const previous = this.camera;
    this.usingOrtho = !this.usingOrtho;
    this.camera = this.usingOrtho ? this.orthoCamera : this.perspectiveCamera;
    this.camera.position.copy(previous.position);
    this.camera.quaternion.copy(previous.quaternion);
    this.camera.up.copy(previous.up);
    this.controls.object = this.camera;
    this.resize();
    this.controls.update();
    return !this.usingOrtho;
  }

  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this._pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hits = this._raycaster.intersectObjects(this.root.children, true);
    let part = null;
    for (const hit of hits) {
      let node = hit.object;
      while (node && node !== this.root && !node.userData.part) node = node.parent;
      if (node?.userData.part) {
        part = node;
        break;
      }
    }
    if (!part) return;
    this.selected = part;
    this._showSelection(part);
    if (this.isolate) this._applyIsolation();
    this._updateLabels();
  }

  _showSelection(part) {
    const name = part.userData.part || part.name || 'COMPONENT';
    const description = part.userData.description || this.describePart(name);
    const selection = document.querySelector('#watch-selection');
    const component = document.querySelector('#watch-component');
    if (selection) {
      selection.hidden = false;
      selection.replaceChildren();
      const eyebrow = document.createElement('span');
      eyebrow.textContent = 'SELECTED COMPONENT';
      const strong = document.createElement('strong');
      strong.textContent = name;
      const small = document.createElement('small');
      small.textContent = description;
      selection.append(eyebrow, strong, small);
    }
    if (component) {
      component.hidden = false;
      component.replaceChildren();
      const eyebrow = document.createElement('span');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = 'INSPECTED';
      const strong = document.createElement('strong');
      strong.textContent = name;
      const detail = document.createElement('span');
      detail.textContent = description;
      component.append(eyebrow, strong, detail);
    }
  }

  _clearSelection() {
    this.selected = null;
    this.isolate = false;
    const selection = document.querySelector('#watch-selection');
    const component = document.querySelector('#watch-component');
    if (selection) selection.hidden = true;
    if (component) component.hidden = true;
    this.parts.forEach(part => { part.visible = part.userData.originalVisible ?? true; });
  }

  describePart(name) {
    if (name.includes('BALANCE')) return 'Regulating organ; the animation is kinematic, not a torque-and-inertia simulation.';
    if (name.includes('ESCAPE')) return 'Escape wheel and pinion. Tooth geometry is a visual approximation, not a factory CAD profile.';
    if (name.includes('PALLET')) return 'Pallet fork and ruby pallet stones control release of the escape wheel.';
    if (name.includes('BARREL')) return 'Mainspring barrel and first train wheel.';
    if (name.includes('CENTER')) return 'Center wheel and pinion; minute-hand arbor in the simplified going train.';
    if (name.includes('THIRD')) return 'Intermediate compound wheel and pinion.';
    if (name.includes('FOURTH')) return 'Fourth-wheel arbor; drives the seconds indication in this model.';
    if (name.includes('DOUBLE-AXIS OUTER GIMBAL')) return 'Outer carrier of the double-axis tourbillon study; its axis is perpendicular to the inner cage axis.';
    if (name.includes('TOURBILLON CAGE')) return 'Rotating carriage for the balance and escapement in this procedural tourbillon study.';
    if (name.includes('TOURBILLON BALANCE')) return 'Oscillating balance inside the rotating cage; simplified kinematics.';
    if (name.includes('TOURBILLON ESCAPE')) return 'Escape wheel mounted in the rotating carriage.';
    if (name.includes('TOURBILLON PALLET')) return 'Pallet fork inside the tourbillon carriage.';
    if (name.includes('ROTOR')) return 'Automatic winding rotor; the swing is illustrative.';
    if (name.includes('BRIDGE') || name.includes('COCK')) return 'Bridge or cock supporting movement components.';
    if (name.includes('JEWEL')) return 'Jewel bearing; represented with a ruby material.';
    if (name.includes('HAND')) return 'Time display component linked to the simplified wheel train.';
    return 'Component of the current movement study.';
  }

  setLabels(value) {
    this.labels = Boolean(value);
    this._updateLabels();
  }

  _clearLabels() {
    this.labelsByPart.forEach(label => label.remove());
    this.labelsByPart.clear();
    if (this.labelLayer) this.labelLayer.replaceChildren();
  }

  _updateLabels() {
    if (!this.labelLayer) return;
    if (!this.labels) {
      this._clearLabels();
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.root.updateMatrixWorld(true);
    const labelParts = this.parts;
    const keep = new Set(labelParts);
    this.labelsByPart.forEach((label, part) => {
      if (!keep.has(part)) {
        label.remove();
        this.labelsByPart.delete(part);
      }
    });

    const candidates = [];
    labelParts.forEach(part => {
      let label = this.labelsByPart.get(part);
      if (!label) {
        label = document.createElement('span');
        label.className = 'watch-part-label';
        label.textContent = part.userData.part || part.name || 'PART';
        this.labelLayer.append(label);
        this.labelsByPart.set(part, label);
      }
      const center = new THREE.Vector3();
      new THREE.Box3().setFromObject(part).getCenter(center);
      center.project(this.camera);
      const x = (center.x * 0.5 + 0.5) * rect.width;
      const y = (-center.y * 0.5 + 0.5) * rect.height;
      const inFrustum = center.z >= -1 && center.z <= 1 && x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;
      label.hidden = !inFrustum || !part.visible;
      label.style.left = `${x}px`;
      label.style.top = `${y}px`;
      if (inFrustum && part.visible) {
        label.hidden = false;
        candidates.push({ part, label, x, y, z: center.z, selected: part === this.selected });
      }
    });

    // Greedy screen-space collision culling: selected part gets priority, followed
    // by central/front labels. This keeps names readable instead of stacking all
    // 44 component labels at nearly the same screen position on narrow displays.
    candidates.sort((a, b) => Number(b.selected) - Number(a.selected) || a.z - b.z ||
      Math.hypot(a.x - rect.width / 2, a.y - rect.height / 2) - Math.hypot(b.x - rect.width / 2, b.y - rect.height / 2));
    const isSmallViewport = window.innerWidth <= 1024;
    const maxLabels = isSmallViewport ? 5 : 16;
    const reservedTop = isSmallViewport ? 36 : 28;
    const reservedBottom = this.selected ? (isSmallViewport ? 94 : 84) : 28;
    const accepted = [];
    for (const candidate of candidates) {
      if (accepted.length >= maxLabels || candidate.y < reservedTop || candidate.y > rect.height - reservedBottom) {
        candidate.label.hidden = true;
        continue;
      }
      const width = candidate.label.offsetWidth || Math.min(isSmallViewport ? 112 : 140, candidate.label.textContent.length * 4 + 14);
      const height = candidate.label.offsetHeight || 18;
      const box = { left: candidate.x - width / 2 - 5, right: candidate.x + width / 2 + 5,
        top: candidate.y - height / 2 - 4, bottom: candidate.y + height / 2 + 4 };
      const overlaps = accepted.some(other => !(box.right < other.left || box.left > other.right || box.bottom < other.top || box.top > other.bottom));
      if (overlaps && !candidate.selected) { candidate.label.hidden = true; continue; }
      if (candidate.selected && overlaps) {
        accepted.forEach(other => { if (!(box.right < other.left || box.left > other.right || box.bottom < other.top || box.top > other.bottom)) other.label.hidden = true; });
      }
      candidate.label.hidden = false;
      accepted.push({ ...box, label: candidate.label });
    }
  }

  isolateSelected() {
    if (!this.selected) return false;
    this.isolate = !this.isolate;
    this._applyIsolation();
    return this.isolate;
  }

  _applyIsolation() {
    this.parts.forEach(part => {
      if (this.isolate) part.visible = part === this.selected;
      else part.visible = part.userData.originalVisible ?? true;
    });
    this._updateLabels();
  }

  resize() {
    const width = this.canvas.clientWidth || this.wrap?.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || this.wrap?.clientHeight || window.innerHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.perspectiveCamera.aspect = width / height;
    this.perspectiveCamera.updateProjectionMatrix();
    const span = 3.85;
    this.orthoCamera.left = -span * width / height;
    this.orthoCamera.right = span * width / height;
    this.orthoCamera.top = span;
    this.orthoCamera.bottom = -span;
    this.orthoCamera.updateProjectionMatrix();
    if (this.parts.length) this._fitModelToCamera(true);
    this._updateLabels();
  }

  _fitModelToCamera(preserveView = false) {
    if (!this.parts.length) return;
    this.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    const effectivelyVisible = object => {
      let node = object;
      while (node && node !== this.root) {
        if (!node.visible) return false;
        node = node.parent;
      }
      return true;
    };
    this.root.traverse(object => {
      if (object.isMesh && effectivelyVisible(object)) bounds.expandByObject(object);
    });
    if (bounds.isEmpty()) return;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const aspect = Math.max(this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight), 0.25);
    const verticalHalfFov = THREE.MathUtils.degToRad(this.perspectiveCamera.fov * 0.5);
    const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect);
    const maxSpan = Math.max(size.x, size.y, size.z, 1e-4);
    // Leave enough room for the complete 3D explode range on narrow phone viewports.
    const currentSpreadFactor = 1 + (EXPLODE_SPREAD_FACTOR - 1) * this.explode;
    const reserveFactor = EXPLODE_SPREAD_FACTOR / currentSpreadFactor;
    const fitWidth = size.x * reserveFactor + maxSpan * 0.22;
    const fitHeight = size.y * reserveFactor + maxSpan * 0.22;
    const fitDepth = size.z * reserveFactor + maxSpan * 0.22;
    const distance = Math.max(
      fitHeight / (2 * Math.tan(verticalHalfFov)),
      fitWidth / (2 * Math.tan(horizontalHalfFov))
    ) * 1.10 + fitDepth * 0.5;
    let direction = preserveView
      ? this.camera.position.clone().sub(this.controls.target)
      : new THREE.Vector3(0, 0, 1);
    if (direction.lengthSq() < 1e-8) direction.set(0, 0, 1);
    direction.normalize();
    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(direction, Math.max(6, distance));
    this.controls.minDistance = Math.max(3, distance * 0.38);
    this.controls.maxDistance = Math.max(22, distance * 5);
    this.controls.update();

    const orthoSpan = Math.max(fitHeight * 0.5, fitWidth / (2 * aspect)) * 1.08;
    this.orthoCamera.left = -orthoSpan * aspect;
    this.orthoCamera.right = orthoSpan * aspect;
    this.orthoCamera.top = orthoSpan;
    this.orthoCamera.bottom = -orthoSpan;
    this.orthoCamera.position.copy(this.camera.position);
    this.orthoCamera.quaternion.copy(this.camera.quaternion);
    this.orthoCamera.updateProjectionMatrix();
  }

  setActive(active) {
    this._active = Boolean(active);
    if (!this._active) {
      if (this._frame) cancelAnimationFrame(this._frame);
      this._frame = 0;
      this.clock.stop();
      return;
    }
    if (this._frame) return;
    this.resize();
    this.clock.start();
    this._frame = requestAnimationFrame(() => this._animate());
  }

  _animate() {
    if (!this._active || document.hidden) {
      this._frame = 0;
      return;
    }
    this._frame = requestAnimationFrame(() => this._animate());
    const delta = Math.min(this.clock.getDelta(), 0.05);
    if (this.playing && delta > 0) {
      if (this.mixer) this.mixer.update(delta * this.speed);
      if (this.remoteModel) this.remoteModel.rotation.y += delta * 0.025 * this.speed;
      else this._animateProcedural(delta * this.speed);
    }
    this.controls.update(delta);
    this.renderer.render(this.scene, this.camera);
    if (this.labels) this._updateLabels();
  }

  _animateProcedural(delta) {
    this.simTime += delta;
    const beatRate = 5;
    const escapeTeeth = 15;
    const nextBeat = Math.floor(this.simTime * beatRate);
    const escapeAngle = nextBeat * (TAU / (2 * escapeTeeth));
    if (nextBeat !== this._beatIndex) this._beatIndex = nextBeat;

    const fourthAngle = -escapeAngle * 8 / 80;
    const thirdAngle = -fourthAngle * 8 / 64;
    const centerAngle = -thirdAngle * 8 / 60;
    const barrelAngle = -centerAngle * 8 / 54;
    const rotations = {
      'BARREL WHEEL': barrelAngle,
      'CENTER WHEEL / PINION': centerAngle,
      'THIRD WHEEL / PINION': thirdAngle,
      'FOURTH WHEEL / PINION': fourthAngle,
      'ESCAPE WHEEL / PINION': escapeAngle,
      'BALANCE ASSEMBLY': Math.sin(this.simTime * Math.PI * beatRate) * 0.78,
      'PALLET FORK': Math.sin(this.simTime * Math.PI * beatRate + 0.12) * 0.2,
      'SMALL SECONDS HAND': fourthAngle,
      'CENTRAL SECONDS HAND': fourthAngle,
      'MINUTE HAND': centerAngle,
      'HOUR HAND': centerAngle / 12
    };
    this.parts.forEach(part => {
      const name = part.userData.part;
      if (Object.hasOwn(rotations, name)) part.rotation.z = rotations[name];
    });

    if (this.rotor) this.rotor.rotation.z = Math.sin(this.simTime * 0.55) * 0.7 + Math.sin(this.simTime * 0.19) * 0.22;
    if (this.modelType === 'minute-repeater') {
      this.parts.forEach(part => {
        if (part.userData.repeaterHammer && part.userData.baseRotation) {
          const phase = part.userData.part === 'REPEATER HOUR HAMMER' ? 0 : 1.15;
          const strike = Math.max(0, Math.sin(this.simTime * 3.7 + phase));
          part.rotation.z = part.userData.baseRotation.z + strike * 0.34;
        }
        if (part.userData.part === 'REPEATER GOVERNOR' && part.userData.baseRotation) {
          part.rotation.z = part.userData.baseRotation.z + this.simTime * 3.4;
        }
      });
    }
    if (this.tourbillonOuterCage) this.tourbillonOuterCage.rotation.z = this.simTime * TAU / 60;
    if (this.tourbillonCage) {
      if (this.modelType === 'double-tourbillon') this.tourbillonCage.rotation.x = this.simTime * TAU / 38;
      else this.tourbillonCage.rotation.z = this.simTime * TAU / 60;
    }
    const balance = this.parts.find(part => part.userData.part === 'BALANCE ASSEMBLY');
    const hairspring = balance?.userData.hairspring;
    if (hairspring?.userData.basePositions) {
      const positions = hairspring.geometry.attributes.position;
      const base = hairspring.userData.basePositions;
      const tubeSegments = hairspring.userData.tubeSegments;
      const radialSegments = hairspring.userData.radialSegments;
      const angle = balance.rotation.z;

      for (let segment = 0; segment <= tubeSegments; segment++) {
        const twist = -angle * segment / tubeSegments;
        const cosine = Math.cos(twist);
        const sine = Math.sin(twist);

        for (let side = 0; side <= radialSegments; side++) {
          const index = (segment * (radialSegments + 1) + side) * 3;
          const x = base[index];
          const y = base[index + 1];
          positions.array[index] = x * cosine - y * sine;
          positions.array[index + 1] = x * sine + y * cosine;
          positions.array[index + 2] = base[index + 2];
        }
      }

      positions.needsUpdate = true;
      hairspring.geometry.computeVertexNormals();
    }
  }

  dispose() {
    this.setActive(false);
    removeEventListener('resize', this._resize);
    this.canvas.removeEventListener('click', this._onClick);
    this._clearModel();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
