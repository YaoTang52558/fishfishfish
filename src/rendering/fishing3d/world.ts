import {
  BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, ConeGeometry, CylinderGeometry,
  DoubleSide, FogExp2, Group, HemisphereLight, IcosahedronGeometry, InstancedMesh,
  Line, LineBasicMaterial, Matrix4, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry,
  Scene, ShaderMaterial, SphereGeometry, TorusGeometry, TubeGeometry, Vector3, DirectionalLight,
} from 'three';
import { createPrototypeFish } from './fish.ts';
import { SceneResources } from './resources.ts';
import type { FishingView } from './cameras.ts';
import type { FightState3D } from '../../domain/fishing3d/state.ts';
import { toWorld } from './coordinates.ts';

export function createFishingWorld(resources: SceneResources) {
  const scene = new Scene();
  scene.background = new Color('#a8def0');
  scene.fog = new FogExp2('#a8def0', 0.011);
  scene.add(new HemisphereLight('#fff6df', '#3b8289', 2.5));
  const sun = new DirectionalLight('#ffebc9', 3.3);
  sun.position.set(-8, 15, 9); scene.add(sun);
  const sphere = resources.geometry(new SphereGeometry(1, 20, 12));
  const rock = resources.geometry(new IcosahedronGeometry(1, 1));
  const cylinder = resources.geometry(new CylinderGeometry(1, 1, 1, 12));
  const palette = new Map<string, MeshStandardMaterial>();
  const material = (color: string) => {
    if (!palette.has(color)) palette.set(color, resources.material(new MeshStandardMaterial({ color, roughness: 0.84 })));
    return palette.get(color)!;
  };
  const mesh = (parent: Object3D, geometry: BufferGeometry, color: string, p: number[], s: number[]) => {
    const object = new Mesh(geometry, material(color));
    object.position.set(p[0]!, p[1]!, p[2]!); object.scale.set(s[0]!, s[1]!, s[2]!);
    parent.add(object); return object;
  };
  // Small repeated details are batched into one draw call per geometry/material.
  const batches = new Map<string, { geometry: BufferGeometry; color: string; matrices: Matrix4[] }>();
  const shoreInstances: InstancedMesh[] = [];
  const dummy = new Object3D();
  function instance(geometry: BufferGeometry, color: string, p: number[], s: number[], rotation = 0) {
    const key = `${geometry.uuid}:${color}`;
    if (!batches.has(key)) batches.set(key, { geometry, color, matrices: [] });
    dummy.position.set(p[0]!, p[1]!, p[2]!); dummy.scale.set(s[0]!, s[1]!, s[2]!);
    dummy.rotation.set(0, rotation, 0); dummy.updateMatrix();
    batches.get(key)!.matrices.push(dummy.matrix.clone());
  }
  const shore = new Group(); scene.add(shore);
  instance(rock, '#ddc9a5', [-3.4, -0.2, 7.5], [6.6, 1.4, 3.5]);
  instance(rock, '#edd8b1', [-3, 0.4, 6.3], [2.6, 0.6, 1.6]);
  for (let i = 0; i < 17; i++) {
    const x = -10 + i * 0.85;
    instance(rock, i % 2 ? '#b5b79b' : '#ddc9a5', [x, 0.03, 5.8 + Math.sin(i * 2.4) * 0.5], [0.7 + (i % 3) * 0.2, 0.5, 0.65], i);
  }
  // Seabed remains visible below both cameras and slopes into deeper water.
  const bedGeometry = resources.geometry(new PlaneGeometry(130, 130, 24, 24));
  bedGeometry.rotateX(-Math.PI / 2);
  const positions = bedGeometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    positions.setY(i, -3.2 + Math.sin(x * 0.5) * 0.13 + Math.cos(z * 0.6) * 0.18 - Math.max(0, -z) * 0.06);
  }
  bedGeometry.computeVertexNormals();
  const bedMaterial = resources.material(new ShaderMaterial({
    side: DoubleSide, uniforms: { time: { value: 0 }, fogColor: { value: new Color('#a8def0') }, fogDensity: { value: 0.011 } },
    vertexShader: `varying vec3 p; varying float depth; void main(){p=(modelMatrix*vec4(position,1.0)).xyz;
      vec4 mv=modelViewMatrix*vec4(position,1.0); depth=-mv.z; gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform float time; uniform vec3 fogColor; uniform float fogDensity; varying vec3 p; varying float depth;
      void main(){float c=pow(abs(sin(p.x*3.2+sin(p.z*2.7+time*0.3))*sin(p.z*3.3-p.x*0.9+time*0.25)),14.0);
      vec3 sand=mix(vec3(0.20,0.49,0.48),vec3(0.77,0.77,0.53),smoothstep(-12.0,6.0,p.z));
      vec3 color=sand+c*vec3(0.20,0.25,0.16);
      color=mix(color,fogColor,1.0-exp(-fogDensity*fogDensity*depth*depth));
      gl_FragColor=vec4(color,1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  }));
  scene.add(new Mesh(bedGeometry, bedMaterial));
  // Keep the fish's foreground corridor clear; reefs sit behind and to its sides.
  for (let i = 0; i < 28; i++) {
    const x = Math.sin(i * 2.31) * 9, z = -2 - (i % 7) * 2;
    const size = 0.45 + (i % 4) * 0.18;
    instance(rock, '#648f87', [x, -2.9, z], [size * 1.3, size * 0.7, size], i);
    for (let j = 0; j < 4; j++) {
      const offset = (j - 1.5) * 0.19;
      const color = i % 3 ? '#e5b46f' : '#cf85a0';
      instance(sphere, color, [x + offset, -2.6 + j * 0.1, z], [0.19, 0.4 + j * 0.08, 0.17]);
      instance(sphere, '#367c68', [x + 0.6 + offset, -2.7, z - 0.3], [0.15, 0.6 + j * 0.11, 0.1]);
    }
  }
  for (let i = 0; i < 6; i++) {
    const x = -25 + i * 11, z = -32 - (i % 3) * 8;
    instance(rock, '#85aba4', [x, 1, z], [3 + (i % 3), 3.5 + (i % 2) * 3, 3], i);
    instance(rock, '#5b9a83', [x, 3, z], [2.5, 2, 2.5]);
  }
  for (let i = 0; i < 8; i++) {
    instance(sphere, '#eff5e8', [-40 + i * 12, 7 + (i % 2) * 2, -60], [6, 1.1, 2]);
  }
  // Avatar is an original, rounded mesh greybox; formal character animation is G4.
  const avatar = new Group(); avatar.position.set(-3.1, 0.9, 6.1); scene.add(avatar);
  mesh(avatar, sphere, '#faf4dc', [0, 0.63, 0], [0.43, 0.5, 0.3]);
  mesh(avatar, sphere, '#f0bb8b', [0, 1.25, -0.05], [0.32, 0.34, 0.3]);
  mesh(avatar, sphere, '#644f36', [0, 1.38, 0.04], [0.35, 0.26, 0.3]);
  mesh(avatar, cylinder, '#e7be72', [0, 1.58, -0.04], [0.68, 0.07, 0.68]);
  mesh(avatar, cylinder, '#e7be72', [0, 1.73, -0.04], [0.38, 0.27, 0.38]);
  mesh(avatar, cylinder, '#356c78', [0, 1.64, -0.04], [0.39, 0.075, 0.39]);
  for (const side of [-1, 1]) {
    mesh(avatar, sphere, '#6591a0', [side * 0.22, 0.13, -0.08], [0.24, 0.2, 0.34]);
    mesh(avatar, sphere, '#f0bb8b', [side * 0.26, -0.06, -0.33], [0.14, 0.24, 0.14]);
    mesh(avatar, sphere, '#79583e', [side * 0.26, -0.23, -0.4], [0.19, 0.14, 0.29]);
    mesh(avatar, sphere, '#f0bb8b', [side * 0.35, 0.67, -0.32], [0.12, 0.13, 0.38]);
  }
  mesh(avatar, sphere, '#c39552', [-0.18, 0.44, 0.28], [0.34, 0.32, 0.16]);
  // Basket and a few leaves give the shore recognizable scale.
  mesh(shore, cylinder, '#b88746', [-4.3, 1.05, 6.3], [0.38, 0.5, 0.38]);
  const basketRim = new Mesh(resources.geometry(new TorusGeometry(0.37, 0.04, 6, 20)), material('#e4c17d'));
  basketRim.rotation.x = Math.PI / 2; basketRim.position.set(-4.3, 1.31, 6.3); shore.add(basketRim);
  for (let i = 0; i < 15; i++) {
    instance(sphere, '#548d55', [-6 + Math.sin(i * 2) * 2, 0.9 + (i % 3) * 0.1, 7.5 + Math.cos(i) * 0.7], [0.17, 0.6, 0.2], i);
  }
  const rodPoints = [new Vector3(-2.7, 1.65, 5.6), new Vector3(-2.1, 2.8, 4.8), new Vector3(-1.4, 3.5, 3.8), new Vector3(-0.7, 3.6, 2.8)];
  const rodCurve = new CatmullRomCurve3(rodPoints);
  const rod = new Mesh(resources.geometry(new TubeGeometry(rodCurve, 24, 0.027, 6, false)), material('#a36632')); scene.add(rod);
  // Rebuild only the rod's vertex positions, keeping one GPU geometry throughout the fight.
  const originalRodPoints = rodPoints.map((point) => point.clone());
  const initialRodPositions = (rod.geometry.getAttribute('position').array as Float32Array).slice();
  const rodPosition = rod.geometry.getAttribute('position');
  const rodTip = rodPoints[3]!.clone();
  mesh(scene, sphere, '#e3c684', [-2.62, 1.79, 5.49], [0.085, 0.09, 0.085]);
  const bobber = new Group(); scene.add(bobber);
  mesh(bobber, sphere, '#fff9e7', [0, 0, 0], [0.095, 0.15, 0.095]);
  mesh(bobber, cylinder, '#f16e47', [0, 0.09, 0], [0.065, 0.1, 0.065]);
  mesh(bobber, resources.geometry(new ConeGeometry(0.04, 0.2, 8)), '#fff9e7', [0, 0.23, 0], [1, 1, 1]);
  const ripple = new Mesh(resources.geometry(new TorusGeometry(0.43, 0.008, 4, 40)), material('#c7fff0'));
  ripple.rotation.x = Math.PI / 2; scene.add(ripple);
  const fish = createPrototypeFish(resources); scene.add(fish.group);
  const lineGeometry = resources.geometry(new BufferGeometry());
  const linePositions = new Float32Array(24 * 3);
  lineGeometry.setAttribute('position', new BufferAttribute(linePositions, 3));
  const line = new Line(lineGeometry, resources.material(new LineBasicMaterial({ color: '#fff9dd', transparent: true, opacity: 0.85 })));
  line.frustumCulled = false; scene.add(line);
  const water = resources.material(new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide,
    uniforms: { time: { value: 0 }, underwater: { value: 0 } },
    vertexShader: `uniform float time; varying vec3 p; varying float depth;
      void main(){vec3 v=position; v.z+=0.035*sin(v.x*1.8+time)*cos(v.y*1.5+time*0.7);
        p=(modelMatrix*vec4(v,1.0)).xyz; vec4 mv=modelViewMatrix*vec4(v,1.0);
        depth=-mv.z; gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform float time; uniform float underwater; varying vec3 p; varying float depth;
      void main(){float wave=sin(p.x*2.3+time*0.6+sin(p.z*1.8))*sin(p.z*2.4-time*0.7);
        float glitter=pow(max(wave,0.0),18.0); float deep=1.0-smoothstep(-30.0,4.0,p.z);
        vec3 c=mix(vec3(0.015,0.32,0.28),vec3(0.006,0.095,0.21),deep);
        c+=glitter*vec3(0.21,0.31,0.26); c+=wave*0.018;
        if(underwater>0.5)c=vec3(0.12,0.65,0.70)+glitter*0.14;
        gl_FragColor=vec4(c,underwater>0.5?0.65*exp(-0.0025*depth*depth):0.88);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const waterMesh = new Mesh(resources.geometry(new PlaneGeometry(140, 140, 64, 64)), water);
  waterMesh.rotation.x = -Math.PI / 2; waterMesh.renderOrder = 2; scene.add(waterMesh);
  for (const batch of batches.values()) {
    const instances = resources.own(new InstancedMesh(batch.geometry, material(batch.color), batch.matrices.length));
    batch.matrices.forEach((matrix, i) => instances.setMatrixAt(i, matrix));
    scene.add(instances);
    if (['#ddc9a5', '#edd8b1', '#b5b79b', '#548d55'].includes(batch.color)) shoreInstances.push(instances);
  }
  const mouth = new Vector3();
  let usingFight = false;
  function update(time: number, reducedMotion: boolean, fight?: FightState3D) {
    const t = time;
    if (fight) {
      toWorld(fight.fishPosition, fish.group.position);
      const h = fight.fishHeading;
      fish.group.rotation.set(0, Math.atan2(h.z, h.x), Math.atan2(h.y, Math.hypot(h.x, h.z)), 'YXZ');
      toWorld(fight.rodTip, rodTip);
      const offset = rodTip.clone().sub(originalRodPoints[3]!);
      for (let i = 0; i < rodPosition.count; i++) {
        const along = Math.floor(i / 7) / 24;
        const flex = along * along;
        rodPosition.setXYZ(i, initialRodPositions[i * 3]! + offset.x * flex, initialRodPositions[i * 3 + 1]! + offset.y * flex, initialRodPositions[i * 3 + 2]! + offset.z * flex);
      }
      rodPosition.needsUpdate = true; rod.geometry.computeVertexNormals(); rod.geometry.computeBoundingSphere();
      usingFight = true;
    } else {
      if (usingFight) { (rodPosition.array as Float32Array).set(initialRodPositions); rodPosition.needsUpdate = true; rod.geometry.computeVertexNormals(); rod.geometry.computeBoundingSphere(); usingFight = false; }
      rodTip.copy(originalRodPoints[3]!);
      fish.group.position.set(Math.sin(t * 0.35) * 0.6, -1.35 + Math.sin(t * 0.7) * 0.09, 1.4 + Math.cos(t * 0.3) * 0.18);
      fish.group.rotation.set(0, Math.sin(t * 0.35) * 0.14, 0, 'YXZ');
    }
    const active = fight?.action === 'telegraph' || fight?.action === 'sprint';
    const fishTime = fight ? fight.elapsedTicks / 60 : t;
    fish.animate(fishTime * (active ? 1.6 : 0.65), reducedMotion);
    fish.mouthPosition(mouth);
    bobber.visible = !fight; ripple.visible = !fight;
    bobber.position.set(2.1, Math.sin(t * 1.4) * 0.03, 1.1);
    ripple.position.set(bobber.position.x, 0.025, bobber.position.z);
    ripple.scale.setScalar(1 + Math.sin(t * 1.4) * 0.08);
    for (let i = 0; i < 24; i++) {
      const above = fight ? true : i <= 16;
      const blend = fight ? i / 23 : above ? i / 16 : (i - 16) / 7;
      const start = above ? rodTip : bobber.position, end = fight ? mouth : above ? bobber.position : mouth;
      const slack = fight ? Math.max(0, fight.lineLength - rodTip.distanceTo(mouth)) * 0.35 : 0.16;
      linePositions[i * 3] = start.x + (end.x - start.x) * blend;
      linePositions[i * 3 + 1] = start.y + (end.y - start.y) * blend - (above ? Math.sin(blend * Math.PI) * Math.min(slack, 1.4) : 0);
      linePositions[i * 3 + 2] = start.z + (end.z - start.z) * blend;
    }
    lineGeometry.getAttribute('position').needsUpdate = true;
    line.visible = fight?.phase !== 'escaped';
    const decorationTime = reducedMotion ? 0 : t;
    water.uniforms.time!.value = decorationTime; bedMaterial.uniforms.time!.value = decorationTime;
  }
  update(0, false);
  return {
    scene, fishPosition: fish.group.position,
    update,
    setView(view: FishingView) {
      const below = view === 'underwater';
      // Hide only occluding above-water shore geometry for the underwater camera.
      shore.visible = !below; avatar.visible = !below;
      shoreInstances.forEach((object) => { object.visible = !below; });
      scene.background = new Color(below ? '#2c959d' : '#a8def0');
      scene.fog = new FogExp2(below ? '#2c959d' : '#a8def0', below ? 0.047 : 0.011);
      bedMaterial.uniforms.fogColor!.value = scene.fog.color;
      bedMaterial.uniforms.fogDensity!.value = scene.fog.density;
      water.uniforms.underwater!.value = below ? 1 : 0;
    },
  };
}
