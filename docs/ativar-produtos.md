# Disponibilidade dos produtos

Em `src/data/produtos.js`, cada produto possui `ativo: true`.
Troque por `ativo: false` e publique para ocultar e impedir novas compras.
Volte para `true` e publique para reativar, desde que o banco também não o tenha desativado.

Para usar o botão do admin, aplique `supabase/produtos_ativos.sql` uma vez.
Uma escolha explícita no painel (`ativo_admin`) prevalece sobre o código, tanto para ativar
quanto para desativar. Sem escolha no painel (`ativo_admin = NULL`), `false` no código
ou no campo `ativo` do banco bloqueia o produto. Para voltar ao controle pelo arquivo,
defina `ativo_admin = NULL` no banco e mantenha `ativo = true`.
A sincronização automática insere apenas IDs novos e não altera esse controle do banco.
O bloqueio pelo código funciona mesmo antes da migração SQL.

Vitrine, categorias, busca e página do produto respeitam o controle.
Frete, cupom, criação de pagamento e salvamento de carrinho validam o catálogo no servidor,
inclusive quando o cliente tem um carrinho antigo. Pedidos existentes não são alterados.
Links de pagamento já emitidos não são cancelados pela desativação.

Esta opção controla publicação e novas vendas; não torna imagens ou dados do catálogo
confidenciais. Arquivos públicos, bundles antigos e o catálogo público do banco podem
continuar acessíveis tecnicamente.
