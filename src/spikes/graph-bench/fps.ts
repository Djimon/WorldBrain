// Rolling-average fps over a window of frame timestamps.
export class FpsMeter {
  private times: number[] = [];
  private readonly window: number;

  constructor(window = 60) {
    this.window = window;
  }

  push(nowMs: number): void {
    this.times.push(nowMs);
    if (this.times.length > this.window + 1) this.times.shift();
  }

  get value(): number {
    if (this.times.length < 2) return 0;
    const span = this.times[this.times.length - 1] - this.times[0];
    if (span <= 0) return 0;
    return ((this.times.length - 1) / span) * 1000;
  }
}
