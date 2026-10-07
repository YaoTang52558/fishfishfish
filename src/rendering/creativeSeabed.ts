import * as THREE from 'three';
/** Original, lightweight habitat scenery; the shapes do not stand for identified species. */
export function creativeSeabed() {
  const group = new THREE.Group(), geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const floorGeo = new THREE.PlaneGeometry(16, 16, 1, 1), floorMat = new THREE.MeshStandardMaterial({ color: '#d4d9b7', roughness: 1 }); geometries.push(floorGeo); materials.push(floorMat);
  const floor = new THREE.Mesh(floorGeo, floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -1.8, -3); group.add(floor);
  const rockGeo = new THREE.DodecahedronGeometry(1, 0), rockMat = new THREE.MeshStandardMaterial({ color: '#76a895', roughness: 1 }); geometries.push(rockGeo); materials.push(rockMat);
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 10), matrix = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < 10; i++) { q.setFromEuler(new THREE.Euler(i * 0.4, i * 0.7, 0)); matrix.compose(new THREE.Vector3((i % 5 - 2) * 1.5, -1.7, -2 - Math.floor(i / 5) * 2), q, new THREE.Vector3(0.8, 0.3 + i % 3 * 0.13, 0.65)); rocks.setMatrixAt(i, matrix); } group.add(rocks);
  const coralGeo = new THREE.CylinderGeometry(0.025, 0.06, 1, 6), coralMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }); geometries.push(coralGeo); materials.push(coralMat);
  const branches = new THREE.InstancedMesh(coralGeo, coralMat, 30);
  for (let i = 0; i < 30; i++) { const side = i < 15 ? -1 : 1; q.setFromEuler(new THREE.Euler(0, i * 0.4, Math.sin(i) * 0.45)); matrix.compose(new THREE.Vector3(side * (2.5 + i % 3 * 0.18), -1.55 + (i % 4) * 0.11, -1.8 - i % 5 * 0.35), q, new THREE.Vector3(1, 0.5 + i % 4 * 0.15, 1)); branches.setMatrixAt(i, matrix); branches.setColorAt(i, new THREE.Color(['#dca28d','#c4b3d8','#dbc282'][i % 3]!)); } group.add(branches);
  return { group, dispose() { rocks.dispose(); branches.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); } };
}
