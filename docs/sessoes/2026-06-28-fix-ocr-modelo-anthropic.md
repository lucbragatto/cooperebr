# Sessão 2026-06-28 — Fix OCR: modelo Anthropic aposentado (bug descoberto em E2E do funil)

> **Fechamento retroativo** feito em 2026-07-01 durante o ritual de retomada da sessão seguinte —
> a sessão do dia 28/06 empurrou um commit sem doc-sessão correspondente, violando a regra
> inegociável bilateral de 13/05/2026 (`regra_fechamento_sessao_inegociavel.md`). Doc curto no
> formato de "sessão de manutenção".

## TL;DR (pra leigo)
Descobrimos que o **leitor automático de faturas (OCR)** estava quebrado há um tempo — usava um
modelo da Anthropic que foi **desligado**. Toda fatura que entrava por cadastro público ou pelo
pipeline de email caía silenciosamente pro modo manual (sem sinal de erro pra ninguém). Trocamos
pelo modelo atual (`claude-sonnet-4-6`) e ainda deixamos a escolha **configurável por variável
de ambiente** pra evitar re-quebrar da próxima vez que a Anthropic aposentar um modelo. Testamos
ponta-a-ponta com a sua própria fatura EDP-ES e o OCR extraiu tudo (nome/CPF/UC/distribuidora/
consumo/histórico/créditos) corretamente.

## Entregas + SHA
- **1 commit direto no `main`:** `443ea09 fix(ocr): modelo Anthropic configuravel + atual (claude-sonnet-4-6)`.
- **6 arquivos alterados** (+14/-6):
  - `backend/src/faturas/faturas.service.ts` — `CLAUDE_MODEL = process.env.OCR_MODEL || 'claude-sonnet-4-6'`
  - `backend/.env.example` — documenta variável `OCR_MODEL`
  - 4 scripts concierge — literal antigo → `claude-sonnet-4-6`:
    - `concierge-levantamento-universo.ts`
    - `processar-pasta-pdfs-concierge.ts`
    - `reocerizar-fatura-concierge.ts`
    - `retry-falhas-concierge.ts`

## Contexto do bug
- Bug descoberto pelo **orquestrador** ao rodar teste E2E do funil de captação (frente
  recomendada da FRASE DE RETOMADA do M52b — `docs/relatorios/2026-06-23-investigacao-funil-captacao-roteador-m48.md` §7).
- O `faturas.service.ts` chumbava `claude-sonnet-4-20250514` (modelo aposentado pela
  Anthropic). Chamada retornava `404 not_found` → toda fatura falhava no cadastro público +
  no pipeline IMAP → cadastro caía no **fallback manual silencioso**.
- Fix espelha o padrão já existente do CoopereAI (`COOPEREAI_MODEL`): variável de ambiente
  com default atual. **Evita re-quebrar** na próxima aposentadoria de modelo.

## Verificação E2E
Upload `edp-luciano-gd.pdf` no cadastro público:
- ✅ OCR extraiu nome
- ✅ OCR extraiu CPF
- ✅ OCR extraiu UC
- ✅ OCR extraiu distribuidora
- ✅ OCR extraiu consumo
- ✅ OCR extraiu histórico
- ✅ `temCreditosInjetados=true`

## Débitos
- **Nenhum novo.** Fix cirúrgico, não introduz débito.
- **Nenhum resolvido formalmente** — bug latente sem catalogação prévia.

## Decisões
- Padrão env-configurável em toda integração com modelos da Anthropic (espelha
  `COOPEREAI_MODEL`). Regra tácita: **nunca chumbar modelo no código**.

## Pendências abertas
- **Próximo passo único** permanece o da FRASE DE RETOMADA do M52b: **escolha do Luciano
  entre 4 frentes** (E2E integral do funil / 3 portas de config / vitrines do funil / M52c
  escrituração retrospectiva). Este fix é lateral e não altera a escolha pendente.
- **Doc-sessão retroativa** fechada em 2026-07-01 — recomenda-se atenção especial ao ritual
  de fechamento canônico bilateral (13/05/2026) mesmo em fixes pequenos: **todo commit
  push-ado no main precisa de doc-sessão correspondente**, sob pena de perda de
  rastreabilidade narrativa.

## Próximo passo
Aguardando escolha do Luciano entre as 4 frentes da FRASE DE RETOMADA do M52b.
