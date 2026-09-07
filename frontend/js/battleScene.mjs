import * as THREE from "/vendor/three/three.module.js";
import { getMotionTiming, resolveMoveAnimation } from "./battleAnimationRegistry.mjs";

const WEATHER_COLORS = {
  rain: 0x83c9ff,
  snow: 0xe8f8ff,
  sandstorm: 0xd8ae67,
};

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function createParticleMaterial(color, size = 0.1) {
  return new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function createCoreGeometry(animation) {
  switch (animation.family) {
    case "beam":
      return new THREE.CylinderGeometry(0.09, 0.09, 1.5, 12);
    case "lightning":
      return new THREE.OctahedronGeometry(0.24 * animation.intensity, 0);
    case "flame":
    case "dragon":
      return new THREE.ConeGeometry(0.22 * animation.intensity, 0.65, 12);
    case "water":
    case "wind":
      return new THREE.TorusGeometry(0.25 * animation.intensity, 0.07, 8, 20);
    case "ice":
    case "leaves":
      return new THREE.ConeGeometry(0.18 * animation.intensity, 0.58, 5);
    case "steel":
    case "impact":
      return new THREE.BoxGeometry(0.34, 0.34, 0.34);
    case "psychic":
    case "ghost":
    case "dark":
      return new THREE.SphereGeometry(0.24 * animation.intensity, 12, 9);
    case "fairy":
    case "swarm":
      return new THREE.TetrahedronGeometry(0.25 * animation.intensity, 0);
    case "rock":
    case "ground":
      return new THREE.DodecahedronGeometry(0.24 * animation.intensity);
    default:
      return new THREE.SphereGeometry(0.18 * animation.intensity, 16, 12);
  }
}

export class BattleScene {
  constructor({ container, reducedMotion = false } = {}) {
    this.container = container;
    this.reducedMotion = reducedMotion;
    this.disposed = false;
    this.effects = new Set();
    this.weather = null;
    this.weatherKind = "clear";
    this.clock = new THREE.Clock();
    this.baseCameraPosition = new THREE.Vector3(0, 3.5, 7.2);
    this.initialize();
  }

  initialize() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
    this.camera.position.copy(this.baseCameraPosition);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = "battle-webgl-canvas";
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.container.prepend(this.renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xd9edff, 0x5b4934, 1.65);
    this.scene.add(ambient);
    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    this.keyLight.position.set(-2, 6, 4);
    this.keyLight.castShadow = true;
    this.scene.add(this.keyLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 7),
      new THREE.MeshStandardMaterial({
        color: 0x8eb879,
        roughness: 0.92,
        metalness: 0.02,
        transparent: true,
        opacity: 0.88,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.22;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.platforms = [-2.45, 2.45].map((x) => {
      const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 1.68, 0.2, 48),
        new THREE.MeshStandardMaterial({ color: 0xc9d99a, roughness: 0.8 }),
      );
      platform.position.set(x, -0.98, 0);
      platform.receiveShadow = true;
      platform.castShadow = true;
      this.scene.add(platform);
      return platform;
    });

    this.resize = this.resize.bind(this);
    this.renderFrame = this.renderFrame.bind(this);
    this.resizeObserver = globalThis.ResizeObserver
      ? new globalThis.ResizeObserver(this.resize)
      : null;
    this.resizeObserver?.observe(this.container);
    globalThis.addEventListener?.("resize", this.resize);
    this.resize();
    this.frameId = globalThis.requestAnimationFrame?.(this.renderFrame);
  }

  resize() {
    if (this.disposed || !this.container) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  renderFrame() {
    if (this.disposed) return;
    const elapsed = this.clock.getElapsedTime();
    this.platforms.forEach((platform, index) => {
      platform.position.y = -0.98 + Math.sin(elapsed * 1.1 + index * 1.8) * 0.018;
    });
    this.updateWeather(elapsed);
    this.renderer.render(this.scene, this.camera);
    this.frameId = globalThis.requestAnimationFrame?.(this.renderFrame);
  }

  setReducedMotion(value) {
    this.reducedMotion = Boolean(value);
  }

  setWeather(weather) {
    const kind = String(weather || "clear").toLowerCase();
    if (kind === this.weatherKind) return;
    this.clearWeather();
    this.weatherKind = kind;
    if (kind === "sun" || kind === "sunny") {
      this.keyLight.color.setHex(0xffd28a);
      this.keyLight.intensity = 2.8;
      return;
    }
    this.keyLight.color.setHex(0xffffff);
    this.keyLight.intensity = 2.1;
    if (!WEATHER_COLORS[kind]) return;

    const count = this.reducedMotion ? 35 : 90;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 11;
      positions[index * 3 + 1] = Math.random() * 6 - 1;
      positions[index * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = createParticleMaterial(
      WEATHER_COLORS[kind],
      kind === "snow" ? 0.11 : 0.075,
    );
    this.weather = new THREE.Points(geometry, material);
    this.scene.add(this.weather);
  }

  updateWeather() {
    if (!this.weather) return;
    const positions = this.weather.geometry.attributes.position;
    const speed = this.weatherKind === "snow" ? 0.012 : 0.035;
    for (let index = 0; index < positions.count; index += 1) {
      const current = positions.getY(index) - speed;
      positions.setY(index, current < -1.2 ? 5 : current);
      if (this.weatherKind === "sandstorm") {
        positions.setX(index, positions.getX(index) + 0.025);
        if (positions.getX(index) > 5.5) positions.setX(index, -5.5);
      }
    }
    positions.needsUpdate = true;
  }

  clearWeather() {
    if (!this.weather) return;
    this.scene.remove(this.weather);
    this.weather.geometry.dispose();
    this.weather.material.dispose();
    this.weather = null;
  }

  createEffect(animation, startX) {
    const count = Math.round(18 * animation.intensity);
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 0.35;
      positions[index * 3 + 1] = (Math.random() - 0.5) * 0.35;
      positions[index * 3 + 2] = (Math.random() - 0.5) * 0.35;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = createParticleMaterial(animation.color, 0.11 * animation.intensity);
    const points = new THREE.Points(geometry, material);

    const coreGeometry = createCoreGeometry(animation);
    const core = new THREE.Mesh(
      coreGeometry,
      new THREE.MeshBasicMaterial({
        color: animation.color,
        transparent: true,
        opacity: 0.82,
      }),
    );
    if (animation.family === "beam") core.rotation.z = Math.PI / 2;
    if (["flame", "dragon", "ice", "leaves"].includes(animation.family)) {
      core.rotation.z = -Math.PI / 2;
    }

    const group = new THREE.Group();
    group.add(points, core);
    group.position.set(startX, 0.1, 0.4);
    this.scene.add(group);
    this.effects.add(group);

    const light = new THREE.PointLight(animation.color, 2.2 * animation.intensity, 4);
    group.add(light);
    return group;
  }

  async playMove(side, move) {
    if (this.disposed) return;
    const animation = resolveMoveAnimation(move);
    const timing = getMotionTiming(this.reducedMotion, animation.duration);
    const direction = side === "player" ? 1 : -1;
    const startX = direction * -2.35;
    const endX = direction * 2.35;
    const effect = this.createEffect(animation, startX);
    const startTime = performance.now();
    const originalCameraX = this.camera.position.x;

    await new Promise((resolve) => {
      const tick = (now) => {
        if (this.disposed) return resolve();
        const progress = Math.min(1, (now - startTime) / timing.duration);
        const eased = easeOutCubic(progress);
        if (animation.id === "thunderbolt") {
          effect.position.x = endX;
          effect.position.y = THREE.MathUtils.lerp(2.6, 0.1, eased);
        } else if (animation.family === "ground") {
          effect.position.x = endX;
          effect.position.y = -0.72 + Math.sin(progress * Math.PI * 5) * 0.12;
          effect.scale.setScalar(0.7 + Math.sin(progress * Math.PI) * 2.2);
        } else {
          effect.position.x = THREE.MathUtils.lerp(startX, endX, eased);
          effect.position.y = 0.1 + Math.sin(progress * Math.PI) * 0.45;
        }
        effect.rotation.x += 0.14;
        effect.rotation.y += 0.18;
        if (timing.camera) {
          const groundShake =
            animation.family === "ground" && timing.shake
              ? Math.sin(progress * Math.PI * 12) * 0.12
              : 0;
          this.camera.position.x =
            originalCameraX + direction * Math.sin(progress * Math.PI) * 0.18 + groundShake;
          this.camera.lookAt(0, 0, 0);
        }
        if (progress < 1) globalThis.requestAnimationFrame?.(tick);
        else resolve();
      };
      globalThis.requestAnimationFrame?.(tick);
    });

    this.camera.position.x = originalCameraX;
    this.camera.lookAt(0, 0, 0);
    this.disposeEffect(effect);
  }

  pulseHit(side, critical = false) {
    if (this.disposed) return;
    const x = side === "player" ? -2.35 : 2.35;
    const color = critical ? 0xffdf61 : 0xffffff;
    const light = new THREE.PointLight(color, critical ? 6 : 3.5, 5);
    light.position.set(x, 0.5, 1.5);
    this.scene.add(light);
    globalThis.setTimeout?.(() => {
      this.scene?.remove(light);
      light.dispose?.();
    }, this.reducedMotion ? 80 : 220);
  }

  disposeEffect(effect) {
    if (!effect) return;
    this.scene.remove(effect);
    effect.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose());
      else object.material?.dispose?.();
    });
    this.effects.delete(effect);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    globalThis.cancelAnimationFrame?.(this.frameId);
    this.resizeObserver?.disconnect();
    globalThis.removeEventListener?.("resize", this.resize);
    this.clearWeather();
    [...this.effects].forEach((effect) => this.disposeEffect(effect));
    this.scene.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose());
      else object.material?.dispose?.();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
