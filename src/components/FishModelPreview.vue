<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { ACESFilmicToneMapping, Box3, Color, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { loadFishModel } from '../rendering/fishing3d/models';
import { SceneResources } from '../rendering/fishing3d/resources';
const props = defineProps<{ speciesId: string }>();
const host=ref<HTMLDivElement>(),error=ref('');const resources=new SceneResources();let renderer:WebGLRenderer|undefined,observer:ResizeObserver|undefined,dead=false;
onMounted(async()=>{try{
 renderer=new WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;renderer.setPixelRatio(1);host.value!.append(renderer.domElement);
 const scene=new Scene();scene.background=new Color('#1f555b');scene.add(new HemisphereLight('#fff7df','#567e90',3));const sun=new DirectionalLight('#fff8de',3);sun.position.set(-3,5,5);scene.add(sun);
 const model=await loadFishModel(resources,props.speciesId);if(dead)return;scene.add(model.group);model.animate(0,true);
 const box=new Box3().setFromObject(model.group),center=box.getCenter(new Vector3()),size=box.getSize(new Vector3());
 const camera=new PerspectiveCamera(35,1,.1,30);camera.position.copy(center).add(new Vector3(.35,.15,4.3));camera.lookAt(center);
 const render=()=>{if(!renderer||dead)return;const w=host.value!.clientWidth,h=host.value!.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.position.z=center.z+Math.max(3.4,size.x/camera.aspect*1.5,size.y*1.65);camera.updateProjectionMatrix();renderer.render(scene,camera);};
 render();const preview=document.createElement('img');preview.src=renderer.domElement.toDataURL('image/png');preview.alt='';host.value!.replaceChildren(preview);resources.dispose();renderer.dispose();renderer.forceContextLoss();renderer=undefined;
}catch{if(!dead)error.value='模型暂时无法加载';}});
onBeforeUnmount(()=>{dead=true;observer?.disconnect();resources.dispose();renderer?.dispose();});
</script>
<template><div ref="host" class="model-preview" role="img" :aria-label="speciesId+' 的三维模型'"><span v-if="error">{{ error }}</span></div></template>
<style scoped>.model-preview{height:190px;background:#1f555b;border-radius:16px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#fff3d9}.model-preview :deep(img){width:100%;height:100%;object-fit:contain;display:block}</style>
