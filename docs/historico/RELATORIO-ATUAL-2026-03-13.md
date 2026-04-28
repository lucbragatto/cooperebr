# COOPERE-BR — Relatório de Desenvolvimento
**Data:** 13/03/2026 | **Último commit:** c35fb43

## Stack
- Backend: NestJS + TypeScript + Prisma + Supabase (São Paulo)
- Frontend: Next.js 16 + Tailwind + Shadcn/UI
- Banco: jsudavbqbirkirkendws.supabase.co
- Backend porta 3000, Frontend porta 3001
- Repositório: github.com/lucbragatto/cooperebr (privado)
- Pasta: C:\Users\Luciano\cooperebr

## Usuário de teste
- Email: teste@cooperebr.com | Senha: Coopere@123 | Perfil: ADMIN
- ID: cmmm3qjci0000uoy47b5phytl

## Para rodar
```bash
# Terminal 1
cd C:\Users\Luciano\cooperebr\backend && npm run start:dev

# Terminal 2
cd C:\Users\Luciano\cooperebr\web && npm run dev
```

## Rotas do Backend (39 rotas, todas protegidas por JWT)
- POST /auth/register, POST /auth/login, GET /auth/me
- POST /auth/facial/cadastrar, POST /auth/facial/verificar
- GET/POST/PUT/DELETE /cooperados, /cooperados/:id
- GET/POST/PUT/DELETE /ucs, /ucs/:id, GET /ucs/cooperado/:id
- GET/POST/PUT/DELETE /usinas, /usinas/:id
- GET/POST/PUT/DELETE /contratos, /contratos/:id, GET /contratos/cooperado/:id
- GET/POST/PUT/DELETE /cobrancas, /cobrancas/:id, GET /cobrancas/contrato/:id
- GET/POST/PUT/DELETE /ocorrencias, /ocorrencias/:id, GET /ocorrencias/cooperado/:id

## Tabelas do Banco
- usuarios (id, nome, email, cpf, telefone, perfil, fotoFacialUrl, supabaseId)
- cooperados (id, nomeCompleto, cpf, email, telefone, status)
- ucs (id, numero, endereco, cidade, estado, cep, cooperadoId)
- usinas (id, nome, potenciaKwp, cidade, estado)
- contratos (id, numero, cooperadoId, ucId, usinaId, percentualDesconto, dataInicio, dataFim, status)
- cobrancas (id, contratoId, mesReferencia, anoReferencia, valorBruto, valorDesconto, valorLiquido, dataVencimento, dataPagamento, status)
- ocorrencias (id, cooperadoId, ucId, tipo, descricao, status, prioridade, resolucao)

## Páginas do Frontend
- /login
- /dashboard — KPIs: total cooperados, UCs, usinas, cobranças pendentes
- /dashboard/cooperados — listagem + /novo + /:id (detalhe)
- /dashboard/ucs — listagem + /nova + /:id
- /dashboard/usinas — listagem + /nova + /:id
- /dashboard/contratos — listagem + /novo + /:id
- /dashboard/cobrancas — listagem + /nova + /:id
- /dashboard/ocorrencias — listagem + /nova + /:id

## O que está implementado ✅
- Autenticação JWT (register/login/me)
- Reconhecimento facial (upload + comparação por pixels com sharp)
- CRUD completo backend: cooperados, UCs, usinas, contratos, cobranças, ocorrências
- Painel web: login, dashboard, listagem, cadastro e detalhe de todas as entidades
- Seed de dados de teste (npm run seed no backend)
- Bucket fotos-faciais no Supabase Storage

## O que está pendente ❌
- Formulários de EDIÇÃO de registros (PUT /:id)
- Exclusão com modal de confirmação (DELETE /:id)
- Ações de cobrança: dar baixa, cancelar, emitir PDF
- Fluxo de cadastro via upload de fatura (OCR → pré-preenchimento)
- App mobile (React Native + Expo)
- Jobs automáticos de cobrança (BullMQ + Redis)
- Integração WhatsApp (Evolution API)
- Paginação e filtros nas tabelas
- Deploy produção (Railway + Vercel)
