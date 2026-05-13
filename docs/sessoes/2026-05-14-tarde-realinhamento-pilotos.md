# Sessão 2026-05-14 tarde — Realinhamento (pilotos não rodaram + D-WIZARD fix + D-45/D-46/D-47 catalogados)

## TL;DR

Sessão de **alta entropia** disparada por screenshots em sequência do Luciano. Resultado:
- ✅ **D-WIZARD resolvido** (commit `0448f9b`) — Step5Cobranca.tsx enum corrigido
- ✅ **D-45 catalogado** (P2) — wizard `/dashboard/cooperados/novo` com 4 erros encadeados
- ✅ **D-46 catalogado** (P2 chapéu, 12 sub-itens) — divergências spec↔Plano/engine
- ✅ **D-47 catalogado** (P3) — confusão nomes OURO/PRATA Plano↔PlanoSaas
- ✅ **docs/especificacao-modelos-cobranca.md + MAPA-INTEGRIDADE atualizados** (`cc5472e`) — estado pós-Fase B
- ❌ **Sub-Fase A canário (4 cooperados FIXO) NÃO RODOU** — Code parou em Fase 1 read-only aguardando 3 OKs que respondi no claude.ai mas não empaqueteimos como prompt comandante pro Code colar
- ❌ **Sub-Fase B AMAGES COMPENSADOS adiada** — depende de Sub-Fase A fechar primeiro

## Autocrítica documentada

Decisão 23 aplicada **5 vezes em 48h** (4ª aplicação já registrada — esta sessão produziu a 5ª: "engines COMPENSADOS/DINAMICO bloqueadas" virou "implementadas + E2E sintético ok" + 12 divergências achadas pelo sub-agente).

Erros desta sessão (catalogados como aprendizado pra próxima):

1. **Reativo, não proativo** — cada screenshot virou investigação ad-hoc sem plano técnico
2. **Ordem errada** — atualizei docs (`cc5472e`) antes de fazer diff spec↔código completo; segunda investigação (D-46) achou 13 divergências adicionais; correção precisou ser feita em 2 ciclos quando 1 bastava
3. **Falha de orquestração Code** — respondi 3 OKs aqui no claude.ai sem empacotar como prompt copy-paste pra Code executar; Code ficou parado; banco continua vazio dos pilotos. **Esse foi o erro mais caro** e é exatamente o cenário que o `feedback_frase_retomada_direta.md` previa
4. **Saltei de assunto** — Sub-Fase A → AMAGES → D-46 → D-WIZARD → autocrítica. Nada fechado.

## Estado real do banco CoopereBR (Code reportou no último turno)

- 0 cooperados-piloto criados nesta sessão (DIEGO/CAROLINA/ALMIR/THEOMAX = todos pendentes)
- 0 UCs criadas
- 0 FaturasProcessadas criadas
- 0 Contratos criados
- 0 Cobranças geradas
- `BLOQUEIO_MODELOS_NAO_FIXO` continua `undefined` no `.env` (default `true` = ativo)
- Usina `usina-linhares` continua com `distribuidora = "EDP ES"` (string com espaço — desalinhada com enum `EDP_ES`)
- Plano `cmn7ru9970004uokcfwydmqjm` (Plano Individual Residencial FIXO_MENSAL 18%) confirmado disponível

## 4 scripts read-only criados pelo Code (zero produção tocada)

Verificar/decidir limpeza na próxima sessão:
- `backend/scripts/investigar-fatia-a-canario.ts`
- `backend/scripts/validar-adriana-agostinho-canario.ts`
- `backend/scripts/fase1-validar-piloto-4-cooperados.ts`
- `backend/scripts/verificar-pre-req-subfase-a.ts`

Todos SELECT-only, fora do `tsconfig.build.json`, não vão pro `dist/`.

## Decisões já tomadas (válidas pra próxima sessão Code)

### OKs respondidos pelos 3 gates Sub-Fase A

1. ✅ **UPDATE usina-linhares.distribuidora `'EDP ES'` → `'EDP_ES'`** — autorizado. Auditoria CLAUDE.md regra atendida: 1 registro, valor textual normalizado, sem perda, reversível.
2. ✅ **Emails sintéticos `piloto.<nome>@cooperebr.invalid`** — autorizado. TLD `.invalid` é reservado IANA (RFC 2606), nunca resolve DNS. Combinado com `ambienteTeste=true` = blindagem dupla.
3. ✅ **Status `ATIVO` direto** (em vez de PENDENTE_ATIVACAO) — autorizado. Critério Fase 4 exige cobrança gerada via engine FIXO; se exigir Contrato.status=ATIVO, PENDENTE_ATIVACAO bloqueia. Anotar no doc da próxima sessão: "promovido manualmente — em produção real seria via UI admin".

### Bloqueio crítico Sub-Fase B AMAGES (D-46.SEED)

Antes de desligar `BLOQUEIO_MODELOS_NAO_FIXO=false` no `.env`, OBRIGATÓRIO rodar:

```sql
UPDATE planos
SET publico = false
WHERE nome IN ('PLANO OURO', 'PLANO PRATA', 'CONSUMO DE CREDITOS DE KWH');
```

Senão, esses 3 planos `Plano` (membro, `CREDITOS_COMPENSADOS`, criados por `seed.ts:194-220`) vazam pra vitrine pública automaticamente. Confirmado em `planos.service.ts:91-96` — filtro `findAtivos(publico=true)` os esconde só enquanto BLOQUEIO ativo.

## PROMPT SUB-FASE A PRONTO PARA EXECUTAR (copy-paste no Code na próxima sessão)

````
TAREFA: Executar Sub-Fase A do canário 14/05 — cadastrar 4 cooperados-piloto
em modelo FIXO_MENSAL na cooperativa CoopereBR via Prisma direto (NÃO via UI).

Pré-requisito: Fase 1 read-only desta tarefa JÁ FOI executada na sessão Code
anterior (14/05 tarde). Resultados validados:
- PM2 cooperebr-backend online (id 0)
- CoopereBR real: cmn0ho8bx0000uox8wu96u6fd
- Plano Individual Residencial FIXO_MENSAL: cmn7ru9970004uokcfwydmqjm
- BLOQUEIO_MODELOS_NAO_FIXO continua default true (FIXO_MENSAL liberado)
- Dedup: 0 conflitos com CPF/CNPJ dos 4 candidatos
- 2 BLOCKERS resolvidos com OKs do Luciano (ver abaixo)

============================================================
PRÉ-EXECUÇÃO (Sub-step 0)
============================================================

OK 1 — UPDATE Usina Linhares.distribuidora "EDP ES" → "EDP_ES":

UPDATE usinas SET distribuidora = 'EDP_ES' WHERE id = 'usina-linhares';

OK 2 — Emails sintéticos piloto.<nome>@cooperebr.invalid:
- piloto.diego.allan@cooperebr.invalid
- piloto.carolina.lemos@cooperebr.invalid
- piloto.almir.muniz@cooperebr.invalid
- piloto.theomax@cooperebr.invalid

OK 3 — Status Contrato ATIVO direto após aceitar() (não deixar PENDENTE_ATIVACAO).

============================================================
DADOS DOS 4 COOPERADOS (Fase 2)
============================================================

Todos com:
- cooperativaId = cmn0ho8bx0000uox8wu96u6fd (CoopereBR real)
- ambienteTeste = true
- status = ATIVO
- planoId = cmn7ru9970004uokcfwydmqjm

--- COOPERADO 1: DIEGO ---
nomeCompleto: DIEGO ALLAN CORREIA PEREIRA
cpf: 05375082799
tipoPessoa: PF
email: piloto.diego.allan@cooperebr.invalid
telefone: null
endereco: RUA PERNAMBUCO 120 AP 1503 ED VERANNO
bairro: PRAIA DA COSTA
cidade: VILA VELHA
estado: ES
cep: 29101-335
UC: { numero: '0.001.516.624.054-75', distribuidora: EDP_ES,
      classe: B1_RESIDENCIAL, tipoFornecimento: TRIFASICO }
FaturaProcessada: { mesReferencia: 1, anoReferencia: 2026,
  consumoKwh: 490, valorTotal: 545.95, valorCheioKwh: 1.11418,
  tarifaSemImpostos: 0.78931, dataVencimento: 2026-01-15,
  dataLeitura: 2026-01-02, emissao: 2026-01-05,
  bandeiraTarifaria: AMARELA, status: APROVADA }

--- COOPERADO 2: CAROLINA (UC FLAT) ---
nomeCompleto: CAROLINA LEMOS CRAVO
cpf: 08649654789
tipoPessoa: PF
email: piloto.carolina.lemos@cooperebr.invalid
telefone: null
endereco: AV ANTONIO GIL VELOSO 1950 AP 706 ED OCEAN FLAT
bairro: PRAIA DA COSTA
cidade: VILA VELHA
estado: ES
cep: 29101-022
UC: { numero: '0.000.897.339.054-90', distribuidora: EDP_ES,
      classe: B3_COMERCIAL, tipoFornecimento: MONOFASICO }
FaturaProcessada: { mesReferencia: 1, anoReferencia: 2026,
  consumoKwh: 146, valorTotal: 173.56, valorCheioKwh: 1.18877,
  tarifaSemImpostos: 0.78931, dataVencimento: 2026-01-15,
  dataLeitura: 2026-01-02, emissao: 2026-01-05,
  bandeiraTarifaria: AMARELA, status: APROVADA }

--- COOPERADO 3: ALMIR (REMAX LOJA) ---
nomeCompleto: ALMIR JOAO MUNIZ FREITAS
cpf: 68691157704
tipoPessoa: PF
email: piloto.almir.muniz@cooperebr.invalid
telefone: null
endereco: RUA AURORA 612 CX 02
bairro: GLORIA
cidade: VILA VELHA
estado: ES
cep: 29122-280
UC: { numero: '0160213718', distribuidora: EDP_ES,
      classe: B1_RESIDENCIAL, tipoFornecimento: TRIFASICO }
Nota: numero da UC formato ANTIGO (pré-2026). Confirmar campo aceita.
FaturaProcessada: { mesReferencia: 12, anoReferencia: 2025,
  consumoKwh: 1061, valorTotal: 1147.47, valorCheioKwh: 1.08150,
  tarifaSemImpostos: 0.78931, dataVencimento: 2025-12-30,
  dataLeitura: 2025-12-15, emissao: 2025-12-16,
  bandeiraTarifaria: VERMELHA_PTM1, status: APROVADA }

--- COOPERADO 4: THEOMAX (PJ) ---
nomeCompleto: THEOMAX COMERCIO DE CALCADOS E ACESSORIOS LTDA
cpf: 43896674000129    (campo unico cooperados.cpf serve PF+PJ)
tipoPessoa: PJ
email: piloto.theomax@cooperebr.invalid
telefone: null
representanteLegalNome: (deixar generico ou null)
representanteLegalCpf: null
representanteLegalCargo: null
endereco: RUA FRANCISCO EUGENIO MUSSIELLO 750 LJ 12 ED SANTAREM
bairro: JARDIM DA PENHA
cidade: VITORIA
estado: ES
cep: 29060-290
UC: { numero: '0000652942', distribuidora: EDP_ES,
      classe: B1_RESIDENCIAL, tipoFornecimento: BIFASICO }
Nota: numero da UC formato ANTIGO (pré-2026).
FaturaProcessada: { mesReferencia: 12, anoReferencia: 2025,
  consumoKwh: 1143, valorTotal: 1233.33, valorCheioKwh: 1.07903,
  tarifaSemImpostos: 0.78931, dataVencimento: 2025-12-15,
  dataLeitura: 2025-12-02, emissao: 2025-12-03,
  bandeiraTarifaria: VERMELHA_PTM1, status: APROVADA }

============================================================
SEQUENCIA OPERACIONAL POR COOPERADO (Fase 3)
============================================================

Ordem por cooperado (sequencial, 1 por vez):

1. prisma.cooperado.create({ data: { ...campos acima } })
2. prisma.uc.create({ data: { ucPayload, cooperadoId: <id>, cooperativaId } })
3. prisma.faturaProcessada.create({
     data: { ...campos fatura, ucId, cooperadoId, cooperativaId,
             status: 'APROVADA' }
   })
4. motorPropostaService.aceitar({
     cooperadoId, ucId, planoId, faturaProcessadaId, ...
   }, cooperativaId, userId)
   → cria Proposta + Contrato com snapshots Fase B
5. prisma.contrato.update({
     where: { id: novoContratoId },
     data: { status: 'ATIVO' }   ← Promove de PENDENTE_ATIVACAO
   })
6. faturasService.gerarCobrancaPosFatura(faturaProcessadaId) ou método
   equivalente disponível no service → engine FIXO_MENSAL
   (faturas.service.ts:1862-1902) grava:
   - modeloCobrancaUsado: 'FIXO_MENSAL'
   - valorBruto, valorDesconto, valorLiquido
   - valorEconomiaMes, valorEconomiaAno, economia5anos, economia15anos
   - LancamentoCaixa PREVISTO

Após cada cooperado, SELECT confirmando 6 entidades criadas:
SELECT c.id, c."nomeCompleto", u.numero, fp.status as fp_status,
       p.id as proposta_id, ct.id as contrato_id, ct.status as ct_status,
       cb."modeloCobrancaUsado", cb."valorLiquido", cb."valorEconomiaMes"
FROM "Cooperado" c
LEFT JOIN "Uc" u ON u."cooperadoId" = c.id
LEFT JOIN "FaturaProcessada" fp ON fp."ucId" = u.id
LEFT JOIN "Proposta" p ON p."cooperadoId" = c.id
LEFT JOIN "Contrato" ct ON ct."cooperadoId" = c.id
LEFT JOIN "Cobranca" cb ON cb."contratoId" = ct.id
WHERE c.cpf = '<cpf>';

Se falhar em qualquer passo:
- Reportar exceção exata
- NÃO tentar reverter automaticamente
- Aguardar instrução

============================================================
FASE 4 — VALIDACAO AGREGADA
============================================================

Após 4 ciclos:

SELECT COUNT(*) FROM "Cooperado"
WHERE "cooperativaId" = 'cmn0ho8bx0000uox8wu96u6fd'
  AND "ambienteTeste" = true
  AND cpf IN ('05375082799','08649654789','68691157704','43896674000129');
-- Esperado: 4

SELECT COUNT(*) FROM "Contrato"
WHERE status = 'ATIVO'
  AND "valorContrato" IS NOT NULL
  AND "valorCheioKwhAceite" IS NOT NULL
  AND "baseCalculoAplicado" IS NOT NULL
  AND "cooperadoId" IN (<4 ids>);
-- Esperado: 4

SELECT COUNT(*), SUM("valorLiquido"), SUM("valorEconomiaMes") FROM "Cobranca"
WHERE "modeloCobrancaUsado" = 'FIXO_MENSAL'
  AND "valorEconomiaMes" > 0
  AND "contratoId" IN (<4 contratos>);
-- Esperado: count = 4, somas > 0

============================================================
FECHAMENTO SUB-FASE A
============================================================

Se 4/4 ok:
1. Commit: "feat(canario): 4 cooperados-piloto FIXO_MENSAL E2E real"
   - inclui 4 cooperados + 4 UCs + 4 faturas + 4 propostas + 4 contratos + 4 cobranças
2. Doc nova: docs/sessoes/2026-05-15-canario-sub-fase-a-fixo.md
   - lista IDs Prisma + SELECTs validação + critério atendido
3. Atualizar docs/CONTROLE-EXECUCAO.md:
   - "Última sessão" = 2026-05-15
   - frase de retomada: comandante para Sub-Fase B AMAGES
4. Reportar resumo ao Luciano + perguntar se libera Sub-Fase B

Se < 4/4:
1. NÃO commit
2. Reportar exceção exata + estado parcial banco
3. Aguardar instrução Luciano

============================================================
RESTRIÇÕES
============================================================

- NÃO desligar BLOQUEIO_MODELOS_NAO_FIXO (Sub-Fase B fará isso, não esta)
- NÃO mexer em planos seed (D-46.SEED será resolvido em Sub-Fase B)
- NÃO renomear PLANO OURO/PRATA (D-47 fica pra sessão dedicada)
- NÃO tocar nos 4 scripts read-only deixados na sessão anterior (decidir limpeza depois)
- NÃO usar UI wizard /dashboard/cooperados/novo (D-45 não corrigido)
- ambienteTeste=true em todos pra blindar SMTP/WA
````

## D-46.SEED + D-47 não bloqueiam Sub-Fase A

Esses 2 débitos só ficam relevantes em Sub-Fase B (quando BLOQUEIO desligar). Sub-Fase A roda em FIXO_MENSAL liberado, sem precisar tocar nesses planos.

## Frase de retomada (Decisão 24 — local único)

"Code: abra `docs/sessoes/2026-05-14-tarde-realinhamento-pilotos.md` → seção **PROMPT SUB-FASE A PRONTO PARA EXECUTAR** → execute o prompt EXATAMENTE como está. Não improvise."

## Próximos passos pós Sub-Fase A

1. Sub-Fase B AMAGES COMPENSADOS — prompt em `docs/sessoes/2026-05-14-tarde-realinhamento-pilotos.md` (PENDENTE de criar — fazer ao iniciar próxima sessão após Sub-Fase A fechar)
2. D-46.SEED mitigação (UPDATE publico=false 3 planos legados) ANTES de desligar BLOQUEIO
3. D-47 renomeação OURO/PRATA (sessão dedicada, ~30min)
4. D-45 fix wizard cadastro cooperados (4-6h Code, sessão dedicada)
5. D-46 ALTAS restantes (8-12h Code, fatias)
