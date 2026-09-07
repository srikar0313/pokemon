const STATUS_PARTICLES = {
  burned: { glyph: "", className: "status-flame", count: 4 },
  poisoned: { glyph: "", className: "status-poison", count: 5 },
  badpoison: { glyph: "", className: "status-poison", count: 7 },
  paralyzed: { glyph: "", className: "status-electric", count: 5 },
  asleep: { glyph: "Z", className: "status-sleep", count: 3 },
  frozen: { glyph: "", className: "status-frost", count: 6 },
  confused: { glyph: "?", className: "status-confusion", count: 4 },
};

export function clearStatusParticles(target) {
  target?.querySelectorAll(".presentation-status-particles").forEach((node) => node.remove());
}

export function renderStatusParticles(target, status, reducedMotion = false) {
  if (!target) return;
  clearStatusParticles(target);
  const config = STATUS_PARTICLES[status];
  if (!config) return;
  const layer = document.createElement("span");
  layer.className = `presentation-status-particles ${config.className}`;
  layer.setAttribute("aria-hidden", "true");
  const count = reducedMotion ? Math.min(2, config.count) : config.count;
  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement("i");
    particle.textContent = config.glyph;
    particle.style.setProperty("--particle-index", index);
    particle.style.setProperty("--particle-left", `${18 + (index * 23) % 68}%`);
    layer.appendChild(particle);
  }
  target.appendChild(layer);
}

export function createAbilityAnnouncement(target, text, reducedMotion = false) {
  if (!target || !text) return;
  const banner = document.createElement("span");
  banner.className = "ability-announcement";
  banner.textContent = text;
  target.appendChild(banner);
  globalThis.setTimeout?.(() => banner.remove(), reducedMotion ? 850 : 1500);
}

export function flashBattlefield(container, tone = "hit", reducedMotion = false) {
  if (!container) return;
  const flash = document.createElement("span");
  flash.className = `battlefield-flash flash-${tone}`;
  if (reducedMotion) flash.classList.add("reduced");
  container.appendChild(flash);
  globalThis.setTimeout?.(() => flash.remove(), reducedMotion ? 100 : 360);
}
