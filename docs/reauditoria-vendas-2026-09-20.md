# Reauditoria de vendas — 20/09/2026

## Parecer

**Ainda não liberar vendas com envio automático.** As leituras públicas confirmam melhorias na configuração, mas há incompatibilidades no código de etiquetas e lacunas na recuperação de pagamentos. O fluxo completo autenticado e o agendamento de notificações ainda não foram comprovados nesta sessão.

Base local: commit `cf007fe`. Site consultado: `https://www.ijprint26.com`. Esta rodada é uma auditoria: foram adicionados diagnóstico e documentação, sem alterar a lógica comercial nem dados de produção.

## O que foi confirmado

| Verificação | Resultado | Alcance |
| --- | --- | --- |
| Página publicada | HTTP 200, Vercel | Leitura real |
| Cabeçalhos | HSTS, DENY, nosniff e strict-origin-when-cross-origin presentes | Leitura real |
| Configuração pública Supabase | Uma chave publicável; nenhum padrão de chave secreta encontrado no bundle examinado | Varredura do JavaScript público, não garantia de ausência de segredos em outros lugares |
| Catálogo | 76 produtos retornados | Leitura real do catálogo público |
| Tabelas sensíveis | HEAD com limite zero retornou 401 em pedidos, perfis, endereços, loja_admins, clientes_com_compra, cupons_reservados, notificacoes_pedidos, limites_loja e carrinhos_salvos | Acesso anônimo negado; não prova isolamento entre usuários autenticados |
| Preço Pintado / kit | Banco público contém R$159,90 para produto 32/Pintado e R$199,90 para produto 62/Kit Ambas Figures | Leitura real |
| Testes existentes | 20 de auditoria, 18 de cupons e 6 arquivos de src/lib passaram | Mocks/local |
| Migração | 11 cenários SQL passaram | PostgreSQL isolado; não é execução na produção |
| Build | Passou; aviso de bundle grande permanece | Local |
| Dependências | npm audit: zero vulnerabilidades reportadas | Lockfile atual |

O bundle publicado `/assets/index--41brmR6.js` confirma o filtro antigo no botão de retomar pagamentos. A versão dos handlers privados publicados não foi confirmada comparando artefatos do servidor.

## Achados

### R01 — P1: etiqueta dos Correios envia vários volumes numa única chamada

Fonte: `api/etiqueta.js:30`; `api/frete.js:74`.

O código cria um volume por unidade e coloca todos numa chamada `/me/cart`. A cotação, por sua vez, descarta os pacotes devolvidos pela transportadora, preservando somente ID, nome, preço e prazo.

**Reprodução isolada:** duas unidades do mesmo produto produziram `service: 1` e dois volumes numa única requisição. A documentação exige que volumes venham dos pacotes cotados e que, para Correios, cada chamada contenha somente um volume. Como a loja oferece PAC/SEDEX, o caminho de carrinhos com múltiplas unidades é incompatível com esse contrato. Não foi criada uma etiqueta real. [Documentação Melhor Envio](https://docs.melhorenvio.com.br/reference/inserir-fretes-no-carrinho).

**Corrigir:** preservar os pacotes da cotação e seus valores; enviar uma chamada por pacote dos Correios, com persistência/idempotência individual; ou usar uma embalagem única efetivamente cotada. Não inventar uma embalagem na emissão da etiqueta.

### R02 — P1: dados obrigatórios do remetente estão ausentes

Fonte: `api/etiqueta.js:27`.

O objeto `from` contém nome, CEP, endereço, número, cidade, UF e e-mail, mas não CPF nem CNPJ. A documentação exige documento conforme a natureza do remetente. Configurar somente token e ORIGEM_CEP não preenche esses campos, pois o código não os lê. Isso precisa ser resolvido para homologar a emissão, inclusive para pedidos com um item. [Regras do remetente](https://docs.melhorenvio.com.br/reference/inserir-fretes-no-carrinho).

**Corrigir:** cadastrar os dados reais da loja no servidor e montar o payload apropriado. Validar também os dados de nota/declaração exigidos pelo contrato técnico da integração para a operação da loja; esta auditoria não substitui análise fiscal.

### R03 — P2: botão de retomar pagamento desaparece para os links atuais

Fonte: `src/components/MeusPedidos.jsx:21`; allowlist em `api/pagamento.js`.

O backend passou a aceitar `checkout.infinitepay.io` e `checkout.infinitepay.com.br`, mas o histórico só mostra o botão quando o host é `pay.infinitepay.io`. O problema existe no bundle atualmente publicado.

**Reprodução:** a função real do componente retornou falso para ambos os hosts atuais e verdadeiro para o antigo. Se o cliente fecha o checkout, o histórico mostra o pedido pendente sem o botão de retomada, apesar de ter um link armazenado.

**Corrigir:** compartilhar uma validação única de URL entre backend e frontend, com hosts exatos e HTTPS, e testar o fluxo de retomada com os domínios reais.

### R04 — P2: falha transitória no webhook não deixa evento recuperável

Fonte: `api/webhook.js:19`, `api/webhook.js:40`; `src/pages/PaginaSucesso.jsx:26`.

Os identificadores da transação só são persistidos depois do sucesso de `payment_check`. Se essa consulta falha, o handler retorna 503 sem salvar o evento; a página de sucesso apenas consulta o estado local do pedido e não faz reconciliação.

**Reprodução:** timeout da operadora retornou 503 e zero mutações persistidas. A documentação explicita reenvio após 400, mas não garante o comportamento de 503. Portanto, depender dele não constitui uma recuperação comprovada. Não foi demonstrado que a operadora jamais reenvie 503; a lacuna é a ausência de garantia e de recuperação própria. [Webhook InfinitePay](https://www.infinitepay.io/checkout-documentacao).

**Corrigir:** persistir um evento pendente sem marcar o pedido pago, validar a transação em processamento idempotente e repetir falhas transitórias; alinhar o HTTP de erro ao contrato da operadora e homologar callbacks repetidos/timeout.

### R05 — P2: cotação e etiqueta usam pesos diferentes e perdem complemento

Fontes: `api/frete.js:36`, `api/etiqueta.js:21`, `api/etiqueta.js:28`.

O produto público 77 tem 10 g. Na cotação ele é enviado como 0,1 kg; na etiqueta como 0,01 kg. Além de não preservar a embalagem cotada (R01), são usados pesos diferentes para a mesma mercadoria. O endereço salvo contém `complemento`, mas o destinatário enviado ao Melhor Envio não contém esse campo, podendo omitir apartamento/bloco.

**Corrigir:** usar o pacote cotado até a emissão e incluir o complemento do endereço congelado no pedido. Conferir fisicamente peso e dimensões embalados.

### R06 — P2: carrinho permanece compartilhado entre contas no mesmo navegador

Fontes: `src/context/CarrinhoContext.jsx:46`, `src/context/CarrinhoContext.jsx:74`, `src/pages/Perfil.jsx:58`.

Há uma chave global de localStorage e o estado não é reiniciado quando muda o usuário. O logout apenas encerra a sessão. Ao entrar outra conta, o efeito sincroniza os mesmos itens com a nova identidade. Isso pode expor personalizações em dispositivo compartilhado e associar recuperação de carrinho à conta errada. Constatação pelo código, sem troca entre contas reais nesta auditoria.

**Corrigir:** separar o carrinho por conta, limpar o estado privado no logout e definir explicitamente a transferência do carrinho de visitante no login.

## Configuração ainda não comprovada

- RLS entre dois clientes autenticados e um administrador; proteção dos RPCs e presença dos índices/triggers no projeto real. O resultado 401 anônimo não cobre esses casos.
- Cron: `vercel.json` não contém `crons`; isso não prova ausência de agendador externo ou Supabase Cron. Preciso da localização do agendamento e de uma execução bem-sucedida da fila. Criar CRON_SECRET isoladamente não agenda nada.
- Entrega Resend, callback real InfinitePay, valores conciliados e compra/postagem de etiqueta.
- Conciliação de pedidos antigos ou marcados `processando`. Cancelamento/estorno automático continua indisponível no código.

Foi preparado `supabase/reauditoria_vendas_leitura.sql`, que retorna metadados e totais agregados, sem listar pedidos/clientes nem segredos. Os resultados permitem verificar as mudanças no projeto real.

## Limites desta execução

Não havia credenciais administrativas locais nem conectores de Supabase/Vercel. O lote inicial de requisições a endpoints de produção foi rejeitado pela revisão automática por possível alteração de pedidos, envio de notificações ou sincronização; ele não foi executado. As verificações externas posteriores foram restritas à página/JavaScript públicos, catálogo e HEAD de tabelas com limite zero. Nenhuma cobrança, notificação, etiqueta ou conta de teste foi criada.

## Reprodução local

```sh
npm test
npm run build
npm audit
node --experimental-vm-modules scripts/auditar-regressoes-vendas.mjs
PGLITE_PATH=/tmp/ij-audit-sql/node_modules/@electric-sql/pglite/dist/index.js node tests/seguranca-sql.mjs
```

O script de diagnóstico imprime os problemas observados com banco e provedor simulados; não é um teste que aprova o site. O runtime PGlite fica fora do projeto e precisa estar disponível no caminho informado.
