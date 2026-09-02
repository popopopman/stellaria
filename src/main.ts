import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  AU_TO_SCENE,
  BODIES,
  BODY_BY_ID,
  MOON,
  calendarDateToJulianDay,
  isSupportedJulianDay,
  julianDayToCalendarDate,
  moonOrbitVertices,
  moonPositionAtJulianDay,
  orbitVertices,
  positionAtJulianDay,
  relativeRadius,
  SUPPORTED_END_DATE,
  SUPPORTED_START_DATE,
  type BodyId,
  type CelestialBody,
  type Vector3,
} from "./simulation.js";
import "./style.css";

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

function requireJulianDay(value: string): number {
  const julianDay = calendarDateToJulianDay(value);
  if (julianDay === null) throw new Error(`Invalid calendar date: ${value}`);
  return julianDay;
}

const canvas = requireElement<HTMLCanvasElement>("#space");
const fallback = requireElement<HTMLElement>("#webglFallback");
const bodyList = requireElement<HTMLElement>("#bodyList");
const dayReadout = requireElement<HTMLElement>("#dayReadout");
const focusName = requireElement<HTMLElement>("#focusName");
const focusDetail = requireElement<HTMLElement>("#focusDetail");
const speed = requireElement<HTMLInputElement>("#speed");
const speedValue = requireElement<HTMLOutputElement>("#speedValue");
const scale = requireElement<HTMLInputElement>("#scale");
const scaleValue = requireElement<HTMLOutputElement>("#scaleValue");
const playButton = requireElement<HTMLButtonElement>("#playButton");
const reverseButton = requireElement<HTMLButtonElement>("#reverseButton");
const simulationDate = requireElement<HTMLInputElement>("#simulationDate");
const ephemerisStatus = requireElement<HTMLOutputElement>("#ephemerisStatus");
const sizeMode = requireElement<HTMLSelectElement>("#sizeMode");
const sizeModeValue = requireElement<HTMLOutputElement>("#sizeModeValue");
const bodySize = requireElement<HTMLInputElement>("#bodySize");
const bodySizeValue = requireElement<HTMLOutputElement>("#bodySizeValue");
const sizeLegend = requireElement<HTMLElement>("#sizeLegend");

type SizeMode = "enhanced" | "relative";

interface SimulationState {
  julianDay: number;
  speed: number;
  scale: number;
  playing: boolean;
  direction: 1 | -1;
  focus: BodyId;
  displayedDate: string;
  sizeMode: SizeMode;
  bodySize: number;
}

function startSimulation() {
  let renderer: THREE.WebGLRenderer;
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
  const solarFog = new THREE.FogExp2(0x164e9b, 0.008);
  scene.fog = solarFog;
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 180);
  camera.position.set(46, 35, 68);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x164e9b, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.minDistance = 8;
  controls.maxDistance = 105;
  controls.target.set(0, 0, 0);
  const selectionRaycaster = new THREE.Raycaster();
  const selectionPointer = new THREE.Vector2();
  let pointerStart: { x: number; y: number } | null = null;

  scene.add(new THREE.HemisphereLight(0xb8cfff, 0x273178, 1.6));
  const sunlight = new THREE.PointLight(0xffd096, 1150, 72, 1.7);
  scene.add(sunlight);

  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "/");
  const initialJulianDay = requireJulianDay(today);
  const state: SimulationState = {
    julianDay: initialJulianDay,
    speed: 24,
    scale: 1,
    playing: false,
    direction: 1,
    focus: "sun",
    displayedDate: "",
    sizeMode: "enhanced",
    bodySize: 1,
  };
  const solarGroup = new THREE.Group();
  scene.add(solarGroup);
  const planetMeshes = new Map<BodyId, THREE.Mesh>();
  const firstJulianDay = requireJulianDay(SUPPORTED_START_DATE);
  const lastJulianDay = requireJulianDay(SUPPORTED_END_DATE);
  const orbitLines = new Map<BodyId, THREE.LineLoop>();
  const moonOffset = new THREE.Vector3();
  let moonMesh: THREE.Mesh;
  let moonOrbit: THREE.LineLoop;
  const backgroundStars = makeStars();
  const sphere = new THREE.SphereGeometry(1, 30, 22);
  const textureLoader = new THREE.TextureLoader();

  function loadSurface(filename: string): THREE.Texture {
    const texture = textureLoader.load(
      `${import.meta.env.BASE_URL}textures/${filename}`,
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  const detailedSurfaces: Partial<Record<BodyId, THREE.Texture>> = {
    sun: loadSurface("sun.jpg"),
    earth: loadSurface("earth.jpg"),
    jupiter: loadSurface("gas-giant.jpg"),
    saturn: loadSurface("gas-giant.jpg"),
  };

  function displayRadius(body: CelestialBody): number {
    const baseRadius =
      state.sizeMode === "relative" ? relativeRadius(body, 0.9) : body.radius;
    return body.id === "sun" || body.id === "moon"
      ? baseRadius
      : baseRadius * state.bodySize;
  }

  function makeRandom(seed: number): () => number {
    let value = seed;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function makeSurface(body: CelestialBody): THREE.CanvasTexture {
    const surface = document.createElement("canvas");
    surface.width = 512;
    surface.height = 256;
    const context = surface.getContext("2d");
    if (!context) throw new Error("Could not create texture canvas context");
    const random = makeRandom(
      [...body.id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0),
    );
    context.fillStyle = body.color;
    context.fillRect(0, 0, surface.width, surface.height);

    const circle = (
      color: string,
      amount: number,
      size: number,
      alpha = 0.3,
    ) => {
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
    const bands = (colors: readonly string[], softness = 0, wobble = 12) => {
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
    const swirls = (
      color: string,
      amount: number,
      width: number,
      alpha = 0.25,
    ) => {
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
    const continent = (color: string, amount: number, size: number) => {
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
          if (point === 0) context.moveTo(pointX, pointY);
          else context.lineTo(pointX, pointY);
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
    } else if (body.id === "uranus") {
      bands(["#b9eef0", "#80dce5", "#b5eff1", "#78cbd9"], 0.04, 5);
    } else if (body.id === "neptune") {
      bands(["#245ab7", "#3b82dc", "#1e55ae", "#4e92e3"], 0.06, 8);
      circle("#163e91", 11, 12, 0.32);
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

  function makeStars(): THREE.Points {
    const points: number[] = [];
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
    return new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xe5edff,
        size: 0.11,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.76,
      }),
    );
  }

  function createPlanet(body: CelestialBody): void {
    const surface = detailedSurfaces[body.id] ?? makeSurface(body);
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
    mesh.scale.setScalar(displayRadius(body));
    mesh.userData.rotationSpeed =
      body.id === "sun" ? 0.0018 : 0.0005 + body.radius * 0.0006;
    planetMeshes.set(body.id, mesh);
    solarGroup.add(mesh);
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
      mesh.add(ring);
    }
  }

  function displayMoonOffset(offset: Vector3): Vector3 {
    if (state.sizeMode === "relative") return offset;
    const meanDistance = MOON.semiMajorAxisAu * AU_TO_SCENE * state.scale;
    const visibleMeanDistance =
      displayRadius(BODY_BY_ID.earth) + displayRadius(MOON) + 0.1;
    const factor = visibleMeanDistance / meanDistance;
    return [offset[0] * factor, offset[1] * factor, offset[2] * factor];
  }

  function createMoon(): void {
    moonMesh = new THREE.Mesh(
      sphere,
      new THREE.MeshStandardMaterial({
        color: MOON.color,
        map: makeSurface(MOON),
        roughness: 0.9,
      }),
    );
    moonMesh.scale.setScalar(displayRadius(MOON));
    moonMesh.userData.rotationSpeed = 0.0007;
    planetMeshes.set(MOON.id, moonMesh);
    solarGroup.add(moonMesh);
    moonOrbit = new THREE.LineLoop(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xe4edff,
        transparent: true,
        opacity: 0.78,
      }),
    );
    solarGroup.add(moonOrbit);
  }

  function createOrbit(body: CelestialBody): void {
    if (!body.elements) return;
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: body.id === "earth" ? 0xf0f4ff : 0xc3d4ff,
        transparent: true,
        opacity: body.id === "earth" ? 0.9 : 0.68,
      }),
    );
    orbitLines.set(body.id, line);
    solarGroup.add(line);
  }

  function refreshOrbits(): void {
    BODIES.forEach((body) => {
      const line = orbitLines.get(body.id);
      if (!line) return;
      line.geometry.setFromPoints(
        orbitVertices(body, 160, state.scale, state.julianDay).map(
          ([x, y, z]) => new THREE.Vector3(x, y, z),
        ),
      );
    });
    moonOrbit.geometry.setFromPoints(
      moonOrbitVertices(120, state.scale, state.julianDay).map((offset) => {
        const [x, y, z] = displayMoonOffset(offset);
        return new THREE.Vector3(x, y, z);
      }),
    );
  }

  function getPlanetMesh(id: BodyId): THREE.Mesh {
    const mesh = planetMeshes.get(id);
    if (!mesh) throw new Error(`Missing mesh for ${id}`);
    return mesh;
  }

  function updateBodies(): void {
    BODIES.forEach((body) => {
      const mesh = getPlanetMesh(body.id);
      mesh.position.set(
        ...positionAtJulianDay(body, state.julianDay, state.scale),
      );
      mesh.rotation.y += mesh.userData.rotationSpeed;
    });
    const earthMesh = getPlanetMesh(BODY_BY_ID.earth.id);
    const [x, y, z] = displayMoonOffset(
      moonPositionAtJulianDay(state.julianDay, state.scale),
    );
    moonOffset.set(x, y, z);
    moonMesh.position.copy(earthMesh.position).add(moonOffset);
    moonMesh.rotation.y += moonMesh.userData.rotationSpeed;
    moonOrbit.position.copy(earthMesh.position);
  }

  function refreshBodySizes(): void {
    BODIES.forEach((body) => {
      getPlanetMesh(body.id).scale.setScalar(displayRadius(body));
    });
    moonMesh.scale.setScalar(displayRadius(MOON));
    refreshOrbits();
    updateBodies();
  }

  function updateSizeReadout(): void {
    sizeModeValue.value =
      state.sizeMode === "relative" ? "実寸比" : "観察用補正";
    bodySizeValue.value = `現在比 ${state.bodySize.toFixed(2)}×`;
    sizeLegend.textContent = `惑星サイズ：${sizeModeValue.value}・${state.bodySize.toFixed(2)}×`;
  }

  function setFocus(id: BodyId): void {
    state.focus = id;
    const body = BODY_BY_ID[id];
    focusName.textContent = body.name;
    focusDetail.textContent = body.detail;
    document
      .querySelectorAll<HTMLButtonElement>(".body-button")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.focus === id),
        ),
      );
  }

  function selectBodyAt(clientX: number, clientY: number): void {
    const bounds = canvas.getBoundingClientRect();
    selectionPointer.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    selectionRaycaster.setFromCamera(selectionPointer, camera);
    const hit = selectionRaycaster.intersectObjects(
      [...planetMeshes.values()],
      false,
    )[0];
    if (!hit) return;
    const body = [...planetMeshes].find(([, mesh]) => mesh === hit.object);
    if (body) setFocus(body[0]);
  }

  function buildBodyList(): void {
    [...BODIES, MOON].forEach((body) => {
      const button = document.createElement("button");
      button.className = "body-button";
      button.dataset.focus = body.id;
      button.setAttribute("aria-pressed", String(body.id === state.focus));
      button.innerHTML = `<i style="--body-color:${body.color}"></i><span>${body.name}</span><small>${body.id === "sun" ? "中心" : `${body.period.toLocaleString("ja-JP", { maximumFractionDigits: 0 })}日`}</small>`;
      button.addEventListener("click", () => setFocus(body.id));
      bodyList.append(button);
    });
  }

  function resize(): void {
    const { clientWidth, clientHeight } = canvas;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  }

  function updatePlaybackButtons(): void {
    const movingForward = state.playing && state.direction === 1;
    const movingBackward = state.playing && state.direction === -1;
    playButton.setAttribute("aria-pressed", String(movingForward));
    reverseButton.setAttribute("aria-pressed", String(movingBackward));
    playButton.innerHTML = movingForward
      ? '<span aria-hidden="true">Ⅱ</span> 時をとめる'
      : '<span aria-hidden="true">▶</span> 時をうごかす';
    reverseButton.innerHTML = movingBackward
      ? '<span aria-hidden="true">Ⅱ</span> 時をとめる'
      : '<span aria-hidden="true">◀</span> 時をもどす';
  }

  function setPlayback(direction: 1 | -1): void {
    if (state.playing && state.direction === direction) {
      state.playing = false;
    } else {
      state.direction = direction;
      state.playing = true;
    }
    updatePlaybackButtons();
  }

  function syncCalendarDate(): void {
    const calendarDate = julianDayToCalendarDate(state.julianDay);
    if (calendarDate === state.displayedDate) return;
    state.displayedDate = calendarDate;
    dayReadout.textContent = calendarDate;
    if (
      document.activeElement !== simulationDate &&
      simulationDate.getAttribute("aria-invalid") !== "true"
    ) {
      simulationDate.value = calendarDate;
    }
  }

  function setCalendarDate(value: string): void {
    const julianDay = calendarDateToJulianDay(value);
    if (julianDay === null || !isSupportedJulianDay(julianDay)) {
      simulationDate.setAttribute("aria-invalid", "true");
      ephemerisStatus.value = "1800/01/01–2050/12/31 で入力";
      return;
    }
    if (state.playing) {
      state.playing = false;
      updatePlaybackButtons();
    }
    state.julianDay = julianDay;
    state.displayedDate = "";
    simulationDate.setAttribute("aria-invalid", "false");
    ephemerisStatus.value = "JPL 近似 • UTC 00:00";
    refreshOrbits();
    updateBodies();
    syncCalendarDate();
  }

  scene.add(backgroundStars);
  BODIES.forEach((body) => {
    createPlanet(body);
    createOrbit(body);
  });
  createMoon();
  buildBodyList();
  updateSizeReadout();
  refreshOrbits();
  setCalendarDate(today);
  resize();
  new ResizeObserver(resize).observe(canvas);
  canvas.addEventListener("pointerdown", (event: PointerEvent) => {
    pointerStart = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener("pointerup", (event: PointerEvent) => {
    if (
      !pointerStart ||
      Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y,
      ) > 6
    ) {
      pointerStart = null;
      return;
    }
    selectBodyAt(event.clientX, event.clientY);
    pointerStart = null;
  });
  playButton.addEventListener("click", () => setPlayback(1));
  reverseButton.addEventListener("click", () => setPlayback(-1));
  speed.addEventListener("input", () => {
    state.speed = Number(speed.value);
    speedValue.value = `${state.speed} 日 / 秒`;
  });
  simulationDate.addEventListener("change", () => {
    setCalendarDate(simulationDate.value);
  });
  simulationDate.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      setCalendarDate(simulationDate.value);
      simulationDate.blur();
    }
  });
  sizeMode.addEventListener("change", () => {
    state.sizeMode = sizeMode.value === "relative" ? "relative" : "enhanced";
    updateSizeReadout();
    refreshBodySizes();
  });
  bodySize.addEventListener("input", () => {
    state.bodySize = Number(bodySize.value) / 100;
    updateSizeReadout();
    refreshBodySizes();
  });
  scale.addEventListener("input", () => {
    state.scale = Number(scale.value) / 100;
    scaleValue.value = `${state.scale.toFixed(2)}×`;
    refreshOrbits();
    updateBodies();
  });
  const clock = new THREE.Clock();
  function animate() {
    const delta = Math.min(clock.getDelta(), 0.1);
    if (state.playing) {
      const nextJulianDay =
        state.julianDay + delta * state.speed * state.direction;
      if (nextJulianDay <= firstJulianDay || nextJulianDay >= lastJulianDay) {
        state.julianDay = Math.min(
          lastJulianDay,
          Math.max(firstJulianDay, nextJulianDay),
        );
        state.playing = false;
        updatePlaybackButtons();
      } else {
        state.julianDay = nextJulianDay;
      }
    }
    updateBodies();
    controls.target.lerp(getPlanetMesh(state.focus).position, 0.055);
    controls.update();
    syncCalendarDate();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}

startSimulation();
