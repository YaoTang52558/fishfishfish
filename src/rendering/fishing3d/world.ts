import {
  BufferAttribute, BufferGeometry, CatmullRomCurve3, CircleGeometry, Color, ConeGeometry, CylinderGeometry,
  DoubleSide, FogExp2, Group, HemisphereLight, IcosahedronGeometry, InstancedMesh,
  Line, LineBasicMaterial, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry,
  Scene, ShaderMaterial, SphereGeometry, TorusGeometry, TubeGeometry, Vector3, DirectionalLight,
} from 'three';
import { createPrototypeFish } from './fish.ts';
import { createSpeciesFish } from './species.ts';
import { speciesFor } from '../../catalog/species.ts';
import type { HabitatId } from '../../domain/types.ts';
import { SceneResources } from './resources.ts';
import type { FishingView } from './cameras.ts';
import type { FightState3D } from '../../domain/fishing3d/state.ts';
import { toWorld } from './coordinates.ts';
import { castPosition } from '../../domain/fishing3d/round.ts';
import type { RoundState } from '../../domain/fishing3d/round.ts';
import { bobberPosition, castingPose, splashAge, surfaceFloat, surfaceRodTip } from '../../domain/fishing3d/visual.ts';
import { spots } from '../../domain/fishing.ts';

export function createFishingWorld(resources: SceneResources, options: { habitatId?: HabitatId; fullContent?: boolean; deferModels?: boolean } = {}) {
  const coast = options.habitatId === 'coastal-rock';
  let lowQuality = false;
  const scene = new Scene();
  scene.background = new Color('#a8def0');
  scene.fog = new FogExp2('#a8def0', 0.011);
  scene.add(new HemisphereLight('#fff6df', '#3b8289', 2.5));
  const sun = new DirectionalLight('#ffebc9', 3.3);
  sun.position.set(-8, 15, 9); scene.add(sun);
  const sphere = resources.geometry(new SphereGeometry(1, 16, 10));
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
  instance(rock, coast ? '#6c7c78' : '#ddc9a5', [-3.4, -0.2, 7.5], [coast ? 5.8 : 6.6, 1.4, 3.5]);
  instance(rock, coast ? '#87958c' : '#edd8b1', [-3, 0.4, 6.3], [2.6, 0.6, 1.6]);
  for (let i = 0; i < 17; i++) {
    const x = -10 + i * 0.85;
    instance(rock, coast ? '#6c7c78' : i % 2 ? '#b5b79b' : '#ddc9a5', [x, 0.03, 5.8 + Math.sin(i * 2.4) * 0.5], [0.7 + (i % 3) * 0.2, coast ? .7 : .5, 0.65], i);
  }
  // Seabed remains visible below both cameras and slopes into deeper water.
  const bedGeometry = resources.geometry(new PlaneGeometry(130, 130, 24, 24));
  bedGeometry.rotateX(-Math.PI / 2);
  const positions = bedGeometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    positions.setY(i, (coast ? -3.8 : -3.2) + Math.sin(x * 0.5) * 0.13 + Math.cos(z * 0.6) * 0.18 - Math.max(0, -z) * (coast ? .09 : .06));
  }
  bedGeometry.computeVertexNormals();
  const bedMaterial = resources.material(new ShaderMaterial({
    side: DoubleSide, uniforms: { time: { value: 0 }, detail: { value: 1 }, fogColor: { value: new Color('#a8def0') }, fogDensity: { value: 0.011 } },
    vertexShader: `varying vec3 p; varying float depth; void main(){p=(modelMatrix*vec4(position,1.0)).xyz;
      vec4 mv=modelViewMatrix*vec4(position,1.0); depth=-mv.z; gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform float time; uniform float detail; uniform vec3 fogColor; uniform float fogDensity; varying vec3 p; varying float depth;
      void main(){float c=0.0; if(detail>.5)c=pow(abs(sin(p.x*3.2+sin(p.z*2.7+time*0.3))*sin(p.z*3.3-p.x*0.9+time*0.25)),14.0);
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
      const color = coast ? (i % 3 ? '#426f65' : '#738268') : i % 3 ? '#e5b46f' : '#cf85a0';
      instance(sphere, color, [x + offset, -2.6 + j * 0.1, z], [coast ? .085 : .19, (coast ? 1 : .4) + j * 0.08, coast ? .08 : .17]);
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
  // Original rounded shore character, with small casts/reeling/netting poses.
  const avatar = new Group(); avatar.position.set(-3.1, 0.9, 6.1); scene.add(avatar);
  mesh(avatar, sphere, '#faf4dc', [0, 0.63, 0], [0.43, 0.5, 0.3]);
  mesh(avatar, sphere, '#f0bb8b', [0, 1.25, -0.05], [0.32, 0.34, 0.3]);
  mesh(avatar, sphere, '#644f36', [0, 1.38, 0.04], [0.35, 0.26, 0.3]);
  mesh(avatar, cylinder, '#e7be72', [0, 1.58, -0.04], [0.68, 0.07, 0.68]);
  mesh(avatar, cylinder, '#e7be72', [0, 1.73, -0.04], [0.38, 0.27, 0.38]);
  mesh(avatar, cylinder, '#356c78', [0, 1.64, -0.04], [0.39, 0.075, 0.39]);
  const arms: Group[] = [];
  for (const side of [-1, 1]) {
    mesh(avatar, sphere, '#6591a0', [side * 0.22, 0.13, -0.08], [0.24, 0.2, 0.34]);
    mesh(avatar, sphere, '#f0bb8b', [side * 0.26, -0.06, -0.33], [0.14, 0.24, 0.14]);
    mesh(avatar, sphere, '#79583e', [side * 0.26, -0.23, -0.4], [0.19, 0.14, 0.29]);
    const arm = new Group(); arm.position.set(side * 0.35, 0.67, -0.1); avatar.add(arm); arms.push(arm);
    mesh(arm, sphere, '#f0bb8b', [0, 0, -0.22], [0.12, 0.13, 0.38]);
  }
  mesh(avatar, sphere, '#c39552', [-0.18, 0.44, 0.28], [0.34, 0.32, 0.16]);
  for(const side of [-1,1]){
    mesh(avatar,sphere,'#273d39',[side*.11,1.3,-.315],[.035,.045,.02]);
    mesh(avatar,sphere,'#d7886c',[side*.18,1.21,-.29],[.055,.025,.015]);
    mesh(avatar,sphere,'#4b8291',[side*.35,.73,-.09],[.16,.18,.16]);
  }
  mesh(avatar,sphere,'#f0bb8b',[0,1.23,-.36],[.055,.045,.035]);
  for(let i=0;i<3;i++)mesh(avatar,sphere,'#c3a05c',[0,.78-i*.12,-.295],[.025,.025,.02]);
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
  const reelCrank = new Group();reelCrank.position.set(-2.66,1.72,5.57);scene.add(reelCrank);
  const reelRing = new Mesh(resources.geometry(new TorusGeometry(.115,.018,6,18)),material('#e3c684'));reelCrank.add(reelRing);
  mesh(reelCrank,cylinder,'#e3c684',[.06,0,0],[.025,.13,.025]).rotation.z=Math.PI/2;
  mesh(reelCrank,sphere,'#614b37',[.115,0,.02],[.04,.035,.025]);
  const bobber = new Group(); scene.add(bobber);
  mesh(bobber, sphere, '#fff9e7', [0, 0, 0], [0.095, 0.15, 0.095]);
  mesh(bobber, cylinder, '#f16e47', [0, 0.09, 0], [0.065, 0.1, 0.065]);
  mesh(bobber, resources.geometry(new ConeGeometry(0.04, 0.2, 8)), '#fff9e7', [0, 0.23, 0], [1, 1, 1]);
  const ripple = new Mesh(resources.geometry(new TorusGeometry(0.43, 0.008, 4, 40)), material('#c7fff0'));
  ripple.rotation.x = Math.PI / 2; scene.add(ripple);
  ripple.renderOrder = 4;
  const fishShadow = new Mesh(sphere, resources.material(new MeshBasicMaterial({ color: '#104e54', transparent: true, opacity: 0.4, depthWrite: false })));
  fishShadow.scale.set(0.65, 0.015, 0.21); fishShadow.renderOrder = 3; scene.add(fishShadow);
  const wake = [0, 1, 2].map(() => {
    const ring = new Mesh(resources.geometry(new TorusGeometry(0.3, 0.012, 4, 28)), resources.material(new MeshBasicMaterial({ color: '#d7fff0', transparent: true, opacity: 0.3, depthWrite: false })));
    ring.rotation.x = Math.PI / 2; ring.renderOrder = 4; scene.add(ring); return ring;
  });
  const splashMaterial = resources.material(new MeshBasicMaterial({ color: '#e3fff5', transparent: true, opacity: 0, depthWrite: false }));
  const splash = new Group(); scene.add(splash);
  const splashRings = [0, 1].map(() => {
    const ring = new Mesh(resources.geometry(new TorusGeometry(0.23, 0.014, 4, 32)), splashMaterial);
    ring.rotation.x = Math.PI / 2; ring.renderOrder = 4; splash.add(ring); return ring;
  });
  const droplets = Array.from({ length: 7 }, () => {
    const drop = new Mesh(sphere, splashMaterial); drop.scale.set(0.035, 0.065, 0.035); drop.renderOrder = 4; splash.add(drop); return drop;
  });
  const models = new Map<string, ReturnType<typeof createSpeciesFish>>();
  if (options.fullContent && !options.deferModels) for (const item of speciesFor(options.habitatId ?? 'reef-edge')) { const model = createSpeciesFish(resources, item.id); models.set(item.id, model); scene.add(model.group); model.group.visible = false; }
  const emptyModel = { group: new Group(), mouthPosition: (target:Vector3)=>target.set(0,0,0), animate: (_time:number,_reducedMotion:boolean)=>{} };
  let fish = options.fullContent ? models.values().next().value ?? emptyModel : createPrototypeFish(resources);
  if (!options.fullContent) scene.add(fish.group);
  const fishPosition = new Vector3();
  const net = new Group();scene.add(net);
  const netRim=new Mesh(resources.geometry(new TorusGeometry(.62,.025,6,26)),material('#c0a066'));netRim.rotation.x=Math.PI/2;net.add(netRim);
  const netting=new Mesh(resources.geometry(new SphereGeometry(.62,12,8,0,Math.PI*2,Math.PI/2,Math.PI/2)),resources.material(new MeshBasicMaterial({color:'#e1d3a9',wireframe:true,transparent:true,opacity:.45})));netting.scale.y=.45;net.add(netting);
  const netHandle=new Mesh(cylinder,material('#a37e49'));scene.add(netHandle);netHandle.scale.set(.028,1,.028);
  const lineGeometry = resources.geometry(new BufferGeometry());
  const linePositions = new Float32Array(24 * 3);
  lineGeometry.setAttribute('position', new BufferAttribute(linePositions, 3));
  const line = new Line(lineGeometry, resources.material(new LineBasicMaterial({ color: '#fff9dd', transparent: true, opacity: 0.85 })));
  line.frustumCulled = false; scene.add(line);
  const water = resources.material(new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide,
    uniforms: { time: { value: 0 }, detail: { value: 1 }, underwater: { value: 0 }, coast: { value: coast ? 1 : 0 } },
    vertexShader: `uniform float time; varying vec3 p; varying float depth;
      void main(){vec3 v=position; v.z+=0.035*sin(v.x*1.8+time)*cos(v.y*1.5+time*0.7);
        p=(modelMatrix*vec4(v,1.0)).xyz; vec4 mv=modelViewMatrix*vec4(v,1.0);
        depth=-mv.z; gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform float time; uniform float detail; uniform float underwater; uniform float coast; varying vec3 p; varying float depth;
      void main(){float wave=0.0; float glitter=0.0;
        if(detail>.5){wave=sin(p.x*2.3+time*0.6+sin(p.z*1.8))*sin(p.z*2.4-time*0.7);glitter=pow(max(wave,0.0),18.0);}
        float deep=1.0-smoothstep(-30.0,4.0,p.z);
        vec3 c=mix(vec3(0.015,0.32,0.28),vec3(0.006,0.095,0.21),deep);
        if(coast>.5)c=mix(vec3(.06,.23,.27),vec3(.02,.09,.16),deep);
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
      if (['#ddc9a5', '#edd8b1', '#b5b79b', '#548d55','#6c7c78','#87958c'].includes(batch.color)) shoreInstances.push(instances);
  }
  const mouth = new Vector3();
  const castSpots = spots.map(({ id }) => {
    const marker = new Mesh(resources.geometry(new TorusGeometry(0.42, 0.045, 6, 24)), material('#fff4c2'));
    marker.rotation.x = Math.PI / 2; toWorld(castPosition(id), marker.position); marker.position.y = 0.035;
    marker.userData.spot = id; scene.add(marker); return marker;
  });
  // Hit the entire circular area, including the empty centre of the decorative torus.
  const hitMaterial = resources.material(new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }));
  const castTargets = castSpots.map(marker => {
    const target = new Mesh(resources.geometry(new CircleGeometry(0.65, 24)), hitMaterial);
    target.rotation.copy(marker.rotation); target.position.copy(marker.position); target.userData.spot = marker.userData.spot;
    scene.add(target); return target;
  });
  let usingFight = false;
  function update(time: number, reducedMotion: boolean, fight?: FightState3D, round?: RoundState) {
    if (options.fullContent) {
      for (const model of models.values()) model.group.visible = false;
      fish = models.get(round?.speciesId ?? '') ?? models.values().next().value ?? emptyModel;
    }
    const t = time;
    reelCrank.rotation.z = reducedMotion ? 0 : (fight?.reelTurns ?? 0) * Math.PI * 2;
    const pose = round ? castingPose(round, reducedMotion) : null;
    avatar.rotation.x = pose?.lean ?? 0;
    arms.forEach(arm => { arm.rotation.x = -(pose?.arm ?? 0); });
    if (round?.phase === 'fighting' && fight) {
      avatar.rotation.x = reducedMotion ? 0 : -.025 - Math.min(1, fight.tension) * .045;
      arms.forEach((arm,i) => { arm.rotation.x = reducedMotion ? 0 : -.08 + (fight.reeling ? Math.sin(fight.reelTurns * Math.PI * 2 + i) * .08 : 0); });
    }
    if (round?.phase === 'caught' || round?.phase === 'landing') arms.forEach(arm => { arm.rotation.x = -.4; });
    if (fight) {
      toWorld(fight.fishPosition, fish.group.position);
      const h = fight.fishHeading;
      fish.group.rotation.set(0, Math.atan2(h.z, h.x), Math.atan2(h.y, Math.hypot(h.x, h.z)), 'YXZ');
      toWorld(round ? surfaceRodTip(fight) : fight.rodTip, rodTip);
      const offset = rodTip.clone().sub(originalRodPoints[3]!);
      for (let i = 0; i < rodPosition.count; i++) {
        const along = Math.floor(i / 7) / 24;
        const flex = along * along;
        rodPosition.setXYZ(i, initialRodPositions[i * 3]! + offset.x * flex, initialRodPositions[i * 3 + 1]! + offset.y * flex, initialRodPositions[i * 3 + 2]! + offset.z * flex);
      }
      rodPosition.needsUpdate = true; rod.geometry.computeVertexNormals(); rod.geometry.computeBoundingSphere();
      usingFight = true;
    } else {
      if (usingFight && round?.phase !== 'casting') { (rodPosition.array as Float32Array).set(initialRodPositions); rodPosition.needsUpdate = true; rod.geometry.computeVertexNormals(); rod.geometry.computeBoundingSphere(); usingFight = false; }
      rodTip.copy(originalRodPoints[3]!);
      if (pose && round?.phase === 'casting') {
        toWorld(pose.tip, rodTip);
        // Rotate the shaft around the fixed grip, then flex its upper section; do not just slide its tip.
        const grip = originalRodPoints[0]!, originalAxis = originalRodPoints[3]!.clone().sub(grip), targetAxis = rodTip.clone().sub(grip);
        const rotation = new Object3D().quaternion.setFromUnitVectors(originalAxis.clone().normalize(), targetAxis.clone().normalize());
        const rotatedTip = originalAxis.clone().applyQuaternion(rotation), flex = targetAxis.clone().sub(rotatedTip);
        const vertex = new Vector3();
        for (let i = 0; i < rodPosition.count; i++) {
          const along = Math.floor(i / 7) / 24;
          vertex.set(initialRodPositions[i * 3]!, initialRodPositions[i * 3 + 1]!, initialRodPositions[i * 3 + 2]!).sub(grip).applyQuaternion(rotation).add(grip).addScaledVector(flex, along * along);
          // Small tip lag makes the rod load on the backswing, then spring forward on release.
          vertex.y -= Math.sin(Math.PI * along) * Math.abs(pose.arm) * 0.25;
          rodPosition.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        rodPosition.needsUpdate = true; rod.geometry.computeVertexNormals(); rod.geometry.computeBoundingSphere(); usingFight = true;
      }
      fish.group.position.set(Math.sin(t * 0.35) * 0.6, -1.35 + Math.sin(t * 0.7) * 0.09, 1.4 + Math.cos(t * 0.3) * 0.18);
      fish.group.rotation.set(0, Math.sin(t * 0.35) * 0.14, 0, 'YXZ');
    }
    const active = fight?.action === 'telegraph' || fight?.action === 'sprint';
    const fishTime = fight ? fight.elapsedTicks / 60 : t;
    fish.animate(fishTime * (active ? 1.6 : 0.65), reducedMotion);
    fish.mouthPosition(mouth);
    castSpots.forEach(marker => { marker.visible = round?.phase === 'setup'; });
    castTargets.forEach(target => { target.visible = round?.phase === 'setup'; });
    fish.group.visible = !round || ['landing', 'caught', 'released'].includes(round.phase);
    if (round && fight && ['landing', 'caught', 'released'].includes(round.phase)) fish.group.position.y = round.phase === 'caught' ? 0.4 : -0.12;
    net.visible=netHandle.visible=!!round&&['landing','caught'].includes(round.phase);
    if(net.visible){net.position.copy(fish.group.position);net.position.y-=.25;const from=new Vector3(-2.72,1.55,5.72),to=net.position.clone(),axis=to.clone().sub(from);netHandle.position.copy(from).add(to).multiplyScalar(.5);netHandle.scale.y=axis.length();netHandle.quaternion.setFromUnitVectors(new Vector3(0,1,0),axis.normalize());}
    if (round?.phase === 'released') {
      fish.group.position.z -= round.ticks / 60 * 2; fish.group.position.y -= round.ticks / 60 * 0.3;
      fish.animate(round.ticks / 60, reducedMotion);
    }
    bobber.visible = !fight; ripple.visible = !fight;
    bobber.position.set(2.1, Math.sin(t * 1.4) * 0.03, 1.1);
    if (round) { toWorld(bobberPosition(round, reducedMotion), bobber.position); bobber.visible = ['casting', 'waiting', 'bite'].includes(round.phase); ripple.visible = ['waiting', 'bite'].includes(round.phase); }
    const surfaceFight = !!fight && !!round && ['fighting', 'landing'].includes(round.phase);
    if (surfaceFight && fight) { toWorld(surfaceFloat(fight, reducedMotion), bobber.position); bobber.visible = true; ripple.visible = true; }
    fishShadow.visible = surfaceFight;
    if (surfaceFight && fight) {
      fishShadow.position.copy(bobber.position); fishShadow.position.y = 0.012;
      fishShadow.rotation.y = Math.atan2(fight.fishHeading.z, fight.fishHeading.x);
      const factor = fight.size === 'large' ? 1.35 : 1;
      fishShadow.scale.set(0.65 * factor, 0.015, 0.21 * factor);
    }
    wake.forEach((ring, index) => {
      ring.visible = surfaceFight && (!lowQuality || index === 0);
      if (!surfaceFight || !fight) return;
      const age = reducedMotion ? (index + 1) / 4 : ((fight.elapsedTicks / 60 * 1.2 + index / 3) % 1);
      ring.position.copy(bobber.position); ring.position.y = 0.04;
      ring.position.x -= fight.fishVelocity.x * age * 0.3; ring.position.z += fight.fishVelocity.z * age * 0.3;
      ring.scale.set(1 + age * 2.8, 0.65 + age * 1.5, 1);
      (ring.material as MeshBasicMaterial).opacity = (1 - age) * (fight.action === 'rest' ? 0.18 : 0.65);
    });
    // The float leans while travelling and stands upright on impact.
    bobber.rotation.z = round?.phase === 'casting' && splashAge(round) === null && !reducedMotion ? -0.35 : 0;
    ripple.position.set(bobber.position.x, 0.025, bobber.position.z);
    ripple.scale.setScalar(1 + (surfaceFight && fight ? fight.tension * 0.25 : 0) + (reducedMotion ? 0 : Math.sin(t * 1.4) * 0.08));
    const impact = round ? splashAge(round) : null;
    splash.visible = impact !== null && impact < 0.65 && !reducedMotion;
    if (splash.visible && impact !== null && round?.spot) {
      toWorld(castPosition(round.spot), splash.position); splash.position.y = 0.045;
      splashMaterial.opacity = Math.max(0, 1 - impact / 0.65);
      splashRings.forEach((ring, index) => { ring.scale.setScalar(1 + impact * (4 + index * 2)); });
      droplets.forEach((drop, index) => {
        const angle = index / droplets.length * Math.PI * 2, radius = 0.12 + impact * 0.6;
        drop.position.set(Math.cos(angle) * radius, Math.max(0, impact * 2.2 - impact * impact * 5), Math.sin(angle) * radius);
        drop.visible = impact < 0.42 && !lowQuality;
      });
    }
    if (round) lineGeometry.setDrawRange(0, 24); // A single tip-to-float line before the fish is hooked.
    for (let i = 0; i < 24; i++) {
      const above = !!round || !!fight || i <= 16;
      const blend = round || fight ? i / 23 : above ? i / 16 : (i - 16) / 7;
      const start = above ? rodTip : bobber.position, end = surfaceFight ? bobber.position : fight ? mouth : above ? bobber.position : mouth;
      const slack = fight ? Math.max(0, fight.lineLength - rodTip.distanceTo(mouth)) * 0.35 : 0.16;
      linePositions[i * 3] = start.x + (end.x - start.x) * blend;
      linePositions[i * 3 + 1] = start.y + (end.y - start.y) * blend - (above ? Math.sin(blend * Math.PI) * Math.min(slack, 1.4) : 0);
      linePositions[i * 3 + 2] = start.z + (end.z - start.z) * blend;
    }
    lineGeometry.getAttribute('position').needsUpdate = true;
    fishPosition.copy(fish.group.position);
    line.visible = round ? ['casting', 'waiting', 'bite', 'fighting', 'landing'].includes(round.phase) : fight?.phase !== 'escaped';
    const decorationTime = reducedMotion ? 0 : t;
    water.uniforms.time!.value = decorationTime; bedMaterial.uniforms.time!.value = decorationTime;
  }
  update(0, false);
  return {
    scene, fishPosition, castSpots: castTargets,
    warmModels(visible: boolean) { if (options.fullContent) for (const model of models.values()) model.group.visible = visible; },
    installModels(loaded: Map<string, ReturnType<typeof createSpeciesFish>>) {
      for(const model of models.values())scene.remove(model.group);models.clear();
      for(const [id,model] of loaded){models.set(id,model);scene.add(model.group);model.group.visible=false;}
      fish=models.values().next().value!;
    },
    update,
    quality(value: 'standard' | 'low') {
      lowQuality = value === 'low';
      water.uniforms.detail!.value = bedMaterial.uniforms.detail!.value = lowQuality ? 0 : 1;
    },
    setView(view: FishingView) {
      const below = view === 'underwater';
      // Hide only occluding above-water shore geometry for the underwater camera.
      shore.visible = !below; avatar.visible = !below;
      reelCrank.visible = !below;
      shoreInstances.forEach((object) => { object.visible = !below; });
      scene.background = new Color(below ? '#2c959d' : '#a8def0');
      scene.fog = new FogExp2(below ? '#2c959d' : '#a8def0', below ? 0.047 : 0.011);
      bedMaterial.uniforms.fogColor!.value = scene.fog.color;
      bedMaterial.uniforms.fogDensity!.value = scene.fog.density;
      water.uniforms.underwater!.value = below ? 1 : 0;
    },
  };
}
