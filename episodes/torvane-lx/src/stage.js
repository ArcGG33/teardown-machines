// Black studio: the look comes from what the metal reflects. A procedural environment of strip lights
// (white behind, warm copper at the back edges, a little ice blue low in front), one shadow-casting key,
// a copper rim and a blue working light. No image files, so every machine renders the same picture.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {camPos} from './timeline.js';

const rad = (d) => (d * Math.PI) / 180;
const COPPER = [1.0, 0.42, 0.13];   // AX Lab copper #D87349, pushed for light
const ICE = [0.5, 0.8, 1.0];

// Where the lights sit, as azimuths around the machine (deg). Each format looks from a different side.
const RIG = {
  landscape: {view: 46, key: 5, rim: 205, rim2: -95, blue: -8},
  portrait: {view: 18, key: -30, rim: 185, rim2: -120, blue: -40},
};

function dir(az, el, r, out = new THREE.Vector3()) {
  return out.set(r * Math.cos(rad(el)) * Math.cos(rad(az)), r * Math.sin(rad(el)), r * Math.cos(rad(el)) * Math.sin(rad(az)));
}

function buildEnvironment(renderer, view) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x000000);
  const R = 10;
  // A glowing panel on the studio sphere: centre az/el, angular size w/h (deg), colour * intensity.
  const panel = (az, el, w, h, rgb, k) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(2 * R * Math.tan(rad(w / 2)), 2 * R * Math.tan(rad(h / 2))),
      new THREE.MeshBasicMaterial({color: new THREE.Color(rgb[0] * k, rgb[1] * k, rgb[2] * k), side: THREE.DoubleSide}));
    dir(az, el, R, m.position);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  const W = [1, 0.97, 0.93], back = view + 180;
  panel(back, 10, 70, 6, W, 6.5);          // low strip behind: the streak across every top face
  panel(back, 27, 80, 14, W, 2.4);         // soft box above it
  panel(back + 8, 62, 50, 16, W, 1.1);     // overhead
  panel(view + 112, 22, 9, 46, COPPER, 11); // copper edge, back left
  panel(view - 118, 18, 7, 38, COPPER, 7);  // copper edge, back right
  panel(view - 52, 9, 16, 8, ICE, 2.6);    // ice blue, low in front
  panel(view, 14, 90, 30, W, 0.22);        // faint front fill so faces toward the lens are graphite, not void
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.035, 0.1, 100).texture;
  pm.dispose();
  return tex;
}

function floorAlpha() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  grd.addColorStop(0, '#fff'); grd.addColorStop(0.45, '#bbb'); grd.addColorStop(1, '#000');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
  return new THREE.CanvasTexture(c);
}

export function createStage(canvas, {format, capture = false, bloom = true, shadowSize = 2048}) {
  const rig = RIG[format];
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: capture, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = buildEnvironment(renderer, rig.view);

  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 20, 9000);

  const key = new THREE.SpotLight(0xfff4e8, 0, 0, 0.42, 1, 0);
  dir(rig.key, 58, 2400, key.position).add(new THREE.Vector3(-60, 0, 0));
  key.target.position.set(-60, 40, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  key.shadow.camera.near = 900; key.shadow.camera.far = 4200;
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.6; key.shadow.radius = 5;
  scene.add(key, key.target);

  const rim = new THREE.DirectionalLight(new THREE.Color(...COPPER), 0);
  dir(rig.rim, 24, 1000, rim.position);
  const rim2 = new THREE.DirectionalLight(new THREE.Color(...COPPER), 0);
  dir(rig.rim2, 14, 1000, rim2.position);
  const blue = new THREE.DirectionalLight(new THREE.Color(...ICE), 0);
  dir(rig.blue, 16, 1000, blue.position);
  scene.add(rim, rim2, blue);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(3200, 64),
    new THREE.MeshStandardMaterial({color: 0x0b0b0c, roughness: 0.6, metalness: 0, envMapIntensity: 0.02, alphaMap: floorAlpha(), transparent: true}));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(-60, -0.05, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  let composer = null, bloomPass = null;
  if (bloom) {
    const rt = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 4});
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.2, 0.55, 0.95);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }

  let led = null;
  const stage = {
    renderer, scene, camera, free: false,
    add(machine) { scene.add(machine.root); led = machine.materials.led; },
    resize(w, h, dpr) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      if (composer) { composer.setPixelRatio(dpr); composer.setSize(w, h); }
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    // Pose the camera and lights from the state without drawing (the overlay needs the camera matrices first).
    pose(S) {
      if (!stage.free) {
        camPos(S.cam, camera.position);
        camera.fov = S.cam.fov;
        camera.updateProjectionMatrix();
        camera.lookAt(S.cam.tx, S.cam.ty, S.cam.tz);
      }
      camera.updateMatrixWorld();
      const L = S.light;
      scene.environmentIntensity = L.env;
      scene.environmentRotation.y = L.sweep;
      key.intensity = 2.6 * L.key;
      rim.intensity = 3.2 * L.rim;
      rim2.intensity = 1.3 * L.rim;
      blue.intensity = 1.6 * L.blue;
      if (led) led.emissiveIntensity = 3 * L.led;
    },
    draw() { composer ? composer.render() : renderer.render(scene, camera); },
  };
  return stage;
}
