# Sessão maratona 2026-05-16 — Bloco H' + Bloco C + Dossiê v1.1 + Templates + Reforma

## TL;DR

Sessão com 4 entregas principais: (1) Bloco H' fechado (M5) com schema Usina expandido + saneamentos AMAGES/Exfishes + UI cadastro condicional; (2) Bloco C fechado (M6) com Cadastro SEM_UC UI acessível em 2 caminhos (admin + público) — smoke 6/6 PASS; (3) Dossiê judicial CoopereBR × EDP v1.1 consolidado em 4 documentos (Frentes administrativa EDP, administrativa ANEEL, judicial TJES); (4) Repositório templates documentos refatorado em 3 camadas multi-tenant com 27 arquivos, incluindo reforma estatutária CoopereBR (AGE 17/06/2026 prevista) + spec módulo Compliance.

## Marcos entregues

- **M5** — Bloco H' Cadastro Usina expandido modularizado
- **M6** — Bloco C Cadastro SEM_UC UI
- Dossiê CoopereBR × EDP v1.1 (3 Frentes — EDP/ANEEL/TJES)
- Repositório templates documentos (3 camadas: por instituição → por tipo → por versão)
- Reforma estatutária CoopereBR (AGE 17/06/2026 prevista — edital + ata + estatuto v3)
- 2 sprints novos catalogados (Módulo Documentos 46h, Módulo Compliance 108h)

## Commits da sessão (cronológico)

| SHA | Mensagem |
|---|---|
| `2024b13` | feat(usinas): schema H' expandido (11 campos + 2 enums) |
| `15db027` | feat(canario): Bloco H' — saneamentos AMAGES + Exfishes + Cooperebr2 + apelidos |
| `9dada58` | feat(web): UI cadastro usina H' + docs fechamento Bloco H' |
| `ae708e3` | feat(publico): endpoint POST /publico/cadastro-sem-uc (Bloco C) |
| `22345ce` | feat(web): UI SEM_UC + badge + banners de redirect (Bloco C) |
| `5274920` | docs(juridico): dossie CoopereBR vs EDP v1.1 + 3 minutas (Frentes EDP/ANEEL/Judicial) |
| `b09acb2` | docs(templates): repositorio multi-tenant em 3 camadas + reforma estatutaria CoopereBR + spec compliance |
| *(este)* | docs(sessao): fechamento maratona 16/05 |

## Débitos novos catalogados

- **D-novo-D (P3)** — Definir `formaPagamentoDono` + valor concreto (`valorAluguelFixo` OU `percentualGeracaoDono`) para Cooperebr1, Cooperebr2 e demais 4 usinas históricas após acordo parceiro↔dono. UI já permite ajuste a qualquer tempo. Bloqueia apenas relatórios financeiros completos.
- **D-novo-E (P2)** — Reflexos sistêmicos pós-reforma estatutária CoopereBR (AGE 17/06/2026). 8-12h Code. Termo de Adesão atualizado + bot CoopereAI prompt atualizado + integração requisitos Compliance. Bloqueio: depende AGE acontecer.

## Débitos resolvidos

- **D-30B caso Exfishes** — saneamento aplicado (CTR-000134 com kwhContratoAnual=720.000 + percentualUsina=8% + usinaId migrado pra Cooperebr2). Tratamento regulatório completo aguarda Sprint Módulo Classificação GD pós-dossiê.
- **D-30L Fio B parcial** — RegrasFioB documentado como sprint futuro (Módulo Classificação GD, ~8-12h, plugável pós-dossiê judicial). Sistema permanece neutro sobre classificação enquanto litígio CoopereBR×EDP corre.
- **Estado dirty AMAGES** — `ambienteTeste: false → true` (Opção A confirmada Luciano). Preserva smoke histórico M4 + cobrança R$ 979,20.
- **Gap UI SEM_UC** — RESOLVIDO via 2 páginas dedicadas + endpoint público + badge listagem.

## Pendências abertas

- **HTML cadastro-usinas v1.1** (Luciano cola, claude.ai entregou conteúdo no chat)
- **Dossiê judicial — documentos pendentes:** acórdão completo Tema 986 STJ (REsp 1.692.023/MT etc.), despachos homologatórios ANEEL Cooperebr1/2 (datas exatas), contrato de adesão CoopereBR↔Exfishes (cláusula de realocação)
- **Aguarda AGE 17/06/2026** — reforma estatutária + ata aprovada
- **Confirmação CNPJ SISGDSOLAR** (49.950.705 vs 58.103.611)
- **Confirmação regime jurídico Sinergia** (Lei 6.404/76 vs 11.795/2008)

## Aprendizado catalogado

IAs externas hallucinaram 2× nesta sessão:
- Caminho fictício `sys/sisgdsolar/helpcontent/auditoria_estatutaria.md` (não existia no filesystem)
- Arquivos Gemini com testes Python tautológicos (`assert True`-equivalentes)

**Padrão observado:** conteúdo jurídico VÁLIDO + implementação técnica INVENTADA + tom "já existe" FALSO. Conduta correta: validar com filesystem real, preservar conceito jurídico, descartar código fictício. Memorizar como `aprendizado_ia_externa_halucinacao_16_05.md`.

## Plano A→H restante (262-310h Code = 11-14 sessões)

| Pos | Bloco | h | Critério |
|---|---|---|---|
| **4** | **D — 3 crons proativos** | **8-12h** | **PRÓXIMO** |
| 5 | B — Sprint CT Consolidado | 21-26h | Unifica vocabulário antes E/F/G |
| 6 | E — Realocação Multi-Usina | 16-24h | Depende H' (✅) + B |
| 7 | F — Automação Concessionária | 24-32h | Depende E |
| 8 | G — Sprint Assinafy | 12-16h | Independente |
| 9 | Sprint Módulo Documentos | 46h | Catalogado nesta sessão |
| 10 | Sprint Módulo Compliance | 108h | Catalogado nesta sessão, depende AGE 17/06 |
| 11 | Sprint Módulo Classificação GD | 8-12h | Pós-dossiê judicial |
| 12 | D-novo-E reflexos reforma | 8-12h | Pós-AGE 17/06/2026 |

## Próximo passo único

**Bloco D — 3 crons proativos** (8-12h Code). Frase comandante canônica única em `docs/CONTROLE-EXECUCAO.md` "FRASE DE RETOMADA" + replicada em "ONDE PARAMOS / Frase comandante (próxima sessão)".
