# Bubble Store Backend

API REST da Bubble Store construída com NestJS, TypeORM e PostgreSQL.

## Requisitos

- Node.js 22+
- PostgreSQL 16
- Docker e Docker Compose para o ambiente local

## Instalação

```bash
npm install
```

Copie `.env.example` para `.env` e configure as variáveis do ambiente.

## Banco de dados

```bash
npm run db:up
npm run migration:run
```

O schema é controlado por migrations. Mantenha `DB_SYNCHRONIZE=false`.

## Desenvolvimento

```bash
npm run start:dev
```

A API fica disponível em `http://localhost:4007/api`.

## E-mail da Hostinger na AWS

Mesmo hospedada na AWS, a API envia pelas caixas da Hostinger usando SMTP. No
ambiente da API, configure:

```env
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=gerente@wearbubble.com.br
SMTP_PASSWORD=SENHA_DA_CAIXA_POSTAL
SMTP_FROM_EMAIL=contato@wearbubble.com.br
SMTP_FROM_NAME=Wear Bubble
```

`SMTP_USER` deve ser a caixa postal principal, não um alias. O remetente visível
pode continuar sendo definido por `SMTP_FROM_EMAIL`. Use a senha da caixa postal
principal e mantenha a saída TCP 465 liberada na AWS; a porta
não precisa ser aberta para entrada. O backend valida a conexão SMTP ao iniciar
e registra `SMTP conectado a smtp.hostinger.com:465` no log quando ela estiver
pronta. Em produção, credenciais ausentes causam erro explícito no envio em vez
de simularem sucesso.

## Swagger

Com a aplicação em execução, acesse:

```text
http://localhost:4007/api/docs
```

Execute `POST /api/auth/login` para autenticar pelo cookie HTTP-only. Também é
possível usar o botão **Authorize** com um Bearer JWT.

## Melhor Envio

Configure as variáveis `MELHOR_ENVIO_*` do `.env` apenas no backend. Gere uma
chave independente para criptografar os tokens OAuth:

```bash
openssl rand -base64 32
```

Com o gerente autenticado, abra a rota abaixo pelo mesmo domínio usado na
callback:

```text
GET /api/integrations/melhor-envio/oauth/authorize
```

O backend redireciona para o Melhor Envio, valida o `state` no retorno, troca o
`code` pelos tokens e os salva criptografados no PostgreSQL. Consulte o estado
da conexão em:

```text
GET /api/integrations/melhor-envio/status
```

## Imagens dos produtos

As galerias usam um bucket público do Supabase Storage. Configure somente no
backend:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=product-images
```

A chave `service_role` nunca deve ser enviada ao frontend. No primeiro upload,
o backend cria (ou publica) o bucket, limita os arquivos a 5 MB e aceita JPEG,
PNG e WebP. As imagens são redimensionadas e convertidas para WebP antes do
armazenamento.

## Asaas

As credenciais ficam somente no backend. Para produção, configure no provedor:

```env
ASAAS_ENV=production
ASAAS_API_KEY=$aact_prod_...
ASAAS_WEBHOOK_TOKEN=gere-um-segredo-com-pelo-menos-32-caracteres
ASAAS_INSTALLMENTS=3
ASAAS_USER_AGENT=WearBubble/2.1
```

`ASAAS_API_KEY` deve pertencer ao mesmo ambiente definido em `ASAAS_ENV`. O
cifrão inicial faz parte da chave e não pode ser removido. O checkout cria ou
reutiliza o cliente pelo CPF, gera cobranças Pix e processa cartões diretamente
pela API v3 do Asaas. O checkout deve ser servido exclusivamente por HTTPS em
produção, pois os dados do cartão trafegam até o backend e nunca são persistidos.

No painel do Asaas, crie um webhook com:

```text
URL: https://api.wearbubble.com.br/api/payment/webhook/asaas
Token de autenticação: o mesmo valor de ASAAS_WEBHOOK_TOKEN
Eventos: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_REFUNDED,
PAYMENT_PARTIALLY_REFUNDED e PAYMENT_DELETED
```

O token deve ter de 32 a 255 caracteres. O Asaas o envia no header
`asaas-access-token`, validado pelo backend antes de qualquer atualização.
Depois do deploy, valide `GET https://api.wearbubble.com.br/api/health` e os
fluxos completos primeiro no Sandbox.

### Cancelamento pelo painel

Pedidos pagos pelo Asaas podem ser estornados integralmente pelo gerente em:

```text
POST /api/payment/orders/:orderId/cancel
```

A API chama `POST /payments/:paymentId/refund` no ambiente configurado pelo
`ASAAS_ENV`. O pedido local somente muda para `canceled` após uma resposta de
sucesso do Asaas. Os eventos `asaas.refund.request` e `asaas.refund.response`
são registrados sem a API Key para auxiliar na homologação.

## Trocas, devoluções e Crédito Wear Bubble

O cliente autenticado solicita e acompanha o pós-venda pela área da conta. A
devolução por arrependimento é aceita em até 7 dias corridos após a entrega; a
troca voluntária, em até 30 dias. O motivo é obrigatório e o relato adicional é
opcional. Os endpoints principais são:

```text
POST /api/returns
GET  /api/returns/mine
POST /api/returns/:id/cancel
GET  /api/returns/credits/mine
GET  /api/credits/:code
```

O gerente opera a fila em `GET /api/returns`, informa manualmente o código e o
rastreio da logística reversa, registra recebimento e inspeção e conclui por
`POST /api/returns/:id/resolve`. Devoluções usam estorno parcial do Asaas quando
há valor pago pelo gateway. Trocas geram um Crédito Wear Bubble nominal, com
saldo parcial e validade de 180 dias. O frete grátis segue a regra geral da loja:
valor dos produtos após promoções, conjuntos e cupons a partir de R$ 199. O
desconto de pagamento via Pix não reduz essa base.
Se o crédito cobrir todo o pedido, nenhuma cobrança é criada no Asaas.

A geração automática da autorização de postagem pelo Melhor Envio ainda depende
do endereço operacional completo de origem/devolução. Até essa configuração, o
código de postagem e o rastreio são registrados pelo gerente no painel.

## Qualidade

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

## Produção

No primeiro deploy desta versao, habilite a execucao das novas migrations:

```env
NODE_ENV=production
DB_SYNCHRONIZE=false
DB_MIGRATIONS_RUN=true
```

Comandos recomendados no provedor:

```bash
npm ci && npm run build
npm run start:prod
```

Depois que as migrations tiverem sido aplicadas com sucesso, o
`DB_MIGRATIONS_RUN` pode continuar habilitado: o TypeORM ignora migrations que
ja constam na tabela de controle.
