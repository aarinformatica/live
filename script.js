
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

/* =========================================================
   ELEMENTOS DA INTERFACE
========================================================= */

const world = document.getElementById("world");
const hud = document.getElementById("cinematic-hud");

const liveDot = document.getElementById("liveDot");
const statusText = document.getElementById("status");
const preliveMessage = document.getElementById("preliveMessage");
const mainTitle = document.getElementById("mainTitle");
const caption = document.getElementById("caption");

const countdownElement = document.getElementById("countdown");
const progressElement = document.getElementById("progress");
const percentageElement = document.getElementById("percentage");
const progressText = document.getElementById("progressText");

const audioHint = document.getElementById("audioHint");
const audioHintText = document.getElementById("audioHintText");

const errorScreen = document.getElementById("errorScreen");
const errorMessage = document.getElementById("errorMessage");

/* =========================================================
   CONFIGURAÇÕES
========================================================= */

const CONFIG = {
  duration: 300,
  rainCount: 2600,
  fogCount: 24,
  buildingCount: 34,
  pixelRatioLimit: 1.7
};

let scene;
let camera;
let renderer;
let clock;

let character;
let characterParts = {};
let rain;
let rainPositions;
let rainSpeeds;

let fogSprites = [];
let puddles = [];
let lamps = [];
let lightningLights = [];

let animationFrame = null;
let resizeObserver = null;
let running = false;
let liveStarted = false;
let remainingTime = CONFIG.duration;
let audioContext = null;
let audioEnabled = false;
let audioNodes = [];
let captionTimeout = null;

let lastCountdownUpdate = 0;

let walkTime = 0;
let blinkTimer = 0;
let blinkDuration = 0;

const nextWaypoint = new THREE.Vector3(0.8, 0, -4);

/* =========================================================
   ERRO VISÍVEL
========================================================= */

function showError(message) {
  console.error("[Cenário 3D]", message);

  if (errorMessage) {
    errorMessage.textContent = message;
  }

  if (errorScreen) {
    errorScreen.classList.add("visible");
  }
}

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

function initialize() {
  try {
    if (!world) {
      throw new Error("O elemento #world não foi encontrado no HTML.");
    }

    if (!window.WebGLRenderingContext) {
      throw new Error("Este navegador não disponibiliza WebGL.");
    }

    createScene();
    createCamera();
    createRenderer();

    createLights();
    createGround();
    createCity();
    createStreetLamps();
    createPuddles();
    createFog();
    createCharacter();
    createRain();
    createLightning();

    clock = new THREE.Clock();

    setupEvents();
    setupResize();

    remainingTime = CONFIG.duration;
    updateCountdown();
    setPreliveState();

    running = true;
    animate();

    console.log("Cenário 3D inicializado corretamente.");

  } catch (error) {
    showError(
      error?.message ||
      "Ocorreu um erro desconhecido ao iniciar o cenário."
    );
  }
}

/* =========================================================
   CENA
========================================================= */

function createScene() {
  scene = new THREE.Scene();

  scene.background = new THREE.Color(0x070b12);

  scene.fog = new THREE.FogExp2(
    0x101a25,
    0.025
  );
}

/* =========================================================
   CÂMERA
========================================================= */

function createCamera() {
  camera = new THREE.PerspectiveCamera(
    52,
    window.innerWidth / window.innerHeight,
    0.1,
    180
  );

  camera.position.set(0, 5.1, 11.5);
  camera.lookAt(0, 1.3, -5);
}

/* =========================================================
   RENDERER
========================================================= */

function createRenderer() {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance"
  });

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      CONFIG.pixelRatioLimit
    )
  );

  renderer.setSize(
    Math.max(1, world.clientWidth),
    Math.max(1, world.clientHeight),
    false
  );

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  renderer.domElement.setAttribute(
    "aria-label",
    "Cenário urbano 3D"
  );

  world.appendChild(renderer.domElement);

  renderer.domElement.addEventListener(
    "webglcontextlost",
    event => {
      event.preventDefault();
      running = false;

      showError(
        "O navegador perdeu o contexto gráfico WebGL. Recarregue a página para reconstruir o cenário."
      );
    }
  );

  renderer.domElement.addEventListener(
    "webglcontextrestored",
    () => {
      location.reload();
    }
  );
}

/* =========================================================
   ILUMINAÇÃO
========================================================= */

function createLights() {
  const ambient = new THREE.AmbientLight(
    0x8aa3bd,
    0.65
  );

  scene.add(ambient);

  const moon = new THREE.DirectionalLight(
    0x8cbce8,
    1.15
  );

  moon.position.set(-8, 14, -8);
  moon.castShadow = true;

  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -18;
  moon.shadow.camera.right = 18;
  moon.shadow.camera.top = 18;
  moon.shadow.camera.bottom = -18;

  scene.add(moon);

  const blueFill = new THREE.PointLight(
    0x286ca0,
    15,
    35
  );

  blueFill.position.set(0, 4, -12);
  scene.add(blueFill);
}

/* =========================================================
   MATERIAIS
========================================================= */

function standardMaterial(
  color,
  roughness = 0.8,
  metalness = 0.05
) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness
  });
}

/* =========================================================
   CHÃO E ASFALTO MOLHADO
========================================================= */

function createGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    standardMaterial(0x101820, 0.27, 0.35)
  );

  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.035;
  ground.receiveShadow = true;

  scene.add(ground);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(8.5, 100),
    standardMaterial(0x090e14, 0.22, 0.3)
  );

  road.rotation.x = -Math.PI / 2;
  road.position.y = -0.015;
  road.receiveShadow = true;

  scene.add(road);

  const sidewalkMaterial = standardMaterial(
    0x18232d,
    0.5,
    0.12
  );

  for (const side of [-1, 1]) {
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.18, 100),
      sidewalkMaterial
    );

    sidewalk.position.set(side * 5.25, 0.02, -15);
    sidewalk.receiveShadow = true;

    scene.add(sidewalk);
  }

  const centerLineMaterial = new THREE.MeshBasicMaterial({
    color: 0x53616b,
    transparent: true,
    opacity: 0.2
  });

  for (let z = -45; z < 30; z += 7) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09, 2.2),
      centerLineMaterial
    );

    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.002, z);

    scene.add(line);
  }
}

/* =========================================================
   PRÉDIOS
========================================================= */

function createBuilding(x, z, side, index) {
  const width = THREE.MathUtils.randFloat(2.5, 4.8);
  const height = THREE.MathUtils.randFloat(5, 13);
  const depth = THREE.MathUtils.randFloat(3.5, 7);

  const building = new THREE.Group();

  const baseMaterial = standardMaterial(
    index % 2 === 0 ? 0x17212b : 0x111923,
    0.88,
    0.08
  );

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    baseMaterial
  );

  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;

  building.add(body);

  const windowMaterial = new THREE.MeshBasicMaterial({
    color: 0x9bc9e8
  });

  const warmWindowMaterial = new THREE.MeshBasicMaterial({
    color: 0xe0b77c
  });

  const rows = Math.max(2, Math.floor(height / 1.5));
  const columns = Math.max(2, Math.floor(width / 0.85));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      if (Math.random() > 0.56) continue;

      const windowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.27, 0.42),
        Math.random() > 0.5
          ? windowMaterial
          : warmWindowMaterial
      );

      const wx =
        -width / 2 +
        0.5 +
        col * ((width - 0.8) / Math.max(1, columns - 1));

      const wy = 0.9 + row * 1.25;

      windowMesh.position.set(
        wx,
        wy,
        depth / 2 + 0.012
      );

      building.add(windowMesh);
    }
  }

  building.position.set(x, 0, z);
  building.rotation.y = side === 1 ? 0 : Math.PI;

  scene.add(building);
}

function createCity() {
  let index = 0;

  for (let z = -42; z <= 18; z += 5.5) {
    createBuilding(
      -8.2 - Math.random() * 2,
      z,
      -1,
      index++
    );

    createBuilding(
      8.2 + Math.random() * 2,
      z + THREE.MathUtils.randFloat(-1.5, 1.5),
      1,
      index++
    );
  }

  for (let i = 0; i < 12; i++) {
    const distantHeight = THREE.MathUtils.randFloat(10, 22);

    const distant = new THREE.Mesh(
      new THREE.BoxGeometry(
        THREE.MathUtils.randFloat(3, 7),
        distantHeight,
        4
      ),
      standardMaterial(0x101923, 0.95, 0)
    );

    distant.position.set(
      THREE.MathUtils.randFloat(-24, 24),
      distantHeight / 2,
      -35 - Math.random() * 25
    );

    scene.add(distant);
  }
}

/* =========================================================
   POSTES DE ILUMINAÇÃO
========================================================= */

function createStreetLamps() {
  const poleMaterial = standardMaterial(
    0x202b34,
    0.65,
    0.65
  );

  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const group = new THREE.Group();

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.085, 5.3, 8),
        poleMaterial
      );

      pole.position.y = 2.65;
      pole.castShadow = true;

      group.add(pole);

      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.07, 0.07),
        poleMaterial
      );

      arm.position.set(-side * 0.38, 5.1, 0);
      group.add(arm);

      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 12, 8),
        new THREE.MeshBasicMaterial({
          color: 0xffd69a
        })
      );

      bulb.position.set(-side * 0.78, 5.03, 0);
      group.add(bulb);

      const weak = i % 3 === 1;

      const lampLight = new THREE.PointLight(
        weak ? 0xffc77c : 0xffd9a2,
        weak ? 1.2 : 3.2,
        weak ? 6 : 11
      );

      lampLight.position.copy(bulb.position);
      lampLight.position.y -= 0.15;

      group.add(lampLight);

      group.position.set(
        side * 6.2,
        0,
        -25 + i * 9
      );

      scene.add(group);

      lamps.push({
        light: lampLight,
        bulb,
        weak,
        phase: Math.random() * 10,
        baseIntensity: weak ? 1.2 : 3.2
      });
    }
  }
}

/* =========================================================
   POÇAS
========================================================= */

function createPuddles() {
  const puddleMaterial = new THREE.MeshStandardMaterial({
    color: 0x263d4d,
    metalness: 0.8,
    roughness: 0.12,
    transparent: true,
    opacity: 0.58
  });

  for (let i = 0; i < 32; i++) {
    const width = THREE.MathUtils.randFloat(0.35, 1.5);
    const depth = THREE.MathUtils.randFloat(0.35, 1.8);

    const puddle = new THREE.Mesh(
      new THREE.CircleGeometry(1, 32),
      puddleMaterial.clone()
    );

    puddle.scale.set(width, depth, 1);
    puddle.rotation.x = -Math.PI / 2;

    puddle.position.set(
      THREE.MathUtils.randFloat(-3.8, 3.8),
      0.005,
      THREE.MathUtils.randFloat(-42, 12)
    );

    scene.add(puddle);
    puddles.push(puddle);
  }
}

/* =========================================================
   NEBLINA
========================================================= */

function createFog() {
  const canvas = document.createElement("canvas");

  canvas.width = 128;
  canvas.height = 128;

  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(
    64, 64, 2,
    64, 64, 64
  );

  gradient.addColorStop(0, "rgba(170,205,225,0.24)");
  gradient.addColorStop(0.4, "rgba(120,165,195,0.11)");
  gradient.addColorStop(1, "rgba(100,145,180,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);

  for (let i = 0; i < CONFIG.fogCount; i++) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: THREE.MathUtils.randFloat(0.25, 0.65),
      depthWrite: false
    });

    const sprite = new THREE.Sprite(material);

    const scale = THREE.MathUtils.randFloat(5, 11);

    sprite.scale.set(scale, scale * 0.42, 1);

    sprite.position.set(
      THREE.MathUtils.randFloat(-8, 8),
      THREE.MathUtils.randFloat(0.5, 2.5),
      THREE.MathUtils.randFloat(-38, 8)
    );

    sprite.userData.speed = THREE.MathUtils.randFloat(0.15, 0.5);

    scene.add(sprite);
    fogSprites.push(sprite);
  }
}

/* =========================================================
   PERSONAGEM
========================================================= */

function createCharacter() {
  character = new THREE.Group();

  const skin = standardMaterial(0xb8876d, 0.82);
  const jacket = standardMaterial(0x202a34, 0.9);
  const jacketDark = standardMaterial(0x111922, 0.9);
  const pants = standardMaterial(0x171e28, 0.92);
  const shoes = standardMaterial(0x090d12, 0.75);
  const hair = standardMaterial(0x171313, 0.95);

  /* TRONCO */

  const torso = new THREE.Group();

  torso.position.y = 1.28;

  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.78, 0.36),
    jacket
  );

  chest.position.y = 0.03;
  chest.castShadow = true;

  torso.add(chest);

  const collar = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.15, 0.38),
    jacketDark
  );

  collar.position.set(0, 0.43, 0.015);

  torso.add(collar);

  character.add(torso);

  characterParts.torso = torso;

  /* PESCOÇO */

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.12, 0.2, 12),
    skin
  );

  neck.position.y = 1.78;

  character.add(neck);

  /* CABEÇA */

  const head = new THREE.Group();

  head.position.set(0, 2.02, 0.015);

  const face = new THREE.Mesh(
    new THREE.SphereGeometry(0.29, 24, 20),
    skin
  );

  face.scale.set(0.88, 1.08, 0.88);
  face.castShadow = true;

  head.add(face);

  /* CABELO */

  const hairTop = new THREE.Mesh(
    new THREE.SphereGeometry(
      0.295,
      20,
      12,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.55
    ),
    hair
  );

  hairTop.scale.set(0.95, 0.95, 0.95);
  hairTop.position.y = 0.075;

  head.add(hairTop);

  const fringe = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.11, 0.13),
    hair
  );

  fringe.position.set(0, 0.18, 0.225);
  fringe.rotation.x = -0.12;

  head.add(fringe);

  /* OLHOS */

  const eyeWhite = new THREE.MeshBasicMaterial({
    color: 0xf2eee8
  });

  const irisMaterial = new THREE.MeshBasicMaterial({
    color: 0x463c32
  });

  const pupilMaterial = new THREE.MeshBasicMaterial({
    color: 0x090909
  });

  const eyes = [];

  for (const x of [-0.105, 0.105]) {
    const eye = new THREE.Group();

    eye.position.set(x, 0.025, 0.246);

    const white = new THREE.Mesh(
      new THREE.SphereGeometry(0.047, 12, 10),
      eyeWhite
    );

    white.scale.set(1, 0.7, 0.42);

    eye.add(white);

    const iris = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 10, 8),
      irisMaterial
    );

    iris.position.set(0, 0, 0.018);

    eye.add(iris);

    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.011, 8, 8),
      pupilMaterial
    );

    pupil.position.set(0, 0, 0.027);

    eye.add(pupil);

    head.add(eye);
    eyes.push(eye);
  }

  characterParts.eyes = eyes;
  characterParts.head = head;

  character.add(head);

  /* MOCHILA */

  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.62, 0.22),
    jacketDark
  );

  backpack.position.set(0, 1.35, -0.27);
  backpack.castShadow = true;

  character.add(backpack);

  /* BRAÇOS */

  const arms = [];

  for (const side of [-1, 1]) {
    const arm = new THREE.Group();

    arm.position.set(side * 0.39, 1.53, 0);

    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.12, 0.5, 12),
      jacket
    );

    upper.position.y = -0.22;
    upper.rotation.z = side * -0.08;
    upper.castShadow = true;

    arm.add(upper);

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 12, 10),
      skin
    );

    hand.position.y = -0.51;

    arm.add(hand);

    character.add(arm);

    arms.push(arm);
  }

  characterParts.arms = arms;

  /* PERNAS */

  const legs = [];

  for (const side of [-1, 1]) {
    const leg = new THREE.Group();

    leg.position.set(side * 0.18, 0.95, 0);

    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.115, 0.55, 12),
      pants
    );

    thigh.position.y = -0.28;
    thigh.castShadow = true;

    leg.add(thigh);

    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.13, 0.36),
      shoes
    );

    foot.position.set(0, -0.58, 0.09);

    leg.add(foot);

    character.add(leg);

    legs.push(leg);
  }

  characterParts.legs = legs;

  /* =======================================================
     LANTERNA DE PEITO — POSIÇÃO CORRIGIDA

     O grupo torso está na altura Y = 1.28.
     Portanto, a posição da lanterna é LOCAL ao torso.

     Frente do personagem: +Z
     Esquerda do personagem: -X

     A altura local 0.27 coloca a lanterna
     na região superior esquerda do peito.
  ======================================================= */

  const flashlightMount = new THREE.Group();

  // CORREÇÃO PRINCIPAL:
  // Antes: Y = 1.53 (a lanterna ficava acima da cabeça)
  // Agora: Y = 0.27 (a lanterna fica no peito)
  flashlightMount.position.set(
    -0.245,
    0.27,
    0.215
  );

  /* CORPO DA LANTERNA */

  const flashlightBody = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.055,
      0.07,
      0.25,
      16
    ),
    standardMaterial(0x171d24, 0.35, 0.8)
  );

  flashlightBody.rotation.x = Math.PI / 2;
  flashlightBody.position.z = 0.035;

  flashlightMount.add(flashlightBody);

  /* ANEL FRONTAL */

  const flashlightRing = new THREE.Mesh(
    new THREE.TorusGeometry(
      0.058,
      0.012,
      8,
      20
    ),
    standardMaterial(0x8998a5, 0.25, 0.8)
  );

  flashlightRing.position.z = 0.16;

  flashlightMount.add(flashlightRing);

  /* LENTE */

  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.047, 20),
    new THREE.MeshBasicMaterial({
      color: 0xe8f5ff
    })
  );

  lens.position.z = 0.17;

  flashlightMount.add(lens);

  /* FEIXE DE LUZ */

  const flashlightLight = new THREE.SpotLight(
    0xd7ecff,
    95,
    24,
    Math.PI / 7,
    0.55,
    1.3
  );

  flashlightLight.position.set(0, 0, 0.19);

  const beamTarget = new THREE.Object3D();

  beamTarget.position.set(
    0,
    -0.08,
    8
  );

  flashlightMount.add(beamTarget);

  flashlightLight.target = beamTarget;

  flashlightMount.add(flashlightLight);

  /* ILUMINAÇÃO PRÓXIMA DA LENTE */

  const smallGlow = new THREE.PointLight(
    0xb9e2ff,
    1.3,
    2.5
  );

  smallGlow.position.set(0, 0, 0.2);

  flashlightMount.add(smallGlow);

  /* A LANTERNA É FILHA DO TRONCO */

  torso.add(flashlightMount);

  characterParts.flashlight = flashlightMount;

  /* POSIÇÃO DO PERSONAGEM */

  character.position.set(0, 0, 1.7);
  character.rotation.y = 0;

  scene.add(character);
}

/* =========================================================
   CHUVA
========================================================= */

function createRain() {
  rainPositions = new Float32Array(CONFIG.rainCount * 3);
  rainSpeeds = new Float32Array(CONFIG.rainCount);

  for (let i = 0; i < CONFIG.rainCount; i++) {
    const index = i * 3;

    rainPositions[index] = THREE.MathUtils.randFloat(-13, 13);
    rainPositions[index + 1] = THREE.MathUtils.randFloat(0, 18);
    rainPositions[index + 2] = THREE.MathUtils.randFloat(-30, 13);

    rainSpeeds[i] = THREE.MathUtils.randFloat(8, 17);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(rainPositions, 3)
  );

  const material = new THREE.PointsMaterial({
    color: 0xaacbe4,
    size: 0.055,
    transparent: true,
    opacity: 0.56,
    depthWrite: false
  });

  rain = new THREE.Points(geometry, material);

  scene.add(rain);
}

function updateRain(delta) {
  const positions = rain.geometry.attributes.position.array;

  for (let i = 0; i < CONFIG.rainCount; i++) {
    const index = i * 3;

    positions[index + 1] -= rainSpeeds[i] * delta;
    positions[index] += 0.65 * delta;

    if (positions[index + 1] < 0) {
      positions[index + 1] = THREE.MathUtils.randFloat(12, 18);
      positions[index] = THREE.MathUtils.randFloat(-13, 13);
      positions[index + 2] = THREE.MathUtils.randFloat(-30, 13);
    }

    if (positions[index] > 13) {
      positions[index] = -13;
    }
  }

  rain.geometry.attributes.position.needsUpdate = true;
}

/* =========================================================
   RELÂMPAGOS
========================================================= */

function createLightning() {
  const light = new THREE.PointLight(
    0xb6d8ff,
    0,
    90
  );

  light.position.set(0, 18, -24);

  scene.add(light);

  lightningLights.push(light);
}

let lightningTimer = 5;
let lightningDuration = 0;

function updateLightning(delta) {
  lightningTimer -= delta;

  if (lightningTimer <= 0) {
    lightningDuration = 0.12;
    lightningTimer = THREE.MathUtils.randFloat(8, 18);
  }

  if (lightningDuration > 0) {
    lightningDuration -= delta;

    const flash = Math.random() > 0.5 ? 1 : 0.25;

    lightningLights.forEach(light => {
      light.intensity = 18 * flash;
    });
  } else {
    lightningLights.forEach(light => {
      light.intensity = 0;
    });
  }
}

/* =========================================================
   ANIMAÇÃO DO PERSONAGEM
========================================================= */

function chooseNewWaypoint() {
  nextWaypoint.set(
    THREE.MathUtils.randFloat(-1.8, 1.8),
    0,
    THREE.MathUtils.randFloat(-7, 3)
  );
}

function updateCharacter(delta, elapsed) {
  if (!character) return;

  const direction = new THREE.Vector3()
    .subVectors(nextWaypoint, character.position);

  direction.y = 0;

  const distance = direction.length();

  if (distance < 0.5) {
    chooseNewWaypoint();
  } else {
    direction.normalize();

    character.position.addScaledVector(
      direction,
      delta * 0.45
    );

    const targetRotation = Math.atan2(
      direction.x,
      direction.z
    );

    character.rotation.y = THREE.MathUtils.lerp(
      character.rotation.y,
      targetRotation,
      Math.min(1, delta * 2.2)
    );
  }

  walkTime += delta * 5.2;

  const walking = distance > 0.5;
  const movement = walking ? Math.sin(walkTime) : 0;

  characterParts.legs[0].rotation.x = movement * 0.42;
  characterParts.legs[1].rotation.x = -movement * 0.42;

  characterParts.arms[0].rotation.x = -movement * 0.25;
  characterParts.arms[1].rotation.x = movement * 0.25;

  characterParts.torso.rotation.z =
    Math.sin(walkTime * 0.5) * 0.018;

  characterParts.torso.position.y =
    1.28 + Math.sin(walkTime * 2) * 0.012;

  characterParts.head.rotation.y =
    Math.sin(elapsed * 0.35) * 0.08;

  characterParts.head.rotation.x =
    Math.sin(elapsed * 0.55) * 0.025;

  /* PISCADAS */

  blinkTimer -= delta;

  if (blinkTimer <= 0 && blinkDuration <= 0) {
    blinkDuration = 0.13;
    blinkTimer = THREE.MathUtils.randFloat(2.5, 5.5);
  }

  if (blinkDuration > 0) {
    blinkDuration -= delta;

    const scaleY = blinkDuration > 0.06 ? 0.12 : 1;

    characterParts.eyes.forEach(eye => {
      eye.scale.y = scaleY;
    });
  } else {
    characterParts.eyes.forEach(eye => {
      eye.scale.y = 1;
    });
  }
}

/* =========================================================
   CÂMERA CINEMATOGRÁFICA
========================================================= */

function updateCamera(elapsed, delta) {
  const targetX = Math.sin(elapsed * 0.12) * 0.45;

  const targetY =
    5.05 + Math.sin(elapsed * 0.22) * 0.08;

  camera.position.x = THREE.MathUtils.lerp(
    camera.position.x,
    targetX,
    delta * 0.4
  );

  camera.position.y = THREE.MathUtils.lerp(
    camera.position.y,
    targetY,
    delta * 0.35
  );

  camera.position.z =
    11.5 + Math.sin(elapsed * 0.16) * 0.25;

  camera.lookAt(
    character.position.x * 0.25,
    1.25,
    -5
  );
}

/* =========================================================
   NEBLINA E POSTES
========================================================= */

function updateEnvironment(delta, elapsed) {
  for (const sprite of fogSprites) {
    sprite.position.x += sprite.userData.speed * delta * 0.18;

    if (sprite.position.x > 11) {
      sprite.position.x = -11;
    }

    sprite.material.opacity =
      0.24 +
      (Math.sin(elapsed * 0.3 + sprite.position.z) + 1) * 0.12;
  }

  lamps.forEach((lamp, index) => {
    if (!lamp.weak) return;

    const flicker =
      Math.sin(elapsed * 7 + lamp.phase) > 0.91
        ? 0.18
        : 1;

    const subtle =
      0.86 + Math.sin(elapsed * 1.8 + index) * 0.12;

    lamp.light.intensity =
      lamp.baseIntensity * flicker * subtle;
  });

  puddles.forEach((puddle, index) => {
    puddle.material.opacity =
      0.48 + Math.sin(elapsed * 0.7 + index) * 0.06;
  });
}

/* =========================================================
   CONTADOR
========================================================= */

function updateCountdown() {
  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;

  countdownElement.textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const progress = Math.max(
    0,
    Math.min(100, (remainingTime / CONFIG.duration) * 100)
  );

  progressElement.style.width = `${progress}%`;
  percentageElement.textContent = `${Math.round(progress)}%`;
}

function resetCountdown() {
  remainingTime = CONFIG.duration;
  liveStarted = false;
  lastCountdownUpdate = 0;

  setPreliveState();
  updateCountdown();
}

function startLive() {
  if (liveStarted) return;

  liveStarted = true;

  hud.classList.add("is-live");
  liveDot.classList.add("is-live");

  statusText.textContent = "TRANSMISSÃO EM ANDAMENTO";
  progressText.textContent = "TRANSMISSÃO INICIADA";

  countdownElement.textContent = "AO VIVO";
  percentageElement.textContent = "100%";

  progressElement.style.width = "100%";

  showCaption("A transmissão começou. Seja bem-vindo!");
}

function setPreliveState() {
  hud.classList.remove("is-live");
  liveDot.classList.remove("is-live");

  statusText.textContent = "SISTEMA ONLINE";
  progressText.textContent = "PREPARANDO TRANSMISSÃO";

  countdownElement.textContent = "05:00";
  percentageElement.textContent = "100%";

  if (captionTimeout) {
    clearTimeout(captionTimeout);
  }

  caption.classList.remove("visible");
  caption.textContent = "";
}

/* =========================================================
   LEGENDAS
========================================================= */

function showCaption(message) {
  caption.textContent = message;
  caption.classList.add("visible");

  if (captionTimeout) {
    clearTimeout(captionTimeout);
  }

  captionTimeout = setTimeout(() => {
    caption.classList.remove("visible");
  }, 5000);
}

/* =========================================================
   ÁUDIO AMBIENTE
========================================================= */

async function activateAudio() {
  try {
    if (audioEnabled) {
      await audioContext?.suspend();

      audioEnabled = false;
      audioHintText.textContent = "CLIQUE PARA ATIVAR O ÁUDIO";

      return;
    }

    if (!audioContext) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error("Áudio WebAudio não suportado.");
      }

      audioContext = new AudioContextClass();

      const master = audioContext.createGain();

      master.gain.value = 0.13;
      master.connect(audioContext.destination);

      const bufferSize = audioContext.sampleRate * 2;

      const noiseBuffer = audioContext.createBuffer(
        1,
        bufferSize,
        audioContext.sampleRate
      );

      const data = noiseBuffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = audioContext.createBufferSource();

      noise.buffer = noiseBuffer;
      noise.loop = true;

      const lowpass = audioContext.createBiquadFilter();

      lowpass.type = "lowpass";
      lowpass.frequency.value = 420;

      const rainGain = audioContext.createGain();

      rainGain.gain.value = 0.14;

      noise.connect(lowpass);
      lowpass.connect(rainGain);
      rainGain.connect(master);

      noise.start();

      audioNodes.push(noise);

      const drone = audioContext.createOscillator();

      drone.type = "sine";
      drone.frequency.value = 54;

      const droneGain = audioContext.createGain();

      droneGain.gain.value = 0.035;

      drone.connect(droneGain);
      droneGain.connect(master);

      drone.start();

      audioNodes.push(drone);
      audioContext.masterGain = master;
    }

    await audioContext.resume();

    audioEnabled = true;
    audioHintText.textContent = "ÁUDIO AMBIENTE ATIVADO";

  } catch (error) {
    console.warn("Não foi possível ativar o áudio:", error);

    audioHintText.textContent = "ÁUDIO INDISPONÍVEL";
  }
}

/* =========================================================
   EVENTOS
========================================================= */

function setupEvents() {
  window.addEventListener("keydown", event => {
    if (event.code === "Space") {
      event.preventDefault();

      if (!liveStarted) {
        startLive();
      }
    }

    if (event.key.toLowerCase() === "r") {
      resetCountdown();
    }
  });

  audioHint.addEventListener("click", activateAudio);

  world.addEventListener(
    "pointerdown",
    () => {
      if (!audioEnabled) {
        activateAudio();
      }
    },
    { once: true }
  );
}

/* =========================================================
   REDIMENSIONAMENTO
========================================================= */

function resize() {
  if (!renderer || !camera || !world) return;

  const width = Math.max(1, world.clientWidth);
  const height = Math.max(1, world.clientHeight);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height, false);

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      CONFIG.pixelRatioLimit
    )
  );
}

function setupResize() {
  window.addEventListener("resize", resize);

  if ("ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(world);
  }

  resize();
}

/* =========================================================
   LOOP PRINCIPAL
========================================================= */

function animate() {
  if (!running) return;

  animationFrame = requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  updateRain(delta);
  updateCharacter(delta, elapsed);
  updateCamera(elapsed, delta);
  updateEnvironment(delta, elapsed);
  updateLightning(delta);

  if (!liveStarted) {
    lastCountdownUpdate += delta;

    if (lastCountdownUpdate >= 1) {
      lastCountdownUpdate = 0;

      if (remainingTime > 0) {
        remainingTime--;
        updateCountdown();
      } else {
        startLive();
      }
    }
  }

  renderer.render(scene, camera);
}

/* =========================================================
   ENCERRAMENTO SEGURO
========================================================= */

window.addEventListener("beforeunload", () => {
  running = false;

  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame);
  }

  if (resizeObserver) {
    resizeObserver.disconnect();
  }

  if (audioContext && audioContext.state !== "closed") {
    audioContext.close();
  }
});

/* =========================================================
   INICIAR
========================================================= */

initialize();
