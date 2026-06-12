# Sessão Cowork 11/06/2026 — Concierge Tributário: mockup 10 telas + descoberta na série EXFISHES

## TL;DR (3-5 linhas)

Sessão Cowork longa que (i) fechou o mockup standalone do **Concierge Tributário** com 10 telas
(Lista, 4 casos reais, Leads, Upload, Super-admin, Landing, **+Fluxo WhatsApp**), (ii) catalogou
**Tese 5 — Enriquecimento sem causa + prescrição decenal STF 2024** (multiplica valores
recuperáveis 2-4×), (iii) corrigiu fator SELIC linear `1 + meses/12 × 0.04` em todos os cenários,
e (iv) **descobriu na 1ª passada das 14 faturas EXFISHES reais que a narrativa "transição GDIII
em mar/2026" do mockup está incorreta** — EXFISHES já estava no SCEE desde jan/2025 (provavelmente
out/2024). Parser parou com 3 bugs identificados, retomada amanhã.

## Entregas — Mockup HTML Concierge

Arquivo: `docs/concierge/mockups/2026-06-11-mockup-telas-concierge.html` (1342 linhas, 10 telas).

- Tela 1: Lista de cooperados auditados (4 casos)
- Tela 2: Laurentino (B1 GD, Tese 3) — R$ 126,91/mês indébito
- Tela 3: Sinergia (A4 usina, Tese 2 ICMS + PIS/COFINS) — R$ 2.094,56/mês
- Tela 4: EXFISHES (B3 GDIII, Tese 3) — R$ 2.515,24/mês [⚠️ premissa do "antes de GDIII"
  precisa ser revisada após análise das 14 faturas reais]
- Tela 5: Guilherme ELFSM (caso "sem indébito" — concessionária que aplica correto;
  ratificação da Tese 3)
- Tela 6: Leads recebidos (admin) — gestão dos leads que entraram via landing/WA
- Tela 7: Upload manual (admin entra com fatura sem passar pelo bot)
- Tela 8: **Fluxo WhatsApp** — organograma com 9 estados sequenciais + 4 estados auxiliares
  + estimativas de funil (OCR sucesso 92%, cadastro 45%, adesão 25%, pagamento 20%)
- Tela 9: Super-admin (CoopereBR ativada no Concierge)
- Tela 10: Landing pública (com seção "imprensa" e formulário de captação)

Todos os 4 casos recalculados com SELIC linear correto:

| Caso | Mensal | 60m | 120m (Tese 5) | 120m × dobro CDC |
|---|---|---|---|---|
| Laurentino | R$ 126,91 | R$ 9.138 | R$ 21.321 | R$ 42.642 |
| Christiane | R$ 397,00 | R$ 28.598 | R$ 66.696 | R$ 133.392 |
| Sinergia | R$ 2.094,56 | R$ 150.808 | R$ 351.886 | R$ 703.772 |
| EXFISHES | R$ 2.515,24 | R$ 181.097 | R$ 422.560 | R$ 845.121 |

## Entregas — Specs e documentos

- `docs/concierge/2026-06-11-tese-5-enriquecimento-sem-causa-decenal.md` — Tese 5 STF
  (prescrição decenal + CDC dobro) catalogada com jurisprudência (Migalhas, Conjur, APET, TJDFT)
- `docs/concierge/2026-06-11-adendo-cenarios-multiplos-projecao.md` — substitui coleta de
  `dataInicioScee` por 5 colunas de projeção (12/24/36/48/60m). Cancela
  `D-novo-LEAD-CONCIERGE-DATA-SCEE` e `D-novo-OCR-AUTO-DETECT-SCEE`.
- `docs/concierge/2026-06-11-nota-tecnica-periodo-aplicacao-tese.md` — análise do problema
  original (janela efetiva). Substituído pelo adendo, mas mantido como histórico.
- `docs/arquitetura/2026-06-11-levantamento-tecnico-bot-whatsapp.md` — diagnóstico do módulo
  WhatsApp (51 estados + 14 services + 4 modelos Prisma) usado como base do organograma da
  Tela 8.
- `docs/concierge/2026-06-11-spec-c8-concierge-captacao-wa.md` — Spec C8 (funil de 9 etapas
  + 4 novos estados Concierge + LeadConcierge model)

## Entregas — Análise EXFISHES (PARCIAL — bugs no parser)

- `backend/scripts/exfishes-parser-v1-WIP.py` — parser pdfplumber inicial com bugs
  documentados pra retomada
- `docs/concierge/wip/exfishes-series-v1-WIP.json` — saída da primeira passada (14 faturas,
  série temporal incompleta)

## Débitos novos catalogados (pendentes)

- **D-novo-EXFISHES-PARSER-BUGS P0** — refinar regex pra extrair (1) TOTAL com decimais
  completos, (2) TUSD/TE injetada sem confundir com contrib ilum pública (R$ 200), (3)
  garantir indébito >= 0 (negativos = erro). Calibrar com ABR/2026 conhecido (R$ 2.515,24)
  antes de re-rodar.
- **D-novo-EXFISHES-NARRATIVA-GDIII-INCORRETA P0** — Tela 4 do mockup afirma "transição
  GDIII em mar/2026 — indébito antes era R$ 3.611/mês (90% da conta)". A 1ª fatura da
  série (FEV/2025) já mostra `oUC oPT 01/2025` com 53.574 kWh injetados e créditos
  recebidos 53.574,3014 kWh. **EXFISHES já estava no SCEE desde out/2024 ou antes.** A
  "fatura antes de GDIII" (R$ 3.997 mar/2026) provavelmente é uma fatura com SCEE menor
  naquele mês específico (saldo zerado ou anormalidade pontual), não pré-GDIII. Revisar
  narrativa do mockup antes de qualquer material enviado pro advogado.
- **D-novo-EXFISHES-SERIE-INCOMPLETA P1** — faltam faturas MAR/2025 e MAI/2025 (gap
  confirmado por MD5: triplicatas idênticas detectadas em MAR/2026 e ABR/2026, o "#2
  MAR2026" é cópia exata do "#14 MAR2026"). Luciano precisa puxar essas 2 do portal
  EDP-ES amanhã.
- **D-novo-CONCIERGE-CENARIOS-MULTIPLOS-UI P1** — implementar tabela de 5 colunas na
  tela de cooperado (substituindo a UI conjectural de coleta de data SCEE).

## Débitos resolvidos / cancelados

- `D-novo-LEAD-CONCIERGE-DATA-SCEE` **CANCELADO** (substituído por cenários múltiplos)
- `D-novo-OCR-AUTO-DETECT-SCEE` **CANCELADO** (substituído por cenários múltiplos)
- `D-novo-CONCIERGE-JANELA-EFETIVA` **REBAIXADO P0→P2** (perdeu urgência com adendo)
- `D-novo-SELIC-FATOR-FIXO-MOCKUP` **RESOLVIDO** (mockup atualizado com fator linear)

## Bugs descobertos durante validação

- **Mockup PDF anterior (versão 22:16)** aplicava fator SELIC fixo 1,20 nos cenários 84m,
  108m e 120m da Via 2 — só o 60m estava certo por coincidência (fator 1,20 bate). Versão
  22:34 corrigida com fator linear `1 + meses/12 × 0.04` (60m→1,20; 84m→1,28; 108m→1,36;
  120m→1,40). Impacto: +16,7% no teto Via 2 do EXFISHES.

## Decisões catalogadas

- **DEC-001:** Mockup standalone HTML (não componente React) — é material de pitch comercial
  + ferramenta visual pro advogado parceiro, não código de produção. Decisão técnica unilateral
  (Luciano: "eu não entendo de programação você que tem que sugerir as coisas mais corretas").
- **DEC-002:** Cenários múltiplos (12/24/36/48/60m + 84/108/120m + 120m×2) substituem coleta
  de `dataInicioScee` — elimina 3 carry-overs + 1 schema delta + 1 fricção no funil WA.
- **DEC-003:** Tese 5 STF decenal vira **multiplicador de janela** no detector (não tese
  independente) — porque amplia o prazo de qualquer tese tributária subjacente.
- **DEC-004:** Apresentar **2 vias** (tributária 5 anos + consumerista 10 anos com dobro CDC)
  em todos os casos do mockup — transparência radical evita frustração.
- **DEC-005:** Storage de fatura de lead = `backend/storage/leads-concierge/<uuid>.pdf`
  (decisão técnica do path para Spec C8).

## Pendências abertas pra próxima sessão

1. **Refinar parser EXFISHES** (3 bugs) e rodar nas 14 faturas reais
2. **Calibrar parser com ABR/2026** (deve dar R$ 2.515,24 — valor confirmado no mockup)
3. **Investigar marco real do SCEE** (qual mês mais antigo no histórico EXFISHES?)
4. **Corrigir Tela 4 do mockup** (narrativa "transição mar/2026" errada)
5. **Gerar dossiê EXFISHES consolidado** + planilha XLSX para advogado
6. **Pedir Luciano puxar MAR/2025 e MAI/2025** do portal EDP-ES (gaps na série)
7. **Verificar se há material já enviado** pro advogado que contém narrativa "transição
   mar/2026" — se sim, corrigir antes de qualquer próximo contato

## Próximo passo único e claro

**Refinar parser EXFISHES (3 bugs identificados em `backend/scripts/exfishes-parser-v1-WIP.py`)
e calibrar contra ABR/2026 (deve dar exatamente R$ 2.515,24 de indébito Tese 3) antes de
re-rodar nas 14 faturas reais e gerar dossiê consolidado.**

## Commits desta sessão

Sessão Cowork — paralelo ao Code (que estava rodando M31 Sprint Clube). NÃO commitamos via
Code. Luciano fará commit cirúrgico via PowerShell em terminal separado.

Comando para commit cirúrgico (PowerShell, terminal SEPARADO do Code):

```powershell
cd C:\Users\Luciano\cooperebr
git status
git add docs/concierge/mockups/2026-06-11-mockup-telas-concierge.html
git add docs/concierge/2026-06-11-tese-5-enriquecimento-sem-causa-decenal.md
git add docs/concierge/2026-06-11-adendo-cenarios-multiplos-projecao.md
git add docs/concierge/2026-06-11-nota-tecnica-periodo-aplicacao-tese.md
git add docs/concierge/2026-06-11-spec-c8-concierge-captacao-wa.md
git add docs/concierge/wip/exfishes-series-v1-WIP.json
git add docs/arquitetura/2026-06-11-levantamento-tecnico-bot-whatsapp.md
git add backend/scripts/exfishes-parser-v1-WIP.py
git add docs/sessoes/2026-06-11-cowork-concierge-mockup-completo-e-exfishes-16faturas.md
git add docs/CONTROLE-EXECUCAO.md
git commit -m "docs(concierge): mockup 10 telas + Tese 5 STF + SELIC linear + WIP parser EXFISHES 14 faturas"
git push origin main
```
