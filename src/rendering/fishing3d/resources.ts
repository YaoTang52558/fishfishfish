import type { BufferGeometry, Material, Texture } from 'three';

/** A scene owns its resources, including resources created before an async warm-up finishes. */
export class SceneResources {
  private readonly owned = new Set<{ dispose(): void }>();
  private closed = false;

  own<T extends { dispose(): void }>(resource: T): T {
    if (this.closed) resource.dispose();
    else this.owned.add(resource);
    return resource;
  }

  geometry<T extends BufferGeometry>(resource: T): T { return this.own(resource); }
  material<T extends Material>(resource: T): T { return this.own(resource); }
  texture<T extends Texture>(resource: T): T { return this.own(resource); }
  get size() { return this.owned.size; }

  dispose() {
    if (this.closed) return;
    this.closed = true;
    for (const resource of this.owned) resource.dispose();
    this.owned.clear();
  }
}
