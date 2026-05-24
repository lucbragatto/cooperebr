# Descoberta sistema legado SISGDSOLAR + pivot Sub-Sprint B — 25/05/2026

## Origem

Sessão claude.ai 24-25/05/2026, após fechamento M24 (Sprint Bot Autoatendimento INTEIRAMENTE FECHADO). Luciano sugeriu analisar `SISGDSOLAR-main.zip` como fonte do sistema legado pra resolver a pergunta-mãe que emergiu do Sub-Sprint B Fase 1: "onde estão os ~300 cooperados reais do cooperebr1 hoje?"

## Sistema legado descoberto

Stack: Java 11 + Maven + Spring + Hibernate + SQL Server (Azure SQL `sisgdsolar.database.windows.net`) + Azure App Service deploy `sisgdsolar-new/staging`. Time formal com Git flow, PRs, CI. Documentação viva (`docs/Backup_Banco_Sql.md` atualizado 28/02/2026, `Certificado_Banestes.md` 22/01/2026).

Backup completo do banco real reside no OneDrive do dev `hb06a`:
`C:\Users\hb06a\OneDrive\Documentos\Sisgdsolar\BACKUP BANCO SISGDSOLAR\TODO O BANCO\Script backup\script.sql`
Processo de restore Docker local totalmente documentado.

72 DAOs / 60+ tabelas Hibernate mapeadas. Procedures riquíssimas (~28+) contendo lógica de negócio madura (`atualizar_quitacoes`, `atualizar_saldo_usinas`, `gerar_fatura_unica_automatica_email_titular`, `sp_atualizar_parcela_kwh_consumido`, `sp_carga_dados_edp_usina`).

## Schema legado × schema novo (mapeamento essencial)

| Legado (SQL Server) | Nosso (Prisma/Postgres) |
|---|---|
| `tbl_beneficiario` | `Cooperado` |
| `tbl_benef_conta_energia` + `tbl_contaEdp` | `UC` |
| `tbl_benef_c_energia_hist` | `FaturaProcessada` |
| `tbl_usina` + `tbl_tipo_usina` + `tbl_usina_status_construcao` | `Usina` |
| `tbl_empresa_usina` (+ contrato_sistema) | Dono da usina (E-Solares) |
| `tbl_contrato` | `Contrato` |
| `tbl_parcela` + `tbl_pagamentos` + `tbl_cobranca` | `Cobranca` + relacionados |
| `tbl_concessionaria` | Enum `distribuidora` |
| `tbl_sistema_compensacao*` + `tbl_usina_css_*` | Sistema SCEE / compensação |
| `tbl_usina_energia_injetada_*_kwh` | Geração mensal |
| `tbl_regra_subtracao_kwh` | Regra de Fio B / desconto |
| `tbl_parametro_arrendamento` | Arrendamento usina |
| `tbl_certificado_banestes` + `tbl_log_webhook` | (faltam — adapter Banestes futuro) |
| `tbl_promocional` + `tbl_cupom_lista_parceiros` | CooperToken / cupons |
| `tbl_proposta` | `Proposta` (motor proposta) |
| `tbl_token_isolar` | Telemetria iSolar Cloud (não temos) |

Vocabulário legado: beneficiário = cooperado, parcela = cobrança.

## Banestes em produção (confirmado)

`SISGDSOLAR/docs/Certificado_Banestes.md` menciona arquivo `certificado_banestes_cooperebr_producao.pfx` e o processo de renovação via openssl + tabela `tbl_certificados`. CoopereBR JÁ usa Banestes em produção hoje via integração Java do legado.

## 🚨 ALERTA DE SEGURANÇA

`SISGDSOLAR/src/main/java/hibernate.cfg.xml` contém credencial do banco de produção em texto puro (user `hb_jv_bd_sis`, senha vazada). Risco crítico: qualquer pessoa que clone o repo do legado tem acesso direto ao Azure SQL de produção. Luciano vai avisar time legado pra trocar a senha e mover pra Azure Key Vault / variável de ambiente.

## Decisões tomadas nesta sessão

- ✅ **Banestes TRAVADO como gateway de produção** pro novo sistema. Replica o que já funciona no legado. Asaas continua como adapter alternativo (já validado em sandbox); Sicoob fica opção futura.
- ✅ **Extração tudo localmente** no PC do Luciano. Sem tocar produção do legado: backup script.sql → Docker SQL Server local → ETL offline.
- ✅ **Sub-Sprint B PIVOT**: muda de "saneamento dos 71 sintéticos" pra "ETL legado→novo + saneamento residual". Estimativa redesenhada: ~16-25h Code + 1-7 dias calendário (dominado por lead time externo do script.sql).
- ✅ Riscos da Fase 1 ampla do onboarding revisados:
  - Risco #1 classeGd: RESOLVIDO (Luciano confirmou cooperebr1 pré-07/jan/2023, direito adquirido, 0% Fio B até 2045). Banco com dados sintéticos.
  - Riscos #2-#5 (dados sintéticos / Asaas SANDBOX / backfill `tarifaContratual` / UCs `distribuidora=OUTRAS`): contemplados no Sub-Sprint B redesenhado.

## Pré-requisitos verificados no PC do Luciano

- Docker Desktop ✅ instalado (v29.4.3, container `tb-cooperebr` ativo na 8080)
- sqlcmd ❌ falta (instalar via `winget install --id Microsoft.Sqlcmd -e` quando for usar — ~1min)
- script.sql ❌ não está no PC — aguardar Luciano conseguir do hb06a
- Porta 1433 ✅ livre

## Estado atual: AGUARDANDO script.sql do hb06a

Luciano vai organizar a obtenção do script.sql em paralelo, opções:
- Pedir Generate Scripts fresco ao hb06a (~30min do lado dele, dados atuais)
- Pedir o backup OneDrive de 28/02 (mais rápido, dados 3 meses defasados)
- Pedir compartilhamento da pasta OneDrive (sync contínuo)

Quando script.sql estiver no PC: Code instala sqlcmd, sobe container SQL Server local, restaura backup, inspeciona dados reais da CoopereBR via queries SELECT, mapeia ETL legado→Prisma campo-a-campo, implementa scripts ETL idempotentes com DRY-RUN obrigatório.

## 4 frentes paralelas a Luciano escolher na próxima abertura

1. **Pausa total** — só retomar quando script.sql chegar.
2. **Sprint Housekeeping** (Code, ~3-5h) — limpa 12 débitos D-novo-U a AF acumulados no Sprint Bot.
3. **Sprint Bot Proativo — Fase 1 read-only ampla** (Code) — mapeia infra de bot proativo (lembrete pré-vencimento, webhook pagamento, escalonação inadimplência).
4. **Análise profunda código Banestes do legado** (Code) — mapeia o portado pro adapter `src/gateway-pagamento/banestes/`.

Frentes humanas em paralelo:
- Luciano avisa time legado pra trocar senha do Azure SQL + mover pra Key Vault
- Luciano: Sub-Sprint A (decisões regulatórias com advogado: Assinafy, segregação tributária)
- Luciano: solicitar script.sql ao hb06a

## Plano operacional Sub-Sprint B redesenhado

| Etapa | O que | Quem | Lead time |
|---|---|---|---|
| 0 | Conseguir script.sql do hb06a | Luciano | 1d - 1sem |
| 0 | Avisar time legado pra trocar senha Azure | Luciano | hoje |
| 1 | Instalar sqlcmd + subir container SQL Server local | Code | 30min |
| 2 | Restaurar script.sql no container | Code | 30-60min |
| 3 | Inspeção dados reais CoopereBR (SELECT) | Code | 1-2h |
| 4 | Mapear ETL legado→Prisma campo-a-campo (relatório) | Code | 3-5h |
| 5 | Implementar scripts ETL idempotentes + DRY-RUN | Code | 8-12h |
| 6 | DRY-RUN apresentado, Luciano valida amostras | Luciano + Code | 1-2h |
| 7 | Execução real (apply) no banco novo | Code | 1-2h |
| 8 | Validação cruzada pós-ETL | Code | 1-2h |

## Arquivos não tocados nesta sessão

ZERO código no repo CoopereBR. Único arquivo modificado:
`~/.claude/projects/C--Users-Luciano-cooperebr/memory/sprint_bot_autoatendimento_20_05.md` (memória orquestrador, fora do repo).

## Frase comandante

Próxima sessão Code abre com: ritual de abertura padrão + apresentar pro Luciano as 4 frentes paralelas + perguntar status do script.sql. Se script.sql disponível, arrancar Etapa 1 do plano Sub-Sprint B. Se não, esperar Luciano escolher 1 das 4 paralelas.

Frase canônica única em `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — local único, atualizada 25/05).
