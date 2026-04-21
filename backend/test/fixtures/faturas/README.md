# Fixtures de fatura — smoke test pipeline OCR

Esta pasta contém PDFs de fatura de concessionária usados pelo script
`backend/scripts/smoke-pipeline-fatura.ts` para validar que o pipeline OCR
extrai dados consistentes com fatura EDP real.

## Arquivos

PDFs de fatura EDP real (input):

- `edp-carol.pdf` — B1 residencial, sem GD, sem compensação
- `edp-moradas-enseada.pdf` — B3 comercial (condomínio), sem GD
- `edp-luciano-gd.pdf` — B1 residencial, **COM compensação GD** (créditos injetados)

Fixtures de saída esperada (uma por PDF):

- `edp-carol-expected.json`
- `edp-moradas-enseada-expected.json`
- `edp-luciano-gd-expected.json`

Gerados por `--update`, versionados no git como baseline.

**Privacidade:** os PDFs contêm dados pessoais reais (CPF, endereço, UC, titular).
Hoje o repositório é privado. **Antes de tornar público ou dar acesso externo,
anonimizar todos os PDFs** (ver ticket pendente na Sprint 6/7).

## Uso

```bash
# Modo híbrido (default): chama OCR e compara com fixture
npx ts-node backend/scripts/smoke-pipeline-fatura.ts

# Modo economia: NÃO chama OCR, só valida que arquivos existem
npx ts-node backend/scripts/smoke-pipeline-fatura.ts --cached

# Regenerar fixture (quando OCR mudou intencionalmente)
npx ts-node backend/scripts/smoke-pipeline-fatura.ts --update
```

## Campos críticos

Divergência nesses campos faz o smoke test falhar (exit code 2):

- `numeroUC`
- `consumoAtualKwh`
- `totalAPagar`
- `creditosRecebidosKwh`
- `mesReferencia`

Outros campos (bairro, cep, etc) geram warning mas não bloqueiam.

## Quando rodar

- **Antes de destravar T9** (`BLOQUEIO_MODELOS_NAO_FIXO=false`) — valida que OCR
  ainda processa faturas reais antes do sistema gerar cobrança em produção.
- **Após mudanças em `faturas.service.ts` extrairOcr()** — detecta regressão.
- **Após mudança de modelo Anthropic** — valida que modelo novo mantém
  consistência da extração.

## Adicionando mais faturas

1. Salvar PDF em `backend/test/fixtures/faturas/<nome>.pdf` (sem espaços, lowercase)
2. Rodar `--update` — script detecta automaticamente novos PDFs
3. Revisar o JSON gerado
4. Commitar PDF + expected.json juntos
