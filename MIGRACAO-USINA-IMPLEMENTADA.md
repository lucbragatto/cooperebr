# Migração de Usina — Implementação Concluída (2026-03-26)

## Resumo
Módulo completo de migração de cooperados entre usinas, com histórico, geração de listas para concessionária e UI integrada.

## Arquivos Criados/Modificados

### Schema (Prisma)
- `backend/prisma/schema.prisma` — Adicionado enum `TipoMigracao` e model `MigracaoUsina` com relações em Cooperado e Cooperativa
  - Tipos: `MUDANCA_USINA`, `AJUSTE_KWH`, `SAIDA_USINA`, `MIGRACAO_TOTAL_USINA`
  - Campos: cooperadoId, usinaOrigem/Destino, contratoAntigo/Novo, kWh/percentual anterior e novo, motivo, realizadoPorId

### Backend — Serviço
- `backend/src/migracoes-usina/migracoes-usina.service.ts`
  - `migrarCooperado()` — Encerra contrato antigo, cria novo na usina destino, valida capacidade (SERIALIZABLE), registra histórico, envia WhatsApp, gera listas
  - `ajustarKwh()` — Atualiza kWh/percentual no contrato ativo, valida capacidade, registra histórico, envia WhatsApp
  - `migrarTodosDeUsina()` — Loop por todos os contratos ativos da usina origem, migra cada um com delay de 100ms entre WA, retorna relatório de sucesso/falhas
  - `gerarListaConcessionaria()` — Retorna JSON + CSV com todos os cooperados ativos da usina
  - `gerarRelatorioDualLista()` — Gera listas simultâneas para 2 usinas (útil em migração)
  - `historicoCooperado()` / `historicoUsina()` — Consultas de histórico

### Backend — Controller
- `backend/src/migracoes-usina/migracoes-usina.controller.ts`
  - `POST /migracoes-usina/cooperado` — ADMIN+
  - `POST /migracoes-usina/ajustar-kwh` — ADMIN+
  - `POST /migracoes-usina/usina-total` — SUPER_ADMIN only
  - `GET /migracoes-usina/lista-concessionaria/:usinaId` — ADMIN/OPERADOR+
  - `GET /migracoes-usina/dual-lista?usinaOrigemId=&usinaDestinoId=` — ADMIN+
  - `GET /migracoes-usina/historico/:cooperadoId` — ADMIN/OPERADOR+
  - `GET /migracoes-usina/historico-usina/:usinaId` — ADMIN/OPERADOR+

### Backend — Módulo
- `backend/src/migracoes-usina/migracoes-usina.module.ts` — Importa ContratosModule, UsinasModule, WhatsappModule
- `backend/src/app.module.ts` — Registrado MigracoesUsinaModule

### Frontend — Detalhe da Usina
- `web/app/dashboard/usinas/[id]/page.tsx` — Adicionado:
  - Card "Migração de Usina" com 3 botões: Migrar cooperado, Ajustar kWh, Migrar todos
  - Dialog "Migrar Cooperado" — select cooperado, usina destino, novo kWh, motivo
  - Dialog "Ajustar kWh" — select cooperado, novo kWh, motivo
  - Dialog "Migrar Todos" — select usina destino, motivo, alerta destrutivo, relatório de falhas
  - Card "Histórico de Migrações" — tabela com data, tipo, motivo, kWh anterior/novo

### Frontend — Listas Concessionária
- `web/app/dashboard/usinas/listas/page.tsx` — Nova página com:
  - Tabela de todas as usinas com capacidade, alocação, % uso, total cooperados
  - Barra de progresso visual para ocupação
  - Alertas para usinas com capacidade excedida
  - Botão de download CSV por usina
  - Badges: OK / Alta ocupação / Excedida
- `web/app/dashboard/layout.tsx` — Adicionado link "Listas Concessionária" no menu lateral

## Validação
- `prisma db push` — OK (schema sincronizado com banco)
- `npx tsc --noEmit` — 0 erros
- `prisma generate` — Aguarda reinício do dev server (DLL locked)
