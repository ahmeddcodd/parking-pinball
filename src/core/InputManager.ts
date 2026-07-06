/**
 * Normalizes mouse + touch into a single drag stream.
 * Positions are in canvas pixels; `normDrag` is the drag vector as a
 * fraction of the smaller screen dimension (resolution independent).
 */
export interface DragState {
  startX: number;
  startY: number;
  x: number;
  y: number;
  normDragX: number;
  normDragY: number;
  normLength: number;
}

export class InputManager {
  enabled = false;

  onDragStart: ((d: DragState) => void) | null = null;
  onDragMove: ((d: DragState) => void) | null = null;
  onDragEnd: ((d: DragState) => void) | null = null;
  /** Fires on any pointer-down (used to unlock audio). */
  onAnyPress: (() => void) | null = null;

  private drag: DragState | null = null;
  private pointerId: number | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener("pointerdown", this.handleDown);
    canvas.addEventListener("pointermove", this.handleMove);
    canvas.addEventListener("pointerup", this.handleUp);
    canvas.addEventListener("pointercancel", this.handleUp);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private updateNorm(d: DragState): void {
    const minDim = Math.min(this.canvas.clientWidth, this.canvas.clientHeight) || 1;
    d.normDragX = (d.x - d.startX) / minDim;
    d.normDragY = (d.y - d.startY) / minDim;
    d.normLength = Math.hypot(d.normDragX, d.normDragY);
  }

  private handleDown = (e: PointerEvent): void => {
    this.onAnyPress?.();
    if (!this.enabled || this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    this.drag = {
      startX: e.offsetX,
      startY: e.offsetY,
      x: e.offsetX,
      y: e.offsetY,
      normDragX: 0,
      normDragY: 0,
      normLength: 0,
    };
    this.onDragStart?.(this.drag);
  };

  private handleMove = (e: PointerEvent): void => {
    if (!this.drag || e.pointerId !== this.pointerId) return;
    this.drag.x = e.offsetX;
    this.drag.y = e.offsetY;
    this.updateNorm(this.drag);
    this.onDragMove?.(this.drag);
  };

  private handleUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    d.x = e.offsetX;
    d.y = e.offsetY;
    this.updateNorm(d);
    this.onDragEnd?.(d);
  };

  /** Cancel any in-flight drag (e.g. when pausing). */
  cancel(): void {
    this.drag = null;
    this.pointerId = null;
  }
}
