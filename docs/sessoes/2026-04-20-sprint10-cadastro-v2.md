# Sprint 10 — Ativação CADASTRO_V2_ATIVO (20/04/2026)

## Objetivo
Ativar o feature toggle `CADASTRO_V2_ATIVO=true` para que o cadastro público (`POST /publico/cadastro-web`) crie Cooperado + UC reais em vez de apenas LeadWhatsapp.

## Investigação (Passo 1)
- V2 flow em `publico.controller.ts:288-460` está funcional
- Cria: Cooperado + UC + Motor proposta + Indicação + Convênio linking
- Bug encontrado: `termoAdesaoAceito` não era setado como `true` no create

## Bug corrigido
- **Arquivo:** `backend/src/publico/publico.controller.ts:340-341`
- **Problema:** `cadastroWebV2` não passava `termoAdesaoAceito: true` nem `termoAdesaoAceitoEm`
- **Fix:** 2 linhas adicionadas ao `data` do `prisma.cooperado.create`

## Testes E2E manuais (Passo 2)

| Cenário | CPF | Resultado | Verificações |
|---|---|---|---|
| DESCONTO (padrão) | sessão anterior | OK | Cooperado criado, modoRemuneracao=DESCONTO |
| CLUBE (aceitaClube=true) | 11122233396 | OK | modoRemuneracao=CLUBE, termoAdesaoAceito=true, termoAdesaoAceitoEm preenchido |
| Com ref=codigoIndicacao | 22233344405 | OK | cooperadoIndicadorId linkado, Indicacao criada com status PENDENTE |

Todos os cooperados de teste foram limpos após validação.

## Alterações
1. `backend/src/publico/publico.controller.ts` — +2 linhas (termoAdesaoAceito fix)
2. `backend/.env` — `CADASTRO_V2_ATIVO=true` (não versionado)
3. `docs/MAPA-INTEGRIDADE-SISTEMA.md` — Fluxo 1 atualizado de 65% → 85%

## Pendências Sprint 10
- [ ] Cron lembrete 24h para propostas pendentes de assinatura
- [ ] Envio de cópia assinada por email após assinatura
- [ ] Email D-3/D-1 antes do vencimento
- [ ] Teste E2E automatizado (Playwright)

## Retomada
```
Sprint 10 cadastro V2 está ativo e testado. Próximos itens: cron lembrete 24h, cópia assinada pós-assinatura, emails de vencimento. Ler docs/MAPA-INTEGRIDADE-SISTEMA.md para contexto completo.
```
