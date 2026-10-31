import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import admin from '../api/admin.js';

test('Vercel stays within 12 functions and keeps both admin URLs',()=>{
 const routes=readdirSync(new URL('../api/',import.meta.url)).filter(name=>!name.startsWith('_')&&name.endsWith('.js'));
 assert.ok(routes.length<=12,`${routes.length} functions exceed the deployment limit`);
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
 for(const name of ['status','produto-ativo']) {
  assert.equal(config.rewrites.find(route=>route.source===`/api/${name}`).destination,`/api/admin?operation=${name}`);
 }
});
test('shared admin endpoint rejects unknown operations and retains authentication',async()=>{
 for(const operation of ['unknown','status','produto-ativo']) {
  const res={status(code){this.code=code;return this;},json(body){this.body=body;return this;},setHeader(){}};
  await admin({method:'POST',query:{operation},headers:{},body:{}},res);
  assert.equal(res.code,operation==='unknown'?404:401);
 }
});
