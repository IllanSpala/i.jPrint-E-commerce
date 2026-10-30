import test from 'node:test';
import assert from 'node:assert/strict';
import { criarHandlerFilamentArt } from '../api/filament-art.js';
import { A1 } from '../src/lib/filament-art/opticalModel.js';

const userId = '12345678-1234-4123-8123-123456789abc';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=', 'base64');
function fixture() {
  const files = new Map(), rows = new Map();
  const storage = {
    createSignedUploadUrl: async path => ({data:{path,token:'temporary-upload-token'},error:null}),
    download: async path => files.has(path) ? {data:new Blob([files.get(path)])} : {error:new Error('missing')},
    upload: async (path, bytes) => {files.set(path,bytes); return {data:{path}};},
    remove: async paths => {paths.forEach(path => files.delete(path)); return {};},
    createSignedUrl: async path => ({data:{signedUrl:`https://private.example/${path}`}}),
  };
  const db = {
    auth: {getUser: async token => token === 'valid-session' ? {data:{user:{id:userId}}} : {error:new Error('unauthorized')}},
    storage: {from: () => storage},
    from(table) {
      return {
        select() {return this;}, eq(_, value) {this.id=value; return this;},
        async maybeSingle() {return {data:table === 'produtos' ? {id:82,ativo:true,dimensoes:'24x24x2'} : rows.get(this.id)};},
        async insert(row) {rows.set(row.id,row); return {};},
      };
    },
  };
  const handler = criarHandlerFilamentArt(() => db, async () => {});
  async function call(body, token = 'valid-session') {
    const res = {status(code) {this.code=code; return this;}, json(data) {this.data=data; return this;}};
    await handler({method:'POST',headers:{authorization:`Bearer ${token}`},body},res);
    return res;
  }
  return {call,files,rows,storage};
}
test('authorized upload, save and admin artifact retain original image and palette', async () => {
  const {call,files,rows} = fixture();
  const prepared = await call({action:'prepare-original',size:png.length,type:'image/png'});
  assert.equal(prepared.code,200);
  assert.ok(prepared.data.path.startsWith(`${userId}/`));
  files.set(prepared.data.path,png);
  const input = {mode:'image-preview',plan:{...A1,shape:'square'},shape:'square',palette:['#ffffff'],background:'#ffffff',raster:{width:1,height:1,indices:[0]}};
  const saved = await call({action:'save',input,originalPath:prepared.data.path,originalName:'minha-foto.png'});
  assert.equal(saved.code,200,JSON.stringify(saved.data));
  assert.equal(rows.get(saved.data.id).original_path,prepared.data.path);
  const loaded = await call({action:'load',id:saved.data.id});
  assert.equal(loaded.code,200);
  assert.equal(loaded.data.originalFile.name,'minha-foto.png');
  assert.deepEqual(loaded.data.project.input.palette,['#ffffff']);
  assert.deepEqual(files.get(prepared.data.path),png);
});
test('upload requires a session and a supported image within the limit', async () => {
  const {call} = fixture();
  assert.equal((await call({action:'prepare-original',size:png.length,type:'image/png'},'expired')).code,401);
  assert.equal((await call({action:'prepare-original',size:9*1024*1024,type:'image/png'})).code,422);
  assert.equal((await call({action:'prepare-original',size:100,type:'image/svg+xml'})).code,422);
});
