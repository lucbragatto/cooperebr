# Fixtures de fatura — smoke test pipeline OCR

Esta pasta contém PDFs de fatura de concessionária usados pelo script
`backend/scripts/smoke-pipeline-fatura.ts` para validar que o pipeline OCR
extrai dados consistentes com fatura EDP real.

## Arquivos

- `edp-carol.pdf` — fatura EDP real
- `edp-carol-expected.json` — saída esperada do OCR quando processa o PDF acima.
  Gerada por `--update` e versionada no git pra servir de baseline.

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

1. Salvar PDF em `backend/test/fixtures/faturas/<nome>.pdf`
2. Ajustar `PDF_PATH` e `EXPECTED_JSON_PATH` no script (ou criar versão multi-fixture)
3. Rodar `--update` para gerar expected.json
4. Commitar os dois arquivos juntos
