export type QualityPreference = 'auto' | 'standard' | 'low';
export type RenderQuality = 'standard' | 'low';
export interface FrameStats { fps: number; p95: number; seconds: number; frames: number }

export function frameStats(intervals: readonly number[]): FrameStats {
  const sorted = [...intervals].sort((a, b) => a - b);
  const seconds = sorted.reduce((sum, ms) => sum + ms, 0) / 1000;
  return { fps: seconds ? sorted.length / seconds : 0, p95: sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)] ?? 0, seconds, frames: sorted.length };
}

// Only decoration quality changes. The fixed-step fishing simulation has no dependency on this class.
export class AdaptiveQuality {
  current: RenderQuality = 'standard';
  private slowWindows = 0;
  preference: QualityPreference = 'auto';
  interrupt() { this.slowWindows = 0; }
  set(preference: QualityPreference) {
    this.preference = preference; this.slowWindows = 0;
    this.current = preference === 'low' ? 'low' : 'standard';
    return this.current;
  }
  observe(stats: FrameStats): RenderQuality {
    if (this.preference !== 'auto' || this.current === 'low' || stats.seconds < 5) return this.current;
    this.slowWindows = stats.fps < 30 || stats.p95 > 50 ? this.slowWindows + 1 : 0;
    if (this.slowWindows >= 2) this.current = 'low';
    return this.current;
  }
}

export interface PerformanceMeasurement extends FrameStats {
  complete: boolean; interruptions: number; maxCalls: number; maxTriangles: number;
  qualityChanges: number; passesFrameBudget: boolean;
}
export class PerformanceRecorder {
  private intervals: number[] = [];
  private interruptions = 0;
  private maxCalls = 0;
  private maxTriangles = 0;
  private qualityChanges = 0;
  private seconds = 0;
  private complete = false;
  add(elapsed: number, calls: number, triangles: number) {
    if (this.complete || !Number.isFinite(elapsed) || elapsed <= 0) return;
    this.intervals.push(elapsed); this.seconds += elapsed / 1000;
    this.maxCalls = Math.max(this.maxCalls, calls); this.maxTriangles = Math.max(this.maxTriangles, triangles);
    this.complete = this.seconds >= 60;
  }
  interrupt() { if (!this.complete) this.interruptions++; }
  qualityChanged() { if (!this.complete) this.qualityChanges++; }
  read(): PerformanceMeasurement {
    const stats = frameStats(this.intervals);
    return { ...stats, complete: this.complete, interruptions: this.interruptions, maxCalls: this.maxCalls,
      maxTriangles: this.maxTriangles, qualityChanges: this.qualityChanges,
      passesFrameBudget: this.complete && this.interruptions === 0 && stats.fps + 1e-6 >= 30 && stats.p95 <= 50 && this.maxCalls <= 80 && this.maxTriangles <= 150_000 };
  }
}
