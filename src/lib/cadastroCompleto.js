const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
export function celularValido(valor) {
  const numero = String(valor || '').replace(/\D/g, '');
  return /^[1-9]{2}9\d{8}$/.test(numero) && !/^(\d)\1+$/.test(numero);
}
export function enderecoCompleto(e) {
  return Boolean(e && /^\d{8}$/.test(String(e.cep || '').replace(/\D/g, '')) && !/^0+$/.test(String(e.cep).replace(/\D/g, '')) && UFS.has(e.uf?.toUpperCase()) && ['rua','numero','bairro','cidade'].every(k => typeof e[k] === 'string' && e[k].trim()));
}
export async function carregarCadastro(db, user) {
  if (!user) throw Object.assign(new Error('Entre ou crie uma conta para enviar seu pedido.'), {status:401});
  const [perfil, enderecos] = await Promise.all([
    db.from('perfis').select('nome,telefone,cpf').eq('id',user.id).single(),
    db.from('enderecos').select('*').eq('user_id',user.id).order('padrao',{ascending:false})
  ]);
  if ((perfil.error && perfil.error.code !== 'PGRST116') || enderecos.error) throw Object.assign(new Error('Não foi possível verificar seu cadastro. Tente novamente.'),{status:503});
  const faltas = [];
  if (!user.email_confirmed_at || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email || '')) faltas.push('e-mail confirmado');
  if (!perfil.data?.nome?.trim()) faltas.push('nome');
  if (!celularValido(perfil.data?.telefone)) faltas.push('celular com DDD');
  const endereco = enderecos.data?.find(enderecoCompleto);
  if (!endereco) faltas.push('endereço completo com CEP');
  if (faltas.length) throw Object.assign(new Error(`Complete seu perfil antes de enviar pedidos: ${faltas.join(', ')}.`),{status:422});
  return {nome:perfil.data.nome,email:user.email,telefone:perfil.data.telefone,endereco};
}
