export function produtoPersonalizado(produto) {
  const categorias = [produto.categoria, ...(produto.categorias || [])];
  return Boolean(
    categorias.includes('Personalizados') ||
    produto.exigePersonalizacao ||
    produto.personalizador3d ||
    produto.isPagamentoPersonalizado
  );
}
