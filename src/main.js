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

  function makeRandom(seed) {
    let value = seed;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function makeSurface(body) {
    const surface = document.createElement("canvas");
    surface.width = 512;
    surface.height = 256;
    const context = surface.getContext("2d");
    const random = makeRandom(
      [...body.id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0),
    );
    context.fillStyle = body.color;
    context.fillRect(0, 0, surface.width, surface.height);

    const circle = (color, amount, size, alpha = 0.3) => {
      context.fillStyle = color;
      for (let index = 0; index < amount; index += 1) {
        context.globalAlpha = alpha * (0.45 + random() * 0.55);
        context.beginPath();
        context.arc(
          random() * surface.width,
          random() * surface.height,
          size * (0.45 + random()),
          0,
          Math.PI * 2,
        );
        context.fill();
      }
      context.globalAlpha = 1;
    };
    const bands = (colors, softness = 0, wobble = 12) => {
      colors.forEach((color, index) => {
        context.fillStyle = color;
        context.globalAlpha = 0.82;
        context.beginPath();
        const top = (index * surface.height) / colors.length;
        const bottom = ((index + 1) * surface.height) / colors.length + 2;
        context.moveTo(0, top + (random() - 0.5) * wobble);
        context.bezierCurveTo(
          180,
          top + (random() - 0.5) * wobble,
          340,
          top + (random() - 0.5) * wobble,
          512,
          top + (random() - 0.5) * wobble,
        );
        context.lineTo(512, bottom + (random() - 0.5) * wobble);
        context.bezierCurveTo(
          340,
          bottom + (random() - 0.5) * wobble,
          180,
          bottom + (random() - 0.5) * wobble,
          0,
          bottom + (random() - 0.5) * wobble,
        );
        context.closePath();
        context.fill();
      });
      context.globalAlpha = softness;
      context.strokeStyle = "#ffffff";
      context.lineWidth = 2;
      for (let index = 0; index < 14; index += 1) {
        context.beginPath();
        context.moveTo(0, random() * surface.height);
        context.bezierCurveTo(
          surface.width * 0.3,
          random() * surface.height,
          surface.width * 0.7,
          random() * surface.height,
          surface.width,
          random() * surface.height,
        );
        context.stroke();
      }
      context.globalAlpha = 1;
    };
    const swirls = (color, amount, width, alpha = 0.25) => {
      context.strokeStyle = color;
      context.lineWidth = width;
      context.lineCap = "round";
      for (let index = 0; index < amount; index += 1) {
        const y = random() * surface.height;
        context.globalAlpha = alpha * (0.45 + random() * 0.55);
        context.beginPath();
        context.moveTo(-20, y);
        context.bezierCurveTo(
          120,
          y - 35 + random() * 70,
          340,
          y - 35 + random() * 70,
          532,
          y - 22 + random() * 44,
        );
        context.stroke();
      }
      context.globalAlpha = 1;
    };
    const continent = (color, amount, size) => {
      context.fillStyle = color;
      for (let index = 0; index < amount; index += 1) {
        const x = random() * surface.width;
        const y = 25 + random() * (surface.height - 50);
        context.globalAlpha = 0.72 + random() * 0.2;
        context.beginPath();
        for (let point = 0; point < 9; point += 1) {
          const angle = (point / 9) * Math.PI * 2;
          const radius = size * (0.45 + random() * 0.75);
          const pointX = x + Math.cos(angle) * radius;
          const pointY = y + Math.sin(angle) * radius * (0.5 + random() * 0.35);
          point === 0
            ? context.moveTo(pointX, pointY)
            : context.lineTo(pointX, pointY);
        }
        context.closePath();
        context.fill();
      }
      context.globalAlpha = 1;
    };

    if (body.id === "sun") {
      const glow = context.createRadialGradient(256, 128, 4, 256, 128, 210);
      glow.addColorStop(0, "#fff4bc");
      glow.addColorStop(0.52, "#ffcf63");
      glow.addColorStop(1, "#e88731");
      context.fillStyle = glow;
      context.fillRect(0, 0, 512, 256);
      circle("#d66024", 86, 13, 0.23);
      circle("#fff0a0", 62, 8, 0.27);
      swirls("#fff3b2", 24, 3, 0.3);
      swirls("#d55b28", 18, 5, 0.22);
      context.fillStyle = "#b94428";
      context.globalAlpha = 0.62;
      for (let index = 0; index < 12; index += 1) {
        context.beginPath();
        context.ellipse(
          random() * 512,
          random() * 256,
          7 + random() * 14,
          3 + random() * 6,
          random() * Math.PI,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
      context.globalAlpha = 1;
    } else if (body.id === "earth") {
      const ocean = context.createLinearGradient(0, 0, 512, 256);
      ocean.addColorStop(0, "#123f91");
      ocean.addColorStop(0.48, "#2d96ca");
      ocean.addColorStop(1, "#174b9c");
      context.fillStyle = ocean;
      context.fillRect(0, 0, 512, 256);
      continent("#4da16b", 12, 31);
      continent("#c8b66c", 7, 17);
      circle("#8fcf88", 38, 4, 0.2);
      swirls("#f5fbff", 24, 3, 0.42);
      context.fillStyle = "rgba(244, 251, 255, .75)";
      context.fillRect(0, 0, 512, 18);
      context.fillRect(0, 238, 512, 18);
    } else if (body.id === "jupiter") {
      bands(
        [
          "#e4bc8e",
          "#a96643",
          "#f0ce9b",
          "#c28158",
          "#e7bd89",
          "#8e503b",
          "#f4d4a4",
        ],
        0.12,
        19,
      );
      swirls("#fff0c8", 32, 3, 0.25);
      swirls("#7e4337", 18, 4, 0.2);
      context.fillStyle = "#b84d36";
      context.beginPath();
      context.ellipse(352, 150, 49, 23, -0.12, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#f3b078";
      context.lineWidth = 3;
      context.beginPath();
      context.ellipse(352, 150, 57, 28, -0.12, 0, Math.PI * 2);
      context.stroke();
    } else if (body.id === "saturn") {
      bands(
        ["#ead18d", "#c9a66b", "#f2dd9c", "#b9905e", "#edd69b", "#c29c67"],
        0.08,
        11,
      );
      swirls("#fff1be", 24, 2, 0.3);
    } else if (body.id === "venus") {
      bands(["#c98c4b", "#f2c773", "#e7ae5a", "#f8d784", "#d7984f"], 0.16, 18);
      swirls("#fff0ac", 28, 4, 0.35);
    } else {
      circle(
        body.id === "mars" ? "#792d28" : "#4b4d58",
        body.id === "mars" ? 42 : 58,
        body.id === "mars" ? 10 : 7,
      );
      circle("#e1b079", body.id === "mars" ? 18 : 26, 4);
      swirls(body.id === "mars" ? "#f0a06b" : "#aab1c9", 18, 1.5, 0.25);
    }

    const texture = new THREE.CanvasTexture(surface);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

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

  function addSolarCorona(mesh) {
    const corona = new THREE.Group();
    const random = makeRandom(1977);
    const colors = [0xfff1a1, 0xffc95d, 0xff9254];
    for (let index = 0; index < 24; index += 1) {
      const longitude = random() * Math.PI * 2;
      const latitude = (random() - 0.5) * 1.35;
      const normal = new THREE.Vector3(
        Math.cos(latitude) * Math.cos(longitude),
        Math.sin(latitude),
        Math.cos(latitude) * Math.sin(longitude),
      );
      const tangent = new THREE.Vector3(
        -Math.sin(longitude),
        0,
        Math.cos(longitude),
      );
      const end = normal
        .clone()
        .applyAxisAngle(tangent, (random() - 0.5) * 0.72)
        .normalize();
      const lift = 0.38 + random() * 0.34;
      const curve = new THREE.CubicBezierCurve3(
        normal.clone().multiplyScalar(1.01),
        normal
          .clone()
          .multiplyScalar(1 + lift)
          .addScaledVector(tangent, 0.18),
        end
          .clone()
          .multiplyScalar(1 + lift)
          .addScaledVector(tangent, -0.18),
        end.multiplyScalar(1.01),
      );
      const flare = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(12)),
        new THREE.LineBasicMaterial({
          color: colors[index % colors.length],
          transparent: true,
          opacity: 0.2 + random() * 0.25,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      flare.userData.phase = random() * Math.PI * 2;
      corona.add(flare);
    }
    corona.rotation.x = -0.28;
    mesh.userData.corona = corona;
    mesh.add(corona);
  }

  function createPlanet(body) {
    const surface = makeSurface(body);
    const material = new THREE.MeshStandardMaterial({
      color: body.color,
      map: surface,
      roughness: body.id === "sun" ? 0.7 : 0.84,
      metalness: 0.02,
      emissive: body.id === "sun" ? body.color : 0x000000,
      emissiveMap: body.id === "sun" ? surface : null,
      emissiveIntensity: body.id === "sun" ? 1.2 : 0,
    });
    const mesh = new THREE.Mesh(sphere, material);
    mesh.scale.setScalar(body.radius);
    mesh.userData.rotationSpeed =
      body.id === "sun" ? 0.0018 : 0.0005 + body.radius * 0.0006;
    planetMeshes.set(body.id, mesh);
    scene.add(mesh);
    if (body.id === "sun" || body.id === "earth") {
      const aura = new THREE.Mesh(
        sphere,
        new THREE.MeshBasicMaterial({
          color: body.id === "sun" ? 0xffb74d : 0x75caff,
          transparent: true,
          opacity: body.id === "sun" ? 0.18 : 0.13,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      aura.scale.setScalar(body.id === "sun" ? 1.22 : 1.08);
      mesh.add(aura);
    }
    if (body.id === "sun") addSolarCorona(mesh);
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

  function updateBodies(elapsed) {
    BODIES.forEach((body) => {
      const mesh = planetMeshes.get(body.id);
      mesh.position.set(...positionAtDay(body, state.day, state.scale));
      mesh.rotation.y += mesh.userData.rotationSpeed;
      if (mesh.userData.corona) {
        const corona = mesh.userData.corona;
        corona.rotation.y -= 0.0011;
        corona.rotation.z = Math.sin(elapsed * 0.42) * 0.075;
        corona.children.forEach((flare) => {
          const pulse = 0.14 * Math.sin(elapsed * 1.7 + flare.userData.phase);
          flare.scale.setScalar(1 + pulse);
          flare.material.opacity = 0.3 + pulse;
        });
      }
    });
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
    const elapsed = clock.getElapsedTime();
    if (state.playing) state.day += delta * state.speed;
    updateBodies(elapsed);
    controls.target.lerp(planetMeshes.get(state.focus).position, 0.055);
    controls.update();
    dayReadout.textContent = formatSimulationDay(state.day);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}

startSimulation();
