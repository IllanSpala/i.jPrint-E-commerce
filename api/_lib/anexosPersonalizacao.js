import { arquivosPersonalizacao } from '../../src/lib/arquivosPersonalizacao.js';

export function anexosPersonalizacao(itens) {
  return arquivosPersonalizacao(itens).map(arquivo => ({ filename: arquivo.nome, content: Buffer.from(arquivo.conteudo, 'utf8').toString('base64') }));
}
