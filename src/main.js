import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  BODIES,
  BODY_BY_ID,
  formatSimulationDay,
  orbitVertices,
  positionAtDay,
} from "./simulation.js";
import "./style.css";

const canvas = document.querySelector("#space");
const fallback = document.querySelector("#webglFallback");
const bodyList = document.querySelector("#bodyList");
const dayReadout = document.querySelector("#dayReadout");
const focusName = document.querySelector("#focusName");
const focusDetail = document.querySelector("#focusDetail");
const speed = document.querySelector("#speed");
const scale = document.querySelector("#scale");
const playButton = document.querySelector("#playButton");

function startSimulation() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
  } catch {
    fallback.hidden = false;
    return;
  }

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x164e9b, 0.014);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 180);
  camera.position.set(20, 16, 28);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x164e9b, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.minDistance = 8;
  controls.maxDistance = 72;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xb8cfff, 0x273178, 1.6));
  const sunlight = new THREE.PointLight(0xffd096, 1150, 72, 1.7);
  scene.add(sunlight);

  const state = { day: 0, speed: 24, scale: 1, playing: true, focus: "sun" };
  const planetMeshes = new Map();
  const orbitLines = new Map();
  const sphere = new THREE.SphereGeometry(1, 30, 22);

  function makeStars() {
    const points = [];
    let seed = 511;
    const random = () =>
      ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let index = 0; index < 1100; index += 1) {
      const radius = 42 + Math.abs(random()) * 55;
      points.push(
        random() * radius,
        random() * radius * 0.72,
        random() * radius,
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3),
    );
    scene.add(
      new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          color: 0xe5edff,
          size: 0.11,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.76,
        }),
      ),
    );
  }

  function createPlanet(body) {
    const material = new THREE.MeshStandardMaterial({
      color: body.color,
      roughness: body.id === "sun" ? 0.7 : 0.84,
      metalness: 0.02,
      emissive: body.id === "sun" ? body.color : 0x000000,
      emissiveIntensity: body.id === "sun" ? 1.2 : 0,
    });
    const mesh = new THREE.Mesh(sphere, material);
    mesh.scale.setScalar(body.radius);
    planetMeshes.set(body.id, mesh);
    scene.add(mesh);
    if (body.id === "saturn") {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.32, 2.12, 72),
        new THREE.MeshBasicMaterial({
          color: 0xf9cf75,
          transparent: true,
          opacity: 0.57,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = Math.PI / 2.1;
      ring.scale.setScalar(body.radius);
      mesh.add(ring);
    }
  }

  function createOrbit(body) {
    if (!body.orbit) return;
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: body.id === "earth" ? 0xd0d7ff : 0x90a6f5,
        transparent: true,
        opacity: body.id === "earth" ? 0.58 : 0.3,
      }),
    );
    orbitLines.set(body.id, line);
    scene.add(line);
  }

  function refreshOrbits() {
    BODIES.forEach((body) => {
      const line = orbitLines.get(body.id);
      if (!line) return;
      line.geometry.setFromPoints(
        orbitVertices(body, 160, state.scale).map(
          ([x, y, z]) => new THREE.Vector3(x, y, z),
        ),
      );
    });
  }

  function updateBodies() {
    BODIES.forEach((body) =>
      planetMeshes
        .get(body.id)
        .position.set(...positionAtDay(body, state.day, state.scale)),
    );
  }

  function setFocus(id) {
    state.focus = id;
    const body = BODY_BY_ID[id];
    focusName.textContent = body.name;
    focusDetail.textContent = body.detail;
    document
      .querySelectorAll(".body-button")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.focus === id),
        ),
      );
  }

  function buildBodyList() {
    BODIES.forEach((body) => {
      const button = document.createElement("button");
      button.className = "body-button";
      button.dataset.focus = body.id;
      button.setAttribute("aria-pressed", String(body.id === state.focus));
      button.innerHTML = `<i style="--body-color:${body.color}"></i><span>${body.name}</span><small>${body.orbit ? `${body.period.toLocaleString("ja-JP", { maximumFractionDigits: 0 })}日` : "中心"}</small>`;
      button.addEventListener("click", () => setFocus(body.id));
      bodyList.append(button);
    });
  }

  function resize() {
    const { clientWidth, clientHeight } = canvas;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  }

  function togglePlay() {
    state.playing = !state.playing;
    playButton.setAttribute("aria-pressed", String(state.playing));
    playButton.innerHTML = state.playing
      ? '<span aria-hidden="true">Ⅱ</span> 時をとめる'
      : '<span aria-hidden="true">▶</span> 時をうごかす';
  }

  makeStars();
  BODIES.forEach((body) => {
    createPlanet(body);
    createOrbit(body);
  });
  buildBodyList();
  refreshOrbits();
  resize();
  new ResizeObserver(resize).observe(canvas);
  playButton.addEventListener("click", togglePlay);
  speed.addEventListener("input", ({ target }) => {
    state.speed = Number(target.value);
    document.querySelector("#speedValue").value = `${state.speed} 日 / 秒`;
  });
  scale.addEventListener("input", ({ target }) => {
    state.scale = Number(target.value) / 100;
    document.querySelector("#scaleValue").value = `${state.scale.toFixed(2)}×`;
    refreshOrbits();
  });

  const clock = new THREE.Clock();
  function animate() {
    const delta = Math.min(clock.getDelta(), 0.1);
    if (state.playing) state.day += delta * state.speed;
    updateBodies();
    controls.target.lerp(planetMeshes.get(state.focus).position, 0.055);
    controls.update();
    dayReadout.textContent = formatSimulationDay(state.day);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}

startSimulation();
