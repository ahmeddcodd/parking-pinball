import "./style.css";
import { Game } from "./core/Game";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui") as HTMLElement;

const game = new Game(canvas, uiRoot);
game.start();
