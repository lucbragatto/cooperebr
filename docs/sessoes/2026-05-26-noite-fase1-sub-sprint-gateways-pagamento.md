# Sessão 26/05 noite — Fase 1 Sub-Sprint Gateways de Pagamento

## Origem

Sessão claude.ai 26/05 noite, após fechamento M26 (Adapter Banestes Cenário
Mínimo). Luciano enviou screenshot do painel `/dashboard/configuracoes/asaas`
apontando:

1. Painel admin Banestes nunca foi criado no M26 (escopo focado em backend).
2. Tela atual é específica Asaas — não escala pra Banestes/Sicoob/BB.

Decidiu refatorar pra "Gateways de Pagamento" genérica com pattern extensível
(lista de configurados + botão "+ Adicionar gateway"). Refatoração ANTES de
configurar sandbox Banestes — evita retrabalho de migrar do `.env` pro banco
depois.

Fase 1 read-only ampla rodou nesta sub-sessão e produziu o relatório em
`docs/relatorios/2026-05-26-fase1-sub-sprint-gateways-pagamento.md` (616
linhas, 14 seções).

## Achados centrais da Fase 1

- **`ConfigGateway` JÁ EXISTE** no `schema.prisma:1352` (`@@unique([cooperativaId, gateway])`,
  campo `credenciais Json` schemaless). Subutilizado — só 3 consumidores leem;
  só `Banestes.adapter:102` lê `credenciais.chavePix`.
- **🚨 Divergência ATIVA de dados:** `AsaasConfig.apiKey` (legado, sufixo `dfe8`,
  AES-256-GCM encrypted) ≠ `ConfigGateway.credenciais.apiKey` (sufixo `2776`,
  plain text). 2 fontes de verdade incoerentes. AsaasAdapter lê do legado;
  ConfigGateway só serve pra factory decidir adapter.
- **Encryption já existe** em `AsaasService.encrypt/decrypt` (AES-256-GCM com
  `ASAAS_ENCRYPT_KEY`). Recomendado extrair pra `CredentialsEncryptor`
  reutilizável + nova `GATEWAY_ENCRYPT_KEY`.
- **`.pfx` Banestes:** manter em disco (`/opt/certs/{tenantId}-{ambiente}.pfx`
  permissão 0600), path em `metadados.pfxPath`, senha encrypted em
  `credenciaisCriptografadas.pfxSenha`. Upload via UI valida senha antes de
  gravar.
- **Refator schema aditivo:** rename `credenciais` → `credenciaisCriptografadas`
  + add `metadados Json`. Migração com dry-run obrigatório (CLAUDE.md regra 6).

## Estimativa atualizada

**24-34h Code em 5 fases** (era 8-12h):

- F1 backend (módulo `gateways-pagamento-config/` + 8 endpoints + registry +
  encryptor + specs) — 8-12h
- F2 schema + dual-write Asaas — 3-4h
- F3 refator BanestesConfigService multi-tenant — 4-6h
- F4 frontend tela nova + redirect rota antiga + sidebar/wizard rename — 6-9h
- F5 migration dados + smoke E2E — 3h

Crescimento aconteceu porque relatório descobriu a divergência `AsaasConfig`
vs `ConfigGateway` (não conhecida antes), e exige dual-write durante
coexistência 30 dias pra não quebrar produção.

## Riscos catalogados

9 riscos (R1-R9) catalogados na §12 do relatório. Mais crítico:

- **R2: perda da `GATEWAY_ENCRYPT_KEY` = TODOS gateways ilegíveis.** Recovery
  exige 2 backups offline da chave master. Responsabilidade operacional do
  Luciano fora do sistema (papel + gerenciador senhas, por exemplo).

## Decisões técnicas TRAVADAS pelo orquestrador (5)

1. ✅ **Encryption opção (a):** `CredentialsEncryptor` reutilizável + nova
   `GATEWAY_ENCRYPT_KEY` (AES-256-GCM mesmo padrão Asaas). Opções (b)
   pgcrypto e (c) Azure Key Vault adiadas como D-novo-AI futuro.
2. ✅ **`.pfx` em DISCO** (não bytes no DB): `/opt/certs/{tenantId}-{ambiente}.pfx`
   permissão 0600, path + senha encrypted no DB.
3. ✅ **Coexistência `AsaasConfig` (legado) + `ConfigGateway` (novo) por 30 dias**
   com dual-write. Migração faseada segura.
4. ✅ **`ConfigGatewayPlataforma` ADIADA** (gateway que SISGD usa pra cobrar
   parceiros via FaturaSaas é outro escopo — sprint próprio futuro).
5. ✅ **Sicoob/BB FORA do registry até adapter real existir** (sem promessa
   vazia na UI).

## Decisão de produto TRAVADA pelo Luciano (1)

6. ✅ `@@unique([cooperativaId, gateway])` MANTIDO — 1 ambiente por gateway
   por tenant (CoopereBR escolhe sandbox OU produção pra cada gateway,
   troca via edição do ConfigGateway).

## Decisões PENDENTES (Luciano decide quando voltar do fórum)

- ❓ **ABORDAGEM** (3 opções apresentadas):
  - **Fatiar** — F1+F2+F3+F5 backend ~18-25h em 2-3 sessões; F4 frontend
    depois; Carolina paga via Postman antes do UI. (Recomendação orquestrador
    — velocidade pra Carolina pagar antes do polish UI)
  - **Completo 24-34h sequencial** — UI desde início, mais sessões, entrega
    coerente.
  - **Cortar pra mínimo extensível tabs estáticas (~8-12h)** — perde
    extensibilidade que Luciano explicitamente pediu.
- ❓ **TIMING** (depende da abordagem):
  - Próxima sessão Code já (F1 backend não depende do `.pfx` sandbox).
  - Esperar Luciano conseguir `.pfx` sandbox primeiro.
  - Pausa total mais longa.

## Status

**PAUSA TOTAL** — Luciano foi pro fórum 26/05 tarde-noite. Próxima sessão
abre apresentando 3 opções de abordagem + 3 opções de timing pra ele bater.

## Arquivos não tocados

ZERO código no repo CoopereBR nesta sub-sessão (após M26). Único arquivo
modificado fora do repo: memória do orquestrador em
`~/.claude/projects/C--Users-Luciano-cooperebr/memory/sprint_bot_autoatendimento_20_05.md`.

Arquivos criados nesta sub-sessão (commit 62ce291 + commit fechamento):
- `docs/relatorios/2026-05-26-fase1-sub-sprint-gateways-pagamento.md` (616 linhas)
- `docs/sessoes/2026-05-26-noite-fase1-sub-sprint-gateways-pagamento.md` (este)
- `docs/CONTROLE-EXECUCAO.md` (frase de retomada atualizada)

## Frase comandante

Próxima sessão Code abre com: ritual de abertura padrão + apresentar pro
Luciano as 2 decisões pendentes (abordagem + timing). Se ele escolher
"fatiar próxima sessão já", Code arranca F1 backend imediato. Se "completo",
Code arranca F1+F2+F3 numa sequência sólida. Se "cortar", Code volta pra
um plano menor (sem registry dinâmico). Pausa total se Luciano ainda
quiser respirar.
