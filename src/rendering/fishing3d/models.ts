import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Vector3 } from 'three';
import type { Mesh, Texture } from 'three';
import { speciesFor } from '../../catalog/species.ts';
import { speciesMouth } from '../../domain/fishing3d/content.ts';
import type { HabitatId } from '../../domain/types.ts';
import type { SceneResources } from './resources.ts';
const binaries = new Map<string, Promise<ArrayBuffer>>();
async function binary(id: string) {
  if (!binaries.has(id)) binaries.set(id, fetch(`${import.meta.env.BASE_URL}models/fishing/${id}.glb`).then(r => { if(!r.ok)throw new Error('Fish model unavailable');return r.arrayBuffer(); }).catch(e=>{binaries.delete(id);throw e;}));
  return binaries.get(id)!;
}
export async function loadFishModel(resources: SceneResources, id: string) {
  const gltf = await new GLTFLoader().parseAsync(await binary(id), '');
  const group = gltf.scene; group.name = id;
  const images = new Set<ImageBitmap>();
  group.traverse(object => {
    const mesh = object as Mesh; if (!mesh.isMesh) return;
    resources.geometry(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      resources.material(material);
      for (const value of Object.values(material)) if ((value as Texture)?.isTexture) {
        const texture = value as Texture; resources.texture(texture);
        if(typeof ImageBitmap!=='undefined'&&texture.image instanceof ImageBitmap&&!images.has(texture.image)){const image=texture.image;images.add(image);resources.own({dispose:()=>image.close()});}
      }
    }
  });
  const tail = group.getObjectByName('tail'), fins = [group.getObjectByName('pectoral-0'),group.getObjectByName('pectoral-1')];
  const a = speciesMouth(id), mouth = new Vector3(a.x,a.y,a.z);
  return { group, mouthPosition(target: Vector3) { group.updateWorldMatrix(true,false);return group.localToWorld(target.copy(mouth)); },
    animate(time:number,reducedMotion:boolean) { if(tail)tail.rotation.y=reducedMotion?0:Math.sin(time*5)*.24;fins.forEach((fin,i)=>{if(fin)fin.rotation.y=(i?1:-1)*(.5+(reducedMotion?0:Math.sin(time*4)*.18));}); } };
}
export async function loadHabitatModels(resources: SceneResources, habitat: HabitatId) {
  return new Map(await Promise.all(speciesFor(habitat).map(async item => [item.id,await loadFishModel(resources,item.id)] as const)));
}
