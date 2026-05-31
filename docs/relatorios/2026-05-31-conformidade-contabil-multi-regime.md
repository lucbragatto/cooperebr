# Relatorio de Conformidade Contabil-Tributaria Multi-Regime — SISGD

**Data:** 31/05/2026
**Escopo:** Modulo `contabilidade-tributaria/` — 4 regimes (COOPERATIVA, CONSORCIO, ASSOCIACAO, CONDOMINIO)
**Frentes:** Contabilidade cooperativa + Financeiro + Tributario + Legal/Juridico/Regulatorio
**Risco geral consolidado:** ALTO — ha inconformidades P0 em todos os 4 regimes que podem gerar autuacao fiscal real ou erro de produto se implementadas com a logica atual.

---

## 1. Sumario Executivo

O modulo de contabilidade tributaria segregada (Sprint 8 do roadmap) foi especificado tendo como referencia o regime da COOPERATIVA. As outras tres formas juridicas suportadas pelo SISGD — CONSORCIO, ASSOCIACAO e CONDOMINIO — apresentam regimes tributarios e contabeis radicalmente distintos, e a aplicacao das regras cooperativas a esses tipos de parceiro constitui risco de conformidade grave.

Os quatro achados criticos (P0) que exigem decisao antes da implementacao sao:

**P0-1 — Isenção PIS/COFINS (STF Tema 536) e exclusiva de COOPERATIVA.** O motor tributario nao pode herdar essa isenção para CONSORCIO, ASSOCIACAO ou CONDOMINIO. Aplica-la indevidamente configura aproveitamento de beneficio fiscal sem fundamento legal — risco de autuacao com retroatividade de 5 anos (CTN Art. 173).

**P0-2 — CONDOMINIO nao e contribuinte de IRPJ/CSLL.** Se o modulo calcular IRPJ/CSLL para parceiros tipo CONDOMINIO, o sistema induzira o parceiro a recolher tributo inexistente (Parecer Normativo CST 76/1971).

**P0-3 — Repasse ao proprietario de usina (arrendamento externo) esta com `naturezaAto` default incorreto.** O default atual `COOPERADO_PROPRIO` classifica como ato cooperativo proprio uma operacao com terceiro nao-cooperado — o que a Receita Federal pode interpretar como simulacao de ato cooperativo para evitar tributacao.

**P0-4 — STF Tema 536 esta em julgamento no plenario fisico (maio/junho 2026).** O Min. Dias Toffoli abriu divergencia em 20/05/2026. O resultado pode alterar a base legal da isenção PIS/COFINS sobre ato cooperativo. A isenção deve ser implementada como parametro configuravel por parceiro, nao como regra hardcoded, para que o sistema possa ser ajustado sem refatoracao de arquitetura caso o STF modifique sua posicao.

Alem dos P0, ha 28 achados P1-P3 distribuidos pelos 4 regimes, detalhados nas secoes seguintes.

VALIDACAO EXTERNA RECOMENDADA antes de qualquer implementacao: contador Walter (classificacao de repasse ao proprietario de usina, regimes PIS/COFINS/IRRF por tipo de parceiro) + advogado tributarista (acompanhamento STF Tema 536, ICMS SCEE no ES) + advogado regulatorio ANEEL (sub-modalidades CONDOMINIO, Art. 655-P IV).

---

## 2. Regime COOPERATIVA (Lei 5.764/71)

### 2.1 Marco legal aplicavel

- Lei 5.764/71, Arts. 79 (ato cooperativo), 28 (fundos obrigatorios), 87-89 (sobras, resultado nao cooperativo)
- NBC ITG 2004 (CFC, 24/11/2017) — norma contabil especifica para cooperativas
- STF Tema 536 (RE 599.362/RJ) — isenção PIS/COFINS sobre ato cooperativo — ATENCAO: julgamento em andamento no plenario fisico em maio/junho 2026
- STJ Tema 986 (REsp 1.692.023/MT, acordao 29/05/2024) + ressalva SCEE (TJMT abr/2026, TJPR 2025)
- CRFB Arts. 5 XVIII, 146 III "c", 174 §2

### 2.2 Classificacao dos atos cooperativos no contexto GD

A NBC ITG 2004 item 6 exige segregacao obrigatoria por natureza de ato. A doutrina (com base no Art. 88 da Lei 5.764/71) identifica tres categorias praticas:

**Ato Cooperativo Proprio (Art. 79):** praticado entre cooperativa e cooperados para consecucao do objeto social. Exemplos no SISGD: cobranca mensal de energia SCEE ao cooperado; creditos de energia compensados ao cooperado; gestao do contrato cooperado-usina. Terminologia correta (NBC ITG 2004 item 7): "ingressos" (nao receitas) e "dispendios" (nao despesas). Esta distincao e tributariamente relevante — ingresso e dispendio de ato proprio nao sao fatos geradores de PIS/COFINS.

**Ato Cooperativo Auxiliar (Art. 88):** operacoes necessarias ao desenvolvimento das atividades cooperativas. Exemplos: convenio Hangar Academia (cooperado PJ que financia custeio); repasse de custeio de manutencao rateado entre cooperados. Para que o fluxo seja tratado como transito nao-tributado, precisam ser cumpridos simultaneamente: (a) objeto social — o convenio deve servir ao cooperado; (b) transparencia — valor repassado ao provedor identico ao arrecadado (soma zero sem margem); (c) documentacao contratual formal; (d) escrituracao segregada.

**Ato Nao Cooperativo (Art. 86):** toda operacao com terceiros nao-cooperados. Exemplos: recarga de eletropostos aberta ao publico geral; venda de excedente de energia a terceiro. Tributacao plena.

### 2.3 Tributacao

**PIS/COFINS:**

| Tipo de ato | Regime | Fundamento |
|---|---|---|
| Ato Proprio | Nao incide — ingresso nao e receita tributavel | Art. 79 Lei 5.764/71 + STF Tema 536 (ressalva: julgamento em curso) |
| Ato Auxiliar | Nao incide — transito contabil sem margem | Art. 88 Lei 5.764/71 |
| Ato Nao Cooperativo | PIS 0,65% + COFINS 3% (regime cumulativo) | Lei 9.715/98 + Lei 9.718/98 |

ALERTA CRITICO — STF Tema 536 (maio/junho 2026): em 20/05/2026 o Min. Dias Toffoli abriu divergencia no plenario fisico propondo que PIS/COFINS nao incide sobre atos cooperativos. A votacao esta em andamento e nao foi concluida. O resultado pode confirmar ou restringir a isenção para cooperativas de energia. A isenção DEVE ser implementada como flag configuravel por parceiro, nao como regra fixa, para acomodar eventual mudanca de posicao do STF sem refatoracao de arquitetura. VALIDACAO EXTERNA RECOMENDADA — advogado tributarista para acompanhamento mensal do julgamento.

**IRPJ/CSLL:**

| Tipo de resultado | IRPJ | CSLL |
|---|---|---|
| Sobras de ato cooperativo proprio | Isento (RIR/2018 Art. 182) | Isento (Lei 10.865/2004 Art. 39 §1) |
| Resultado de ato nao cooperativo | Tributado | Tributado |

**ICMS sobre SCEE:** o STJ Tema 986 fixou que TUSD e TUST integram a base de calculo do ICMS. Porem, a ressalva para o SCEE (credito de energia como emprestimo gratuito, nao circulacao de mercadoria) foi consolidada pelo TJMT (abr/2026) e TJPR (2025). O ICMS sobre a parcela compensada NAO deveria incidir. VALIDACAO EXTERNA RECOMENDADA — advogado para confirmar posicao do Estado ES (SEFAZ-ES).

**ISS:** ato cooperativo tipico nao e servico prestado a terceiro e nao tem "preco" no sentido fiscal — nao gera fato gerador de ISS. ISS incide apenas em servicos prestados a nao-cooperados.

### 2.4 Fundos obrigatorios (Art. 28 Lei 5.764/71)

**Texto literal do Art. 28:**

> "As cooperativas sao obrigadas a constituir: I — Fundo de Reserva destinado a reparar perdas e atender ao desenvolvimento de suas atividades, constituido com 10% (dez por cento), pelo menos, das sobras liquidas do exercicio; II — Fundo de Assistencia Tecnica, Educacional e Social destinado a prestacao de assistencia aos associados, seus familiares e, quando previsto no estatuto, aos empregados da cooperativa, constituido de 5% (cinco por cento), pelo menos, das sobras liquidas apuradas no exercicio."

Total minimo obrigatorio: 15% das sobras liquidas. Ambos os fundos sao classificados como Patrimonio Liquido (NBC ITG 2004, item 22), nao como passivo. O resultado de ato nao cooperativo vai integralmente para o FATES e e tributado (Art. 87 Lei 5.764/71).

### 2.5 Sequencia de apuracao de sobras

1. Ingressos de ato proprio − Dispendios de ato proprio = Sobras brutas de ato proprio
2. Receitas de ato nao cooperativo − Despesas de ato nao cooperativo − Tributos sobre ato nao cooperativo = Resultado de ato nao cooperativo (vai para FATES + tributado)
3. Sobras brutas − (10% Fundo de Reserva) − (5% FATES) − (fundos estatutarios) = Sobras a distribuir aos cooperados (pro-rata — Art. 89)

### 2.6 Repasse ao proprietario de usina — ponto critico P0

**Cenario A — Arrendamento (dono externo nao-cooperado):**

O repasse e despesa de ato nao cooperativo, NAO ato proprio. O default atual `COOPERADO_PROPRIO` e incorreto e representa risco de simulacao fiscal. A classificacao deve ser automatizada via `formaAquisicao`:

| formaAquisicao | proprietarioCooperadoId | Classificacao | Conta |
|---|---|---|---|
| PROPRIA | N/A | Sem repasse externo | N/A |
| CESSAO | Preenchido (cooperado) | Ato Proprio — Dispendio | 5.1.X Dispendio Operacional |
| ALUGUEL | Nulo (terceiro) | Ato Nao Cooperativo — Despesa | 7.1 Despesa Arrendamento |
| CESSAO | Nulo (terceiro nao-cooperado?) | AMBIGUO — bloquear ate Walter definir | — |

VALIDACAO EXTERNA OBRIGATORIA — Walter deve analisar os contratos reais de arrendamento (E-Solares e demais) antes de qualquer classificacao ser implementada.

**Cenario B — Cessao (dono e cooperado):**

O repasse ao cooperado-proprietario e dispendio de ato proprio. Porem, mesmo sendo ato cooperativo, o pagamento de renda ao cooperado-pessoa-fisica pode sujeitar-se a IRRF na fonte se caracterizado como aluguel (rendimento de capital). Este ponto e controvertido na doutrina. VALIDACAO EXTERNA RECOMENDADA — Walter confirmar IRRF.

Nota sobre NBC TG 06 (IFRS 16): contratos de arrendamento de usinas com prazo superior a 12 meses e valores significativos provavelmente exigem reconhecimento de ativo de direito de uso e passivo de arrendamento no balanco. VALIDACAO EXTERNA RECOMENDADA — Walter avalia obrigatoriedade para os contratos atuais da CoopereBR.

### 2.7 Estado atual no SISGD e achados

| # | Dimensao | Status | Severidade | Norma | Recomendacao |
|---|---|---|---|---|---|
| C1 | `naturezaAto` e String livre, nao enum tipado | NAO CONFORME | P0 | NBC ITG 2004 item 6 + Art. 79 Lei 5.764/71 | Migrar para enum `NaturezaCooperativa {PROPRIO, AUXILIAR, NAO_COOPERATIVO}` — migracao em 2 passos com auditoria dos 53 lancamentos |
| C2 | PIS/COFINS: nenhum motor de apuracao | NAO CONFORME | P0 | STF Tema 536 (julgamento em andamento) | Motor com isenção configuravel para PROPRIO; aliquota para NAO_COOPERATIVO; flag por parceiro |
| C3 | IRPJ/CSLL: nenhuma apuracao do ato nao cooperativo | NAO CONFORME | P1 | Art. 87 Lei 5.764/71 + RIR/2018 Art. 182 | Implementar apuracao separada; Walter define regime e percentuais |
| C4 | ICMS: sem motor de verificacao da ressalva SCEE | PARCIAL | P1 | STJ Tema 986 ressalva + TJMT/TJPR | Parametro configuravel por parceiro + alerta se ICMS incidir sobre compensacao |
| C5 | FATES + Fundo de Reserva: sem contas no PlanoContas | NAO CONFORME | P0 | Art. 28 Lei 5.764/71 | Contas de PL especificas + motor de destinacao de sobras |
| C6 | DRE: sem segregacao por natureza de ato | NAO CONFORME | P0 | NBC ITG 2004 item 12 | 3 DREs paralelas (ato proprio / auxiliar / nao cooperativo) + consolidada |
| C7 | Repasse arrendamento: default `COOPERADO_PROPRIO` | CRITICO — risco simulacao fiscal | P0 | Art. 79 vs. Art. 86 Lei 5.764/71 | Automatizar via `formaAquisicao`; bloquear ate Walter assinar |
| C8 | Terminologia: "Receita/Despesa" para ato proprio | NAO CONFORME | P1 | NBC ITG 2004 itens 3 e 7 | Mudar para "Ingresso/Dispendio" no plano de contas e DRE |
| C9 | IRRF sobre arrendamentos pagos | AUSENTE | P1 | RIR/2018 + Lei 15.270/2025 | Estender calculo de IRRF para pagamentos de arrendamento a PF/PJ |
| C10 | NBC TG 06 (arrendamentos): nao avaliado | AUSENTE | P2 | NBC TG 06 / IFRS 16 | Walter avalia obrigatoriedade para contratos de usina |

---

## 3. Regime CONSORCIO (Lei 6.404/76 + Lei 14.300/2022)

### 3.1 Marco legal aplicavel

- Lei 6.404/76, Arts. 278-279: consorcio de empresas (sem personalidade juridica propria; sem solidariedade)
- Lei 14.300/2022, Art. 1, III: consorcio de consumidores de energia eletrica (inovacao — permite PF + PJ; figura sui generis)
- Lei 12.402/2011 + IN RFB 1.199/2011: tributacao por proporcionalidade entre consorciados
- NBC T 10.20 (CFC, Resolucao 1.053/2005): escrituracao contabil propria, empresa lider responsavel
- CTN Art. 111 II: interpretacao literal de normas de isencao (vedada analogia com STF Tema 536)

### 3.2 Natureza juridica — zona cinzenta regulatoria

Ha dois tipos de consorcio relevantes para GD e sao juridicamente distintos:

**Tipo A — Consorcio de Empresas (Lei 6.404/76):** restrito a PJ; sem personalidade juridica propria; consorciados respondem individualmente pelas obrigacoes previstas no contrato.

**Tipo B — Consorcio de Consumidores GD (Lei 14.300/2022, Art. 1, III):** permite PF + PJ; figura juridica nova sem regime tributario especifico definido em lei. A Lei 14.300/2022 nao regulamentou o regime tributario completo — silencio que gera inseguranca juridica em 2026.

VALIDACAO EXTERNA RECOMENDADA — advogado regulatorio ANEEL deve confirmar qual modalidade Sinergia (e qualquer futuro parceiro CONSORCIO) se enquadra antes do onboarding.

### 3.3 Tributacao — principio da proporcionalidade

O consorcio NAO e sujeito passivo tributario autonomo. Cada consorciada apura e recolhe individualmente os tributos na proporcao de sua cota de participacao (IN RFB 1.199/2011 Art. 1):

> "As empresas integrantes de consorcio constituido nos termos dos arts. 278 e 279 da Lei 6.404 respondem pelos tributos devidos, em relacao as operacoes praticadas pelo consorcio, na proporcao de sua participacao no empreendimento."

**PIS/COFINS:**

NAO ha isenção equivalente ao STF Tema 536. O consorcio nao tem "ato cooperativo" — tentativa de aplicar Tema 536 ao consorcio viola o CTN Art. 111 II (interpretacao literal de isencoes). Regime aplicavel: Lucro Real (nao cumulativo) = PIS 1,65% + COFINS 7,6%; Lucro Presumido (cumulativo) = PIS 0,65% + COFINS 3%. Depende do regime das consorciadas.

**IRPJ/CSLL:**

Cada consorciada PJ apura proporcionalmente em suas proprias obrigacoes. Consorciado PF: apura no IRPF na declaracao de ajuste anual (sem mecanismo automatico equivalente ao IRPJ PJ). Nao ha isenção.

**ICMS:**

A ressalva STJ Tema 986 para o SCEE (emprestimo gratuito de energia, nao circulacao de mercadoria) aplica-se ao consorcio da mesma forma que a cooperativa — o fundamento e a natureza juridica do SCEE (REN 1.059/2023 Art. 655), nao a natureza cooperativa da entidade. Documentar este argumento explicitamente no sistema.

**ISS:**

Se o consorcio prestar servicos de gestao energetica, cobranca ou administracao para os consorciados, pode incidir ISS (LC 116/2003) — pois nao ha equivalente ao "ato cooperativo" que afaste a incidencia. Diferenca critica versus cooperativa.

### 3.4 O que NAO existe no consorcio

- Ato cooperativo: instituto exclusivo da Lei 5.764/71 Art. 79
- FATES e Fundo de Reserva legal: exclusivos de cooperativas (Lei 5.764/71 Art. 28)
- Sobras: no consorcio, o resultado positivo e lucro proporcional de cada consorciada, tributavel integralmente como IRPJ/CSLL

O plano de contas `consorcio.template.ts` NAO deve incluir contas de Sobras, FATES, Fundo de Reserva como obrigatorias — seria erro contabil. Deve incluir contas de "Resultado Proporcional por Consorciado", "Reserva Contratual" (se prevista no contrato) e "Lucros a Distribuir".

### 3.5 Arrendamento vs. Cessao no consorcio

A logica e estruturalmente diferente da cooperativa:

| Modalidade | Classif. consorcio | Tributacao | Diferenca vs. cooperativa |
|---|---|---|---|
| Arrendamento (dono externo) | Despesa operacional proporcional | IRRF sobre pagamento a PF/PJ (conforme regime) | Cooperativa pode tratar como ato auxiliar; consorcio: despesa tributavel |
| Cessao (dono e consorciado) — gratuita | Sem despesa — contribuicao ativa | Sem receita tributavel imediata | Na cooperativa e ato proprio; no consorcio e relacao contratual pura |
| Cessao (dono e consorciado) — onerosa | Despesa operacional | Receita tributavel para o cedente; IRPJ/IRPF proporcional | Idem — sem escudo cooperativo |

Na cooperativa, cessao de usina por cooperado-dono pode ser caracterizada como ato cooperativo auxiliar (Art. 79 — contribuicao para consecucao do objeto social). No consorcio, essa mesma cessao onerosa e pura relacao contratual com incidencia tributaria plena.

### 3.6 Escrituracao (NBC T 10.20)

A NBC T 10.20 (CFC, Resolucao 1.053/2005) exige:

1. Contabilidade propria do consorcio, distinta das empresas consorciadas
2. Empresa lider responsavel pela escrituracao e guarda dos livros
3. Demonstracoes contabeis conforme NBC T 6
4. Notas Explicativas: metodologia de reconhecimento receitas/custos/despesas por contrato e criterios de encerramento

O SISGD nao tem hoje campo para "consorciado proporcional" ou "empresa lider" no livro caixa. O template `consorcio.template.ts` (stub vazio na spec) precisa implementar logica de proporcionalidade: para cada lancamento do consorcio, calcular a cota de cada consorciado e gerar subregistros proporcionais.

### 3.7 Achados

| # | Dimensao | Status | Severidade | Norma | Recomendacao |
|---|---|---|---|---|---|
| CO1 | Tipo juridico do consorcio nao definido no onboarding | NAO CONFORME | P0 | Lei 14.300/2022 Art. 1 III vs Lei 6.404/76 Arts. 278-279 | Coletar no cadastro: CNPJ proprio, PJ puro ou misto PF+PJ, empresa lider |
| CO2 | Template `consorcio.template.ts` e stub vazio | NAO CONFORME | P0 | NBC T 10.20 CFC + IN RFB 1.199/2011 | Implementar plano de contas com proporcionalidade — NAO copiar template cooperativa |
| CO3 | Risco de aplicar isenção PIS/COFINS do Tema 536 ao consorcio | RISCO CRITICO | P0 | CTN Art. 111 II — interpretacao literal de isencoes | Motor fiscal deve verificar `tipoParceiro` antes de aplicar qualquer isenção |
| CO4 | Sem campo de proporcionalidade por consorciado | NAO CONFORME | P1 | IN RFB 1.199/2011 Art. 1 + NBC T 10.20 | Adicionar `percentualParticipacao` e `empresaLider` ao modelo de consorciado |
| CO5 | Contas de FATES/Sobras/Fundo de Reserva inaplicaveis | RISCO DE SEED ERRADO | P1 | Lei 5.764/71 Art. 28 — exclusivo cooperativas | Garantir que seed cooperativa nao seja replicada no template consorcio |
| CO6 | Convenios do consorcio tributados diferente da cooperativa | RISCO | P1 | Lei 5.764/71 Art. 79 nao se aplica ao consorcio | Convenio de consorcio e receita tributavel plena — motor deve verificar tipoParceiro |
| CO7 | ISS sobre servicos do consorcio aos consorciados | RISCO | P1 | LC 116/2003 + ausencia de ato cooperativo | Documentar e implementar calculo de ISS para servicos inter-consorcio |
| CO8 | Consorciado PF no consorcio Lei 14.300/2022 — IRPF | NAO ANALISADO | P1 | Lei 14.300/2022 Art. 1 III + RIR/2018 | Definir tratamento para consorciado PF — sem equivalente de cooperado PF |
| CO9 | IRRF em pagamentos de arrendamento | NAO ANALISADO | P1 | Lei 9.430/96 Art. 70 + IN RFB 1.500/2014 | Verificar/implementar IRRF ao pagar arrendamento de usina para dono externo |
| CO10 | Reforma tributaria (LC 214/2025): CBS/IBS sobre SCEE consorcio | INCERTEZA REGULATORIA | P1 | LC 214/2025 — zona cinzenta para consorcio Lei 14.300/2022 | Monitorar regulamentacao do Comite Gestor CBS/IBS em 2026 |

**Decisoes Luciano pendentes (CONSORCIO — antes de onboarding Sinergia):**
1. Sinergia e consorcio puro de PJ (Lei 6.404/76) ou consorcio misto PF+PJ (Lei 14.300/2022)?
2. Sinergia tem CNPJ proprio do consorcio ou opera pelos CNPJs das consorciadas?
3. Quem e a empresa lider do Sinergia?
4. As consorciadas do Sinergia sao Lucro Real ou Lucro Presumido?

---

## 4. Regime ASSOCIACAO (CC Arts. 53-61 + Lei 9.532/1997)

### 4.1 Marco legal aplicavel

- Codigo Civil 2002, Arts. 53-61: natureza juridica da associacao (fins nao economicos)
- CTN Art. 14: requisitos cumulativos e continuados para isenção/imunidade
- Lei 9.532/1997, Art. 15: isenção para associacoes civis sem fins lucrativos
- IN RFB 247/2002, Art. 47: definicao de "receita propria" isenta de COFINS
- LC 224/2025 (publicada 26/12/2025) + IN RFB 2.307/2026 (publicada 20/02/2026): cenario tributario 2026
- NBC ITG 2002 (R1) (CFC, agosto 2015): norma contabil para entidades sem finalidade de lucro
- Lei 14.300/2022, Art. 2, XII: autorizacao expressa para associacao operar GD compartilhada

### 4.2 Natureza juridica e autorizacao para GD

A associacao esta expressamente autorizada pelo Marco Legal MMGD (Lei 14.300/2022 Art. 2 XII) a operar geracao distribuida compartilhada: "reuniao de consumidores atraves de [...] qualquer outra forma de associacao civil constituida para esse fim".

A associacao tem regime distinto da cooperativa em quatro aspectos fundamentais:

| Dimensao | COOPERATIVA | ASSOCIACAO |
|---|---|---|
| Base legal | Lei 5.764/71 | CC 2002 Arts. 53-61 |
| Conceito protetor | Ato cooperativo (Art. 79) | Atividade propria (Art. 15 Lei 9.532) |
| Resultado positivo | Sobras — redistribuidas ou alocadas em fundos obrigatorios | Superavit — obrigatoriamente reinvestido no objeto social |
| Legislacao tributaria | Lei 5.764/71 Arts. 87-89 + CRFB Art. 146 III "c" | Lei 9.532/97 Art. 15 + CTN Art. 14 |
| Solidez da defesa fiscal | Alta — STF Tema 536 + CRFB | Media — IN RFB 2.307/2026 e recente, sem jurisprudencia |

### 4.3 Isenção tributaria — requisitos e riscos de descaracterizacao

**Lei 9.532/1997, Art. 15 (texto literal):**

> "Consideram-se isentas as instituicoes de carater filantropico, recreativo, cultural e cientifico e as associacoes civis que prestem os servicos para os quais houverem sido instituidas e os coloquem a disposicao do grupo de pessoas a que se destinam, sem fins lucrativos."

Requisitos cumulativos (CTN Art. 14):
1. Nao distribuir lucros, bonificacoes ou vantagens a qualquer titulo a dirigentes, mantenedores ou associados
2. Aplicar integralmente no Pais seus recursos na manutencao dos objetivos institucionais
3. Manter escrituracao contabil completa em livros revestidos de formalidades legais
4. Conservar livros e documentacao por 5 anos
5. Apresentar ECF anualmente a Receita Federal

**ATENCAO CRITICA — LC 224/2025 e IN RFB 2.307/2026:**

A LC 224/2025 (26/12/2025) reduziu beneficios tributarios de entidades sem fins lucrativos. A IN RFB 2.307/2026 (20/02/2026) excluiu "associacoes civis sem fins lucrativos" do escopo da reducao, mantendo-as sob o Art. 15 da Lei 9.532/1997. Porem, esta e uma norma de fevereiro de 2026 — recente, sem jurisprudencia consolidada. O cenario pode mudar. VALIDACAO EXTERNA RECOMENDADA — contador especialista em terceiro setor deve confirmar enquadramento atual antes de qualquer onboarding de ASSOCIACAO.

**Riscos de descaracterizacao:**

| Risco | Mecanismo | Consequencia |
|---|---|---|
| Distribuicao velada de receitas | Remuneracao de dirigentes acima do mercado | Perda da isenção com retroatividade de 5 anos |
| Receita atipica predominante | Receitas de arrendamento/convenios com nao-membros superam receitas proprias | Recaracterizacao como empresa; tributacao plena |
| Ausencia de escrituracao formal | Falta de livros, demonstracoes, ECF | Perda automatica da isenção (CTN Art. 14 III) |
| Rateio com carater contraprestacional | COFINS pode incidir se rateio mensal for interpretado como "preco" de servico concreto | COFINS 3% sobre toda a receita de cobranca |

### 4.4 Tributacao

**IRPJ/CSLL:** isento sobre superavit reinvestido no objeto social (Art. 15 Lei 9.532/1997). Alteracoes da LC 224/2025 vigentes desde 01/01/2026 (IRPJ) e 01/04/2026 (CSLL) — IN 2.307 preservou associacoes civis, mas monitoramento continuo necessario.

**PIS:** regime PIS-Folha (1% sobre salarios) — NAO sobre faturamento. Esta e a diferenca critica versus cooperativa. O SISGD nao distingue hoje entre PIS-Faturamento e PIS-Folha — gap de conformidade para parceiros ASSOCIACAO com empregados.

**COFINS:**

- Receitas de atividade propria: isentas (IN RFB 247/2002 Art. 47 — mensalidades e contribuicoes sem carater contraprestacional direto, recebidas de associados)
- Receitas atipicas (servicos a nao-membros, rendimentos financeiros): COFINS 3%

Risco para associacao de GD: o rateio mensal de custos de energia pode ser interpretado pela Receita Federal como "carater contraprestacional direto" (cobranca por servico mensuravel, nao mera mensalidade). Se essa interpretacao prevalecer, toda a receita seria tributavel a 3%. VALIDACAO EXTERNA RECOMENDADA — Walter deve verificar se a forma de cobranca esta documentada como "rateio de custos" (natureza de custeio associativo) e nao como "prestacao de servico de energia".

**ISS:** nao incide sobre servicos prestados aos proprios membros; incide sobre servicos prestados a terceiros nao-membros.

**ICMS sobre SCEE:** a ressalva STJ Tema 986 e aplicavel, mas a construcao argumentativa e mais fraca que na cooperativa. Na cooperativa, o argumento se apoia no Art. 79 paragrafo unico ("ato cooperativo nao implica operacao de mercado"). Na associacao, o argumento e funcional/regulatorio — o SCEE e mecanismo de compensacao regulatoria (REN 1.059/2023), nao venda de energia. Em estados que cobram ICMS sobre a compensacao, a associacao teria maior dificuldade para obter liminar. VALIDACAO EXTERNA RECOMENDADA — advogado tributarista especializado em energia eletrica.

### 4.5 Arrendamento vs. Cessao na associacao

O campo `formaPagamentoDono` (FIXO/PERCENTUAL/HIBRIDO) precisa ser acompanhado de um flag `donoEhMembro: boolean` que nao existe hoje no schema.

**Cessao (dono e membro):** atividade propria da associacao; sem implicacoes adicionais de COFINS; sem ICMS sobre creditos compartilhados (STJ Tema 986 ressalva).

**Arrendamento (dono externo):** ATENCAO CRITICA — REN ANEEL 1.059/2023 veda incluir consumidores no SCEE quando o arrendamento e precificado em R$/kWh (valor atrelado a unidade de energia). O arrendamento por valor fixo em R$/mes e permitido. Violacao desta regra causa exclusao do SCEE.

### 4.6 Convenios na associacao

A Lei 5.764/71 Art. 88 (que da base aos "atos auxiliares" cooperativos) NAO se aplica a associacao. Convenios de associacao com terceiros sao:

- Sem contraprestacao comercial (parceria com prefeitura para uso de telhado publico): despesa ou receita de atividade propria
- Com carater comercial (prestacao remunerada de servico a empresa externa): receita atipica sujeita a COFINS 3% e ISS

### 4.7 Nomenclatura NBC ITG 2002 (R1)

A NBC ITG 2002 (R1) exige nomenclatura propria para entidades sem fins lucrativos. O SISGD deve parametrizar as labels por tipoParceiro:

| Termo Cooperativa | Termo Associacao |
|---|---|
| Sobras do exercicio | Superavit do exercicio |
| Capital social / Cotas-parte | Patrimonio social |
| DRE cooperativa | Demonstracao das Atividades |
| Fundo FATES/RATES | Fundo de reserva estatutario (nao obrigatorio) |
| Ato cooperativo | Atividade propria |

### 4.8 Achados

| # | Dimensao | Status | Severidade | Norma | Recomendacao |
|---|---|---|---|---|---|
| A1 | Conceito "ato cooperativo" semanticamente incorreto para ASSOCIACAO | NAO CONFORME | P1 | CC Art. 53 vs. Lei 5.764 Art. 79 | Criar enum `naturezaReceita` separado para ASSOCIACAO (ATIVIDADE_PROPRIA, RECEITA_ATIPICA, CONVENIO) |
| A2 | Isenção IRPJ/CSLL instavel pos-LC 224/2025 | PARCIAL — IN 2.307 preservou, mas norma instavel | P1 | Lei 9.532/97 Art. 15 + IN RFB 2.307/2026 | Documentar requisitos Art. 15 no onboarding; monitorar evolucao da LC 224/2025 |
| A3 | PIS-Folha vs. PIS-Faturamento: SISGD nao distingue | GAP | P1 | Lei 9.715/1998 Art. 2 I | Adicionar parametro `regimePIS` por tipoParceiro (FOLHA/FATURAMENTO/ISENTO) |
| A4 | COFINS receitas atipicas: sem categorizacao | GAP | P1 | IN RFB 247/2002 Art. 47 + Lei 9.718/1998 Art. 14 X | Campo `tipoReceita` (PROPRIA/ATIPICA) obrigatorio para ASSOCIACAO no Sprint 8 |
| A5 | Arrendamento externo — vedacao ANEEL de R$/kWh | RISCO ALTO | P0 | REN ANEEL 1.059/2023 | Flag `donoEhMembro: boolean` na usina + validacao: se externo, verificar forma de remuneracao |
| A6 | IRRF sobre arrendamentos pagos a PF externas | AUSENTE | P1 | Lei 9.249/1995 + RIR/2018 Art. 700 ss. | Campo de retencao IRRF em contas a pagar para arrendamento |
| A7 | ICMS sobre SCEE — argumentacao mais fraca sem ato cooperativo | FRAGILIDADE | P2 | STJ Tema 986 ressalva + REN 1.059/2023 | Documentar argumento alternativo baseado em natureza regulatoria do SCEE |
| A8 | Plano de contas: nomenclatura inadequada para ASSOCIACAO | GAP | P1 | NBC ITG 2002 (R1) | Parametrizar labels e estrutura por tipoParceiro |
| A9 | Demonstracoes financeiras: DRE unica para todos | GAP | P2 | NBC ITG 2002 (R1) | DRE de ASSOCIACAO deve ser "Demonstracao das Atividades" |
| A10 | FATES/RATES inaplicaveis; fundos estatutarios devem ser mapeados | GAP CONCEITUAL | P2 | CC Art. 54 | Onboarding de ASSOCIACAO deve coletar "fundos previstos no estatuto" |
| A11 | Campo `donoEhMembro` inexistente no schema | GAP DE SCHEMA | P1 | REN 1.059/2023 + risco LC 224/2025 | Adicionar `donoEhMembro: boolean` na entidade Usina |

**Decisoes Luciano pendentes (ASSOCIACAO):**
1. O SISGD vai atender ASSOCIACOES reais nos proximos 6 meses? Se sim, os itens P0 e P1 acima sao bloqueantes.
2. O Sprint 8 deve ser multi-regime desde o inicio (parametrizavel por tipoParceiro) ou implementar cooperativa primeiro e depois adaptar? A segunda opcao gera retrabalho estimado em 30-40% do esforco.
3. Existe alguma ASSOCIACAO especifica ja identificada como parceiro potencial? Se sim, o estatuto dela deve ser analisado antes de qualquer decisao de implementacao.

---

## 5. Regime CONDOMINIO (CC Arts. 1.314-1.358-A + Lei 4.591/64 + Lei 14.300/2022)

### 5.1 Marco legal aplicavel

- Codigo Civil 2002, Arts. 1.314-1.358-A: condominio edilicio
- Lei 4.591/64: condominio em edificacoes e incorporacoes imobiliarias
- Lei 14.300/2022, Arts. 1 VII e 2 IV e 3: EMUC (empreendimento de multiplas UCs) e geracao compartilhada com condominio
- Parecer Normativo CST 76/1971 (RFB): condominio edilicio nao e pessoa juridica contribuinte de IRPJ
- Lei 10.833/2003, Art. 30 §1 IV: obrigacao de retencao PIS/COFINS/CSLL na fonte quando pagar servicos a PJ
- REN ANEEL 1.059/2023, Art. 655-P IV: concentracao >= 25% implica reclassificacao GD
- Convenio CONFAZ ICMS 16/2015: isencao de ICMS sobre energia compensada (aplicacao controversa para geracao compartilhada vs. autoconsumo local)

### 5.2 Natureza juridica — sub-modalidades

Ha duas sub-modalidades relevantes para condominio em GD e o SISGD deve distingui-las no cadastro:

**EMUC (Art. 1 VII Lei 14.300/2022):** usina instalada na area comum do condominio; creditos distribuidos entre UCs internas. Titular da geracao e o proprio condominio ou um condômino designado. Rateio e direto entre UCs do mesmo condominio.

**Geracao compartilhada com condominio (Art. 2 IV + Art. 3 Lei 14.300/2022):** condominio contrata usina remota (fazenda solar); creditos distribuidos entre UCs participantes conforme percentuais definidos em assembleia. Cada condômino tem UC individual que recebe creditos; a alocacao e feita pela distribuidora.

Esta distincao impacta a classificacao GD (I/II/III) e a incidencia de Fio B. VALIDACAO EXTERNA RECOMENDADA — advogado regulatorio ANEEL para confirmar qual sub-modalidade cada parceiro CONDOMINIO opera.

### 5.3 Tributacao — regra fundamental

**O condominio edilicio NAO e pessoa juridica contribuinte de IRPJ/CSLL.**

Parecer Normativo CST 76/1971 (RFB):

> "O condominio de edificios, figura representativa dos co-proprietarios, por nao se tratar de pessoa juridica, nao esta sujeito a apresentacao da declaracao de rendimentos."

As taxas condominiais sao mero rateio de despesas comuns — nao ha receita propria, nao ha lucro, nao ha base de calculo para IRPJ ou CSLL. Este entendimento e consolidado ha decadas e vale mesmo quando o condominio possui CNPJ (obrigatorio apenas para abertura de conta bancaria e contratacoes trabalhistas).

Consequencia direta P0 para o SISGD: o modulo parametrizado para tipoParceiro = CONDOMINIO NAO deve calcular nem provisionar IRPJ e CSLL. Fazê-lo induziria o parceiro a recolher tributo inexistente.

**PIS/COFINS:** o condominio NAO e contribuinte de PIS/COFINS sobre suas "receitas" (nao ha receita — ha rateio de despesas). Porem, o condominio E obrigado a RETER PIS/COFINS/CSLL na fonte (4,65% = PIS 0,65% + COFINS 3% + CSLL 1%) quando pagar servicos a PJ, conforme Lei 10.833/2003 Art. 30 §1 IV (limpeza, conservacao, manutencao, seguranca, vigilancia, locacao de mao de obra, assessoria, gestao, servicos profissionais).

Esta obrigacao e real e ausente do SISGD: o modulo ContaAPagar do parceiro CONDOMINIO precisa de campo de retencao quando o fornecedor for PJ prestadora dos servicos listados. VALIDACAO EXTERNA RECOMENDADA — Walter confirmar quais fornecedores especificos dos parceiros CONDOMINIO estao sujeitos a retencao (ex: empresa de O&M da usina solar e fornecedora sujeita a 4,65% se for PJ no regime nao-simples).

**ICMS:** o Convenio CONFAZ 16/2015 autoriza isencao de ICMS sobre energia compensada em autoconsumo local e remoto com fonte solar. Ha controversia sobre aplicacao a geracao compartilhada stricto sensu. O SISGD nao deve assumir isencao automatica para CONDOMINIO — depende de decreto estadual especifico. VALIDACAO EXTERNA RECOMENDADA — verificar decreto ES vigente.

**ISS:** condominio que nao presta servicos a terceiros nao e contribuinte de ISS. Se o SISGD for o prestador (plataforma SaaS), ISS e obrigacao do SISGD, nao do condominio.

### 5.4 NAO existe no condominio: ato cooperativo, fundos, sobras

Na moldura juridica do CONDOMINIO:

- Ato cooperativo (Lei 5.764/71 Art. 79): inaplicavel — exclusivo de cooperativas
- FATES e Fundo de Reserva legal (Lei 5.764/71 Art. 28): inaplicaveis — condominio tem fundo de reserva (Art. 1.348 CC + Lei 4.591/64 Art. 9) e fundo de obras, que sao reservas de caixa, nao fundos cooperativos com regras de distribuicao legal
- Sobras (Lei 5.764/71 Art. 89): inaplicaveis — resultado positivo do condominio e saldo de caixa aplicado em reserva, devolvido via reducao de taxa futura ou usado em obras; sem regime legal especial de distribuicao

O template de contabilidade para CONDOMINIO deve omitir completamente: naturezaAto, DRE por natureza cooperativa (3 colunas), fundos FATES/RATES, distribuicao de sobras, PIS/COFINS isenção por ato cooperativo.

### 5.5 Fio B no condominio — ponto de conformidade critico

O Fio B incide na ponta consumidora (UC individual do condômino), nao sobre o total da usina com rateio posterior. O sistema deve aplicar o Fio B por UC individual — cada condômino recebe o credito ja liquido de Fio B. Percentual 2026: 60% (Lei 14.300/2022 Art. 27).

O snapshot de classeGd e percentualFioB deve ser preservado por cobranca para auditoria historica — exatamente como para os demais tipos de parceiro.

### 5.6 Risco de concentracao 25% (Art. 655-P IV REN 1.059/2023) — identico ao caso Exfishes

Se um unico condômino concentrar 25% ou mais dos creditos da usina, a usina pode ser reclassificada para GD III, com incidencia maior de Fio B — risco analogico ao caso Exfishes (salto de R$ 3.997 para R$ 32.486 mensais). O engine deve verificar este limite para CONDOMINIO da mesma forma que para COOPERATIVA.

### 5.7 Achados

| # | Dimensao | Status | Severidade | Norma | Recomendacao |
|---|---|---|---|---|---|
| D1 | IRPJ/CSLL: NAO incide no condominio | RISCO DE IMPLEMENTACAO ERRADA | P0 | Parecer Normativo CST 76/1971 | Modulo CONDOMINIO NAO deve calcular IRPJ/CSLL sobre resultado |
| D2 | PIS/COFINS: NAO incide como contribuinte proprio | RISCO DE IMPLEMENTACAO ERRADA | P0 | Lei 10.833/2003 + Parecer CST 76/1971 | Condominio nao apura PIS/COFINS proprio — apenas retencao fonte |
| D3 | Retencao PIS/COFINS/CSLL fonte (4,65%): ausente | AUSENTE | P1 | Lei 10.833/2003 Art. 30 §1 IV | Implementar campo retencao em ContaAPagar para CONDOMINIO |
| D4 | Retencao IRRF arrendamento PF: ausente | AUSENTE | P1 | RIR/2018 Decreto 9.580/2018 | Campo retencao IRRF em ContaAPagar tipo ARRENDAMENTO quando fornecedor PF |
| D5 | Ato cooperativo: inaplicavel ao CONDOMINIO | RISCO CONCEITUAL | P1 | Lei 5.764/71 Art. 79 — exclusivo cooperativas | tipoParceiro = CONDOMINIO deve omitir naturezaAto, DRE 3 colunas, fundos, sobras |
| D6 | Fio B: aplicar por UC individual, nao total usina | RISCO DE CALCULO | P1 | Lei 14.300/2022 Art. 27; REH 3.508/2025 | Verificar com advogado ANEEL como distribuidora aplica |
| D7 | Alerta concentracao 25% por UC: ausente para CONDOMINIO | AUSENTE | P1 | REN 1.059/2023 Art. 655-P IV | Engine deve verificar >= 25% e alertar risco de reclassificacao GD III |
| D8 | ICMS: isencao nao e automatica para CONDOMINIO | INCERTEZA JURIDICA | P1 | Convenio CONFAZ 16/2015 — controversia geracao compartilhada | Nao assumir isencao sem verificar decreto estadual especifico |
| D9 | EFD-Reinf: obrigatorio se reter previdencia | AUSENTE | P2 | IN RFB 2.043/2021 | Orientar parceiro CONDOMINIO sobre obrigatoriedade EFD-Reinf mensal |
| D10 | Arrendamento nao pode ser precificado em kWh | RISCO REGULATORIO | P2 | REN 1.059/2023 (principio preservado) | Verificar minutas de arrendamento dos parceiros CONDOMINIO |
| D11 | Sub-modalidade EMUC vs. geracao compartilhada: indefinida | NAO DEFINIDO | P2 | Lei 14.300/2022 Arts. 1 VII e 2 IV | Definir sub-modalidade de cada parceiro CONDOMINIO |
| D12 | Reforma tributaria IBS/CBS: impacto GD 2026 | MONITORAMENTO | P3 | LC 214/2025 + LC 227/2026 | Vigilia: IBS/CBS em transicao 2026 |

**Decisoes Luciano pendentes (CONDOMINIO):**
1. Os parceiros tipo CONDOMINIO operam como EMUC ou como geracao compartilhada (usina remota)?
2. Os contratos de arrendamento estao precificados em R$ (correto) ou em kWh (problematico)?
3. A empresa de O&M das usinas dos parceiros CONDOMINIO e optante do Simples Nacional? (Condiciona retencao 4,65%)
4. Ha plano de incorporar algum parceiro CONDOMINIO ainda em 2026?

---

## 6. Matriz Comparativa dos 4 Regimes

| Dimensao | COOPERATIVA | CONSORCIO | ASSOCIACAO | CONDOMINIO |
|---|---|---|---|---|
| Ato cooperativo? | SIM (Lei 5.764/71 Art. 79) | NAO | NAO | NAO |
| Fundos obrigatorios? | SIM — FATES (5%) + Fundo de Reserva (10%) das sobras (Lei 5.764/71 Art. 28) | NAO (reservas contratuais facultativas) | NAO (fundos estatutarios facultativos — CC Art. 54) | NAO (fundo de reserva caixa — CC Art. 1.348; sem regime legal especial) |
| Sobras? | SIM — distribuidas pro-rata (Lei 5.764/71 Art. 89) | NAO (lucro proporcional tributavel) | NAO (superavit reinvestido) | NAO (saldo de caixa — reducao de taxa futura ou obras) |
| Isenção PIS/COFINS? | SIM sobre ato proprio — STF Tema 536 (ressalva: julgamento em curso mai/jun 2026) | NAO — tributacao proporcional plena (CTN Art. 111 veda analogia) | PARCIAL — PIS-Folha (1% salarios); COFINS: isenta receitas proprias, 3% sobre atipicas (Lei 9.532/97 Art. 15 + IN 247/2002) | NAO — nao e contribuinte; apenas retencao na fonte (4,65% sobre pagamentos a PJ) |
| IRPJ/CSLL? | Isento ato proprio; tributado ato nao cooperativo (RIR/2018 Art. 182) | Tributado proporcionalmente por cada consorciada | Isento sobre superavit reinvestido (Lei 9.532/97 Art. 15 + LC 224/2025 — IN 2.307 preservou) | NAO incide — condominio nao e pessoa juridica contribuinte (Parecer CST 76/1971) |
| Quem recolhe tributos? | A propria cooperativa (ato nao cooperativo); ato proprio isento | Cada consorciada individualmente, na proporcao da participacao (IN RFB 1.199/2011) | A propria associacao (IRPJ/CSLL sobre ato nao proprio; PIS-Folha sobre salarios) | NAO recolhe IRPJ/CSLL; retencao na fonte quando paga servicos a PJ (4,65%) |
| Arrendamento (dono externo)? | Despesa ato nao cooperativo — CUIDADO: default incorreto no sistema (P0-3) | Despesa operacional proporcional + IRRF sobre pagamento | Despesa atividade propria — ATENCAO: REN 1.059/2023 veda R$/kWh | Despesa do condominio rateada — IRRF se PF; 4,65% se PJ |
| Cessao (dono e membro)? | Dispendio ato proprio (cooperado-proprietario cede usina ao objeto social) | Cessao gratuita: sem receita; cessao onerosa: IRPJ/IRPF proporcional | Atividade propria; sem implicacoes adicionais de COFINS | Ativo imobilizado do condominio (se adquirido coletivamente); ou cessao por condômino (IRPF para o cedente) |
| Convenios? | Ato Auxiliar (Art. 88 Lei 5.764/71) — transito nao-tributado com soma zero | Receita tributavel plena — sem equivalente ao ato auxiliar | Atividade propria (sem carater comercial) ou receita atipica (com carater comercial — COFINS 3% + ISS) | Nao se aplica a figura tipica — taxa condominial e sempre rateio de despesa |
| Ressalva SCEE (STJ Tema 986)? | SIM (mais forte — Art. 79 paragrafo unico + STJ Tema 986) | SIM (argumento funcional/regulatorio — mesma forca) | SIM (argumento mais fraco — sem ato cooperativo; base e REN 1.059/2023) | SIM (argumento funcional — mesma base REN 1.059/2023; controversia quanto a geracao compartilhada vs. autoconsumo local) |
| NBC aplicavel | NBC ITG 2004 (cooperativas) | NBC T 10.20 (consorcios de empresas) | NBC ITG 2002 (R1) (entidades sem fins lucrativos) | NBC T 6 (demonstracoes financeiras gerais) — contabilidade simplificada em regime de caixa |
| Alerta concentracao 25% (Art. 655-P IV)? | SIM — tese central dossie CoopereBR x EDP | SIM — mesmo risco regulatorio | SIM — mesmo risco regulatorio | SIM — mesmo risco; usina do condominio pode ter condômino com >= 25% dos creditos |
| Fio B (2026 = 60%)? | SIM (por UC; snapshot por cobranca) | SIM (por UC; snapshot por cobranca) | SIM (por UC; snapshot por cobranca) | SIM — por UC individual (nao sobre total da usina) |

---

## 7. Recomendacao de Design — Modulo `contabilidade-tributaria/` Parametrizado por tipoParceiro

### 7.1 O que e comum a todos os 4 regimes

Os seguintes elementos podem ser implementados uma vez e compartilhados:

- **Snapshot por cobranca:** `classeGdSnapshot`, `percentualFioBSnapshot`, `tarifaFioBSnapshot` — obrigatorio para auditoria historica em todos os tipos
- **Alerta de concentracao >= 25% (Art. 655-P IV):** mesma engine para todos os tipos de parceiro
- **Ressalva SCEE (STJ Tema 986):** documentar que a ressalva se aplica a todos os tipos; o fundamento e a natureza do SCEE, nao a natureza da entidade
- **Motor Fio B:** calculo por UC individual, nao por usina; percentual progressivo Lei 14.300/2022 Art. 27; snapshot obrigatorio
- **ContaAPagar com retencao IRRF:** para pagamentos de arrendamento a PF — aplicavel a todos os tipos (com logica de calculo diferente, mas campo comum)

### 7.2 O que e especifico por regime — design parametrizado

O design recomendado e um enum `TipoRegimeContabil` alinhado ao `tipoParceiro`, com quatro templates de plano de contas e quatro conjuntos de regras fiscais:

**`tipoParceiro = COOPERATIVA` → `regimeContabil = COOPERATIVO`**

- Enum `NaturezaAto {PROPRIO, AUXILIAR, NAO_COOPERATIVO}` em cada lancamento
- Terminologia: Ingresso/Dispendio para ato proprio; Receita/Despesa para ato nao cooperativo
- Contas obrigatorias de PL: Fundo de Reserva (10% sobras) + FATES (5% sobras)
- Motor de destinacao de sobras (3 fases: sobras brutas → deducoes fundos → sobras a distribuir)
- DRE em 3 colunas: ato proprio / ato auxiliar / ato nao cooperativo + consolidada
- Flag isenção PIS/COFINS sobre ato proprio: configuravel por parceiro (nao hardcoded — aguardar STF Tema 536)
- Apuracao IRPJ/CSLL apenas sobre resultado de ato nao cooperativo
- Motor de classificacao automatica de repasse ao proprietario via `formaAquisicao` + `donoEhMembro`

**`tipoParceiro = CONSORCIO` → `regimeContabil = CONSORCIO_PROPORCIONAL`**

- Campo `percentualParticipacao` por consorciado + campo `empresaLider`
- Logica de subregistros proporcionais: cada lancamento gera N subregistros (um por consorciada)
- SEM contas de Sobras, FATES, Fundo de Reserva, naturezaAto
- Motor PIS/COFINS: tributacao proporcional plena (SEM isenção STF Tema 536)
- Motor IRPJ/CSLL: tributacao proporcional por consorciada
- Relatorio de distribuicao proporcional exportavel (NBC T 10.20 + IN RFB 1.199/2011)
- ISS sobre servicos prestados aos consorciados (verificar LC 116/2003 por municipio)

**`tipoParceiro = ASSOCIACAO` → `regimeContabil = ASSOCIACAO_SEM_FINS_LUCRATIVOS`**

- Enum `NaturezaReceita {ATIVIDADE_PROPRIA, RECEITA_ATIPICA, CONVENIO}` (distinto do enum cooperativo)
- Terminologia: Superavit/Deficit, Patrimonio Social, Demonstracao das Atividades (nao DRE)
- SEM contas de Sobras, FATES/RATES obrigatorios; fundos estatutarios conforme cadastro do parceiro
- Motor PIS: regime PIS-Folha (1% sobre salarios); parametro `regimePIS = FOLHA`
- Motor COFINS: isento para ATIVIDADE_PROPRIA; 3% para RECEITA_ATIPICA
- Motor IRPJ/CSLL: isento sobre superavit reinvestido; tributado sobre atividade atipica
- Validacao no onboarding: requisitos Art. 15 Lei 9.532/1997 + CTN Art. 14 (checklist)
- Alerta: rateio com carater contraprestacional vs. mera mensalidade (flag de risco)

**`tipoParceiro = CONDOMINIO` → `regimeContabil = CONDOMINIO_EDILICIO`**

- SEM calculo de IRPJ/CSLL, SEM PIS/COFINS proprio, SEM naturezaAto, SEM DRE 3 colunas, SEM fundos cooperativos, SEM sobras
- Motor de retencao na fonte: PIS/COFINS/CSLL 4,65% em ContaAPagar para fornecedores PJ (lista de categorias conforme Lei 10.833/2003 Art. 30 §1 IV)
- Motor de retencao IRRF em ContaAPagar para arrendamento a PF (tabela progressiva RIR/2018)
- Plano de contas simplificado: centros de custo por usina/area + fundo de reserva/obras
- Prestacao de contas mensal para sindico: rateio kWh + custos + inadimplencia
- Campo sub-modalidade: EMUC vs. GERACAO_COMPARTILHADA (impacta classificacao GD e Fio B)
- Fio B por UC individual (nao total usina)

### 7.3 Estrategia de implementacao recomendada: cooperativa-primeiro com arquitetura multi-regime

A implementacao deve seguir esta sequencia:

**Fase 1 — Fundacao comum (1 semana):**
Implementar os elementos comuns a todos os tipos (snapshot Fio B, alerta 25%, ressalva SCEE documentada, campo `donoEhMembro`, campo `regimeContabil` derivado de `tipoParceiro`).

**Fase 2 — Template COOPERATIVA (3 semanas):**
Implementar o plano de contas cooperativo completo com os 8 grupos, motor de destinacao de sobras, DRE 3 colunas, motor PIS/COFINS com flag configuravel. Este e o regime mais complexo e mais urgente (CoopereBR e o parceiro atual).

**Fase 3 — Template CONDOMINIO (1 semana):**
Segundo mais simples conceitualmente (sem DRE cooperativa, sem fundos, sem ato cooperativo) mas com obrigacoes proprias de retencao na fonte. Implementar motor de retencao 4,65% + IRRF + plano de contas simplificado.

**Fase 4 — Template ASSOCIACAO (2 semanas):**
Motor PIS-Folha vs. Faturamento; motor COFINS por natureza de receita; Demonstracao das Atividades; validacao dos requisitos Art. 15 no onboarding.

**Fase 5 — Template CONSORCIO (2 semanas):**
A implementacao mais complexa estruturalmente (proporcionalidade por consorciada; subregistros proporcionais; empresa lider). Requer decisao de Luciano sobre Sinergia e validacao externa de Walter + advogado regulatorio ANEEL.

### 7.4 Enums recomendados no schema

```
enum TipoRegimeContabil {
  COOPERATIVO
  CONSORCIO_PROPORCIONAL
  ASSOCIACAO_SEM_FINS_LUCRATIVOS
  CONDOMINIO_EDILICIO
}

enum NaturezaAtoCooperativo {
  PROPRIO
  AUXILIAR
  NAO_COOPERATIVO
}

enum NaturezaReceitaAssociacao {
  ATIVIDADE_PROPRIA
  RECEITA_ATIPICA
  CONVENIO
}

enum SubModalidadeCondominio {
  EMUC
  GERACAO_COMPARTILHADA
}

enum RegimePIS {
  FOLHA      // associacoes sem fins lucrativos — 1% sobre salarios
  FATURAMENTO // empresas e consorcio proporcional
  ISENTO     // cooperativa em ato proprio
}
```

O campo `regimeContabil` na entidade Cooperativa/Parceiro deve ser derivado automaticamente de `tipoParceiro` no momento do cadastro, mas auditavel manualmente por SUPER_ADMIN para casos de borda.

---

## 8. Pontos que Exigem Validacao Profissional

### 8.1 Validacoes IMEDIATAS (antes de iniciar Sprint 8)

**Walter (contador) — OBRIGATORIO antes da Fase 2 do Sprint 8:**

1. Classificacao do repasse ao proprietario de usina por arrendamento (E-Solares e demais): ato auxiliar ou ato nao cooperativo? Esta e a questao mais urgente (P0-3). Sem resposta de Walter, o default do sistema continua incorreto e representa risco de simulacao fiscal.

2. Percentuais dos fundos FATES e Fundo de Reserva no Estatuto CoopereBR v3 (AGE 17/06/2026): iguais ao minimo legal (5% + 10%) ou superiores? O motor de destinacao de sobras precisa dessa informacao.

3. Regime PIS e COFINS da CoopereBR em 2026: confirmar regime cumulativo (0,65% PIS + 3% COFINS) sobre ato nao cooperativo. Verificar se ha ato nao cooperativo com volume suficiente para impactar.

4. IRRF sobre pagamentos de arrendamento a PF/PJ: tabela vigente 2026 (incluindo isenção ate R$ 5.000/mes para PF — Lei 15.270/2025); quais contratos atuais estao sujeitos.

5. NBC TG 06 (IFRS 16): os contratos de arrendamento de usinas da CoopereBR (E-Solares e demais) obrigam reconhecimento de ativo de direito de uso e passivo de arrendamento no balanco? Qual a materialidade?

**Advogado tributarista — PRIORITARIO:**

6. Acompanhamento mensal do julgamento STF Tema 536 (plenario fisico maio/junho 2026). O resultado pode exigir revisao imediata da politica de isenção PIS/COFINS da CoopereBR. O modulo deve ser arquitetado com isenção como flag configuravel (nao hardcoded) precisamente para este cenario.

7. Tratamento de IRRF sobre cessao de usina por cooperado-proprietario: o pagamento e rendimento de capital (aluguel — sujeito a IRRF) ou dispendio cooperativo (sem retencao)? Esta questao e controvertida na doutrina.

**Advogado regulatorio ANEEL / advogado tributarista ES — PRIORITARIO pre-producao:**

8. Posicao do Estado ES (SEFAZ-ES) sobre ICMS no SCEE para cooperativa: ha isenção estadual expressa ou depende de acao judicial? O Espirito Santo nao tem isencao expressa via Convenio CONFAZ como Sao Paulo (Decreto 67.521/2023). Esta questao impacta diretamente a cobranca real em producao.

### 8.2 Validacoes antes de onboarding de CONSORCIO (Sinergia)

**Advogado regulatorio ANEEL:**

9. Qual modalidade juridica o Sinergia se enquadra: Lei 6.404/76 (consorciadas PJ) ou figura sui generis Lei 14.300/2022 (misto PF+PJ)? Condiciona todo o tratamento tributario subsequente.

10. O Sinergia tem CNPJ proprio do consorcio ou opera pelos CNPJs das consorciadas? Determina modelo de emissao de notas fiscais e obrigacoes acessorias.

**Walter + advogado tributarista:**

11. As consorciadas do Sinergia sao Lucro Real ou Lucro Presumido? Define aliquota PIS/COFINS aplicavel (1,65%+7,6% vs. 0,65%+3%).

12. Confirmar que o sistema NAO aplica STF Tema 536 ao Sinergia — risco de autuacao por aproveitamento indevido de isenção fiscal.

13. Monitorar regulamentacao CBS/IBS (LC 214/2025) especifica para consorcio de consumidores GD — zona cinzenta regulatoria em 2026.

### 8.3 Validacoes antes de onboarding de ASSOCIACAO

**Walter:**

14. Regime PIS-Folha confirmado para associacoes de GD em 2026? Confirmar que o PIS incide sobre a folha (1%), nao sobre o faturamento.

15. O rateio mensal de energia solar entre membros e caracterizavel como "mensalidade sem carater contraprestacional" (isento de COFINS) ou como "preco de servico de energia" (COFINS 3%)? Esta e a questao mais critica para o modelo de cobranca da ASSOCIACAO.

16. Monitorar evolucao da LC 224/2025: a IN RFB 2.307/2026 tem apenas 3 meses de vigencia; o cenario pode mudar com nova regulamentacao ou acao judicial do setor.

**Advogado regulatorio ANEEL:**

17. Para qualquer ASSOCIACAO com usina em arrendamento externo: a forma de remuneracao do arrendamento cumpre a proibicao de precificacao em R$/kWh (REN 1.059/2023)?

**Advogado tributarista energia:**

18. Construcao do argumento defensivo para ICMS sobre SCEE em ASSOCIACAO (sem poder usar Lei 5.764/71 Art. 79): como documentar que o SCEE e mecanismo regulatorio e nao venda de energia?

### 8.4 Validacoes antes de onboarding de CONDOMINIO

**Walter:**

19. Quais fornecedores especificos dos parceiros CONDOMINIO estao sujeitos a retencao de 4,65% (PIS/COFINS/CSLL na fonte)? Depende de: (a) o fornecedor ser PJ; (b) o fornecedor nao ser optante do Simples Nacional; (c) o servico estar listado no Art. 30 da Lei 10.833/2003.

20. Tabela vigente de IRRF sobre arrendamento pago pelo condominio a PF proprietaria externa em 2026.

**Advogado ES:**

21. O Espirito Santo aderiu ao Convenio CONFAZ 16/2015 e qual e o alcance exato da isencao de ICMS para geracao compartilhada em condominio? Ha risco de autuacao SEFAZ-ES se isencao for aplicada sem cobertura legal estadual especifica.

**Advogado regulatorio ANEEL:**

22. Sub-modalidade de cada parceiro CONDOMINIO do SISGD: EMUC ou geracao compartilhada? Impacto na classificacao GD e Fio B.

23. As minutas de arrendamento dos parceiros CONDOMINIO cumprem a proibicao de precificacao em kWh?

---

## Nota Final sobre o Julgamento STF Tema 536

Esta e a maior incerteza tributaria transversal a todos os 4 regimes (principalmente o cooperativo). O julgamento no plenario fisico em maio/junho de 2026, com divergencia aberta pelo Min. Dias Toffoli, pode:

(a) Confirmar a isenção sobre atos cooperativos — favoravel: implementa isenção sem risco
(b) Restringir a isenção a cooperativas de producao/agropecuarias — impacto sobre cooperativas de energia dependeria de interpretacao subsequente
(c) Criar modulacao temporal — risco para valores passados

A arquitetura do modulo de contabilidade tributaria deve tratar a isenção PIS/COFINS sobre ato proprio como **flag configuravel por parceiro no painel SUPER_ADMIN**, nao como logica hardcoded. Isso permite ajuste imediato caso o STF modifique sua posicao, sem refatoracao de arquitetura.

---

**VALIDACAO EXTERNA RECOMENDADA** — os 23 pontos listados na Secao 8 representam o mapa completo de validacoes necessarias. Os itens 1-8 sao pre-requisitos para iniciar o Sprint 8. Os itens 9-13 sao pre-requisitos para onboarding do Sinergia. Os itens 14-18 sao pre-requisitos para qualquer ASSOCIACAO. Os itens 19-23 sao pre-requisitos para qualquer CONDOMINIO.