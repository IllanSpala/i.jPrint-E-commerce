# Correções da auditoria de vendas — 18/09/2026

## Situação

As correções foram implementadas no repositório e verificadas localmente. **Não liberar vendas ainda:** a migração não foi aplicada ao Supabase real e as integrações não foram homologadas com contas da loja. Nenhum pagamento, e-mail, etiqueta ou alteração de produção foi realizado nesta sessão.

O relatório `auditoria-vendas-2026-09-18.md` registra o estado anterior (HEAD e784ec4). Os testes de reprodução foram substituídos por testes que exigem o comportamento seguro.

## O que foi corrigido

| Achado | Mudança implementada | Limite / ativação |
| --- | --- | --- |
| A01: APIs administrativas abertas | JWT validado no servidor, permissão em `loja_admins`, token enviado pelo painel; leitura RLS por proprietário/admin; nenhuma escrita de pedidos pelo navegador | Aplicar SQL e confirmar a conta administradora |
| A02: webhook forjável | Consulta `payment_check`, loja gravada no pedido, valor em centavos, transação única e atualização condicional; não confia no status do evento | Homologar com InfinitePay; pedidos antigos exigem conciliação |
| A03/A04: preço e quantidade adulteráveis | Mesma precificação com/sem cupom; preços absolutos de opções/variações; quantidade inteira positiva; opção obrigatória e estoque; pagamento livre só para SKU autorizado | Revisar os preços/opções/estoque cadastrados no banco |
| A05: frete controlado pelo cliente | Cotação assinada e expirada após 15 minutos, vinculada a usuário/carrinho/preço/CEP/serviço; dimensões e peso vêm do cadastro; modo de entrega explícito; CPF e telefone conferidos no servidor | Conferir medidas de embalagens e preço final no Melhor Envio |
| A06: recibos e SVGs ativos | HTML escapado, CSP nos recibos, visualização em iframe isolado; prévia SVG em imagem; SVGs/anexos limitados a geometria estática | SVGs com CSS, entidades, links ou elementos ativos são recusados; arquivos antigos inseguros não são exportados |
| A07: exclusão de pedidos e pagamento tardio | Cronômetro não exclui pedidos nem limpa carrinho; endpoint de cancelamento não apaga registros | Cancelamento/estorno automático desativado. Operadora + conciliação manual são necessários |
| A08: cobrança antes do pedido / duplicidade | Pedido salvo antes da chamada; hash canônico e índice único para pendências; reutiliza link pronto; falha ambígua bloqueia nova chamada | Timeout ou falha após criação exige conciliação, nunca exclusão automática |
| A09: sync público / build alterando catálogo | Endpoint público desativado (410), build só compila; sincronização local explícita exige service role e termina com erro se falhar | Executar `npm run sync:catalogo` apenas quando quiser atualizar o catálogo |
| A10/A11: envio inconsistente | Etiqueta usa pedido do banco, endereço congelado e serviço cotado; claim persistente evita duplicação; criar carrinho no Melhor Envio não marca envio; postagem/retirada pronta confirmadas explicitamente pelo admin | Compra da etiqueta/postagem continuam no Melhor Envio. Erros ambíguos exigem conciliação |
| A12: recibo confundia cupom com frete | Frete gravado separadamente; desconto e total exibidos separadamente | Recibos de pedidos antigos informam quando o frete não foi registrado |
| A13: carrinho e cron sem proteção adequada | `req.body` correto, usuário vem do JWT, preços revalidados, conteúdo de e-mail escapado; cron sempre exige segredo | Configurar CRON_SECRET e agendador |
| A14: simulações de sucesso | Removidos pagamento/frete simulados; falta de configuração retorna indisponibilidade; prebuild na Vercel bloqueia variáveis obrigatórias ausentes | Conferir valores e conectividade, não somente a presença das variáveis |
| A15: recuperação de compra | Histórico no perfil, link para retomar pagamento; confirmação não apaga carrinho modificado depois do checkout | Validar com duas contas reais de homologação |
| A16: abuso / dependências / notificações | Limites no banco por cliente/admin e limite global de webhook; timeouts; fila persistente para notificações de pedidos; dependências vulneráveis atualizadas | Configurar worker e monitorar falhas; limite global não substitui proteção de borda |

## Aplicação no Supabase

1. Faça backup e execute primeiro em um projeto de homologação com estrutura equivalente à produção.
2. Execute `supabase/auditoria_vendas_leitura.sql` e revise as políticas, funções e colunas existentes. O teste local usa uma estrutura representativa; não inventaria objetos adicionais existentes em produção.
3. Execute **todo** `supabase/cupons_primeira_compra.sql`, se ainda não aplicado.
4. Execute **todo** `supabase/seguranca_vendas.sql` em uma transação. Ele cria as tabelas `loja_admins`, `limites_loja`, `notificacoes_pedidos`, adiciona colunas a `pedidos` e substitui políticas das tabelas principais. Não crie apenas uma tabela vazia pelo editor visual.
5. Confirme a promoção da conta administrativa:

```sql
select a.user_id, u.email
from public.loja_admins a
join auth.users u on u.id = a.user_id;
```

A migração só promove `i.j.print26@gmail.com` se a conta já existir com e-mail confirmado. Caso retorne vazio, confirme a conta correta e inclua seu UUID em `loja_admins` pelo SQL Editor. Nunca permita que o cliente grave nessa tabela.

6. Confira as políticas com o script de leitura novamente. Teste anônimo, cliente A, cliente B e admin através da API do Supabase, usando as sessões de cada um. A chave de serviço ignora RLS e não serve para esse teste.
7. Publique o backend e o frontend juntos após a migração. O código anterior depende de permissões e fluxos que foram removidos.

## Variáveis e execução

Servidor: `SUPABASE_URL` (ou URL pública equivalente), `SUPABASE_SERVICE_ROLE_KEY`, `INFINITEPAY_HANDLE`, `MELHOR_ENVIO_TOKEN`, `ORIGEM_CEP`, `RESEND_API_KEY`, `CRON_SECRET`.

Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. A service role nunca deve usar prefixo `VITE_`.

`SITE_URL` define a origem HTTPS do retorno e do webhook. O padrão é `https://www.ijprint26.com`; configure a URL correta na homologação para não enviar seus callbacks ao ambiente de produção.

Use um runtime Node suportado pelas dependências (preferencialmente Node 22 ou superior). Os testes desta sessão rodaram em Node 20.19.2, com aviso de descontinuação futura do Supabase.

### Notificações

Agende `GET /api/carrinho-abandonado` a cada cinco minutos com `Authorization: Bearer <CRON_SECRET>`, em um agendador que suporte essa frequência e cabeçalho. Esse endpoint também processa a fila de pedidos. O cron não foi criado nesta sessão; confirme o plano/limites do seu provedor.

As transições gravam dois eventos persistentes (cliente/admin). O worker reserva até cinco registros por execução, usa chave de idempotência do Resend e registra envio apenas após sucesso. Tentativas ficam limitadas a 12; monitore pendências e investigue falhas, especialmente após indisponibilidade prolongada. Não prometa entrega de e-mail apenas porque o pedido mudou de status.

```sql
select id, pedido_id, evento, destino, tentativas, criado_em, reservado_ate
from public.notificacoes_pedidos
where enviado_em is null
order by criado_em;
```

## Conciliação obrigatória de pedidos antigos e falhas ambíguas

- Não apague pedidos para “cancelar” pagamento. Isso não invalida links nem devolve dinheiro.
- Pedidos anteriores sem `pagamento_handle` não são confirmados automaticamente pelo novo webhook. Confira a transação e o valor na operadora; os dados legados foram criados pelo fluxo auditado como inseguro.
- Revise também os pedidos já marcados pagos pelo webhook antigo antes de fabricar/despachar.
- Se a criação de link falhar depois do envio da requisição, o pedido permanece e a repetição é bloqueada. Verifique na InfinitePay usando o ID do pedido; registre o link/resultado somente após confirmar a associação correta. Não limpe o hash ou a reserva de cupom sem comprovar que não há cobrança pagável.
- Se `etiqueta_estado = 'processando'`, confira o carrinho no Melhor Envio antes de liberar outra tentativa. Adicionar ao carrinho não compra etiqueta nem comprova postagem.
- O cancelamento/estorno financeiro não foi automatizado: o endpoint retorna 409 e preserva o registro. A operação financeira precisa ser realizada na operadora e conciliada por um administrador autorizado.

## Verificações executadas

- 20 testes de regressão da auditoria: acesso, webhook, valor/estoque, frete assinado, recibos/SVG, repetição de checkout e falha ambígua.
- 18 testes de cupons e pagamento, atualizados para cotação assinada e persistência anterior à cobrança.
- 6 arquivos de testes existentes em `src/lib`.
- 11 cenários SQL em PostgreSQL isolado via PGlite, incluindo reexecução da migração, RLS, índices, triggers e reserva da fila.
- Build de produção concluído. Persiste aviso de tamanho do bundle; não é evidência de segurança.
- `npm audit`: zero vulnerabilidades reportadas após atualizar React Router e dependências transitivas.
- Navegador local: catálogo, navegação de produto, opção Pintado a R$159,90, carrinho e bloqueio de checkout anônimo com encaminhamento ao login.

Comandos reproduzíveis:

```sh
npm test
npm run build
npm audit
# Teste SQL requer PGlite instalado separadamente, fora do projeto:
PGLITE_PATH=/tmp/ij-audit-sql/node_modules/@electric-sql/pglite/dist/index.js node tests/seguranca-sql.mjs
```

## Gates restantes para vendas

- Migração aplicada e RLS efetivo confirmado no Supabase real; revisão de funções/policies adicionais, Storage e configurações de autenticação.
- Homologação InfinitePay: aprovado, recusado, repetido, valor divergente, timeout e pagamento tardio; conferir o valor cobrado e a associação ao pedido.
- Homologação Melhor Envio: peso/embalagem real, PAC/SEDEX, endereço e valor final na compra da etiqueta. A operação física e o empacotamento não foram aferidos localmente.
- Cron funcionando, remetentes/domínio Resend verificados e eventos entregues.
- Revisão/conciliação de pedidos existentes e procedimento operacional de cancelamento/estorno.

Referências usadas: [InfinitePay — payment_check e checkout](https://www.infinitepay.io/checkout-documentacao), [Resend — envio de e-mail](https://resend.com/docs/api-reference/emails/send-email).
