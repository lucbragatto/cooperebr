# Sessão 15/06/2026 — Concierge Parecer Jurídico + Teses 9 e 10 + Seções IX e X + Detector DNU

## TL;DR

Sessão maratona (~10h) entregou:
- **Detector Demanda Não Utilizada** (novo) implementado no Concierge com filtro Grupo A + DEMANDA_CONTRATADA + DEMANDA_NAO_UTILIZADA, refinamento Tese 4 GERAR (filtro TUSD_G);
- **Análise de 11 faturas** validando os 7 detectores + DNU em produção (R$ 25.122/mês = R$ 1.884.153 em 60m+SELIC mapeados);
- **Parecer jurídico-tributário formal** (16k palavras) tese-a-tese pra advogado parceiro;
- **Descoberta crítica do Luciano**: 4 faturas dele mostram alíquotas PIS/COFINS variando mês-a-mês (4,90% → 7,07% → 6,40% → 5,26%), provocando **2 teses NOVAS** (Tese 9 anti-isonomia inter-cliente + Tese 10 variabilidade temporal);
- **Adendo extenso ao parecer** com 4 grandes blocos novos (Tese 10, Unificação Geradoras como bloco, Seção IX cumulatividade + 3 cenários por regime tributário, Seção X legitimidade ativa por tese + estratégia processual de 5 ações);
- **Insight estratégico decisivo**: Cliente Lucro Real pode PERDER ganhando Tese 3 (por estorno de crédito) — análise prévia EFD-Contribuições obrigatória para EXFISHES, Sinergia e cooperativa antes de ajuizar.

**Indébito mapeado consolidado refinado: R$ 297k (recuperação limpa PF/LP) até R$ 822k (contingente, se Lucro Real auditar favorável)**.

## Entregas + SHAs (commits a ser feitos no fechamento)

### Código de produção (módulo Concierge)
- `backend/src/concierge/fatura-canonica/fatura-canonica.types.ts` — tipo `DEMANDA_NAO_UTILIZADA` adicionado
- `backend/src/concierge/detectores/detectores.types.ts` — código `TESE_DEMANDA_NAO_UTILIZADA` adicionado
- `backend/src/concierge/fatura-canonica/edp-es.adapter.ts` — regex `Demanda\s+N[aã]o\s+Utilizada` (antes do genérico)
- `backend/src/concierge/detectores/detector-demanda-nao-utilizada.ts` (NOVO) — filtro Grupo A + DEMANDA_CONTRATADA + DEMANDA_NAO_UTILIZADA
- `backend/src/concierge/detectores/detector-tese4-gerar.ts` — refinamento filtro `ehUsina` (TUSD_G presente)
- `backend/src/concierge/detectores/detectores.registry.ts` — DetectorDemandaNaoUtilizada injetado (8 detectores total)
- `backend/src/concierge/concierge.module.ts` — provider registrado

### Documentação (massiva)
- `docs/concierge/pareceres/2026-06-15-parecer-tecnico-tributario-completo.md` (NOVO 16k palavras)
  - Parecer formal estilo doutorado em direito tributário
  - 8 teses individualizadas com fundamentação, cálculos, riscos
  - Comparativo EDP-ES × ELFSM × CEMIG (argumento "decoupling")
  - Estratégia processual federal+estadual
  - Cenários de cálculo realista (honorários + probabilidade)

- `docs/concierge/pareceres/2026-06-15-adendo-tese9-aliquotas-pis-cofins.md` (NOVO ~20k palavras)
  - Seções I-VI: Tese 9 (anti-isonomia inter-cliente)
  - Seção VII-bis: Unificação Bloco UCs Geradoras (CoopereBR I + II + Sinergia)
  - Seção VII-ter: Tese 10 (variabilidade temporal injustificada) — fundamentação CF/88 art. 150 I + III c
  - Seção IX: Cumulatividade + 3 cenários (PF / Lucro Presumido / Lucro Real)
  - Seção X: Legitimidade ativa individualizada por tese + estratégia 5 ações
  - Tabela final de recuperação esperada: R$ 297k–R$ 822k

- `docs/concierge/relatorios/2026-06-15-relatorio-sinergia-cooperebr-i-ii.md` (NOVO)
  - Análise comparativa Sinergia + CUSDs CoopereBR I+II como bloco homogêneo
  - Litisconsórcio ativo facultativo recomendado

- `docs/sessoes/2026-06-15-concierge-parecer-tese9-tese10-secoes-ix-x.md` (este arquivo)

## Bugs descobertos durante validação

- (não houve bugs de código — sessão focada em documentação técnico-jurídica)
- Bug de raciocínio detectado: minha estimativa inicial Tese 3 do Luciano (R$ 154/mês 14/06 manhã) errada por usar inferência sobre bases agregadas. Corrigido via re-OCR detalhado + patch detector base-declarada-fallback.

## Pendências abertas pra próxima sessão

1. **Implementar Tese 9 e Tese 10 como detectores no DetectoresRegistry** (criar `detector-tese9-anti-isonomia.ts` e `detector-tese10-variabilidade-temporal.ts`)
2. **Análise prévia EFD-Contribuições EXFISHES + Sinergia** — pode mudar viabilidade da Tese 3 (R$ 711k em jogo)
3. **Multi-adapter no script `processar-pasta-pdfs-concierge.ts`** (17 ELFSM parse falhou no 14/06) — usar `FaturaAdapterRegistry.obterAdapter()` em vez de `EdpEsFaturaAdapter` fixo
4. **Gerar versão consolidada DOCX** (parecer + adendo unidos) via skill docx
5. **Implementar UI Concierge MVP** (3 níveis: super-admin + admin parceiro + cooperado)
6. **Adapter CEMIG + ELFSM completo** (atualmente esqueletos)
7. **Auditar TOP 5 da pasta** (boa praça, LOJA 09/10, ILHA ALECRIM, etc) — pendência do dia 14
8. Mismatch cooperado.documento × fatura.titularDocumento (Leonardo Capucho com fatura EXFISHES) — pendência do 14

## Decisões catalogadas

### D15/06-1 — Filtro de aplicabilidade da Tese 4 GERAR
A Lei GERAR/ES 11.253/2021 aplica especificamente a UCs GERADORAS (não a consumidores Grupo A cativos sem GD). Detector exige presença de rubrica TUSD_G (Demanda Geração) como sinal de UC geradora. Refinamento feito no `detector-tese4-gerar.ts` em 14/06 noite, mantido no 15/06.

### D15/06-2 — Litisconsórcio Ativo Facultativo Geradoras
CoopereBR (Usinas I + II) + Consórcio Sinergia Ambiental compartilham identidade jurídica-tributária (Grupo A4, mesma alíquota 3,52%, mesmo tratamento SCEE). Devem figurar como litisconsortes em ação única estadual para ICMS (Teses 2 + 6 + 4).

### D15/06-3 — Tese 9 catalogada
Análise da fatura Pizzol revelou que EDP-ES aplica alíquotas PIS/COFINS distintas a clientes em situação equivalente, sem fundamento normativo. **Tese 9 (anti-isonomia inter-cliente)** criada, fundamentação CF/88 art. 150 II + Lei 9.430/96 art. 27 + STF Tema 745.

### D15/06-4 — Tese 10 catalogada
4 faturas consecutivas Luciano (DEZ/2025, FEV/2026, MAR/2026, ABR/2026) revelam variação de 4,90% → 7,07% → 6,40% → 5,26% no mesmo cooperado mesma UC. **Tese 10 (variabilidade temporal injustificada)** criada, fundamentação CF/88 art. 150 I + III c + art. 195 §6º + CTN art. 97 IV.

### D15/06-5 — Análise tributária prévia obrigatória para Lucro Real
Cliente Lucro Real (provável EXFISHES e Sinergia) credita 9,25% PIS/COFINS sobre energia (Lei 10.637 art. 3 IX + Lei 10.833 art. 3 IX). Vencer Tese 3 obriga estorno do crédito sobre parte indébita — resultado líquido pode ser NEGATIVO. **Decisão regra**: para cada cliente PJ Lucro Real, auditar EFD-Contribuições nos últimos 5 anos antes de ajuizar.

### D15/06-6 — Configuração processual ótima (5 ações)
Definida em Seção X.4 do adendo:
- 2 ações estaduais ES (MS + AO Repetição) — ICMS
- 2 ações federais (MS + AO Repetição) — PIS/COFINS
- 1 ação coletiva (Lei 7.347/85) — Tese 9 + 10 com efeitos erga omnes

## Próximo passo único e claro

**Implementar Tese 9 e Tese 10 como detectores algorítmicos no `DetectoresRegistry`:**
- `detector-tese9-anti-isonomia.ts`: compara alíquota efetiva da fatura X vs mediana das alíquotas observadas em UCs de mesmo grupo tarifário, mesma distribuidora, mesmo período (gatilho: desvio > 0,5% sobre a mediana)
- `detector-tese10-variabilidade-temporal.ts`: compara série histórica de alíquotas do mesmo cooperado, dispara se variação > 0,5% entre meses consecutivos sem alteração legislativa

**Em paralelo**: ler EFD-Contribuições da EXFISHES (se acessível via cooperado) para determinar regime tributário e calcular potencial de estorno — pode mudar materialmente a estratégia processual.
