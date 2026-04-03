# /apurar-excedente

Fluxo para apurar excedente de geração e processar cobranças do mês.

## Uso
```
/apurar-excedente <mes/ano>
```
Exemplo: `/apurar-excedente 04/2026`

## Passos

1. **Verificar faturas processadas**
   - Confirmar que todas as FaturaProcessadas do mês estão com status "Dados Conferidos"
   - Pendentes: avisar antes de continuar

2. **Executar apuração**
   - Módulo: `backend/src/modules/coopertoken/` (ou equivalente)
   - **CRÍTICO:** Verificar bug CTK-04 — loop pode pegar contrato errado
   - Usar `Math.round()` em todos os valores (CTK-01)

3. **Aplicar Fio B**
   - 2026: 60% do valor do Fio B
   - Fórmula: ver `.claude/rules/financeiro.md`

4. **Gerar cobranças**
   - Apenas para contratos com status `ATIVO`
   - Verificar se PIX Excedente está habilitado (`ASAAS_PIX_EXCEDENTE_ATIVO`)

5. **Validar resultado**
   - Soma dos percentuais por usina = 100% (ou menos)
   - Valores arredondados (sem centavos quebrados)
   - Nenhum cooperado `PROXY_*` (zumbi) incluído na apuração

## ⚠️ Bugs ativos que afetam este fluxo

- **CTK-01** — Sem Math.round (fix de 1 linha em `apurarExcedentes`)
- **CTK-04** — Loop pode pegar contrato errado
- **PIX-01** — PIX Excedente parado (flag não ativada em prod)
