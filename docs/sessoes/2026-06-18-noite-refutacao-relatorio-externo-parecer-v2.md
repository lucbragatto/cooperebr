# Sessão 18/06/2026 Noite — Refutação Relatório Externo + Parecer v2

## TL;DR

Sessão de refutação técnico-jurídica disparada quando o Luciano recebeu um relatório externo intitulado "SISGD-Concierge v1.1" propondo recalibração radical do parecer de 15/06. Analisamos ponto a ponto, identificamos 6 contribuições válidas (ADI 7.195/DF, Convênio CONFAZ 16/2015, ADIs FCP, distinguishing Tema 986/STJ, alerta Lucro Real, checklist procedimental) e 6 proposições excessivas que foram REFUTADAS (extinção das Teses 9/10, substituição das teses tributárias pelo duplo custeio, expurgo de CDE e Gross-Up, afastamento da Tese 6 das piloto, cálculo "-3,99%" matematicamente incorreto, auto-titulação como v1.1). Emitido parecer v2 incrementando os patches válidos sem apagar versão antiga.

**Posição final**: portfólio de 10 teses tributárias MANTIDO + Tese 11 (Duplo Custeio Regulatório) ACRESCIDA = **11 teses no total**. Recuperação realista recalibrada para R$ 350.000–R$ 460.320 (de R$ 460.320), preservando magnitude de R$ 1.344.522 em 60m+SELIC.

## Entregas

### Documentos jurídico-tributários NOVOS (preservando antigos)
- `docs/concierge/pareceres/2026-06-18-refutacao-relatorio-sisgd-v1-1.md` (NOVO)
  - Refutação ponto a ponto em 3 blocos (A reconhecimentos, B refutações, C motivações implícitas)
  - Análise matemática da fórmula incorreta "-3,99%" do Lucro Real
  - Tabela de impacto econômico do estreitamento proposto (~R$ 596k de perda)

- `docs/concierge/pareceres/2026-06-18-parecer-v2-patches-incorporacao.md` (NOVO)
  - 6 patches formais com texto SUBSTITUIR / SUBSTITUIR POR
  - Tese 11 (Duplo Custeio Regulatório TUSD-G + Fio B) detalhada
  - Anexo Procedimental I (Checklist de Validação Prévia)
  - Recalibração econômica final tabulada

- `docs/concierge/pareceres/2026-06-18-sumario-executivo-v2.md` (NOVO)
  - Versão pós-refutação do sumário 18/06 manhã
  - 5 achados centrais + Tese 11
  - Alerta P0 corrigido sobre fórmula "-3,99%"

### Documentos PRESERVADOS (versão antiga intacta)
- `docs/concierge/pareceres/2026-06-15-parecer-tecnico-tributario-completo.md` ✓ intacto
- `docs/concierge/pareceres/2026-06-15-adendo-tese9-aliquotas-pis-cofins.md` ✓ intacto
- `docs/concierge/pareceres/2026-06-15-anexo-contabil-memorial-calculo.md` ✓ intacto
- `docs/concierge/pareceres/2026-06-18-sumario-executivo.md` (v1) ✓ intacto
- `docs/concierge/pareceres/2026-06-18-parecer-anonimizado-lgpd.md` ✓ intacto
- DOCX/PDF finais em OneDrive ✓ intactos (88 pp + 92 pp)

## Bugs descobertos durante análise

- (não houve bug de código — sessão 100% documental)
- **Bug de raciocínio detectado no relatório externo v1.1**: fórmula "-3,99% Prejuízo Líquido Cash" do Lucro Real está dogmaticamente incorreta — confunde plano da contabilidade interna da concessionária com plano da incidência tributária no consumidor final. Cliente Lucro Real credita 9,25% sobre o VALOR PAGO da fatura (insumo), não sobre o que a EDP recolheu. Risco do estorno existe como argumento defensivo fazendário, mas NÃO pode ser pré-determinado como prejuízo certo.

## Pendências abertas pra próxima sessão

1. **Encaminhar pacote consolidado ao advogado tributarista parceiro** com NDA:
   - Parecer 15/06 + Adendo + Anexo Contábil
   - Sumário Executivo v1 (18/06)
   - Refutação Técnica (18/06 noite)
   - Parecer V2 — Patches e Incorporações (18/06 noite)
   - Sumário Executivo V2 (18/06 noite)
   - Versão anonimizada LGPD (18/06 manhã)

2. **Apurar magnitude financeira da Tese 11** (Duplo Custeio Regulatório):
   - TUSD-G mensal cobrada das CUSDs I + II ([Cooperativa Solicitante]) e [Parceiro F]
   - Fio B mensal retido dos cooperados associados
   - Sobreposição financeira mensal × 60 meses

3. **Implementar Tese 9 e Tese 10 como detectores algorítmicos** no `DetectoresRegistry`
   - `detector-tese9-anti-isonomia.ts` (gatilho: desvio > 0,5% sobre mediana)
   - `detector-tese10-variabilidade-temporal.ts` (gatilho: variação > 0,5% mês a mês)

4. **Solicitar EFD-Contribuições** de [Cliente E] EXFISHES e [Parceiro F] — pode anular Tese 3 em R$ 711k

5. **Multi-adapter no script** `processar-pasta-pdfs-concierge.ts` (pendência 14/06)

6. **Adapter CEMIG completo + ELFSM completo**

7. **UI Concierge MVP**

## Decisões catalogadas

### D18/06-4 — REJEIÇÃO da substituição radical proposta pelo relatório externo
O relatório externo "SISGD-Concierge v1.1" propunha reduzir o portfólio do Concierge a:
- 1 tese tributária (Tese 2 TUSD-G)
- 1 tese regulatória (Duplo Custeio)
- Alertas Lucro Real

A redução acarretaria perda potencial de **~R$ 596 mil** em 60m+SELIC (44% do indébito mapeado). **Rejeitada.** Configuração ótima é INCORPORAR os patches válidos + MANTER portfólio amplo.

### D18/06-5 — INCORPORAÇÃO dos 6 patches válidos
- P-01: ADI 7.195/DF rebaixa Teses 2 e 6 para Médio-Alto
- P-02: ADIs FCP como reforço sistêmico, não fundamento direto
- P-03: Segregação Tese 6 por perfil (geradoras × consumidores)
- P-04: Tema 986/STJ — "distinguishing consolidado"
- P-05: Tese 11 (Duplo Custeio Regulatório) acrescida em PARALELO
- P-06: Checklist de validação prévia como Anexo Procedimental I

### D18/06-6 — REFUTAÇÃO matemática da fórmula "-3,99%" do Lucro Real
A fórmula proposta confunde planos da incidência tributária. Cliente PJ Lucro Real credita 9,25% sobre o VALOR PAGO (insumo válido na ocasião), independente do que EDP recolheu (5,26% efetivos). Risco do estorno existe como argumento defensivo fazendário, mas a quantificação determinística como prejuízo líquido cash é especulativa.

### D18/06-7 — Catalogação da Tese 11 (Duplo Custeio Regulatório TUSD-G + Fio B)
Natureza: Regulatória/Civil (não tributária). Tutela inicial: Consulta formal ANEEL → ACP federal em caso de inação. PARALELA e CUMULATIVA às teses tributárias 2/4/6, jamais em substituição.

### D18/06-8 — Preservação obrigatória de versões antigas
Toda atualização incremental dos pareceres Concierge deve **PRESERVAR a versão antiga**, criando documentos NOVOS com data de emissão própria. Justificativa: rastreabilidade auditável + autoria por sistema oficial v1.0 + facilita comparativo histórico para o advogado parceiro.

## Próximo passo único e claro

**Encaminhar pacote consolidado (parecer 15/06 + Refutação 18/06 + Parecer V2 18/06 + Sumário V2 18/06) ao advogado tributarista parceiro com NDA assinada, solicitando manifestação técnica formal antes do ajuizamento. Em paralelo, apurar magnitude financeira efetiva da Tese 11 (Duplo Custeio Regulatório) cruzando faturas das CUSDs com faturas dos cooperados associados.**
