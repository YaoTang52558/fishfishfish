import { PerspectiveCamera, Vector3 } from 'three';

export type FishingView = 'surface' | 'underwater';

/** One camera interpolates two poses in the same world; it never mutates the fish. */
export class FishingCameras {
  readonly camera = new PerspectiveCamera(48, 1, 0.1, 180);
  view: FishingView = 'surface';
  private readonly focus = new Vector3();
  private readonly destination = new Vector3();
  private readonly target = new Vector3();
  private readonly startPosition = new Vector3();
  private readonly startFocus = new Vector3();
  private transition = 1;

  constructor() {
    this.camera.position.set(5.4, 4.2, 10);
    this.focus.set(-0.7, 0.25, 1);
    this.camera.lookAt(this.focus);
  }

  select(view: FishingView, reducedMotion: boolean, fishPosition: Vector3) {
    if (view === this.view) return;
    this.view = view;
    this.frameWidth();
    this.startPosition.copy(this.camera.position);
    this.startFocus.copy(this.focus);
    this.transition = reducedMotion ? 1 : 0;
    this.update(0, reducedMotion, fishPosition);
  }

  update(dt: number, reducedMotion: boolean, fishPosition: Vector3) {
    if (this.view === 'surface') {
      this.destination.set(5.4, 4.2, 10);
      this.target.set(-0.7, 0.25, 1);
    } else {
      // Offset is fixed: no automatic orbit that reverses the controls' screen direction.
      this.destination.copy(fishPosition).add(new Vector3(1.8, 0.65, 4.8));
      this.destination.y = Math.min(-0.12, this.destination.y);
      this.target.copy(fishPosition).add(new Vector3(0.1, 0.1, 0));
    }
    this.transition = reducedMotion ? 1 : Math.min(1, this.transition + dt / 0.5);
    const ease = this.transition * this.transition * (3 - 2 * this.transition);
    this.camera.position.lerpVectors(this.startPosition, this.destination, ease);
    this.focus.lerpVectors(this.startFocus, this.target, ease);
    this.camera.lookAt(this.focus);
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / Math.max(height, 1);
    this.frameWidth();
  }

  private frameWidth() {
    // Keep enough horizontal field for the avatar AND bobber on portrait screens.
    const minimumAspect = this.view === 'surface' ? 1.85 : 1.2;
    this.camera.fov = Math.min(100, Math.atan(Math.tan(24 * Math.PI / 180) * Math.max(1, minimumAspect / this.camera.aspect)) * 360 / Math.PI);
    this.camera.updateProjectionMatrix();
  }
}
