import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarCadastro, celularValido, enderecoCompleto } from './cadastroCompleto.js';
const endereco={rua:'Rua A',numero:'1',bairro:'Centro',cidade:'São Paulo',uf:'SP',cep:'01001-000'};
const user={id:'cliente',email:'cliente@example.com',email_confirmed_at:'2026-01-01'};
function db({telefone='11987654321',enderecos=[endereco],error=null}={}) { return {from:()=>({select:()=>({eq:()=>({single:async()=>({data:{nome:'Cliente',telefone},error}),order:async()=>({data:enderecos,error})})})})}; }
test('celular e endereço exigem campos válidos',()=>{
 assert.ok(celularValido('(11) 98765-4321'));
 for(const v of ['', '1134567890', '00987654321']) assert.equal(celularValido(v),false);
 assert.ok(enderecoCompleto(endereco));
 for(const patch of [{rua:''},{bairro:''},{numero:''},{uf:'XX'},{cep:'00000000'}]) assert.equal(enderecoCompleto({...endereco,...patch}),false);
});
test('cadastro bloqueia anônimo, email não confirmado, celular ausente e endereço incompleto',async()=>{
 await assert.rejects(carregarCadastro(db(),null),{status:401});
 await assert.rejects(carregarCadastro(db(),{...user,email_confirmed_at:null}),{status:422});
 await assert.rejects(carregarCadastro(db({telefone:''}),user),{status:422});
 await assert.rejects(carregarCadastro(db({enderecos:[]}),user),{status:422});
 await assert.rejects(carregarCadastro(db({error:{message:'offline'}}),user),{status:503});
 assert.equal((await carregarCadastro(db(),user)).email,user.email);
});
