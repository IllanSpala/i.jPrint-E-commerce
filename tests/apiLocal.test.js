import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { criarMiddlewareApiLocal } from '../scripts/api-local.js';

async function request(url, body, options = {}) {
  let loaded = false, next = false;
  const middleware = criarMiddlewareApiLocal({
    rotas: new Set(['filament-art', 'carrinho-abandonado']),
    carregar: async nome => { loaded = true; return {default: (req,res) => res.status(200).json({nome,body:req.body,query:req.query,authorization:req.headers.authorization})}; },
    ...options,
  });
  const req = Readable.from(body ? [body] : []);
  Object.assign(req,{url,method:'POST',headers:{authorization:'Bearer session'}});
  const res = {headers:{},setHeader(k,v) {this.headers[k]=v;},end(text) {this.text=text;this.writableEnded=true;}};
  await middleware(req,res,() => {next=true;});
  return {res,loaded,next,data:res.text ? JSON.parse(res.text) : null};
}
test('local API parses JSON and preserves authentication for actual handlers', async () => {
  for (const nome of ['filament-art','carrinho-abandonado']) {
    const result=await request(`/api/${nome}?test=1`,JSON.stringify({action:'prepare-original'}));
    assert.equal(result.res.statusCode,200);
    assert.deepEqual(result.data,{nome,body:{action:'prepare-original'},query:{test:'1'},authorization:'Bearer session'});
  }
});
test('frontend falls through; private and unknown API paths never load', async () => {
  assert.equal((await request('/produto/82')).next,true);
  for (const path of ['/api/_lib/seguranca.js','/api/missing','/api/filament-art.js']) {
    const result=await request(path);
    assert.equal(result.res.statusCode,404);assert.equal(result.loaded,false);
  }
});
test('malformed and oversized requests stop before invoking a handler', async () => {
  assert.equal((await request('/api/filament-art','{')).res.statusCode,400);
  const large=await request('/api/filament-art','12345',{limite:4});
  assert.equal(large.res.statusCode,413);assert.equal(large.loaded,false);
});
