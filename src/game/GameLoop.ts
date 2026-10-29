/** One requestAnimationFrame owner. Simulation uses seconds, capped after stalls. */
export class GameLoop {
  private requestId: number | null = null;
  private previousMs = 0;

  constructor(private readonly onFrame: (dtSeconds: number) => void) {}

  start(): void {
    if (this.requestId !== null) return;
    this.previousMs = performance.now();
    this.requestId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (this.requestId !== null) cancelAnimationFrame(this.requestId);
    this.requestId = null;
  }

  private readonly frame = (nowMs: number): void => {
    const dtSeconds = Math.min(Math.max((nowMs - this.previousMs) / 1000, 0), 0.05);
    this.previousMs = nowMs;
    this.onFrame(dtSeconds);
    this.requestId = requestAnimationFrame(this.frame);
  };
}
