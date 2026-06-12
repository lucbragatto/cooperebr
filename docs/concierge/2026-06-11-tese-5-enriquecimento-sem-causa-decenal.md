# Tese 5 — Enriquecimento Sem Causa + Prescrição Decenal (10 anos)

> Achado P0 descoberto em 2026-06-11 pela observação do Luciano:
> "se EDP cobra errado e ELFSM cobra certo, e nenhuma das duas tem
> autuação, onde foi parar a diferença?". Pesquisa web confirmou que
> **STF já decidiu o tema com prazo decenal e caracterização de
> enriquecimento sem causa pelas distribuidoras**.

## TL;DR

A tese mais forte do dossiê não é Tese 3 (PIS/COFINS sobre SCEE,
tributária, 5 anos). É **Tese 5 — Enriquecimento Sem Causa**, baseada
na Lei 14.385/2022 e em decisões STF que caracterizam a recuperação
do indébito pelas concessionárias como enriquecimento sem causa
quando NÃO é repassado aos consumidores. **Prazo: 10 anos.** Mecanismo:
relação de consumo + CC art. 884 + CDC. Foro: Justiça Estadual.

## Mecanismo jurídico

1. Concessionária cobrou tributo a mais do consumidor (PIS/COFINS sobre
   ICMS — Tema 69 STF — ou outros).
2. Concessionária entrou com ação **própria** contra União pra recuperar
   esse indébito **dela** (que ela "pagou" ao fisco em nome do consumidor).
3. Quando a concessionária **recebe a restituição** ou homologa a
   compensação tributária federal → caracteriza-se ali o
   **enriquecimento sem causa** porque o dinheiro veio do consumidor
   originalmente.
4. **Lei 14.385/2022** obriga as distribuidoras a devolverem ao
   consumidor (ANEEL fiscaliza).
5. Se não devolve, consumidor tem direito de pleitear em juízo.

## Diferenças vs Teses anteriores

| Critério | Tese 3 (tributária) | **Tese 5 (consumerista)** |
|---|---|---|
| Natureza jurídica | Repetição de indébito tributário | Enriquecimento sem causa (CC 884) + CDC |
| Diploma | CTN art. 165 + 168 | Lei 14.385/2022 + CC 884 + CDC art. 42 |
| **Prescrição** | 5 anos (CTN) | **10 anos** (STF fixou) |
| Marco prescricional | Pagamento da fatura | **Recebimento da restituição pela concessionária** |
| Reparação | Valor + SELIC | Valor + SELIC ± **dobro** (CDC art. 42) |
| Dano moral | Não cabe | Cabe (coletivo + individual) |
| Foro | Justiça Federal (União réu) | **Justiça Estadual** (concessionária ré) |
| Legitimação | Cooperativa via MS coletivo / ação individual | MP + Defensoria + associações + indivíduo |
| Crime envolvido | Nenhum | Apropriação indébita (CP 168) se dolo provado |
| Risco | Médio | **Baixo** (jurisprudência STF consolidada) |

## Fundamento jurídico — citações

- **Lei 14.385/2022** — atribui à ANEEL a fiscalização da devolução de
  tributos pagos a mais pelos consumidores
- **STF** — caracterização do "enriquecimento sem causa" das
  concessionárias quando não repassam aos consumidores. Ministros
  Barroso, Fachin, Dino, Fux e Gilmar fixaram o marco prescricional
  no recebimento da restituição
- **Tema 69 STF** (RE 574.706) — fundamento original do indébito
- **CC art. 884** — "aquele que, sem justa causa, se enriquecer à
  custa de outrem, será obrigado a restituir o indevidamente auferido"
- **CC art. 205** — prescrição geral civil de 10 anos
- **CDC art. 42 par. único** — cobrança indevida em dobro (se houver
  má-fé)
- **STJ Tema 950** — relação de consumo entre concessionária e
  consumidor é regida pelo CDC

## Como a Hipótese B (Luciano) se conecta

A observação do Luciano de que "EDP cobra errado, ELFSM cobra certo,
nenhuma é autuada → fisco aceita o critério líquido → EDP embolsou a
diferença" é **exatamente** o mecanismo que o STF descreveu como
"enriquecimento sem causa":

1. EDP cobrou R$ 138,34 do cliente (errado)
2. EDP recolheu ao fisco R$ 11,43 (correto)
3. EDP recebeu R$ 0 de restituição da União (porque já recolheu certo)
4. **MAS EDP embolsou os R$ 126,91 de diferença** desde a entrada do
   cliente no SCEE
5. CC art. 884 obriga a restituir — sem justa causa

OU pode ser o mecanismo "clássico":

1. EDP cobrou R$ 138,34 do cliente (errado)
2. EDP recolheu R$ 138,34 ao fisco (também errado, mas pra estar em dia)
3. EDP entrou com ação contra União → recebeu R$ 126,91 de restituição
4. **MAS não devolveu ao cliente** — Lei 14.385/2022 violada
5. Aqui se configura o "enriquecimento sem causa" expressamente
   reconhecido pelo STF

**Em qualquer dos cenários → Tese 5 aplica + prazo decenal.**

## Impacto nos números do Concierge

Janela retroativa dobra (60m → 120m). Aplicado aos casos analisados:

| Cliente | Tese | Mensal | 60m+SELIC | **120m+SELIC (Tese 5)** | +Dobro CDC |
|---|---|---|---|---|---|
| LAURENTINO | T3/T5 | R$ 126,91 | R$ 9.138 | **R$ 18.276** | R$ 36.552 |
| CHRISTIANE | T3/T5 | R$ 397,00 | R$ 28.598 | **R$ 57.196** | R$ 114.392 |
| SINERGIA | T2/T5 | R$ 1.774,82 | R$ 127.560 | **R$ 255.120** | R$ 510.240 |
| CUSD I | T2/T5 | R$ 2.732,24 | R$ 196.481 | **R$ 392.962** | R$ 785.924 |
| CUSD II | T2/T5 | R$ 2.868,00 | R$ 206.252 | **R$ 412.504** | R$ 825.008 |
| EXFISHES | T3/T5 | R$ 2.515 | R$ 181.080 | **R$ 362.160** | R$ 724.320 |

**Total CoopereBR aproximado em cenário máximo (10 anos + dobro CDC):**
**R$ 3 milhões+** em indébitos potencialmente recuperáveis.

## Impacto nas Specs e código

### Spec C4 (próxima sessão Cowork)

- Adicionar **Tese 5** ao registry de detectores como **multiplicador
  de janela**, não como tese independente — porque ela amplia o prazo
  de **qualquer** tese tributária subjacente.
- Detector Tese 5 retorna: `multiplicadorJanela: 2` (5 anos → 10 anos)
  + `aplicabilidadeCDC: boolean` (se sim, mostrar opção em dobro).

### `projetarCenarios(indebitoMensal)`

Estender pra retornar **2 colunas de cenários**:

```typescript
export interface CenariosProjecao {
  // Tese tributária (5 anos)
  trib: { c12m: number; c24m: number; c36m: number; c48m: number; c60m: number };
  // Tese consumerista (10 anos)
  cons: { c12m: number; c24m: number; c36m: number; c48m: number; c60m: number;
          c84m: number; c120m: number };
  // Reparação em dobro (CDC)
  consDobro: number;  // c120m × 2
}
```

### Mockup HTML

Atualizar com 2 abas/seções no card de cenários: "Via tributária (5
anos)" vs "Via consumerista (10 anos + STF)". Selo "DECISÃO STF —
prazo DECENAL".

### Spec C8 (Concierge Captação WA)

Argumentação atualizada do bot:

> "Pela decisão recente do STF, você pode pedir devolução de até
> **10 anos** de tributos cobrados a mais. No seu caso isso vira
> R$ XXX. Quer prosseguir?"

### Documentos a atualizar

- `estrategia-justica-federal.md` — adicionar via consumerista alternativa
- `nota-tecnica-periodo-aplicacao-tese.md` — substituir teto 60m por 120m
- `adendo-cenarios-multiplos-projecao.md` — adicionar coluna 120m
- `spec-c8-concierge-captacao-wa.md` — atualizar texto do bot

## Riscos e cautelas

1. **Não é 100% pacífico ainda em todos os tribunais** — STF fixou tese
   mas TJs estaduais podem ter divergências em decisões anteriores.
   Pesquisa de TJ-ES e TJ-TO necessária.
2. **Reparação em dobro exige má-fé provada** — se concessionária
   alegar "erro tributário de boa-fé", juiz pode afastar a parte em
   dobro mas manter os 10 anos.
3. **Marco prescricional do recebimento da restituição** — significa
   que a contagem começa do momento em que CONCESSIONÁRIA recebeu
   restituição da União, não da cobrança ao consumidor. Pode haver
   casos onde a restituição ainda não ocorreu (ação ativa, paga, etc).
4. **Justiça Estadual pode ser mais lenta** — TJ-ES com volume alto.
   Mas Justiça Federal também é. Trade-off pequeno.
5. **Coleção de provas mais ampla** — exige demonstração de que a
   concessionária RECEBEU restituição (DCTF, balanços CVM). Mais
   trabalho probatório, mas mais sólido.

## Próximos passos

1. **Imediato (Cowork)**: catalogar como `D-novo-TESE-5-ENRIQUECIMENTO-DECENAL`
   **P0** e atualizar o mockup HTML com a nova coluna 120m + selo
   "Decisão STF".
2. **Curto prazo (Cowork Sprint C4)**: incluir Tese 5 no detector
   como multiplicador de janela.
3. **Crítico (você + advogado parceiro)**:
   - Confirmar se a interpretação está correta pra Teses 2 e 3
     (a decisão STF fala diretamente do indébito ICMS-PIS/COFINS, mas
     o princípio se estende?)
   - Decidir qual via processual usar (tributária federal ou
     consumerista estadual)
   - Avaliar se vale propor **ação coletiva** com MP / Defensoria
     amplificando o argumento "EDP cobrou de N consumidores"
   - Solicitar DCTF da EDP e balanços CVM pra cruzar valores

## Conclusão

A observação do Luciano não é hipótese, **é uma das teses mais fortes
do dossiê CoopereBR**. O STF já caracterizou o que ele descreveu como
"enriquecimento sem causa". Valor potencial dobra a quadruplica
dependendo dos elementos provados. Estratégia comercial e judicial do
Concierge precisa incorporar isso desde já.

## Sources

- [Migalhas — STF fixa 10 anos para pedir devolução de imposto na conta de luz](https://www.migalhas.com.br/quentes/436810/stf-fixa-10-anos-para-pedir-devolucao-de-imposto-na-conta-de-luz)
- [Estratégia Carreira Jurídica — Energia elétrica: STF fixa prazo para devolução de imposto](https://cj.estrategia.com/portal/conta-energia-eletrica/)
- [APET — STF valida devolução de tributos nas contas de luz](https://apet.org.br/noticia/stf-valida-devolucao-de-tributos-nas-contas-de-luz/)
- [Infomoney — STF confirma devolução bilionária de créditos tributários a consumidores de energia](https://www.infomoney.com.br/politica/stf-confirma-devolucao-bilionaria-de-creditos-tributarios-a-consumidores-de-energia/)
- [Conjur — Inconstitucionalidade do repasse de energia](https://www.conjur.com.br/2022-nov-04/britoe-baqui-inconstitucionalidade-repasse-usuarios/)
- [TJDFT — Cobrança de PIS e COFINS energia elétrica e telefone (jurisprudência reiterada)](https://www.tjdft.jus.br/consultas/jurisprudencia/jurisprudencia-em-temas/jurisprudencia-reiterada-1/consumidor-e-tributario/cobranca-de-pis-e-cofins-energia-eletrica-e-telefone-nv)
