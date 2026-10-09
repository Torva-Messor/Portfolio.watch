import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

function fileKey(value) {
  const clean = decodeURIComponent(String(value).split(/[?#]/)[0]);
  return clean.slice(clean.lastIndexOf('/') + 1).toLowerCase();
}

export class GLBLab {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf4f1ea);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(0, 0, 6.5);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 18;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8f8b82, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(-3, 4, 6);
    this.scene.add(key);

    this.root = null;
    this.sourceScene = null;
    this.mixer = null;
    this.auto = false;
    this.wire = false;
    this.clock = new THREE.Clock();
    this.active = false;
    this.frameId = 0;
    this.parts = [];
    this.selected = null;
    this.explode = 0;
    this.homeCameraPosition = this.camera.position.clone();
    this.homeTarget = this.controls.target.clone();
    this._loadRequestId = 0;
    this._resize = () => this.resize();
    this._click = event => this.pick(event.clientX, event.clientY);
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    addEventListener('resize', this._resize, { passive: true });
    canvas.addEventListener('click', this._click);
    this.resize();
  }

  async load(fileList) {
    const requestId = ++this._loadRequestId;
    const files = Array.from(fileList || []).filter(file => file instanceof File);
    if (!files.length) throw new Error('Choose a GLB or glTF file.');

    const mainFile = files.find(file => /\.glb$/i.test(file.name)) || files.find(file => /\.gltf$/i.test(file.name));
    if (!mainFile) throw new Error('Choose a .glb or .gltf as the main model file.');

    const urls = new Map();
    files.forEach(file => urls.set(fileKey(file.name), URL.createObjectURL(file)));
    const mainUrl = urls.get(fileKey(mainFile.name));
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => urls.get(fileKey(url)) || url);

    try {
      const gltf = await new GLTFLoader(manager).loadAsync(mainUrl);
      if (requestId !== this._loadRequestId) {
        this._disposeObject(gltf.scene);
        return { stale: true };
      }

      this._disposeCurrentModel();
      this.wire = false;
      this.auto = false;

      gltf.scene.updateMatrixWorld(true);
      const overallBounds = new THREE.Box3().setFromObject(gltf.scene);
      let mainPlate = null;
      gltf.scene.traverse(object => {
        if (!mainPlate && object.isMesh && /main plate/i.test(object.name || '')) mainPlate = object;
      });
      const anchorBounds = mainPlate ? new THREE.Box3().setFromObject(mainPlate) : overallBounds;
      const center = anchorBounds.getCenter(new THREE.Vector3());
      const anchorSize = anchorBounds.getSize(new THREE.Vector3());
      const maxDimension = Math.max(anchorSize.x, anchorSize.y, anchorSize.z) || 1;

      const pivot = new THREE.Group();
      pivot.name = 'CAD MOVEMENT PIVOT';
      pivot.scale.setScalar(3.8 / maxDimension);
      // Fit and centre to the movement plate, not a long crown/winding stem.
      // The pivot's scale also scales this local translation into the correct units.
      gltf.scene.position.copy(center).negate();
      pivot.add(gltf.scene);
      this.scene.add(pivot);
      this.root = pivot;
      this.sourceScene = gltf.scene;
      this.mixer = gltf.animations.length ? new THREE.AnimationMixer(gltf.scene) : null;
      gltf.animations.forEach(clip => this.mixer.clipAction(clip).play());
      this.root.updateMatrixWorld(true);
      this._registerParts();
      this.resize();
      this._fitCameraToModel();

      const materials = new Set();
      const nodes = [];
      let vertices = 0;
      this.sourceScene.traverse(object => {
        nodes.push({ object, name: object.name || '(unnamed)', mesh: Boolean(object.isMesh), depth: this.depth(object) });
        if (object.isMesh) {
          const materialList = Array.isArray(object.material) ? object.material : [object.material];
          materialList.forEach(material => materials.add(material));
          if (object.geometry?.attributes?.position) vertices += object.geometry.attributes.position.count;
        }
      });

      return {
        name: mainFile.name,
        size: mainFile.size,
        nodes: nodes.length,
        meshes: this.parts.length,
        vertices,
        materials: materials.size,
        animations: gltf.animations.length,
        tree: nodes
      };
    } catch (error) {
      if (requestId !== this._loadRequestId) return { stale: true };
      throw error;
    } finally {
      urls.forEach(url => URL.revokeObjectURL(url));
    }
  }

  _registerParts() {
    this.parts = [];
    this.selected = null;
    this.explode = 0;
    this.root.updateMatrixWorld(true);
    const modelBounds = new THREE.Box3().setFromObject(this.root);
    const modelSize = modelBounds.getSize(new THREE.Vector3());
    const modelSpan = Math.max(modelSize.x, modelSize.y, modelSize.z) || 1;
    // Compute the source components before applying offsets; Object3D.traverse does
    // not provide a useful index parameter, and each visible mesh needs a stable slot.
    const meshObjects = [];
    let anchor = null;
    this.sourceScene.traverse(object => {
      if (!object.isMesh) return;
      meshObjects.push(object);
      if (!anchor && /main plate/i.test(object.name || '')) anchor = object;
    });
    const anchorBounds = anchor ? new THREE.Box3().setFromObject(anchor) : modelBounds;
    const center = anchorBounds.getCenter(new THREE.Vector3());
    const explodeDistance = modelSpan * 0.16;
    const goldenAngle = 2.399963229728653;

    meshObjects.forEach((object, index) => {
      object.userData.basePosition = object.position.clone();
      object.userData.baseRotation = object.rotation.clone();
      object.userData.originalVisible = object.visible;
      object.userData.part = object.name?.trim() || `MESH ${String(index + 1).padStart(2, '0')}`;

      // Use real geometry bounds, not mesh object origins: CAD vertex coordinates are
      // frequently baked into meshes, making getWorldPosition identical for all parts.
      const partBounds = new THREE.Box3().setFromObject(object);
      const partCenter = partBounds.getCenter(new THREE.Vector3());
      const outward = partCenter.clone().sub(center);
      const fraction = (index + 0.5) / Math.max(meshObjects.length, 1);
      const sphereZ = 1 - 2 * fraction;
      const sphereRadius = Math.sqrt(Math.max(0, 1 - sphereZ * sphereZ));
      const phase = index * goldenAngle;
      const spread = new THREE.Vector3(
        sphereRadius * Math.cos(phase),
        sphereRadius * Math.sin(phase),
        sphereZ
      );
      if (outward.length() < modelSpan * 0.025) outward.copy(spread);
      else outward.normalize().multiplyScalar(0.78).addScaledVector(spread, 0.72).normalize();
      const worldOffset = outward.normalize().multiplyScalar(explodeDistance);

      const originWorld = object.getWorldPosition(new THREE.Vector3());
      const parent = object.parent;
      const baseInParent = parent.worldToLocal(originWorld.clone());
      const targetInParent = parent.worldToLocal(originWorld.clone().add(worldOffset));
      // Keep the main plate fixed as the assembly datum. Every other mesh gets its own
      // non-zero, same-length 3D offset, even when all mesh origins were at zero.
      object.userData.explodeVector = /main plate/i.test(object.userData.part)
        ? new THREE.Vector3()
        : targetInParent.sub(baseInParent);
      this.parts.push(object);
    });
  }

  _fitCameraToModel() {
    if (!this.root) return;
    this.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.root);
    if (bounds.isEmpty()) return;
    const size = bounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.x) || Math.max(size.x, size.y, size.z) <= 0) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
    const aspect = Math.max(this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight), 0.25);
    const horizontalHalfFov = Math.atan(Math.tan(halfFov) * aspect);
    const maxSpan = Math.max(size.x, size.y, size.z);
    // Include a safety envelope for the maximum exploded positions, especially on phones.
    const fitWidth = size.x + maxSpan * 0.32;
    const fitHeight = size.y + maxSpan * 0.32;
    const fitDepth = size.z + maxSpan * 0.32;
    const distance = Math.max(
      fitHeight / (2 * Math.tan(halfFov)),
      fitWidth / (2 * Math.tan(horizontalHalfFov))
    ) * 1.10 + fitDepth * 0.5;
    this.camera.position.copy(center).add(new THREE.Vector3(0, 0, Math.max(4.5, distance)));
    this.controls.target.copy(center);
    this.controls.minDistance = Math.max(2, distance * 0.38);
    this.controls.maxDistance = Math.max(18, distance * 4);
    this.controls.update();
    this.homeCameraPosition.copy(this.camera.position);
    this.homeTarget.copy(this.controls.target);
  }

  depth(object) {
    let depth = 0;
    while (object.parent && object.parent !== this.sourceScene) {
      depth++;
      object = object.parent;
    }
    return depth;
  }

  setExplode(value) {
    this.explode = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
    this.parts.forEach(part => {
      if (!part.userData.basePosition || !part.userData.explodeVector) return;
      part.position.copy(part.userData.basePosition).addScaledVector(part.userData.explodeVector, this.explode);
    });
  }

  _restoreSelectedMaterial() {
    const object = this.selected;
    if (!object || !Object.prototype.hasOwnProperty.call(object.userData, '_glbOriginalMaterial')) {
      this.selected = null;
      return;
    }
    const highlighted = Array.isArray(object.material) ? object.material : [object.material];
    object.material = object.userData._glbOriginalMaterial;
    const originals = Array.isArray(object.material) ? object.material : [object.material];
    highlighted.forEach(material => {
      if (material && !originals.includes(material)) material.dispose();
    });
    delete object.userData._glbOriginalMaterial;
    this.selected = null;
  }

  select(object) {
    if (!object?.isMesh) return;
    if (this.selected === object) {
      const status = document.querySelector('#glb-status');
      if (status) status.textContent = `SELECTED: ${object.userData.part || object.name || 'MESH'}`;
      return;
    }
    this._restoreSelectedMaterial();
    object.userData._glbOriginalMaterial = object.material;
    const accent = new THREE.Color(0xb7955e);
    const highlight = material => {
      if (!material) return material;
      const clone = material.clone();
      if (clone.color?.isColor) clone.color.lerp(accent, 0.24);
      if (this.wire) clone.wireframe = true;
      if (clone.emissive?.isColor) {
        clone.emissive.copy(accent).multiplyScalar(0.12);
        clone.emissiveIntensity = Math.max(Number(clone.emissiveIntensity) || 0, 0.18);
      }
      return clone;
    };
    object.material = Array.isArray(object.material) ? object.material.map(highlight) : highlight(object.material);
    this.selected = object;
    const status = document.querySelector('#glb-status');
    if (status) status.textContent = `SELECTED: ${object.userData.part || object.name || 'MESH'}`;
  }

  pick(clientX, clientY) {
    if (!this.root) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this._pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hit = this._raycaster.intersectObjects(this.root.children, true).find(result => result.object.isMesh);
    if (hit) this.select(hit.object);
  }

  isolateSelected() {
    if (!this.root || !this.selected) return false;
    const isolate = !this.selected.userData.isolated;
    this.parts.forEach(part => {
      part.visible = isolate ? part === this.selected : (part.userData.originalVisible ?? true);
    });
    this.selected.userData.isolated = isolate;
    return isolate;
  }

  disposeCurrentModel() {
    this._disposeCurrentModel();
  }

  _disposeObject(root) {
    if (!root) return;
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      const original = object.userData?._glbOriginalMaterial;
      const originalList = Array.isArray(original) ? original : original ? [original] : [];
      [...list, ...originalList].forEach(material => {
        materials.add(material);
        Object.values(material).forEach(value => {
          if (value?.isTexture) textures.add(value);
        });
      });
    });
    geometries.forEach(geometry => geometry.dispose());
    textures.forEach(texture => texture.dispose());
    materials.forEach(material => material.dispose());


  }

  _disposeCurrentModel() {
    if (!this.root) return;
    this._disposeObject(this.root);
    this.scene.remove(this.root);
    this.root = null;
    this.sourceScene = null;
    this.mixer = null;
    this.parts = [];
    this.selected = null;
    this.explode = 0;
  }

  resize() {
    const width = this.canvas.clientWidth || this.canvas.parentElement?.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || this.canvas.parentElement?.clientHeight || window.innerHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  reset() {
    this._restoreSelectedMaterial();
    this.setExplode(0);
    this.auto = false;
    this.setWire(false);
    this.controls.reset();
    this.camera.position.copy(this.homeCameraPosition);
    this.controls.target.copy(this.homeTarget);
    if (this.root) this.root.rotation.set(0, 0, 0);
    this.parts.forEach(part => {
      part.visible = part.userData.originalVisible ?? true;
      if (part.userData.basePosition) part.position.copy(part.userData.basePosition);
      if (part.userData.baseRotation) part.rotation.copy(part.userData.baseRotation);
      delete part.userData.isolated;
    });
    this.controls.update();
    const status = document.querySelector('#glb-status');
    if (status && this.root) status.textContent = 'MODEL READY / SELECT A PART TO INSPECT';
  }

  setWire(value) {
    this.wire = Boolean(value);
    this.root?.traverse(object => {
      if (!object.isMesh) return;
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.forEach(material => {
        if (material.userData.originalWireframe === undefined) material.userData.originalWireframe = material.wireframe;
        material.wireframe = this.wire || material.userData.originalWireframe;
      });
    });
  }

  setActive(active) {
    this.active = Boolean(active);
    if (!this.active) {
      if (this.frameId) cancelAnimationFrame(this.frameId);
      this.frameId = 0;
      this.clock.stop();
      return;
    }
    if (this.frameId) return;
    this.resize();
    this.clock.start();
    this.frameId = requestAnimationFrame(() => this.animate());
  }

  animate() {
    if (!this.active || document.hidden) {
      this.frameId = 0;
      return;
    }
    this.frameId = requestAnimationFrame(() => this.animate());
    const delta = Math.min(this.clock.getDelta(), 0.05);
    if (this.mixer) this.mixer.update(delta);
    if (this.auto && this.root) this.root.rotation.y += delta * 0.25;
    this.controls.update(delta);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.setActive(false);
    removeEventListener('resize', this._resize);
    this.canvas.removeEventListener('click', this._click);
    this._disposeCurrentModel();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
