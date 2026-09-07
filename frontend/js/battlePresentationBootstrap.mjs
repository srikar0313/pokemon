import { BattlePresentationController } from "./battlePresentation.mjs";

const controller = new BattlePresentationController();

globalThis.BattlePresentation = controller;
globalThis.dispatchEvent?.(new CustomEvent("battle-presentation-ready"));
