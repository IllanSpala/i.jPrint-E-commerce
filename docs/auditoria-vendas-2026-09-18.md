# Auditoria de pagamento, pedidos e segurança — I.J Print

> **Registro histórico, anterior às correções.** Os achados abaixo descrevem o HEAD e784ec4. Consulte `correcoes-vendas-2026-09-18.md` para o estado atual, testes e implantação. Os testes de reprodução citados aqui foram substituídos por regressões de segurança. As referências de linha correspondem ao código auditado, não às versões corrigidas.

**Decisão: NÃO LIBERAR PARA VENDAS REAIS.**

Auditoria concluída em 18/09/2026, sobre o código do commit `e784ec4`. Há caminhos para alterar/apagar pedidos sem autenticação, forjar confirmação de pagamento e manipular valores. Compilar com sucesso não elimina esses problemas.

A auditoria adicionou somente este relatório, testes de reprodução local e um SQL de inspeção. Nenhuma correção funcional, migração remota ou publicação foi executada. Não foram criadas cobranças, enviadas mensag
ens, alterados pedidos reais ou testados ataques contra produção.

## Evidências e limites

Foram revisadas todas as 11 entradas de API e os fluxos de login, perfil, carrinho, confirmação, administração, cupons, arquivos de personalização e deploy. Os handlers críticos foram executados com banco, pagamento e e-mail simulados; nas reproduções por VM, chamadas de rede são bloqueadas.

| Verificação | Resultado |
| --- | --- |
| Compilação direta pelo Vite | Passou; aviso de bundle grande |
| Testes existentes de cupom | 18 passaram |
| Testes existentes de `src/lib` | 6 arquivos passaram |
| Cenários de auditoria | 15 reproduções de comportamentos inseguros/incorretos confirmadas |
| `npm audit` | 4 pacotes afetados: 1 com severidade alta e 3 moderada |
| Credenciais locais para serviços | Nenhuma variável de integração configurada nesta sessão |
| Supabase/Vercel/InfinitePay em produção | Não inspecionados; configurações e migrações não confirmadas |

Os testes de auditoria passam quando reproduzem o problema. Eles **não** são um teste de aprovação para deploy. As simulações comprovam decisões e payloads do código; não afirmam que a InfinitePay aceita, por exemplo, quantidade negativa.

## Bloqueadores confirmados

### A01 — Crítico: APIs administrativas sem autenticação nem autorização

**Fontes:** [status.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/status.js:16), [concluido.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/concluido.js:15), [cancelar.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/cancelar.js:14), [etiqueta.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/etiqueta.js:129).

Os handlers não verificam token, identidade ou papel de admin. Com um ID de pedido válido, uma requisição anônima alcança atualização de status, exclusão e geração de recibo. `status` e `concluido` também retornam o pedido com dados relacionados. A checagem por e-mail em [Admin.jsx](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/src/pages/Admin.jsx:372) protege apenas a tela. Os botões chamam as APIs sem Authorization.

**Comprovado localmente:** atualização para Em Produção/Concluído, exclusão de pedido pago e retorno de recibo, todos sem token. Com a configuração prevista de `service_role`, RLS não funciona como proteção adicional para essas operações: a chave de serviço ignora RLS. [Referência Supabase](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z).

**Correção necessária:** autenticação comum a todas as APIs administrativas, autorização definida no servidor, 401 para anônimo e 403 para cliente comum. Enviar o token nos botões e testar isolamento entre duas contas de cliente e uma de admin.

### A02 — Crítico: webhook aceita confirmação de pagamento forjada

**Fonte:** [webhook.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/webhook.js:28).

Um corpo com `order_nsu` de pedido existente e `status: paid`, ou apenas `transaction_nsu`, é tratado como confirmação. Não há consulta ao provedor, conferência de valor ou vínculo verificável entre transação, loja e pedido. Não são persistidos identificador da transação e comprovante para reconciliação.

**Comprovado localmente:** pedido de R$ 100 foi marcado Pago com evento não autenticado informando um centavo, sem consulta externa. Isso também pode consumir indevidamente a elegibilidade do cupom pelo trigger de primeira compra.

**Correção necessária:** conferir a transação no servidor pela API do provedor, pedido/loja/valor e estado aprovado antes de atualizar. Persistir transação e identificadores com unicidade. A InfinitePay documenta `payment_check`, incluindo `handle`, `order_nsu`, `transaction_nsu` e `slug`. O campo de valor pago pode incluir encargos; a conciliação precisa respeitar a semântica do provedor. [Documentação InfinitePay](https://www.infinitepay.io/checkout-documentacao).

### A03 — Alta: preço do produto pode ser alterado pelo cliente no checkout sem cupom

**Fonte:** [pagamento.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/pagamento.js:100).

O servidor aceita `isPagamentoPersonalizado` enviado pelo navegador e passa a usar `item.preco`, mesmo para produto normal. Quantidades positivas/inteiras também não são exigidas nesse caminho.

**Comprovado localmente:** produto cadastrado por R$ 100 resultou em payload de R$ 0,01. Quantidade negativa chegou ao mock do provedor. O preço seguro usado na validação de cupons não é usado no caminho sem cupom.

**Correção necessária:** uma única rotina de preço para todos os pedidos, identificando pagamento livre por cadastro confiável no servidor; validar quantidade, limites, produto, disponibilidade e opção. Persistir o item recalculado, não o JSON comercial recebido do navegador.

### A04 — Alta: opções com preço próprio são cobradas incorretamente, inclusive com cupom

**Fontes:** [PaginaProduto.jsx](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/src/pages/PaginaProduto.jsx:92), [pagamento.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/pagamento.js:105), [cupons.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/_lib/cupons.js:46).

O frontend usa `opcao.preco`/`variacao.preco`; as duas rotinas do servidor consideram apenas `precoAcrescimo`. Variações concatenadas no nome também não correspondem à busca exata da opção. A regra de disponibilidade não é aplicada de forma geral no servidor.

**Comprovado com o catálogo versionado:** The Division Bell, opção Pintado, custa R$ 159,90 na página, mas foi precificada em R$ 73,90 no checkout e na base do cupom. O kit de Cult of the Lamb tem a mesma incompatibilidade de modelo: opção R$ 199,90 versus base R$ 119,90.

**Correção necessária:** alinhar representação de opções/variações e sua precificação entre página, cupom e pagamento. Acrescentar regressões com produtos reais do catálogo.

### A05 — Alta: frete e endereço de checkout não são validados pelo servidor

**Fontes:** [pagamento.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/pagamento.js:126), [frete.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/frete.js:22), [SidebarCarrinho.jsx](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/src/components/SidebarCarrinho.jsx:279).

O pagamento recebe diretamente `frete_valor` e endereço do cliente; não recebe/verifica uma cotação vinculada aos itens, serviço e CEP. A cotação também confia no peso, dimensões e valor enviados pelo navegador. CPF e telefone são verificados somente na interface.

**Comprovado localmente:** pedido de envio com `frete_valor: 0` gera payload sem frete. Na interface, Finalizar não depende de cotação válida ou do fim do cálculo; se não houver frete selecionado, envia zero. Respostas antigas de frete podem substituir a seleção depois de mudar o endereço.

**Correção necessária:** validar destinatário e modo de entrega no servidor; recalcular/validar cotação com dados do catálogo e persistir serviço, preço, CEP e validade. Bloquear checkout de envio sem cotação válida e descartar respostas obsoletas.

### A06 — Alta: conteúdo do cliente entra em HTML executável no navegador do admin

**Fontes:** [etiqueta.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/etiqueta.js:24), [Admin.jsx](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/src/pages/Admin.jsx:279), [pagamento.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/pagamento.js:198).

Nome, personalização, endereço e outros campos são interpolados sem escape no recibo. O painel abre uma janela e executa `document.write(htmlRecibo)`. Essa combinação cria um caminho de XSS armazenado, que pode executar código na origem da loja quando o admin imprime o recibo. O comprovante HTML baixado também inclui conteúdo bruto.

**Comprovado localmente:** uma tag com atributo de evento foi preservada no HTML retornado. Não foi executado código no navegador de um admin real; CSP e cabeçalhos de produção não foram inspecionados.

**Correção necessária:** escapar todo texto/atributo do usuário, preferir renderização segura e isolar a impressão. Validar/sanitizar SVGs no servidor e tratar originais anexados como arquivos não confiáveis; a validação atual exige apenas presença de `<svg` em parte dos fluxos. [validarPersonalizacao.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/_lib/validarPersonalizacao.js:10).

### A07 — Alta: exclusão de pedidos pendentes pode perder uma venda paga

**Fontes:** [Admin.jsx](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/src/pages/Admin.jsx:518), [ContagemRegressiva.jsx](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/src/components/ContagemRegressiva.jsx:7), [cancelar.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/cancelar.js:80).

O painel apaga pedidos pendentes após 15 minutos, sem cancelar o link no provedor. O cancelamento manual também exclui o registro, inclusive se já pago, sem fluxo de estorno. Um pagamento posterior ou webhook atrasado deixa de encontrar o pedido. O filtro de status evita apagar um pedido já atualizado pelo webhook, mas não resolve pagamento ainda não sincronizado.

Isso interage com os cupons: a reserva permanece enquanto o pedido pode ser apagado, impedindo nova tentativa do cliente e dificultando reconciliação.

**Correção necessária:** preservar registros e transações; representar expiração/cancelamento como estados. Conciliar com o provedor antes de encerrar, definir tratamento de pagamentos tardios, reembolso e reserva de cupom. O relógio do navegador não deve comandar exclusão financeira.

### A08 — Alta: criação de checkout não é idempotente e o pedido nasce depois do link

**Fonte:** [pagamento.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/pagamento.js:68), [pagamento.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/pagamento.js:156), [pagamento.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/pagamento.js:195).

Cada repetição cria novo UUID e novo link. Se a rede falhar ou o usuário repetir, podem existir múltiplas cobranças do mesmo carrinho. Se o banco falhar depois da criação do link, o link fica sem pedido correspondente. Um webhook rápido também pode chegar antes da inserção.

**Comprovado localmente:** duas requisições iguais geram referências distintas; falha na inserção acontece após sucesso do mock do provedor. A reserva de cupom protege apenas a campanha e não substitui idempotência de pedidos.

**Correção necessária:** persistir pedido/tentativa antes da chamada externa; chave de idempotência, armazenamento do link e transação e recuperação segura de tentativas. Atualizar estado de forma condicional/atômica. No webhook atual, leitura e atualização são separadas e o UPDATE não filtra o estado anterior, permitindo regressão em concorrência.

### A09 — Alta: sincronização do catálogo exposta por segredo fixo e acoplada ao deploy

**Fontes:** [sync-produtos.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/sync-produtos.js:9), [sync-database.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/sync-database.js:51), [package.json](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/package.json:8).

A rota de sincronização usa um segredo literal versionado na URL e não exige sessão administrativa. Com esse valor e a configuração de serviço, é possível sobrescrever o catálogo; a rota também grava pesos/dimensões fixos. O build normal executa upserts no banco e continua mesmo se houver falhas, podendo publicar com catálogo parcialmente sincronizado.

**Correção necessária:** remover a rota pública ou exigir autorização administrativa forte; retirar o segredo fixo/da query string. Separar build de migração/sincronização e impedir falhas silenciosas. Na auditoria foi usado somente o Vite, sem executar a sincronização.

## Outros problemas para corrigir antes da operação

| ID / prioridade | Problema e efeito | Evidência / direção da correção |
| --- | --- | --- |
| A10 / Alta | Expedição pode processar pedido não pago; sempre usa o serviço `1`, apesar de o comprador poder escolher outro; altera partes do endereço pelo cadastro padrão atual. | [etiqueta.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/etiqueta.js:138), [etiqueta.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/etiqueta.js:169), [etiqueta.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/etiqueta.js:235). Exigir estado pago/em produção, usar snapshot e serviço contratado. |
| A11 / Alta | Adicionar ao carrinho do Melhor Envio já envia aviso ao cliente e o frontend marca Enviado. Isso antecede compra/postagem; o UPDATE do frontend ignora erro e a proteção contra duplicidade não é atômica. | [Admin.jsx](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/src/pages/Admin.jsx:264), [etiqueta.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/etiqueta.js:291). Separar etiqueta criada, comprada, postada e entregue; transições no servidor. O Melhor Envio documenta etapas distintas de pagamento e geração de etiqueta: [referência](https://docs.melhorenvio.com.br/docs/introducao-a-integracao). |
| A12 / Média | Recibos inferem frete como `total - itens`, sem considerar cupom; snapshots têm preço/nome do navegador. | [etiqueta.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/etiqueta.js:187). Reproduzido: itens R$ 100 − cupom R$ 10 + frete R$ 25 = total R$ 115; recibo mostra frete R$ 15. Persistir subtotal, desconto, frete e itens oficiais separadamente. |
| A13 / Média | Carrinho abandonado lê `req.json?.()` no handler Node/Vercel e ignora `req.body`; sincronização normal retorna 400. Não autentica a identidade enviada. Cron permite acesso anônimo se `CRON_SECRET` estiver ausente. | [carrinho-abandonado.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/carrinho-abandonado.js:22), [carrinho-abandonado.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/carrinho-abandonado.js:60). Ambos os comportamentos foram reproduzidos. Corrigir parsing junto com autenticação; identidade deve vir do token. [Runtime Vercel](https://vercel.com/docs/functions/runtimes/node-js). |
| A14 / Média | Configuração ausente retorna pagamento/frete simulado com HTTP 200. Falta de Supabase deixa catálogo local navegável, mascarando checkout indisponível. | [pagamento.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/pagamento.js:60), [frete.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/api/frete.js:10), [supabase.js](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/src/lib/supabase.js:43). Produção deve falhar explicitamente quando integração obrigatória não está configurada. |
| A15 / Média | Retorno de sucesso limpa uma chave diferente da usada no contador do checkout. Uma nova compra pode herdar o prazo e ter carrinho limpo. Não há histórico de pedidos no Perfil, apesar de a mensagem de erro direcionar a ele. | [PaginaSucesso.jsx](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/src/pages/PaginaSucesso.jsx:34), [SidebarCarrinho.jsx](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/src/components/SidebarCarrinho.jsx:85), [Perfil.jsx](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/src/pages/Perfil.jsx:42). Limpar estado correto e oferecer recuperação de pedido/link. |
| A16 / Média | Sem limites de uso implementados nas APIs de frete/pagamento, sem timeout explícito para chamadas externas; envio de e-mail aguardado antes de responder pode provocar atraso/repetições. | Revisão dos handlers. Confirmar proteções WAF/rate limit em produção e implementar limites por identidade/IP, timeouts e envio confiável de notificações fora da resposta crítica. |

## Dependências

O registro npm apontou quatro pacotes afetados no lockfile, com correções disponíveis. Nenhuma atualização foi instalada durante a auditoria.

| Pacote | Versão | Severidade reportada | Contexto |
| --- | --- | --- | --- |
| browserslist | 4.28.6 | Alta | Dependência de desenvolvimento/build; não demonstrado caminho de exploração no site publicado |
| baseline-browser-mapping | 2.10.43 | Moderada | Dependência de desenvolvimento/build |
| react-router | 6.30.4 | Moderada | Produção; parte dos avisos é específica de SSR, que este app não utiliza |
| react-router-dom | 6.30.4 | Moderada | Produção; revisar redirecionamento/URLs e atualizar para versão corrigida compatível |

Exemplos dos avisos retornados: [Browserslist](https://github.com/advisories/GHSA-c83g-rgw3-j3cx), [React Router DOM](https://github.com/advisories/GHSA-jjmj-jmhj-qwj2). A presença no audit não comprova explorabilidade de todos os avisos neste aplicativo; os bloqueadores de lógica e autorização acima independem deles.

## O que falta verificar no Supabase e na hospedagem

O repositório contém SQL para carrinhos e cupons, mas não permite comprovar as políticas ativas de `pedidos`, `perfis`, `enderecos` e `produtos`. Não é possível concluir que dados entre clientes estão isolados apenas pelos filtros do React.

Execute [auditoria_vendas_leitura.sql](/home/jojozelan/Documentos/Coding/i.jPrint-E-commerce/supabase/auditoria_vendas_leitura.sql) no SQL Editor. Ele consulta somente estrutura, políticas, grants e triggers, sem retornar dados de clientes. Depois devem ser feitos testes reais em ambiente de homologação:

1. Anônimo não lê pedidos, perfis, CPF, endereços ou reservas; lê somente o catálogo público permitido.
2. Cliente A não lê/altera os dados de B; cliente não modifica preço, status, total, cupom ou papel de administrador.
3. Admin acessa o necessário com autorização verificável no servidor. Confirmar proteção da conta, e-mail verificado e MFA.
4. Função de reserva e tabelas de histórico/cupom não ficam expostas a `anon`/`authenticated`; migração está aplicada.
5. Conferir chaves somente no servidor, URLs de recuperação/login, SMTP, backups, logs, headers e proteção das APIs. A varredura por formatos comuns não encontrou chaves de serviço nas fontes versionadas; não foi uma auditoria de todo o histórico Git nem do painel de variáveis da hospedagem.
6. Confirmar transação de teste autorizada e reconciliação ponta a ponta com InfinitePay; retorno sem webhook, webhook repetido/atrasado, valor divergente, falha de rede e estorno. Não foi realizado pagamento real nesta auditoria.
7. Confirmar cotação PAC/SEDEX, endereço diferente do padrão, cupom com frete, opção Pintado/kit, retirada e pagamento personalizado.

## Ordem para liberar vendas

1. Corrigir A01–A06: autorização, confirmação real de pagamento, preço único confiável, opções, frete e HTML seguro.
2. Corrigir A07–A11: preservar pedidos, idempotência, conciliação, sincronização e expedição.
3. Corrigir valores dos recibos, cupons/pedidos expirados, recuperação do checkout, configuração e dependências.
4. Aplicar/verificar políticas e migrações; executar a matriz de contas e testes com os provedores em homologação.
5. Repetir a auditoria dos pontos corrigidos e somente então autorizar vendas reais.

## Como reproduzir localmente

```bash
node --experimental-vm-modules tests/auditoria-vendas.test.js
node tests/cupons.test.js
node --test src/lib/*.test.js
./node_modules/.bin/vite build
npm audit --json --ignore-scripts
```

O primeiro comando comprova os defeitos atuais com mocks; após corrigir cada defeito, substitua a expectativa pela rejeição/resultado seguro e transforme esses cenários em regressões. Não execute payloads de auditoria contra pedidos reais.
