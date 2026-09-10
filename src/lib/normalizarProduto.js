import { produtos } from "../data/produtos.js";

// Preços e conteúdo comercial vêm do banco; o comportamento do editor pertence
// ao catálogo versionado com a aplicação, inclusive quando o banco retorna false/null.
export function normalizarProduto(data) {
  const local = produtos.find(p => String(p.id) === String(data.id)) || {};
  const produto = {
    ...local,
    ...data,
    precoPromocional: data.preco_promocional ?? data.precoPromocional ?? local.precoPromocional,
    exigePersonalizacao: data.exige_personalizacao ?? data.exigePersonalizacao ?? local.exigePersonalizacao,
    multiplaPersonalizacao: data.multipla_personalizacao ?? local.multiplaPersonalizacao,
  };
  if (local.personalizador3d) {
    Object.assign(produto, {
      personalizador3d: true,
      exigePersonalizacao: false,
      modelo3d: local.modelo3d,
      aplicacaoSvg: local.aplicacaoSvg,
      categorias: local.categorias,
    });
  }
  return produto;
}
