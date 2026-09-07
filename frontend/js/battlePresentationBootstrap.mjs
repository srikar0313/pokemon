import { BattlePresentationController } from "./battlePresentation.mjs";

const controller = new BattlePresentationController();

globalThis.BattlePresentation = controller;
globalThis.dispatchEvent?.(new CustomEvent("battle-presentation-ready"));

globalThis.document?.addEventListener("click", (event) => {
  const button = event.target?.closest?.("button");
  if (button && !button.disabled) controller.audio.playUiSelect();
});
