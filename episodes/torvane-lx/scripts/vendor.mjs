// Copies the browser modules the page imports from node_modules into vendor/, so the page runs from any static host
// with no build step. Run after changing the three or gsap version.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nm = path.join(root, 'node_modules');
const cp = (from, to) => {
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), {recursive: true});
  fs.copyFileSync(from, to);
  return true;
};

for (const f of ['three.module.min.js', 'three.core.min.js']) cp(path.join(nm, 'three/build', f), path.join(root, 'vendor/three', f));
cp(path.join(nm, 'three/LICENSE'), path.join(root, 'vendor/three/LICENSE'));
const addons = [
  'controls/OrbitControls.js', 'utils/BufferGeometryUtils.js',
  'postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js', 'postprocessing/ShaderPass.js', 'postprocessing/MaskPass.js',
  'postprocessing/Pass.js', 'postprocessing/UnrealBloomPass.js', 'postprocessing/OutputPass.js',
  'shaders/CopyShader.js', 'shaders/LuminosityHighPassShader.js', 'shaders/OutputShader.js',
];
for (const f of addons) if (!cp(path.join(nm, 'three/examples/jsm', f), path.join(root, 'vendor/three/addons', f))) throw new Error('missing ' + f);
for (const f of ['index.js', 'gsap-core.js', 'CSSPlugin.js']) if (!cp(path.join(nm, 'gsap', f), path.join(root, 'vendor/gsap', f))) throw new Error('missing gsap/' + f);
console.log('vendor/ updated');
