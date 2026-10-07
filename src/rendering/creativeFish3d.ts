import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getFishGeometry } from '../domain/geometry.ts';
import type { FishDesign, Point } from '../domain/types.ts';
import { renderFish } from './FishRenderer.ts';

/** A generated volume from the saved outline; shared side paint, no design mutation. */
export function createCreativeFish3d(design: FishDesign, paint: CanvasImageSource | null, glow: CanvasImageSource | null) {
  const fish = new THREE.Group(), g = getFishGeometry(design);
  const textures: THREE.Texture[] = [], geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  // The rendering axes need independent scale to recover canonical UV coordinates.
  ctx.setTransform(512 / g.axes.x, 0, 0, 512 / g.axes.y, 256, 256);
  renderFish(ctx, design, { x: 0, y: 0, scale: 1 }, { paint });
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 512;
  if (glow) glowCanvas.getContext('2d')!.drawImage(glow, 0, 0, 512, 512);
  const glowTexture = new THREE.CanvasTexture(glowCanvas); glowTexture.colorSpace = THREE.SRGBColorSpace; textures.push(glowTexture);
  const bodyMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.65, metalness: 0, emissive: glow ? '#ffffff' : '#000000', emissiveMap: glowTexture, emissiveIntensity: 0.85 }); materials.push(bodyMaterial);
  const vertices: number[] = [], uv: number[] = [], indices: number[] = [], slices = 48, rings = 24;
  // Intersect the actual contour; handles head shapes and sculpted trunk alike.
  function section(x: number) {
    const ys: number[] = [];
    for (let i = 0; i < g.contour.length; i++) {
      const a = g.contour[i]!, b = g.contour[(i + 1) % g.contour.length]!;
      if (x >= Math.min(a.x, b.x) && x <= Math.max(a.x, b.x) && Math.abs(b.x - a.x) > 1e-9) ys.push(a.y + (x - a.x) / (b.x - a.x) * (b.y - a.y));
    }
    return ys.length ? { top: Math.min(...ys), bottom: Math.max(...ys) } : { top: 0, bottom: 0 };
  }
  for (let i = 0; i <= slices; i++) {
    const x = (-0.5 + i / slices) * g.axes.x, s = section(Math.max(-0.5 * g.axes.x + 1e-7, Math.min(0.5 * g.axes.x - 1e-7, x)));
    const cy = (s.top + s.bottom) / 2, ry = Math.max(0.001, (s.bottom - s.top) / 2);
    const rz = Math.max(0.001, ry * 0.48) * (i === 0 || i === slices ? 0.08 : 1);
    for (let j = 0; j <= rings; j++) {
      const a = j / rings * Math.PI * 2, y = cy + Math.cos(a) * ry, z = Math.sin(a) * rz;
      vertices.push(x, -y, z); uv.push(x / g.axes.x + 0.5, 0.5 - y / g.axes.y);
      if (i < slices && j < rings) { const k = i * (rings + 1) + j; indices.push(k, k + 1, k + rings + 1, k + 1, k + rings + 2, k + rings + 1); }
    }
  }
  // Close the narrow end rings; no open back/front caps.
  for (const i of [0, slices]) {
    const base = i * (rings + 1), center = vertices.length / 3, s = section((-0.5 + i / slices) * g.axes.x + (i ? -1 : 1) * 1e-7);
    vertices.push((-0.5 + i / slices) * g.axes.x, -(s.top + s.bottom) / 2, 0); uv.push(i / slices, 0.5 - (s.top + s.bottom) / 2 / g.axes.y);
    for (let j = 0; j < rings; j++) indices.push(...(i ? [center, base + j + 1, base + j] : [center, base + j, base + j + 1]));
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); geometries.push(geometry);
  fish.add(new THREE.Mesh(geometry, bodyMaterial));
  const finMaterial = new THREE.MeshStandardMaterial({ color: design.colors.fin, side: THREE.DoubleSide, roughness: 0.7 }); materials.push(finMaterial);
  const tailMaterial = new THREE.MeshStandardMaterial({ color: design.colors.tail, side: THREE.DoubleSide, roughness: 0.7 }); materials.push(tailMaterial);
  function surface(points: Point[], material: THREE.Material) {
    const shape = new THREE.Shape(points.map(p => new THREE.Vector2(p.x, -p.y))), geo = new THREE.ShapeGeometry(shape); geometries.push(geo); return new THREE.Mesh(geo, material);
  }
  const finGeometries: THREE.BufferGeometry[] = g.fins.map(f => surface(f.polygon, finMaterial).geometry);
  const tail = new THREE.Group(); tail.position.set(g.tail.pivot.x, -g.tail.pivot.y, 0); tail.add(surface(g.tail.polygon, tailMaterial)); fish.add(tail);
  for (const side of [-1, 1]) {
    const fin = new THREE.Group(); fin.position.set(g.pectoral.pivot.x, -g.pectoral.pivot.y, side * g.maxHalfHeight * 0.47);
    const mesh = surface(g.pectoral.polygon.map(p => ({ x: p.x - g.pectoral.pivot.x, y: p.y - g.pectoral.pivot.y })), finMaterial);
    fin.add(mesh); fin.rotation.y = side * 0.3; fin.updateMatrixWorld(true); mesh.geometry.applyMatrix4(mesh.matrixWorld); finGeometries.push(mesh.geometry);
  }
  const merged = mergeGeometries(finGeometries); if (merged) { geometries.push(merged); fish.add(new THREE.Mesh(merged, finMaterial)); }
  const size = Math.max(g.bounds.maxX - g.bounds.minX, g.bounds.maxY - g.bounds.minY);
  fish.position.x = -(g.bounds.minX + g.bounds.maxX) / 2;
  return { fish, size, width: g.bounds.maxX - g.bounds.minX, height: g.bounds.maxY - g.bounds.minY, animate(time: number) { tail.rotation.y = Math.sin(time * 3.5) * 0.2; }, dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); } };
}
