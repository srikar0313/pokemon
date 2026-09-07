import { AudioManager } from "./battleAudio.mjs";
import { isWebGLAvailable, selectBattleRenderer } from "./battleCapabilities.mjs";
import { resolveBattlePresentationMode, resolveMoveAnimation } from "./battleAnimationRegistry.mjs";
import { BattleScene } from "./battleScene.mjs";
import {
  createAbilityAnnouncement,
  flashBattlefield,
  renderStatusParticles,
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
    this.scene?.setWeather(weather);
    this.setStatus("player", player?.status);
    this.setStatus("opponent", opponent?.status);
    return this.rendererKind;
  }

  async playMove(side, move = {}) {
    const resolvedMove = {
      name: move.name || "Attack",
      type: move.type || "Normal",
      category: move.category || "Physical",
    };
    const animation = resolveMoveAnimation(resolvedMove);
    await this.audio.playMove(resolvedMove);
    if (!this.scene) return { rendered: false, animation };
    await this.scene.playMove(side, resolvedMove);
    return { rendered: true, animation };
  }

  async hit(side, { heavy = false, critical = false, effectiveness = 1 } = {}) {
    await this.audio.playHit(heavy || critical || effectiveness > 1);
    this.scene?.pulseHit(side, critical);
    const tone = critical ? "critical" : effectiveness > 1 ? "effective" : "hit";
    flashBattlefield(this.container, tone, this.reducedMotion);
    return Boolean(this.scene);
  }

  async faint(side) {
    await this.audio.playFaint();
    flashBattlefield(this.container, "faint", this.reducedMotion);
    return Boolean(this.scene);
  }

  async switchPokemon(side, pokemon = {}) {
    await this.audio.playSendOut(pokemon.speciesId || pokemon.id || 1);
    const target = this.getSide(side);
    if (target) flashBattlefield(target, "send-out", this.reducedMotion);
    return Boolean(this.scene);
  }

  setStatus(side, status) {
    renderStatusParticles(this.getSide(side), status, this.reducedMotion);
  }

  announceAbility(side, text) {
    createAbilityAnnouncement(this.getSide(side), text, this.reducedMotion);
  }

  playEvolutionCue() {
    return this.audio.playEvolutionCue();
  }

  getSide(side) {
    return this.container?.querySelector(`.battle-pokemon.${side}-side`) || null;
  }

  endBattle() {
    this.audio.endBattle();
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
