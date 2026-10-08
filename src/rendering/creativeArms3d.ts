import * as THREE from 'three';
import { armSections, armSegments, type ArmRoot } from '../domain/arms.ts';
/** All arms share one mesh and one draw call; animation only updates vertex arrays. */
export function createCreativeArms3d(roots: ArmRoot[], color: string) {
  const radial = 8, ringSize = radial + 1, verticesPerArm = (armSegments + 1) * ringSize;
  const positions = new Float32Array(roots.length * verticesPerArm * 3), normals = new Float32Array(positions.length);
  const indices: number[] = [];
  for (let arm = 0; arm < roots.length; arm++) for (let section = 0; section < armSegments; section++) for (let side = 0; side < radial; side++) {
    const p = arm * verticesPerArm + section * ringSize + side;
    indices.push(p, p + ringSize, p + 1, p + 1, p + ringSize, p + ringSize + 1);
  }
  for (let arm = 0; arm < roots.length; arm++) {
    const tip = arm * verticesPerArm + armSegments * ringSize;
    for (let side = 1; side < radial - 1; side++) indices.push(tip, tip + side + 1, tip + side);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage)); geometry.setIndex(indices);
  const material = new THREE.MeshStandardMaterial({ color, roughness: .65, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'fantasy-arms';
  function update(time = 0, animated = true) {
    roots.forEach((root, arm) => armSections(root, time, animated).forEach((p, section) => {
      for (let side = 0; side <= radial; side++) {
        const a = side / radial * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), k = (arm * verticesPerArm + section * ringSize + side) * 3;
        positions[k] = p.x + p.nx * p.radius * c; positions[k + 1] = -(p.y + p.ny * p.radius * c); positions[k + 2] = p.radius * s;
        normals[k] = p.nx * c; normals[k + 1] = -p.ny * c; normals[k + 2] = s;
      }
    }));
    geometry.attributes.position!.needsUpdate = true; geometry.attributes.normal!.needsUpdate = true;
  }
  update(0, false);
  // Raycasting must use every possible pose, not the first curled frame.
  const bounds = new THREE.Box3();
  for (const root of roots) {
    const reach = root.length + root.radius;
    bounds.expandByPoint(new THREE.Vector3(root.x - reach, -root.y - reach, -root.radius));
    bounds.expandByPoint(new THREE.Vector3(root.x + reach, -root.y + reach, root.radius));
  }
  geometry.boundingBox = bounds; geometry.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
  return { mesh, update, dispose() { geometry.dispose(); material.dispose(); } };
}
