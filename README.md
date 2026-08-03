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

## PagBank

As credenciais ficam somente no backend. Para producao, configure no provedor:

```env
PAGBANK_ENV=production
PAGBANK_TOKEN=
PAGBANK_PUBLIC_KEY=
PAGBANK_WEBHOOK_URL=https://api.wearbubble.com.br/api/payment/webhook/pagbank
PAGBANK_INSTALLMENTS=3
```

`PAGBANK_TOKEN` deve ser um token de producao. `PAGBANK_PUBLIC_KEY` e opcional:
quando ela estiver vazia, `GET /api/payment/public-key` consulta a chave
vinculada a conta e cria uma pela API do PagBank caso ainda nao exista.

Depois do deploy, valide:

```text
GET https://api.wearbubble.com.br/api/health
GET https://api.wearbubble.com.br/api/payment/public-key
```

O segundo endpoint deve responder com `publicKey` e
`environment: "production"`, sem expor o token secreto.

### Cancelamento pelo painel

Pedidos pagos pelo PagBank podem ser estornados integralmente pelo gerente em:

```text
POST /api/payment/orders/:orderId/cancel
```

A API envia o valor total em centavos para
`POST /charges/:chargeId/cancel` no ambiente configurado pelo
`PAGBANK_ENV`. O pedido local somente muda para `canceled` após uma resposta
de sucesso do PagBank. Os eventos `pagbank.cancel.request` e
`pagbank.cancel.response` são registrados sem o token de autorização para
auxiliar na homologação.

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
