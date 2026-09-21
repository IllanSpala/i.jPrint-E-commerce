// PostgreSQL isolado: PGLITE_PATH=/tmp/ij-audit-sql/node_modules/@electric-sql/pglite/dist/index.js node tests/seguranca-sql.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
if (!process.env.PGLITE_PATH) throw new Error('Informe PGLITE_PATH para um runtime PGlite local. Nunca conecte este teste ao Supabase.');
const { PGlite } = await import(process.env.PGLITE_PATH);
const db = new PGlite();
const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
const admin = '00000000-0000-4000-8000-000000000003';
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; grant usage on schema public,auth to anon,authenticated,service_role;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.perfis(id uuid primary key references auth.users(id),nome text,cpf text,telefone text);
create table public.enderecos(id uuid primary key,user_id uuid,rua text);
create table public.produtos(id integer primary key,nome text,preco numeric);
create table public.pedidos(id uuid primary key,user_id uuid references auth.users(id),status text,total numeric,created_at timestamptz default now(),endereco jsonb,itens jsonb);
create table public.carrinhos_salvos(user_id uuid primary key,itens jsonb);
grant all on all tables in schema public to anon,authenticated,service_role;
create policy insegura on public.pedidos for all using(true) with check(true);
insert into auth.users values('${a}','a@example.invalid',now()),('${b}','b@example.invalid',now()),('${admin}','i.j.print26@gmail.com',now());
insert into public.perfis(id,nome) values('${a}','A'),('${b}','B'),('${admin}','Admin');
insert into public.pedidos(id,user_id,status,total) values('${a}','${a}','Aguardando Pagamento',100),('${b}','${b}','Aguardando Pagamento',100);
insert into public.produtos values(1,'Peça',100);
`);
await db.exec(await readFile(new URL('../supabase/cupons_primeira_compra.sql', import.meta.url), 'utf8'));
const migration = await readFile(new URL('../supabase/seguranca_vendas.sql', import.meta.url), 'utf8');
await db.exec(migration);
await db.exec(migration); // reexecução segura
async function como(role, uid, work) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid}',false);`);
  try { await work(); } finally { await db.exec('reset role;'); }
}
let verificacoes = 0;
async function verificar(nome, trabalho) { await trabalho(); verificacoes++; console.log('OK:', nome); }
await verificar('anônimo só pode ler catálogo', () => como('anon', '', async () => {
  assert.equal((await db.query('select * from produtos')).rows.length, 1);
  await assert.rejects(db.query('select * from pedidos'));
  await assert.rejects(db.query('select * from perfis'));
}));
await verificar('cliente só lê seus pedidos e seu perfil', () => como('authenticated', a, async () => {
  assert.equal((await db.query('select * from pedidos')).rows.length, 1);
  assert.equal((await db.query('select * from perfis')).rows.length, 1);
  assert.equal((await db.query('select public.sou_admin() as admin')).rows[0].admin, false);
}));
await verificar('cliente não modifica pedidos nem se promove a administrador', () => como('authenticated', a, async () => {
  await assert.rejects(db.query("update pedidos set status='Pago'"));
  await assert.rejects(db.query('delete from pedidos'));
  await assert.rejects(db.query(`insert into loja_admins values('${a}')`));
  await assert.rejects(db.query(`select limitar_requisicoes_loja('chave',10)`));
  await assert.rejects(db.query(`select reservar_notificacoes_pedidos()`));
}));
await verificar('administrador lê todos mas também não altera pedidos pelo navegador', () => como('authenticated', admin, async () => {
  assert.equal((await db.query('select public.sou_admin() as admin')).rows[0].admin, true);
  assert.equal((await db.query('select * from pedidos')).rows.length, 2);
  await assert.rejects(db.query("update pedidos set status='Pago'"));
}));
await verificar('cliente não modifica perfil de outro usuário', () => como('authenticated', a, async () => {
  assert.equal((await db.query(`update perfis set nome='alterado' where id='${b}' returning id`)).rows.length, 0);
}));
await verificar('cliente não cria endereço para outro cliente', () => como('authenticated', a, async () => {
  await assert.rejects(db.query(`insert into enderecos values('${a}','${b}','Rua')`));
}));
await verificar('pagamento dispara histórico e notificações uma única vez', () => como('service_role', '', async () => {
  await db.query(`update pedidos set status='Pago',pagamento_transacao='tx-1' where id='${a}'`);
  await db.query(`update pedidos set status='Pago' where id='${a}'`);
  assert.equal((await db.query('select * from clientes_com_compra')).rows.length, 1);
  assert.equal((await db.query('select * from notificacoes_pedidos')).rows.length, 2);
  await assert.rejects(db.query(`update pedidos set status='Pago',pagamento_transacao='tx-1' where id='${b}'`));
}));
await verificar('reserva da fila impede dois workers de enviar o mesmo lote', () => como('service_role','',async () => {
  assert.equal((await db.query('select * from reservar_notificacoes_pedidos()')).rows.length, 2);
  assert.equal((await db.query('select * from reservar_notificacoes_pedidos()')).rows.length, 0);
}));
await verificar('limite de requisições funciona no banco', () => como('service_role','',async () => {
  for (let i=0;i<3;i++) assert.equal((await db.query("select limitar_requisicoes_loja('teste',2) as permitido")).rows[0].permitido, i<2);
}));
await verificar('índice impede cobranças pendentes duplicadas', () => como('service_role','',async () => {
  await db.query(`update pedidos set checkout_hash='hash' where id='${b}'`);
  await assert.rejects(db.query(`insert into pedidos(id,user_id,status,total,checkout_hash) values('${admin}','${b}','Aguardando Pagamento',100,'hash')`));
}));
await verificar('primeira compra não permite novo cupom após pagamento', () => como('service_role','',async () => {
  const r = await db.query(`select reservar_cupom_primeira_compra('${a}','${admin}','COMPRE.IJ') as resultado`);
  assert.equal(r.rows[0].resultado, 'cliente_existente');
}));
const exclusao = await readFile(new URL('../supabase/excluir_pedido_sem_cobranca.sql', import.meta.url), 'utf8');
await db.exec(exclusao);
await db.exec(exclusao);
await verificar('exclusão de checkout restrita ao servidor', async () => {
  for (const role of ['anon', 'authenticated']) await como(role, admin, async () => {
    await assert.rejects(db.query(`select excluir_pedido_sem_cobranca('${b}')`));
  });
});
await verificar('pedidos pagos, ambíguos e com cobrança nunca são excluídos', () => como('service_role', '', async () => {
  assert.equal((await db.query(`select excluir_pedido_sem_cobranca('${a}') as ok`)).rows[0].ok, false);
  assert.equal((await db.query(`select excluir_pedido_sem_cobranca('${b}') as ok`)).rows[0].ok, false);
  for (const [coluna, valor] of [
    ['link_pagamento', 'https://checkout.infinitepay.io/teste'],
    ['pagamento_transacao', 'transacao'], ['pagamento_slug', 'slug'],
    ['pagamento_confirmado_em', '2026-09-21T10:00:00Z'],
    ['melhor_envio_cart_id', 'etiqueta'], ['tracking_url', 'https://example.invalid'],
    ['etiqueta_estado', 'processando'],
  ]) {
    await db.exec('begin');
    try {
      await db.query(`insert into pedidos(id,user_id,status,total,checkout_estado,${coluna}) values($1,$2,'Aguardando Pagamento',10,'falhou',$3)`, [admin, b, valor]);
      assert.equal((await db.query(`select excluir_pedido_sem_cobranca('${admin}') as ok`)).rows[0].ok, false);
      assert.equal((await db.query(`select id from pedidos where id='${admin}'`)).rows.length, 1);
    } finally { await db.exec('rollback'); }
  }
}));
await verificar('falha comprovada é excluída junto com reserva de cupom', () => como('service_role', '', async () => {
  await db.query(`insert into pedidos(id,user_id,status,total,checkout_estado) values('${admin}','${b}','Aguardando Pagamento',10,'falhou')`);
  await db.query(`insert into cupons_reservados(user_id,pedido_id,codigo) values('${b}','${admin}','COMPRE.IJ')`);
  assert.equal((await db.query(`select excluir_pedido_sem_cobranca('${admin}') as ok`)).rows[0].ok, true);
  assert.equal((await db.query(`select id from pedidos where id='${admin}'`)).rows.length, 0);
  assert.equal((await db.query(`select pedido_id from cupons_reservados where pedido_id='${admin}'`)).rows.length, 0);
  assert.equal((await db.query(`select excluir_pedido_sem_cobranca('${admin}') as ok`)).rows[0].ok, false);
}));
console.log(`${verificacoes} cenários SQL aprovados em PostgreSQL isolado.`);
await db.close();
