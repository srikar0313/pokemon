import { BattlePresentationController } from "./battlePresentation.mjs";
import * as BattleTacticalUI from "./battleTacticalUi.mjs";
import * as HandbookUI from "./handbookUi.mjs?v=20260908-battle-academy";
import { OverworldPresentationController } from "./overworldPresentation.mjs";
import * as PokedexUI from "./pokedexUi.mjs";

const controller = new BattlePresentationController();
const overworldController = new OverworldPresentationController({ audio: controller.audio });

globalThis.BattlePresentation = controller;
globalThis.BattleTacticalUI = BattleTacticalUI;
globalThis.HandbookUI = HandbookUI;
globalThis.OverworldPresentation = overworldController;
globalThis.PokedexUI = PokedexUI;
globalThis.dispatchEvent?.(new CustomEvent("battle-presentation-ready"));

globalThis.document?.addEventListener("click", (event) => {
  const button = event.target?.closest?.("button");
  if (button && !button.disabled) controller.audio.playUiSelect();
});
