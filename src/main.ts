import "./style.css";
import { Game } from "./core/Game";
import { SaveManager } from "./core/SaveManager";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui") as HTMLElement;

// Cloud save reads are async and Game consumes save data synchronously from
// its constructor onward, so the save has to be resolved before booting.
async function boot(): Promise<void> {
  const save = await SaveManager.create();
  const game = new Game(canvas, uiRoot, save);
  game.start();
}

void boot();
