import test from 'node:test';
import assert from 'node:assert/strict';
import { imagePalette, quantizePixels, validateImagePreview, serializePreviewRaster } from '../src/lib/filament-art/previewColors.js';
import { loadImage } from '../src/lib/filament-art/imagePipeline.js';

test('save tolerates canvas RGB rounding without emitting invalid palette indices', () => {
  const palette = ['#fafafa', '#181818', '#bb2934', '#cccccc'];
  const image = {width:4,height:1,data:new Uint8ClampedArray([249,250,251,255, 24,23,25,255, 188,40,52,255, 203,205,204,255])};
  const raster = serializePreviewRaster(image,palette);
  assert.deepEqual(raster.indices,[0,1,2,3]);
  assert.doesNotThrow(() => validateImagePreview({shape:'square',palette,background:palette[0],raster}));
});
test('saved preview respects dimension limits and retains only palette indices', () => {
  for (const [width,height] of [[512,512],[1,1024],[1024,1]]) {
    const data = new Uint8ClampedArray(width*height*4).fill(255);
    const raster = serializePreviewRaster({width,height,data},['#ffffff']);
    assert.ok(raster.width <= 256 && raster.height <= 256);
    assert.equal(raster.indices.length,raster.width*raster.height);
    assert.ok(raster.indices.every(index => index === 0));
  }
});

test('preserves every pixel of an opaque image already using four colors', () => {
  const pixels = new Uint8ClampedArray([255,0,0,255, 0,255,0,255, 0,0,255,255, 255,255,255,255, 255,0,0,255]);
  const palette = imagePalette(pixels);
  assert.equal(palette.length, 4);
  assert.deepEqual(quantizePixels(pixels, palette), pixels);
});
test('gradients and transparency never introduce a fifth output color', () => {
  const pixels = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) pixels.set([i, 255-i, i % 80, i], i*4);
  const palette = imagePalette(pixels), result = quantizePixels(pixels, palette);
  const unique = new Set();
  for (let i = 0; i < result.length; i += 4) { unique.add([...result.slice(i,i+3)].join(',')); assert.equal(result[i+3],255); }
  assert.ok(unique.size <= 4);
  assert.deepEqual(quantizePixels(pixels, palette), result);
  assert.equal(result.length, pixels.length);
});
test('server rejects fifth colors and invalid palette references', () => {
  const input = { shape: 'square', palette: ['#000000'], background: '#000000', raster: { width: 2, height: 1, indices: [0,0] } };
  assert.doesNotThrow(() => validateImagePreview(input));
  assert.doesNotThrow(() => validateImagePreview({...input,shape:'circle'}));
  assert.throws(() => validateImagePreview({...input,shape:'rectangle'}));
  assert.throws(() => validateImagePreview({...input,palette: Array(5).fill('#000000')}));
  assert.throws(() => validateImagePreview({...input,raster: {...input.raster,indices: [0,1]}}));
  assert.throws(() => validateImagePreview({...input,background:'#ffffff'}));
});
test('image loader returns a usable preview and handles HTMLImageElement fallback without close()', async () => {
  const originals = { document: globalThis.document, Image: globalThis.Image, createImageBitmap: globalThis.createImageBitmap };
  const bytes = new Uint8Array(24); bytes.set([137,80,78,71,13,10,26,10]); bytes.set([73,72,68,82],12); new DataView(bytes.buffer).setUint32(16,2); new DataView(bytes.buffer).setUint32(20,3);
  const file = new Blob([bytes], { type: 'image/png' });
  let closed = false;
  globalThis.document = { createElement: () => ({getContext: () => ({drawImage() {}}),toDataURL: () => 'data:image/png;base64,preview'}) };
  try {
    globalThis.createImageBitmap = async () => ({width:2,height:3,close() {closed=true;}});
    const first = await loadImage(file);
    assert.equal(first.canvas.width,2); assert.equal(first.canvas.height,3); assert.ok(first.url.startsWith('data:image/png')); assert.ok(closed);
    globalThis.createImageBitmap = async () => {throw new Error('decoder unavailable');};
    globalThis.Image = class { naturalWidth=2; naturalHeight=3; set src(value) {queueMicrotask(() => this.onload());} };
    const fallback = await loadImage(file);
    assert.equal(fallback.canvas.width,2); assert.equal(fallback.url,first.url);
  } finally { for (const [key,value] of Object.entries(originals)) { if(value === undefined) delete globalThis[key]; else globalThis[key]=value; } }
});

test('small red accents survive a predominantly neutral textured image', () => {
  const pixels = [];
  for (let shade=0;shade<256;shade++) {
    for(let n=0;n<30;n++) pixels.push(shade,shade,shade,255);
  }
  // JPEG-like variation across the red star and its lighter red lettering.
  for(let n=0;n<100;n++) pixels.push(220+n%20,n%8,20+n%15,255);
  for(let n=0;n<100;n++) pixels.push(255,50+n%15,80+n%15,255);
  const input=new Uint8ClampedArray(pixels);
  const palette=imagePalette(input);
  assert.ok(palette.length<=4);
  const output=quantizePixels(input,palette);
  for(let i=0;i<256*30*4;i+=4) {
    assert.equal(output[i],output[i+1], 'neutral texture must not become red');
    assert.equal(output[i+1],output[i+2]);
  }
  for(let i=256*30*4;i<output.length;i+=4) {
    assert.ok(output[i]>180 && output[i+1]<100 && output[i+2]<110, 'both red regions must stay red');
  }
});
