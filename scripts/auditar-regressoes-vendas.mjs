// Diagnóstico isolado, sem rede nem credenciais reais. Não é teste de aprovação.
// node --experimental-vm-modules scripts/auditar-regressoes-vendas.mjs [catalogo-publico.json]
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { produtos as catalogoLocal } from '../src/data/produtos.js';
import { criarHandlerWebhook } from '../api/webhook.js';
const root=fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const pedido={id:'pedido-isolado',status:'Em Produção',modo_entrega:'envio',frete_servico:1,endereco:{cliente_nome:'Teste',cep:'01001000',logradouro:'Rua de teste',numero:'1',bairro:'Centro',cidade:'São Paulo',uf:'SP'},perfis:{cpf:'52998224725'},itens:[{id:77,nome:'Peça de teste',quantidade:2,preco:9.9,peso_gramas:10,dimensoes:'90x90x5'}]};
const db={from(){let action='select'; const q={select(){return q},eq(){return q},update(){action='update';return q},maybeSingle(){return Promise.resolve({data:action==='update'?{id:pedido.id}:pedido,error:null})}};return q}};
let payload;
const context=vm.createContext({process:{env:{MELHOR_ENVIO_TOKEN:'somente-teste',ORIGEM_CEP:'01001000'}},AbortSignal,fetch:async(url,options)=>{payload=JSON.parse(options.body);return {ok:false,status:422}}});
const entry=new vm.SourceTextModule(await readFile(root+'/api/etiqueta.js','utf8'),{context});
await entry.link(async specifier=>{
 const values=specifier.includes('seguranca')?{protegerAdmin:handler=>(req,res)=>handler(req,res,db)}:{gerarReciboSeguro:()=>'<html>Recibo de teste</html>'};
 return new vm.SyntheticModule(Object.keys(values),function(){for(const [name,value]of Object.entries(values))this.setExport(name,value)},{context});
});
await entry.evaluate();
const res={code:200,status(c){this.code=c;return this},json(v){this.body=v;return this}};
await entry.namespace.default({method:'POST',body:{pedido_id:pedido.id}},res);
const history=await readFile(root+'/src/components/MeusPedidos.jsx','utf8');
const expression=history.match(/const linkSeguro = (.*);/)[1];
const linkSeguro=vm.runInNewContext(expression,{URL});
const log=[];
const webDb={rpc:async()=>({data:true}),from(){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:{id:'pedido-teste',status:'Aguardando Pagamento',total:100,pagamento_handle:'loja-teste'}}),update(v){log.push(v);return q}};return q}};
const webRes={...res,code:200};await criarHandlerWebhook(webDb,async()=>{throw new Error('timeout simulado')})({method:'POST',body:{order_nsu:'pedido-teste',transaction_nsu:'transacao-teste',invoice_slug:'slug-teste'}},webRes);
const catalog=process.argv[2] ? JSON.parse(await readFile(process.argv[2],'utf8')) : catalogoLocal;const item=catalog.find(p=>p.id===77);
const result={
 etiqueta:{quantidade:2,service:payload.service,volumes_por_requisicao:payload.volumes.length,documento_remetente:!!(payload.from.document||payload.from.company_document),complemento_destinatario_incluido:Object.hasOwn(payload.to,'complement'),estado_http_apos_rejeicao_simulada:res.code},
 retomada_pagamento:['checkout.infinitepay.io','checkout.infinitepay.com.br','pay.infinitepay.io'].map(host=>({host,botao_visivel:linkSeguro('https://'+host+'/teste','pay.infinitepay.io')})),
 webhook_timeout:{status:webRes.code,mutacoes_persistidas:log.length},
 produto_publico_exemplo:{id:item.id,peso_gramas:item.peso_gramas,peso_cotacao_kg:Math.max(.1,item.peso_gramas/1000),peso_etiqueta_kg:item.peso_gramas/1000}
};
console.log(JSON.stringify(result,null,2));
