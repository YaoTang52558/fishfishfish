import { CatmullRomCurve3, Color, CylinderGeometry, EdgesGeometry, ExtrudeGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial, ShaderMaterial, Shape, SphereGeometry, TorusGeometry, TubeGeometry, Vector3 } from 'three';
import { speciesById } from '../../catalog/species.ts';
import { speciesMouth } from '../../domain/fishing3d/content.ts';
import type { SceneResources } from './resources.ts';
type ModelSpec = { body: [number, number, number]; color: string; fin: string; tail: string; pattern: number; tailShape: 'fan' | 'fork' | 'lunate' | 'truncate'; dorsal: 'soft' | 'sail' | 'spiny' | 'filament' | 'nub'; head?: string };
/** Original mesh definitions based on the appearance descriptions in the reviewed catalog. No external assets. */
export const fishModels: Readonly<Record<string, ModelSpec>> = {
  'amphiprion-ocellaris': { body: [.83,.42,.25],color:'#f78732',fin:'#f78732',tail:'#f78732',pattern:1,tailShape:'fan',dorsal:'soft' },
  'zebrasoma-flavescens': { body: [.72,.57,.16],color:'#f6d634',fin:'#f6d634',tail:'#f6d634',pattern:0,tailShape:'truncate',dorsal:'sail' },
  'paracanthurus-hepatus': { body: [.83,.47,.17],color:'#248ee4',fin:'#163d69',tail:'#f8d952',pattern:2,tailShape:'truncate',dorsal:'spiny' },
  'forcipiger-flavissimus': { body: [.65,.52,.15],color:'#f6d44c',fin:'#f6d44c',tail:'#f6d44c',pattern:3,tailShape:'truncate',dorsal:'spiny',head:'#faf6df' },
  'arothron-hispidus': { body: [.88,.57,.46],color:'#688e78',fin:'#86996d',tail:'#83956d',pattern:4,tailShape:'fan',dorsal:'nub' },
  'zanclus-cornutus': { body: [.65,.58,.13],color:'#fff2ca',fin:'#fff2ca',tail:'#243a40',pattern:5,tailShape:'lunate',dorsal:'filament' },
  'sebastes-schlegelii': { body: [.85,.39,.24],color:'#536660',fin:'#536660',tail:'#536660',pattern:6,tailShape:'truncate',dorsal:'spiny' },
  'acanthopagrus-schlegelii': { body: [.84,.46,.19],color:'#a9b6af',fin:'#b6a87c',tail:'#536660',pattern:7,tailShape:'fork',dorsal:'spiny' },
  'hexagrammos-otakii': { body: [.9,.31,.21],color:'#a5995c',fin:'#6b7564',tail:'#6b7564',pattern:8,tailShape:'truncate',dorsal:'soft' },
  'oplegnathus-fasciatus': { body: [.77,.49,.2],color:'#d6c47e',fin:'#d6c47e',tail:'#d6c47e',pattern:9,tailShape:'truncate',dorsal:'spiny',head:'#293f43' },
  'girella-punctata': { body: [.86,.39,.21],color:'#6a7561',fin:'#58614f',tail:'#58614f',pattern:10,tailShape:'truncate',dorsal:'soft' },
  'sebastiscus-marmoratus': { body: [.78,.42,.28],color:'#b36a4c',fin:'#bd7b54',tail:'#ad7151',pattern:11,tailShape:'fan',dorsal:'spiny' },
};
export function createSpeciesFish(resources: SceneResources, id: string) {
  const spec = fishModels[id], definition = speciesById(id); if (!spec || !definition) throw new Error(`Missing fish model: ${id}`);
  const group = new Group(); group.name = id;
  const sphere = resources.geometry(new SphereGeometry(1, 24, 14));
  const mat = (color: string) => resources.material(new MeshStandardMaterial({color,roughness:.5,metalness:.06}));
  const finMat = mat(spec.fin), edge = mat('#263e3b'), bodyColor = mat(spec.head ?? spec.color);
  const body = resources.material(new ShaderMaterial({ uniforms: { tint: {value:new Color(spec.color)}, pattern: {value:spec.pattern} },
    vertexShader: `varying vec3 p; varying vec3 n; void main(){p=position;n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform vec3 tint; uniform float pattern; varying vec3 p; varying vec3 n;
    void main(){vec3 c=tint;vec3 dark=vec3(.07,.13,.15);vec3 ivory=vec3(.98,.96,.84);
    float band=abs(fract((p.x+1.)*1.65)-.5);float noise=sin(p.x*19.+sin(p.y*21.))*sin(p.y*17.+p.x*5.);
    if(pattern==1.){float b=min(abs(p.x-.58)-.13,min(abs(p.x+.08)-.14,abs(p.x+.78)-.1));c=mix(dark,c,smoothstep(0.,.025,b));c=mix(c,ivory,1.-smoothstep(-.035,-.015,b));}
    if(pattern==2.){float mask=pow((p.x+.05)/.82,2.)+pow((p.y-.3)/.42,2.);c=mix(c,dark,1.-smoothstep(.8,1.,mask));c=mix(c,tint,1.-smoothstep(.1,.15,length(p.xy-vec2(-.18,.27))));}
    if(pattern==3.&&p.x>.3)c=p.y>.05?dark:ivory;
    if(pattern==4.){float dots=length(fract(p.xy*7.)-.5);c=mix(c,ivory,(1.-smoothstep(.12,.19,dots))*step(-.25,p.y));if(p.y<-.25)c=mix(ivory,tint,step(.78,fract(p.x*9.)));}
    if(pattern==5.)c=mix(c,dark,1.-smoothstep(.18,.22,abs(abs(p.x+.07)-.44)));
    if(pattern==6.)c=mix(c,dark,smoothstep(.2,.75,noise)*.8);
    if(pattern==7.)c=mix(c,dark,(1.-smoothstep(.12,.2,band))*.35);
    if(pattern==8.)c=mix(c,dark,smoothstep(.2,.8,noise)*.4);
    if(pattern==9.)c=mix(c,dark,1.-smoothstep(.17,.2,abs(fract((p.x+1.)*3.)-.5)));
    if(pattern==10.)c=mix(c,ivory,smoothstep(.1,.85,-p.y)*.3);
    if(pattern==11.)c=mix(c,dark,(1.-smoothstep(.12,.2,band))*.5+smoothstep(.3,.9,noise)*.3);
    c*=.6+.4*max(dot(normalize(n),normalize(vec3(-.3,.9,1.))),0.);gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }` }));
  const bodyMesh = new Mesh(sphere,body); bodyMesh.scale.set(...spec.body);group.add(bodyMesh);
  const oval = (material: MeshStandardMaterial,p:number[],scale:number[]) => { const m=new Mesh(sphere,material);m.position.set(p[0]!,p[1]!,p[2]!);m.scale.set(scale[0]!,scale[1]!,scale[2]!);group.add(m);return m; };
  // Snout length and head volume are independent of the body, not just a palette swap.
  oval(bodyColor,[.64,-.015,0],[.23,spec.body[1]*.54,spec.body[2]*.72]);
  if(id==='forcipiger-flavissimus')oval(edge,[.56,.16,0],[.18,.2,spec.body[2]*.8]);
  const anchor=speciesMouth(id);
  if(anchor.x>1){ const nose=new Mesh(resources.geometry(new CylinderGeometry(.055,.09,anchor.x-.76,10)),bodyColor);nose.rotation.z=-Math.PI/2;nose.position.set((anchor.x+.76)/2,-.055,0);group.add(nose); }
  const eyeX=id==='forcipiger-flavissimus'?.53:.64, eyeY=spec.body[1]*.3;
  for(const side of [-1,1]){
    oval(mat('#faf7e7'),[eyeX,eyeY,side*spec.body[2]*.83],[.12,.13,.045]);
    oval(edge,[eyeX+.024,eyeY,side*(spec.body[2]*.83+.034)],[.074,.08,.025]);
    oval(mat('#ffffff'),[eyeX+.04,eyeY+.03,side*(spec.body[2]*.83+.057)],[.023,.024,.014]);
  }
  const lip=new Mesh(resources.geometry(new TorusGeometry(.065,.018,6,14)),bodyColor);lip.rotation.y=Math.PI/2;lip.position.set(anchor.x-.018,anchor.y,0);group.add(lip);
  lip.name = 'mouth';
  function fin(points:number[][],material:MeshStandardMaterial,parent=group){const shape=new Shape();points.forEach((p,i)=>i?shape.lineTo(p[0]!,p[1]!):shape.moveTo(p[0]!,p[1]!));shape.closePath();const m=new Mesh(resources.geometry(new ExtrudeGeometry(shape,{depth:.025,bevelEnabled:false})),material);m.position.z=-.0125;parent.add(m);if(id==='amphiprion-ocellaris'||id==='paracanthurus-hepatus'||id==='sebastes-schlegelii'&&parent.name==='tail'){m.add(new LineSegments(resources.geometry(new EdgesGeometry(m.geometry)),resources.material(new LineBasicMaterial({color:id==='sebastes-schlegelii'?'#faf5df':'#263d3c'}))));}return m;}
  const tail=new Group();tail.position.x=-spec.body[0]*.82;group.add(tail);
  tail.name = 'tail';
  const tips=spec.tailShape==='fan'?[[-.5,.3],[-.62,.1],[-.62,-.1],[-.5,-.3]]:spec.tailShape==='fork'?[[-.66,.35],[-.4,0],[-.66,-.35]]:spec.tailShape==='lunate'?[[-.7,.4],[-.38,0],[-.7,-.4]]:[[-.5,.24],[-.5,-.24]];
  fin([[0,.08],...tips,[0,-.08]],mat(spec.tail),tail);
  const high=spec.body[1], base=[[-.58,high*.6],[-.45,high*.92]];
  if(spec.dorsal==='spiny'){for(let i=0;i<7;i++)base.push([-.44+i*.115,high+.16+(i%2)*.05],[-.39+i*.115,high]);}
  else if(spec.dorsal==='sail')base.push([-.35,high+.42],[.13,high+.4],[.48,high*.5]);
  else if(spec.dorsal==='nub')base.push([-.42,high+.14],[-.16,high*.95]);
  else base.push([-.25,high+.18],[.15,high+.12],[.42,high*.58]);
  fin([...base,[.4,high*.6]],finMat);
  fin([[-.55,-high*.6],[-.3,-high-.15],[.34,-high*.62]],finMat);
  const pectorals=[-1,1].map(side=>{const m=fin([[0,0],[-.32,-.19],[-.29,-.32],[.04,-.15]],id==='acanthopagrus-schlegelii'?mat('#efa94e'):finMat);m.position.set(.22,-.08,side*spec.body[2]*.86);return{m,side};});
  pectorals.forEach(({m},i) => { m.name = `pectoral-${i}`; });
  if(spec.dorsal==='filament'){const curve=new CatmullRomCurve3([new Vector3(-.25,high,0),new Vector3(-.27,high+.64,0),new Vector3(-.88,high+.7,0),new Vector3(-1.13,high+.52,0)]);group.add(new Mesh(resources.geometry(new TubeGeometry(curve,16,.025,5,false)),mat('#fff8dd')));}
  if(id==='zebrasoma-flavescens')oval(mat('#fffbea'),[-.66,.02,spec.body[2]],[.1,.025,.028]);
  if(id==='forcipiger-flavissimus')for(const side of [-1,1])oval(edge,[-.37,-high-.04,side*.04],[.055,.055,.025]);
  if(id==='girella-punctata')for(const side of [-1,1])oval(edge,[.19,-.05,side*spec.body[2]],[.06,.08,.018]);
  if(id==='arothron-hispidus')for(const side of [-1,1]){const ring=new Mesh(resources.geometry(new TorusGeometry(.12,.015,6,18)),mat('#f4efcf'));ring.position.set(.22,-.08,side*spec.body[2]);group.add(ring);}
  if(id==='hexagrammos-otakii')oval(edge,[-.08,high+.055,.025],[.07,.06,.022]);
  const mouth=new Vector3(anchor.x,anchor.y,0);
  return { group, mouthPosition(target:Vector3){group.updateWorldMatrix(true,false);return group.localToWorld(target.copy(mouth));},
    animate(time:number,reducedMotion:boolean){tail.rotation.y=reducedMotion?0:Math.sin(time*5)*.24;pectorals.forEach(({m,side})=>m.rotation.y=side*(.5+(reducedMotion?0:Math.sin(time*4)*.18)));},
  };
}
