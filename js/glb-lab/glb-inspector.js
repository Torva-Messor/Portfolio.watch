import { GLBLab } from './glb-loader.js';

const byId = id => document.getElementById(id);

export function initGLBLab() {
  const canvas = byId('glb-canvas');
  const lab = new GLBLab(canvas);
  const fileInput = byId('glb-file');
  const dropZone = byId('glb-drop');
  const status = byId('glb-status');
  const stats = byId('glb-stats');
  const tree = byId('glb-tree');
  const explode = byId('glb-explode');
  const explodeOut = byId('glb-explode-out');
  const configuredModel = byId('glb-lab')?.dataset.publicModel || 'models/ETA-6497-1-Movement-Gold-Jewels.glb';
  let publicModelChecked = false;

  function renderStats(details) {
    const rows = [
      ['MODEL', details.name],
      ['SIZE', `${(details.size / 1024 / 1024).toFixed(2)} MB`],
      ['NODES', details.nodes],
      ['MESHES', details.meshes],
      ['VERTICES', details.vertices.toLocaleString()],
      ['MATERIALS', details.materials],
      ['ANIMATIONS', details.animations]
    ];
    stats.replaceChildren();
    rows.forEach(([label, value]) => {
      const row = document.createElement('div');
      const name = document.createElement('span');
      const detail = document.createElement('b');
      name.textContent = label;
      detail.textContent = value;
      row.append(name, detail);
      stats.append(row);
    });

    tree.replaceChildren();
    const heading = document.createElement('div');
    heading.className = 'eyebrow';
    heading.textContent = 'NODE TREE · SELECT A MESH TO INSPECT';
    tree.append(heading);
    details.tree.slice(0, 120).forEach(node => {
      const line = document.createElement(node.mesh ? 'button' : 'div');
      line.className = node.mesh ? 'glb-tree-node mesh' : 'glb-tree-node';
      line.style.paddingLeft = `${Math.min(node.depth, 12) * 6}px`;
      line.textContent = `${node.mesh ? '◼' : '◻'} ${node.name}`;
      if (node.mesh) {
        line.type = 'button';
        line.addEventListener('click', () => lab.select(node.object));
      }
      tree.append(line);
    });
  }

  async function load(files) {
    if (!files?.length) return;
    status.textContent = 'LOADING MODEL';
    try {
      const details = await lab.load(files);
      if (details?.stale) return;
      renderStats(details);
      status.textContent = details.meshes > 1
        ? 'MODEL LOADED / SELECT A PART OR EXPLODE'
        : 'MODEL LOADED / SINGLE MESH — LIMITED EXPLODE';
      explode.value = '0';
      explodeOut.value = '0%';
      byId('glb-auto').textContent = 'AUTO ROTATE';
      byId('glb-wire').textContent = 'WIREFRAME';
      byId('glb-isolate').textContent = 'ISOLATE';
    } catch (error) {
      console.error('Could not load the watch model:', error);
      status.textContent = error.message || 'UNABLE TO LOAD MODEL';
      const row = document.createElement('div');
      const label = document.createElement('span');
      const detail = document.createElement('b');
      label.textContent = 'ERROR';
      detail.textContent = 'LOAD FAILED';
      row.append(label, detail);
      stats.replaceChildren(row);
      tree.textContent = 'Choose a valid glTF 2.0 / GLB file. For .gltf, include its referenced binary and texture files. For a public model, place a separated watch movement at models/ETA-6497-1-Movement-Gold-Jewels.glb and deploy the site again.';
    }
  }

  async function checkForPublicModel() {
    if (publicModelChecked) return;
    publicModelChecked = true;
    const url = new URL(configuredModel, document.baseURI);
    status.textContent = 'CHECKING FOR PUBLIC MOVEMENT MODEL';
    try {
      const response = await fetch(url.href, { cache: 'no-store' });
      if (!response.ok) {
        status.textContent = 'NO PUBLIC MOVEMENT MODEL YET';
        tree.textContent = `To enable the same inspection for every visitor, add a separated GLB assembly at ${configuredModel} in the repository and redeploy. You can still load a local model below for private testing.`;
        return;
      }
      const blob = await response.blob();
      const filename = url.pathname.split('/').pop() || 'ETA-6497-1-Movement-Gold-Jewels.glb';
      const file = new File([blob], filename, { type: 'model/gltf-binary' });
      await load([file]);
    } catch (error) {
      status.textContent = 'PUBLIC MODEL COULD NOT BE LOADED';
      tree.textContent = `Check that ${configuredModel} exists in the published site and that the URL matches the repository path. ${error?.message || ''}`.trim();
    }
  }

  fileInput.addEventListener('change', event => load(event.currentTarget.files));
  ['dragenter', 'dragover'].forEach(type => dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.classList.add('is-drag');
  }));
  ['dragleave', 'drop'].forEach(type => dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.classList.remove('is-drag');
  }));
  dropZone.addEventListener('drop', event => load(event.dataTransfer.files));

  byId('glb-auto').addEventListener('click', event => {
    lab.auto = !lab.auto;
    event.currentTarget.textContent = lab.auto ? 'AUTO ROTATE / ON' : 'AUTO ROTATE';
  });
  byId('glb-wire').addEventListener('click', event => {
    lab.setWire(!lab.wire);
    event.currentTarget.textContent = lab.wire ? 'WIREFRAME / ON' : 'WIREFRAME';
  });
  byId('glb-isolate').addEventListener('click', event => {
    const isolated = lab.isolateSelected();
    event.currentTarget.textContent = isolated ? 'SHOW ALL' : 'ISOLATE';
  });
  explode.addEventListener('input', event => {
    const amount = Number(event.currentTarget.value);
    lab.setExplode(amount);
    explodeOut.value = `${Math.round(amount * 100)}%`;
  });
  byId('glb-reset').addEventListener('click', () => {
    lab.reset();
    explode.value = '0';
    explodeOut.value = '0%';
    byId('glb-auto').textContent = 'AUTO ROTATE';
    byId('glb-wire').textContent = 'WIREFRAME';
    byId('glb-isolate').textContent = 'ISOLATE';
  });

  void checkForPublicModel();
  return lab;
}
