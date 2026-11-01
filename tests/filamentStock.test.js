import test from 'node:test';
import assert from 'node:assert/strict';
import { availableColors, matchStockColor, validateStockSelection } from '../src/lib/filament-art/stockColors.js';
import { imagePalette, recolorPixels, validateImagePreview } from '../src/lib/filament-art/previewColors.js';
const rows = [{id:'white',in_stock:true,profile:{name:'Branco',hex:'#ffffff',material:'PLA'}},{id:'red',in_stock:false,profile:{name:'Vermelho',hex:'#ff0000',material:'PLA'}}];
test('only confirmed available PLA colors can be offered and saved',()=>{
 const stock=availableColors(rows);assert.equal(stock.length,1);
 assert.equal(matchStockColor('#fafafa',stock).compatible,true);
 assert.equal(matchStockColor('#0000ff',stock).compatible,false);
 assert.equal(matchStockColor('#ffffff',[]).suggested,undefined);
 assert.doesNotThrow(()=>validateStockSelection({palette:['#ffffff'],filamentIds:['white']},rows));
 assert.throws(()=>validateStockSelection({palette:['#ff0000'],filamentIds:['red']},rows));
 assert.throws(()=>validateStockSelection({palette:['#000000'],filamentIds:['white']},rows));
 assert.throws(()=>validateStockSelection({palette:['#ffffff'],filamentIds:['white']},[]));
});
test('replacing red by blue preserves the red region instead of reclassifying it as black',()=>{
 const data=new Uint8ClampedArray([255,0,0,255,0,0,0,255,255,0,0,255]);
 assert.deepEqual(recolorPixels(data,['#ff0000','#000000'],['#0000ff','#000000']),new Uint8ClampedArray([0,0,255,255,0,0,0,255,0,0,255,255]));
});
test('PETG and multicolor stock are not offered as solid PLA replacements',()=>{
 const stock=availableColors([
  ...rows,
  {id:'petg',in_stock:true,profile:{name:'Roxo',hex:'#773ca1',material:'PETG'}},
  {id:'tricolor',in_stock:true,profile:{name:'Tricolor',hex:'#c9a227',material:'PLA',effect:'multicolor'}},
 ]);
 assert.deepEqual(stock.map(color=>color.id),['white']);
});
test('saved image scale must be inside the slider range',()=>{
 const input={shape:'square',palette:['#ffffff'],background:'#ffffff',raster:{width:1,height:1,indices:[0]}};
 assert.doesNotThrow(()=>validateImagePreview({...input,imageScale:75}));
 assert.throws(()=>validateImagePreview({...input,imageScale:0}));
 assert.throws(()=>validateImagePreview({...input,imageScale:Infinity}));
});

test('palette preserves solid source colors despite shading and antialiasing',()=>{
 const pixels=[];
 for(const color of [[255,0,0],[255,255,255],[0,0,0],[255,220,0]])
   for(let i=0;i<100;i++) pixels.push(...color,255);
 for(let i=1;i<80;i++) pixels.push(255-i,i/2,i/2,255);
 const palette=imagePalette(new Uint8ClampedArray(pixels));
 assert.equal(palette.length,4);
 assert.ok(palette.includes('#ff0000'));
 assert.deepEqual(new Set(palette),new Set(['#ff0000','#ffffff','#000000','#ffdc00']));
});
