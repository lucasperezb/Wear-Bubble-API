# Bubble Store Backend

API REST da Bubble Store construída com NestJS, TypeORM e PostgreSQL.

## Requisitos

- Node.js 20+
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

## Qualidade

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

## Produção

```bash
npm run build
npm run start:prod
```
