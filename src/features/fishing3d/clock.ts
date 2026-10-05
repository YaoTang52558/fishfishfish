/** G1 presentation clock. G2 will attach its fixed-step simulation to these steps. */
export class SceneClock {
  time = 0;
  private previous: number | undefined;
  private remainder = 0;
  readonly step = 1 / 60;

  tick(timestampMs: number, onStep?: () => void): number {
    const elapsed = this.previous === undefined ? 0 : Math.max(0, Math.min((timestampMs - this.previous) / 1000, 0.1));
    this.previous = timestampMs;
    this.remainder += elapsed;
    while (this.remainder + 1e-10 >= this.step) {
      this.time += this.step;
      this.remainder -= this.step;
      onStep?.();
    }
    return elapsed;
  }

  suspend() { this.previous = undefined; }
}
