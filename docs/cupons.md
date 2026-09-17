# Cupons no carrinho

`COMPRE.IJ` concede 10% sobre o subtotal dos itens, inclusive preços promocionais e acréscimos de opções. O frete não recebe desconto. A primeira compra é verificada por conta autenticada, não por navegador ou CPF. O código aceita letras minúsculas e espaços no início/fim.

## Ativação

1. Execute `supabase/cupons_primeira_compra.sql` no SQL Editor do projeto Supabase. A migração é reaplicável, adiciona os campos de desconto em pedidos e restringe o histórico/reservas ao servidor.
2. Configure `SUPABASE_URL` (ou `VITE_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY` e `INFINITEPAY_HANDLE` no ambiente das APIs. Nunca coloque a chave de serviço em variável `VITE_*`.
3. Publique o frontend e as APIs juntos. O Vite puro não executa `/api/cupom`; a validação deve ser testada em um ambiente que sirva as funções da Vercel.

A migração importa clientes com pedidos nos estados Pago, Em Produção, Enviado e Concluído e mantém esse histórico nas próximas mudanças de status. Pedidos pagos já excluídos antes da migração não podem ser reconstruídos automaticamente: importe esses clientes de um histórico confiável antes de ativar a campanha, se houver.

## Fluxo

O carrinho consulta `/api/cupom` usando a sessão do usuário e recebe os preços e desconto calculados pelo servidor. Alterar itens, quantidades ou conta invalida a aplicação; o cupom pode ser aplicado novamente. Em `/api/pagamento`, os preços e a elegibilidade são revalidados e uma reserva atômica impede dois checkouts com o benefício. A InfinitePay recebe itens com preços já reduzidos e o frete integral. O pedido guarda `cupom_codigo`, `desconto` e o total efetivamente cobrado.

Um pedido pendente com cupom reserva o benefício: o cliente deve usar o link já recebido por e-mail. A reserva não expira com o contador local do carrinho, pois esse contador não invalida o link do provedor. Uma recusa definitiva HTTP 4xx (exceto 408) libera a reserva. Em falhas de rede, resposta 5xx ou falha ao salvar o pedido depois de criar o link, a reserva permanece para impedir cobranças duplicadas com desconto. O suporte deve conferir o pedido na InfinitePay; somente depois de confirmar que o link anterior foi invalidado e que não existe pagamento aprovado pode liberar a reserva correspondente. Excluir um pedido no painel não invalida o link e não libera automaticamente o cupom.

O checkout local existente continua simulado em modo DEV. Os testes automatizados usam banco e provedor simulados e não criam cobranças nem enviam e-mails reais.

## Testes

Execute `node tests/cupons.test.js` para validar autenticação, elegibilidade, preços oficiais, arredondamento em centavos, cobrança com e sem desconto, frete, reserva concorrente e falhas do provedor. Compile o frontend com `./node_modules/.bin/vite build` para não executar o script de sincronização de banco incluído em `npm run build`.

O cadastro atual fica em `api/_lib/cupons.js`. A regra de reserva SQL é específica da campanha de primeira compra; novas modalidades de cupom devem incluir sua própria regra no servidor/banco, além da configuração visual.
