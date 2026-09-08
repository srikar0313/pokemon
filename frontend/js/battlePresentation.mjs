import { AudioManager } from "./battleAudio.mjs";
import { isWebGLAvailable, selectBattleRenderer } from "./battleCapabilities.mjs";
import {
  normalizeWeatherVisual,
  resolveBattleIntro,
  resolveBattlePresentationMode,
  resolveHitReaction,
  resolveMoveAnimation,
} from "./battleAnimationRegistry.mjs";
import { BattleScene } from "./battleScene.mjs";
import {
  createCaptureAnimationPlan,
  createEvolutionAnimationPlan,
  playCaptureDomSequence,
  playEvolutionDomSequence,
  restoreCaptureScene,
} from "./battleCinematics.mjs";
import {
  createAbilityAnnouncement,
  applyCssHitReaction,
  clearPresentationLayers,
  flashBattlefield,
  playCssMoveEffect,
  renderStatusParticles,
  showBattleBanner,
  showProtectShield,
  syncWeatherVisual,
} from "./battleParticles.mjs";

export class BattlePresentationController {
  constructor({ documentLike = globalThis.document, audioManager } = {}) {
    this.document = documentLike;
    this.audio = audioManager || new AudioManager();
    this.scene = null;
    this.container = null;
    this.mode = null;
    this.rendererKind = "css";
    this.bindSettings();
  }

  get reducedMotion() {
    return Boolean(
      this.audio.settings.reduceMotion ||
        globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    );
  }

  mount({ container, kind = "wild", weather = "clear", player, opponent } = {}) {
    if (!container) return "css";
    const mode = resolveBattlePresentationMode(kind, opponent);
    const shouldPlayIntro = this.mode !== mode;
    const containerChanged = this.container !== container;
    if (containerChanged) this.disposeScene();
    this.container = container;
    this.mode = mode;
    this.audio.setBattleMode(mode);

    const webglAvailable = isWebGLAvailable(this.document);
    this.rendererKind = selectBattleRenderer({ webglAvailable });
    if (this.rendererKind === "webgl" && !this.scene) {
      try {
        this.scene = new BattleScene({ container, reducedMotion: this.reducedMotion });
        container.classList.add("presentation-webgl");
      } catch (error) {
        console.warn("WebGL battle presentation unavailable; using CSS fallback.", error);
        this.rendererKind = "css";
        this.scene = null;
      }
    }
    this.scene?.setReducedMotion(this.reducedMotion);
    this.setWeather(weather);
    this.setStatus("player", player?.status);
    this.setStatus("opponent", opponent?.status);
    if (shouldPlayIntro) this.playIntro(mode);
    return this.rendererKind;
  }

  async playMove(side, move = {}) {
    const resolvedMove = {
      name: move.name || "Attack",
      type: move.type || "Normal",
      category: move.category || "Physical",
    };
    const animation = resolveMoveAnimation(resolvedMove);
    const cameraClass = side === "player" ? "camera-push-player" : "camera-push-opponent";
    if (!this.reducedMotion) this.container?.classList.add(cameraClass);
    const results = await Promise.all([
      this.audio.playMove(resolvedMove),
      playCssMoveEffect(this.container, side, animation, this.reducedMotion),
      this.scene?.playMove(side, resolvedMove),
    ]);
    this.container?.classList.remove(cameraClass);
    return { rendered: Boolean(results[1] || this.scene), animation };
  }

  async hit(side, metadata = {}) {
    const reaction = resolveHitReaction(metadata);
    this.scene?.pulseHit(side, reaction);
    flashBattlefield(this.container, reaction.flash, this.reducedMotion);
    await Promise.all([
      reaction.id === "immune"
        ? Promise.resolve({ source: "none" })
        : this.audio.playHit(["heavy", "effective", "critical"].includes(reaction.id), {
            critical: reaction.id === "critical",
          }),
      applyCssHitReaction(this.getSide(side), reaction, this.reducedMotion),
    ]);
    return { rendered: Boolean(this.scene), reaction };
  }

  async faint(side) {
    await this.audio.playFaint();
    flashBattlefield(this.container, "faint", this.reducedMotion);
    return Boolean(this.scene);
  }

  async switchPokemon(side, pokemon = {}) {
    await this.audio.playSendOut(pokemon);
    const target = this.getSide(side);
    if (target) flashBattlefield(target, "send-out", this.reducedMotion);
    return Boolean(this.scene);
  }

  playBall() {
    return this.audio.playBall();
  }

  async playCaptureSequence({ ballType, caught, player, opponent } = {}) {
    const plan = createCaptureAnimationPlan({
      ballType,
      caught,
      reducedMotion: this.reducedMotion,
    });
    if (!this.container) {
      for (const step of plan.steps) await this.audio.playCaptureCue(step.audio);
      return { rendered: false, player, opponent, ...plan };
    }
    return playCaptureDomSequence({
      container: this.container,
      plan,
      audio: this.audio,
    });
  }

  restoreCaptureScene() {
    restoreCaptureScene(this.container);
  }

  setStatus(side, status) {
    renderStatusParticles(this.getSide(side), status, this.reducedMotion);
  }

  setWeather(weather) {
    const normalized = normalizeWeatherVisual(weather);
    this.scene?.setWeather(normalized);
    syncWeatherVisual(this.container, normalized, this.reducedMotion);
  }

  playIntro(mode = this.mode || "wild") {
    const intro = resolveBattleIntro(mode);
    const container = this.container;
    container?.classList.add(`battle-intro-${mode}`);
    showBattleBanner(container, intro.label, `intro-${mode}`, this.reducedMotion);
    this.scene?.frameIntro(intro.intensity, this.reducedMotion ? 100 : intro.duration);
    globalThis.setTimeout?.(
      () => container?.classList.remove(`battle-intro-${mode}`),
      this.reducedMotion ? 120 : intro.duration,
    );
    return intro;
  }

  showTurnMetadata(side, metadata = {}) {
    const opposite = side === "player" ? "opponent" : "player";
    (metadata.effects || []).forEach((effect) => {
      const targetSide = effect.target === "self" ? side : opposite;
      const target = this.getSide(targetSide);
      if (effect.type === "statChange") {
        const arrow = Number(effect.stages || 0) > 0 ? "UP" : "DOWN";
        showBattleBanner(target, `${String(effect.stat || "Stat").replace(/([A-Z])/g, " $1")} ${arrow}`, arrow.toLowerCase(), this.reducedMotion);
      } else if (effect.type === "allStatsUp") {
        showBattleBanner(target, "ALL STATS UP", "up", this.reducedMotion);
      } else if (["status", "volatileStatus"].includes(effect.type)) {
        this.setStatus(targetSide, effect.status);
      } else if (effect.type === "weather") {
        this.setWeather(effect.weather);
        showBattleBanner(this.container, `${normalizeWeatherVisual(effect.weather).toUpperCase()} WEATHER`, "weather", this.reducedMotion);
      } else if (effect.type === "protect") {
        showProtectShield(target, this.reducedMotion);
      } else if (effect.type === "recoil") {
        showBattleBanner(target, `RECOIL -${effect.amount || 0}`, "recoil", this.reducedMotion);
      } else if (effect.type === "drain" || effect.type === "heal") {
        showBattleBanner(target, `+${effect.amount || 0} HP`, "heal", this.reducedMotion);
      }
    });
  }

  announceAbility(side, text) {
    createAbilityAnnouncement(this.getSide(side), text, this.reducedMotion);
  }

  playHealing() {
    return this.audio.playHealing();
  }

  playStatus() {
    return this.audio.playStatus();
  }

  playEvolutionCue(pokemon) {
    return this.audio.playEvolutionCue(pokemon);
  }

  playEvolutionSequence({ before, after, container } = {}) {
    const plan = createEvolutionAnimationPlan({
      before,
      after,
      reducedMotion: this.reducedMotion,
    });
    if (!container) {
      this.audio.playEvolutionCue(after);
      return Promise.resolve({ rendered: false, ...plan });
    }
    return playEvolutionDomSequence({ container, plan, audio: this.audio });
  }

  getSide(side) {
    return this.container?.querySelector(`.battle-pokemon.${side}-side`) || null;
  }

  endBattle() {
    this.audio.endBattle();
    clearPresentationLayers(this.container);
    this.disposeScene();
    this.container = null;
    this.mode = null;
  }

  disposeScene() {
    this.container?.classList.remove("presentation-webgl");
    this.scene?.dispose();
    this.scene = null;
  }

  toggleSettings() {
    const panel = this.document?.getElementById("presentation-settings-panel");
    const button = this.document?.getElementById("presentation-settings-toggle");
    if (!panel) return;
    const opening = panel.classList.contains("hidden");
    panel.classList.toggle("hidden", !opening);
    button?.setAttribute("aria-expanded", String(opening));
  }

  bindSettings() {
    if (!this.document) return;
    const bind = () => {
      const fields = {
        musicVolume: this.document.getElementById("music-volume"),
        sfxVolume: this.document.getElementById("sfx-volume"),
        cryVolume: this.document.getElementById("cry-volume"),
        muted: this.document.getElementById("audio-muted"),
        reduceMotion: this.document.getElementById("reduce-battle-motion"),
      };
      Object.entries(fields).forEach(([key, field]) => {
        if (!field) return;
        if (field.type === "checkbox") field.checked = this.audio.settings[key];
        else field.value = String(Math.round(this.audio.settings[key] * 100));
        const eventName = field.type === "range" ? "input" : "change";
        field.addEventListener(eventName, () => {
          const value = field.type === "checkbox" ? field.checked : Number(field.value) / 100;
          this.audio.saveSettings({ [key]: value });
          this.scene?.setReducedMotion(this.reducedMotion);
        });
      });
    };
    if (this.document.readyState === "loading") {
      this.document.addEventListener("DOMContentLoaded", bind, { once: true });
    } else {
      bind();
    }
  }
}
