import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { linearizar, codificar, lab, deltaE00 } from '../src/lib/filament-art/colorSpaces.js';
import { A1, ESTIMATED_PROFILES, compose, virtualPalette, baseHeight, zAt, validatePlan } from '../src/lib/filament-art/opticalModel.js';
import { processArt, repairDiagonals } from '../src/lib/filament-art/engine.js';
import { generateMesh, validateMesh } from '../src/lib/filament-art/meshGenerator.js';
import { binaryStl, geometricThreeMf } from '../src/lib/filament-art/exporters.js';
import { inspectImage } from '../src/lib/filament-art/imagePipeline.js';
import { stableJson, projectSnapshot, fitsProduct, isFilamentProduct } from '../src/lib/filament-art/projectSerializer.js';
import { validateFilamentProjects, checkCommercialPlan } from '../api/_lib/filamentArt.js';
import { validarPersonalizacao } from '../api/_lib/validarPersonalizacao.js';
import { normalizarProduto } from '../src/lib/normalizarProduto.js';
import { produtos } from '../src/data/produtos.js';
import { prontaEntrega } from '../src/data/prontaEntrega.js';
const near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} ≠ ${b}`);
const input=(width=4,height=4)=>({raster:{width,height,data:Uint8Array.from({length:width*height*4},(_,i)=>i%4===3?255:(i*47)%256)},plan:{...A1},profiles:ESTIMATED_PROFILES.map(p=>({...p}))});
test('sRGB and CIEDE2000 published reference pairs, including hue wrap',()=>{
  near(linearizar(.04045),.003130805); near(codificar(linearizar(.5)),.5);
  near(lab([1,1,1])[0],100,.001); near(lab([0,0,0])[0],0);
  near(deltaE00([50,2.6772,-79.7751],[50,0,-82.7485]),2.0425,.0001);
  near(deltaE00([50,3.1571,-77.2803],[50,0,-82.7485]),2.8615,.0001);
  near(deltaE00([50,-1.3802,-84.2814],[50,0,-82.7485]),1,.0001);
  near(deltaE00([50,0,0],[50,-1,2]),2.3669,.0001);
  near(deltaE00([50,2.49,-.001],[50,-2.49,.001]),7.1792,.0001);
});
test('attenuation composes in linear light; TD does not replace hiding distance',()=>{
  const p={...ESTIMATED_PROFILES[3],hex:'#ffffff',hidingDistanceMm:1,transmissionDistanceMm:900};
  near(compose([0,0,0],p,1)[0],.9);
  const twice=compose(compose([0,0,0],p,.5),p,.5); near(twice[0],.9);
  assert.throws(()=>validatePlan(A1,[{...p,hidingDistanceMm:0}]));
  assert.throws(()=>validatePlan(A1,[...ESTIMATED_PROFILES,p]));
});
test('one to four materials use exact first/base/art layer accounting',()=>{
  near(baseHeight(A1),.6);near(zAt(A1,16),1.88);
  for(let n=1;n<=4;n++){
    const palette=virtualPalette(A1,ESTIMATED_PROFILES.slice(0,n));
    assert.equal(palette.length,17);
    palette.forEach((p,k)=>near(p.zMm,.6+k*.08));
    const changes=palette.filter((p,i)=>i && p.filamentId!==palette[i-1].filamentId);
    assert.equal(changes.length,n-1);
    assert.deepEqual(palette,virtualPalette(A1,ESTIMATED_PROFILES.slice(0,n)));
  }
  assert.throws(()=>virtualPalette(A1,ESTIMATED_PROFILES,['preto','preto','branco','amarelo']));
});
test('optimizer preserves reproducible inputs, reachable palette and discrete heights',()=>{
  const value=input(),before=stableJson(value),a=processArt(value),b=processArt(value);
  assert.equal(stableJson(value),before);assert.deepEqual(a,b);
  a.map.forEach((k,i)=>{assert.ok(Number.isInteger(k));assert.deepEqual(Array.from(a.preview.slice(i*4,i*4+3)),a.palette[k].rgb);});
  const snap=projectSnapshot(value,a,'f'.repeat(64));const replay=processArt(JSON.parse(JSON.stringify(snap.input)));
  assert.deepEqual(Array.from(replay.map),snap.map);
  assert.equal(createHash('sha256').update(stableJson(snap)).digest('hex'),createHash('sha256').update(stableJson(JSON.parse(JSON.stringify(snap)))).digest('hex'));
  assert.ok(Number.isFinite(a.meanDeltaE00));assert.ok(a.manifest.transitions.every(t=>t.layerNumber<=a.manifest.totalLayers));
});
test('alpha and uniform edge removal can be corrected manually',()=>{
  const value=input(3,3);value.raster.data.fill(255);value.raster.data.set([0,0,0,255],16);
  value.adjustments={background:true,tolerance:1};
  const result=processArt(value);assert.equal(result.removed[4],0);assert.equal(result.removed[0],1);
  value.mask=new Uint8Array(9);value.mask[0]=2;value.mask[4]=1;
  const corrected=processArt(value);assert.equal(corrected.removed[0],0);assert.equal(corrected.removed[4],1);
  value.adjustments={};value.mask=null;value.raster.data.fill(0);
  assert.ok(processArt(value).map.every(k=>k===0));
});
test('invalid raster, profile, dimensions and sub-nozzle detail fail closed',()=>{
  for(const patch of [{widthMm:257},{layerMm:0},{brim:true},{supports:true},{baseLayers:1},{artLayers:NaN}])assert.throws(()=>processArt({...input(),plan:{...A1,...patch}}));
  assert.throws(()=>processArt({...input(),raster:{width:500,height:500,data:[]}}));
  assert.throws(()=>processArt({...input(),mask:[1]}));
  assert.throws(()=>processArt({...input(128,128),plan:{...A1,widthMm:10,heightMm:10}}));
  assert.throws(()=>processArt({...input(),adjustments:{gamma:NaN}}));
});
test('flat, checkerboard, random, narrow and dithered geometry is closed and outward',()=>{
  for(const [width,height] of [[2,2],[3,4],[8,7]])for(let variant=0;variant<4;variant++){
    const value=input(width,height),result=processArt({...value,adjustments:{dither:variant===3}});
    if(variant<3){result.map=Uint8Array.from({length:width*height},(_,i)=>variant===0?0:variant===1?(i%2)*16:(i*13)%17);repairDiagonals(result.map,width,height);}
    const mesh=generateMesh(result,value.plan),validation=validateMesh(mesh);
    near(validation.volumeMm3,mesh.volumeMm3,.02);
    assert.equal(validation.watertight,true);near(Math.max(...mesh.positions.filter((_,i)=>i%3===0)),24);
    const stl=binaryStl(mesh),view=new DataView(stl);assert.equal(view.getUint32(80,true),mesh.indices.length/3);assert.equal(stl.byteLength,84+mesh.indices.length/3*50);
    const broken={...mesh,indices:mesh.indices.slice(3)};assert.throws(()=>validateMesh(broken));
  }
});
test('3MF ZIP references contain valid model data for 1–4 material inputs without Bambu claims',()=>{
  for(let n=1;n<=4;n++){
    const value=input();value.profiles=value.profiles.slice(0,n);const result=processArt(value),mesh=generateMesh(result,value.plan);
    const zip=geometricThreeMf(mesh),view=new DataView(zip.buffer),decoder=new TextDecoder(),files={};let i=0;
    while(view.getUint32(i,true)===0x04034b50){const size=view.getUint32(i+18,true),nameLength=view.getUint16(i+26,true);const name=decoder.decode(zip.slice(i+30,i+30+nameLength));files[name]=decoder.decode(zip.slice(i+30+nameLength,i+30+nameLength+size));i+=30+nameLength+size;}
    assert.equal(view.getUint32(i,true),0x02014b50);assert.equal(view.getUint32(zip.length-22,true),0x06054b50);
    assert.match(files['_rels/.rels'],/Target="\/3D\/3dmodel.model"/);
    assert.match(files['3D/3dmodel.model'],/unit="millimeter"/);
    assert.equal((files['3D/3dmodel.model'].match(/<triangle /g)||[]).length,mesh.indices.length/3);
    assert.ok(!files['Metadata/project_settings.config']);
  }
});
test('image header rejects SVG, malformed files and dimensions before bitmap decoding',()=>{
  assert.throws(()=>inspectImage(new TextEncoder().encode('<svg>'+ ' '.repeat(100)+'</svg>')));
  const bytes=new Uint8Array(33);bytes.set([137,80,78,71,13,10,26,10]);bytes.set(new TextEncoder().encode('IHDR'),12);
  const view=new DataView(bytes.buffer);view.setUint32(16,1024);view.setUint32(20,1024);
  assert.equal(inspectImage(bytes).type,'image/png');
  view.setUint32(16,20000);assert.throws(()=>inspectImage(bytes));
  const jpg=new Uint8Array(30);jpg.set([255,216,255,192,0,17,8,0,100,0,200]);assert.deepEqual(inspectImage(jpg),{type:'image/jpeg',width:200,height:100});
  const webp=new Uint8Array(30);webp.set(new TextEncoder().encode('RIFF'));new DataView(webp.buffer).setUint32(4,22,true);webp.set(new TextEncoder().encode('WEBPVP8X'),8);webp[24]=99;webp[27]=49;
  assert.deepEqual(inspectImage(webp),{type:'image/webp',width:100,height:50});webp[20]=2;assert.throws(()=>inspectImage(webp));
});
test('existing product and ready-made HueForge keep identity and price; large sizes cannot use small price',()=>{
  const p=produtos.find(p=>p.id===82),ready=prontaEntrega.find(p=>p.id==='pronta-hueforge-harrison');
  assert.equal(produtos.filter(p=>p.id===82).length,1);assert.equal(p.preco,33.9);assert.equal(ready.modeloId,82);assert.ok(!isFilamentProduct(ready));
  assert.equal(normalizarProduto({id:82,preco:50,tipoPersonalizacao:null}).tipoPersonalizacao,'filament_art');
  assert.equal(normalizarProduto({id:82,preco:50}).preco,50);assert.ok(fitsProduct(A1,p));assert.ok(!fitsProduct({...A1,widthMm:200},p));assert.throws(()=>checkCommercialPlan({plan:{...A1,widthMm:200}},p));
});
test('checkout ownership, hash, product and canonical snapshot are verified server-side',async()=>{
  const id='12345678-1234-4123-8123-123456789abc',hash='a'.repeat(64),item={id:82,filamentArt:{id,hash}};
  const bytes = new Uint8Array(24); bytes.set([137,80,78,71,13,10,26,10]); bytes.set([73,72,68,82],12); new DataView(bytes.buffer).setUint32(16,2); new DataView(bytes.buffer).setUint32(20,2);
  const row={id,hash,user_id:'owner',product_id:82,original_path:'owner/original',summary:{plan:A1,status:'estimativa',originalFile:{sha256:createHash('sha256').update(bytes).digest('hex')}}};
  const db={from:()=>({select(){return this;},in(){return this;},eq:async()=>({data:[row],error:null})}),storage:{from:()=>({download:async()=>({data:new Blob([bytes]),error:null})})}};
  assert.equal(validarPersonalizacao(item),null);assert.ok(validarPersonalizacao({...item,id:81}));
  const refs=await validateFilamentProjects(db,'owner',[item]);assert.deepEqual(refs.get(id).plan,A1);
  await assert.rejects(()=>validateFilamentProjects(db,'other',[item]));
  await assert.rejects(()=>validateFilamentProjects(db,'owner',[{...item,filamentArt:{id,hash:'b'.repeat(64)}}]));
  assert.equal((await validateFilamentProjects(null,'owner',[{id:1}])).size,0);
  row.summary.originalFile.sha256 = '0'.repeat(64);
  await assert.rejects(()=>validateFilamentProjects(db,'owner',[item]), /alterada/);
  db.storage.from = () => ({download:async()=>({data:null,error:new Error('missing')})});
  await assert.rejects(()=>validateFilamentProjects(db,'owner',[item]), /foto original/);
});
