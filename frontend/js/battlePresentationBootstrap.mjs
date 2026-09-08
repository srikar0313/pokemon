import { BattlePresentationController } from "./battlePresentation.mjs";
import * as BattleTacticalUI from "./battleTacticalUi.mjs";

const controller = new BattlePresentationController();

globalThis.BattlePresentation = controller;
globalThis.BattleTacticalUI = BattleTacticalUI;
globalThis.dispatchEvent?.(new CustomEvent("battle-presentation-ready"));

globalThis.document?.addEventListener("click", (event) => {
  const button = event.target?.closest?.("button");
  if (button && !button.disabled) controller.audio.playUiSelect();
});
