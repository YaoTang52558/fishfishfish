import {
  Color, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, ShaderMaterial, Shape,
  SphereGeometry, TorusGeometry, Vector3,
} from 'three';
import type { SceneResources } from './resources.ts';

export function createPrototypeFish(resources: SceneResources) {
  const fish = new Group();
  const orange = resources.material(new MeshStandardMaterial({ color: '#ff852a', roughness: 0.55 }));
  const dark = resources.material(new MeshStandardMaterial({ color: '#253d45', roughness: 0.5 }));
  const white = resources.material(new MeshStandardMaterial({ color: '#fff6db', roughness: 0.3 }));
  const sphere = resources.geometry(new SphereGeometry(1, 28, 16));
  const body = resources.material(new ShaderMaterial({
    uniforms: { orange: { value: new Color('#f78a32') } },
    vertexShader: `varying vec3 n; varying vec3 p;
      void main(){ p=position; n=normalize(mat3(modelMatrix)*normal);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 orange; varying vec3 n; varying vec3 p;
      void main(){
        float bands=min(abs(p.x-0.48)-0.13,min(abs(p.x+0.13)-0.12,abs(p.x+0.7)-0.07));
        vec3 c=mix(orange,vec3(0.055,0.10,0.12),1.0-smoothstep(0.0,0.025,bands));
        c=mix(c,vec3(0.97,0.94,0.83),1.0-smoothstep(-0.028,-0.014,bands));
        float light=0.52+0.48*max(dot(normalize(n),normalize(vec3(-0.4,1.0,1.0))),0.0);
        c*=light; c+=vec3(0.13)*pow(max(dot(normalize(n),normalize(vec3(0.5,0.8,1.0))),0.0),24.0);
        gl_FragColor=vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const bodyMesh = new Mesh(resources.geometry(new SphereGeometry(1, 48, 24)), body);
  bodyMesh.scale.set(0.88, 0.44, 0.28);
  fish.add(bodyMesh);
  function oval(material: MeshStandardMaterial, position: number[], scale: number[]) {
    const mesh = new Mesh(sphere, material);
    mesh.position.set(position[0]!, position[1]!, position[2]!);
    mesh.scale.set(scale[0]!, scale[1]!, scale[2]!);
    fish.add(mesh);
    return mesh;
  }
  for (const side of [-1, 1]) {
    oval(orange, [0.56, 0.13, side * 0.24], [0.18, 0.19, 0.09]);
    oval(dark, [0.59, 0.14, side * 0.303], [0.12, 0.135, 0.045]);
    oval(white, [0.625, 0.185, side * 0.339], [0.031, 0.035, 0.018]);
  }
  const lip = new Mesh(resources.geometry(new TorusGeometry(0.105, 0.032, 8, 20)), orange);
  lip.rotation.y = Math.PI / 2;
  lip.position.set(0.87, -0.055, 0);
  fish.add(lip);
  const finShape = new Shape();
  finShape.moveTo(0, 0); finShape.quadraticCurveTo(-0.33, 0.3, -0.7, 0.33);
  finShape.quadraticCurveTo(-0.82, 0, -0.7, -0.33); finShape.quadraticCurveTo(-0.33, -0.3, 0, 0);
  const finGeometry = resources.geometry(new ExtrudeGeometry(finShape, { depth: 0.025, bevelEnabled: false, curveSegments: 6 }));
  const tail = new Group(); tail.position.set(-0.7, 0, 0);
  const tailEdge = new Mesh(finGeometry, dark); tail.add(tailEdge);
  const tailInner = new Mesh(finGeometry, orange); tailInner.scale.set(0.91, 0.86, 1.3); tailInner.position.z = -0.004; tail.add(tailInner);
  fish.add(tail);
  const dorsalShape = new Shape();
  dorsalShape.moveTo(-0.6, 0); dorsalShape.lineTo(-0.4, 0.25);
  dorsalShape.lineTo(-0.25, 0.2); dorsalShape.lineTo(-0.1, 0.27);
  dorsalShape.lineTo(0.1, 0.2); dorsalShape.lineTo(0.28, 0); dorsalShape.closePath();
  const dorsal = new Mesh(resources.geometry(new ExtrudeGeometry(dorsalShape, { depth: 0.025, bevelEnabled: false })), orange);
  dorsal.position.set(0, 0.34, -0.012); fish.add(dorsal);
  const pectorals: Mesh[] = [];
  for (const side of [-1, 1]) {
    const fin = new Mesh(finGeometry, orange);
    fin.position.set(0.12, -0.16, side * 0.2);
    fin.scale.set(0.45, 0.45, 0.8); fin.rotation.y = side * 0.6;
    fish.add(fin); pectorals.push(fin);
  }
  const mouth = new Vector3(0.91, -0.055, 0);
  return {
    group: fish,
    mouthPosition: (target: Vector3) => { fish.updateWorldMatrix(true, false); return fish.localToWorld(target.copy(mouth)); },
    animate: (time: number, reducedMotion: boolean) => {
      tail.rotation.y = reducedMotion ? 0 : Math.sin(time * 5) * 0.25;
      pectorals.forEach((fin, i) => { fin.rotation.y = (i ? 1 : -1) * (0.6 + (reducedMotion ? 0 : Math.sin(time * 4) * 0.16)); });
    },
  };
}
