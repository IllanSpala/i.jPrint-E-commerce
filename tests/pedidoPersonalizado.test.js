import test from 'node:test';
import assert from 'node:assert/strict';
import { validarPedido, validarArquivos, LIMITE_BYTES } from '../src/lib/pedidoPersonalizado.js';
import { prepararAnexos, criarHandler } from '../api/pedido-personalizado.js';
const dados = {nome:'Pessoa Teste',email:'teste@example.com',descricao:'Gostaria de uma peça de 15 cm.',referencia:'https://example.com/referencia',chave:'12345678-1234-1234-1234-123456789abc',anexos:[]};
test('valida contato, texto e links sem aceitar protocolos executáveis', () => {
 assert.equal(validarPedido(dados),'');
 for (const alteracao of [{email:'abc'},{descricao:'curto'},{referencia:'javascript:alert(1)'},{nome:null},{referencia:'https://user:pass@example.com'}]) assert.ok(validarPedido({...dados,...alteracao}));
 assert.ok(validarPedido(null));
});
test('limita quantidade, tamanho agregado e formatos', () => {
 assert.equal(validarArquivos([{type:'video/mp4',size:1024}]),'');
 assert.ok(validarArquivos([{type:'image/svg+xml',size:12}]));
 assert.ok(validarArquivos([{type:'video/mp4',size:LIMITE_BYTES+1}]));
 assert.ok(validarArquivos(Array.from({length:4},()=>({type:'image/png',size:1}))));
});
test('confere assinatura e renomeia anexos sem reutilizar nome fornecido', () => {
 const png = Buffer.from([137,80,78,71,13,10,26,10]).toString('base64');
 assert.equal(prepararAnexos([{nome:'../../x.html',tipo:'image/png',conteudo:png}])[0].filename,'referencia-1.png');
 assert.throws(()=>prepararAnexos([{tipo:'image/png',conteudo:Buffer.from('<html>').toString('base64')}]));
 assert.throws(()=>prepararAnexos([{tipo:'image/png',conteudo:'!invalid'}]));
});
async function executar({sent=true,limitError=null,body=dados,method='POST'}={}) {
 let enviado;
 const handler=criarHandler({criarBanco:()=>({}),limitar:async()=>{if(limitError)throw limitError;},enviar:async d=>{enviado=d;return {sent};}});
 const res={status(code){this.code=code;return this;},json(json){this.body=json;return this;}};
 await handler({method,body,headers:{}},res);return {res,enviado};
}
test('só confirma quando o provedor aceita e escapa o conteúdo',async()=>{
 const {res,enviado}=await executar({body:{...dados,descricao:'<script>Uma referência de peça</script>'}});
 assert.equal(res.code,200);assert.equal(res.body.ok,true);assert.ok(!enviado.html.includes('<script>'));assert.ok(enviado.idempotencyKey);
 assert.equal((await executar({sent:false})).res.code,503);
});
test('limite e validação bloqueiam envio; método inválido não envia',async()=>{
 for(const params of [{method:'GET'},{body:{...dados,email:'bad'}},{limitError:Object.assign(new Error('Muitas tentativas'),{status:429})}]) {
 const {res,enviado}=await executar(params);assert.ok(res.code>=400);assert.equal(enviado,undefined);
 }
});
test('aceita um anexo grande dentro do limite sem estourar a validação',()=>{
 const bytes=Buffer.alloc(2*1024*1024); Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);
 assert.equal(prepararAnexos([{tipo:'image/png',conteudo:bytes.toString('base64')}]).length,1);
});
