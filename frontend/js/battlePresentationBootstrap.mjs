import { BattlePresentationController } from "./battlePresentation.mjs";
import * as BattleTacticalUI from "./battleTacticalUi.mjs";
import * as HandbookUI from "./handbookUi.mjs";

const controller = new BattlePresentationController();

globalThis.BattlePresentation = controller;
globalThis.BattleTacticalUI = BattleTacticalUI;
globalThis.HandbookUI = HandbookUI;
globalThis.dispatchEvent?.(new CustomEvent("battle-presentation-ready"));

globalThis.document?.addEventListener("click", (event) => {
  const button = event.target?.closest?.("button");
  if (button && !button.disabled) controller.audio.playUiSelect();
});
