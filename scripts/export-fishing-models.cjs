const{chromium}=require(process.env.FISH_PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),crypto=require('node:crypto');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/dev/fishing-3d');
const exported=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js');const{GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
 const{createSpeciesFish,fishModels}=await import('/src/rendering/fishing3d/species.ts');const{SceneResources}=await import('/src/rendering/fishing3d/resources.ts');const{speciesMouth}=await import('/src/domain/fishing3d/content.ts');
 const result=[];const renderer=new T.WebGLRenderer({antialias:false});renderer.setSize(512,256);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;
 for(const id of Object.keys(fishModels)){
  const resources=new SceneResources(),model=createSpeciesFish(resources,id);let triangles=0;
  model.group.traverse(m=>{
   if(!m.isMesh)return;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
   if(m.material.isShaderMaterial){
    const shader=m.material.clone();shader.vertexShader='varying vec2 texUv;void main(){texUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
    shader.fragmentShader=shader.fragmentShader.replace('varying vec3 p; varying vec3 n;','varying vec2 texUv;').replace('void main(){','void main(){vec3 p=vec3(-cos(texUv.x*6.2831853)*sin(texUv.y*3.1415926),-cos(texUv.y*3.1415926),sin(texUv.x*6.2831853)*sin(texUv.y*3.1415926));vec3 n=p;').replace('c*=.6+.4*max(dot(normalize(n),normalize(vec3(-.3,.9,1.))),0.);','');
    const s=new T.Scene(),geo=new T.PlaneGeometry(2,2),quad=new T.Mesh(geo,shader);quad.position.z=-1;s.add(quad);renderer.render(s,new T.OrthographicCamera(-1,1,1,-1,.1,10));
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;canvas.getContext('2d').drawImage(renderer.domElement,0,0);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    m.material=new T.MeshStandardMaterial({map:texture,roughness:.5,metalness:.06});shader.dispose();geo.dispose();
   }
  });
  const tail=model.group.getObjectByName('tail');const values=[];for(const angle of [0,.24,0,-.24,0]){const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),angle);values.push(...q.toArray());}
  const clip=new T.AnimationClip('swim',1.2,[new T.QuaternionKeyframeTrack(tail.name+'.quaternion',[0,.3,.6,.9,1.2],values)]);
  const bytes=await new GLTFExporter().parseAsync(model.group,{binary:true,animations:[clip]});
  let binary='';for(const v of new Uint8Array(bytes))binary+=String.fromCharCode(v);
  result.push({id,base64:btoa(binary),triangles,mouth:speciesMouth(id)});resources.dispose();
 }
 renderer.dispose();return result;
});
fs.mkdirSync('public/models/fishing',{recursive:true});const assets=[];
for(const item of exported){const bytes=Buffer.from(item.base64,'base64');fs.writeFileSync(`public/models/fishing/${item.id}.glb`,bytes);assets.push({id:item.id,path:`models/fishing/${item.id}.glb`,version:1,source:'Original procedural mesh; appearance from src/catalog/species.ts',license:'Project-owned original asset',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),triangles:item.triangles,textureSize:[512,256],mouthAnchor:item.mouth,reviewStatus:'pending-visual-review'});}
fs.writeFileSync('public/models/fishing/asset-manifest.json',JSON.stringify({version:1,format:'glTF 2.0',assets},null,2)+'\n');console.log('exported',assets.length,'GLBs',assets.reduce((s,x)=>s+x.bytes,0),'bytes');await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
