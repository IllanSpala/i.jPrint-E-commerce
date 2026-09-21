export const CATEGORIAS = ['Acessórios', 'Bustos', 'Chaveiros', 'Miniaturas', 'Personalizados', 'Tabacaria'];

export function normalizarCategoria(categoria) {
  const antigas = { 'Hot Toys': 'Miniaturas', 'Coleções': 'Miniaturas', 'Sensoriais': 'Acessórios', 'Pagamento': 'Personalizados' };
  const atual = antigas[categoria] || categoria;
  return CATEGORIAS.includes(atual) ? atual : 'Acessórios';
}
