# ARQUITETURA-RESUMO.md — CoopereBR
> Mapa de entidades, relacionamentos e fluxos. Atualizado em 15/04/2026.

---

## ENTIDADES CORE

### Cooperativa (TENANT ROOT)
- Raiz do multi-tenant. Todas as queries filtram por `cooperativaId`.
- `tipoParceiro`: COOPERATIVA | CONSORCIO | ASSOCIACAO | CONDOMINIO
- `modulosAtivos[]`: features habilitadas por cooperativa
- Relacionamentos: → Usinas[], Cooperados[], Contratos[], ConfiguracaoCobranca[], AsaasConfig

### Cooperado (MEMBRO)
- PF ou PJ. Possui UCs, contratos, propostas.
- `status`: PENDENTE → PENDENTE_DOCUMENTOS → APROVADO → ATIVO → SUSPENSO → ENCERRADO
- `tipoCooperado`: COM_UC | SEM_UC | GERADOR | CARREGADOR_VEICULAR
- `opcaoToken`: "A" (desconto direto) | "B" (acumula tokens)
- Relacionamentos: → UCs[], Contratos[], PropostaCooperado[], FaturasProcessadas[], CooperTokenSaldo

### UC — Unidade Consumidora (PONTO DE CONSUMO)
- Conta de luz do cooperado na concessionária.
- `distribuidora`: deve ser a mesma da usina vinculada (regra ANEEL).
- `numero` @unique
- Relacionamentos: → Contratos[], FaturasProcessadas[]

### Usina (GERADORA)
- Usina fotovoltaica arrendada pela cooperativa.
- `potenciaKwp`, `capacidadeKwh`, `producaoMensalKwh`
- `statusHomologacao`: CADASTRADA → HOMOLOGADA → EM_PRODUCAO → SUSPENSA
- Soma dos percentuais de contratos ATIVO + PENDENTE_ATIVACAO ≤ 100%
- Relacionamentos: → Contratos[], GeracoesMensais[], ConfiguracaoCobranca[]

### Contrato (VÍNCULO CENTRAL — liga tudo)
- Liga Cooperado ↔ UC ↔ Usina.
- `percentualUsina`: % da usina alocado para este cooperado
- `kwhContratoAnual/Mensal`: cota de energia contratada
- `percentualDesconto`: desconto base (ou override)
- `status`: PENDENTE_ATIVACAO → ATIVO → SUSPENSO → ENCERRADO | LISTA_ESPERA
- `modeloCobrancaOverride`: FIXO_MENSAL | CREDITOS_COMPENSADOS | CREDITOS_DINAMICO
- Relacionamentos: → Cobrancas[], ListaEspera?

### Cobrança (FATURAMENTO MENSAL)
- Gerada mensalmente para cada contrato ATIVO.
- `valorBruto`, `valorDesconto`, `valorLiquido`
- `kwhEntregue`, `kwhConsumido`, `kwhCompensado`
- `status`: PENDENTE → A_VENCER → PAGO | VENCIDO | CANCELADO
- Relacionamentos: → AsaasCobranca[], GeracaoMensal, FaturaProcessada

### GeracaoMensal (INPUT MANUAL)
- kWh efetivamente gerado pela usina em cada mês.
- Input manual do admin (ou futuro: integração Sungrow).
- `@@unique([usinaId, competencia])`
- Usado para ratear créditos: `kwhEntregue = kwhGerado × (percentualUsina / 100)`

### FaturaProcessada (OCR)
- Fatura da concessionária processada por Claude AI.
- `dadosExtraidos` Json: titular, UC, consumo, histórico 12m, créditos
- `status`: PENDENTE → APROVADA | REJEITADA
- `statusRevisao`: PENDENTE_REVISAO | AUTO_APROVADO | APROVADO | REJEITADO
- Vinculada ao cooperado por número de UC

### PropostaCooperado (MOTOR)
- Saída do Motor de Propostas.
- `kwhMesRecente`, `kwhMedio12m`, `descontoPercentual`, `economiaAnual`
- `status`: PENDENTE → **PENDENTE_ASSINATURA** → ASSINADA → ACEITA → CANCELADA ⚠️ status intermediários a implementar
- `aceitar()` → cria Contrato automaticamente (transação atômica)
- Após gerar proposta: enviar link `/assinar?token=xxx` por WA + email automaticamente
- Se não assinar em 24h: lembrete automático
- Após assinar: cooperado entra na fila de alocação em usina

### Plano
- Define modelo de cobrança e desconto base.
- `modeloCobranca`: FIXO_MENSAL | CREDITOS_COMPENSADOS | CREDITOS_DINAMICO | DESCONTO_DIRETO | FATURA_CHEIA_TOKEN
- `descontoBase`, `temPromocao`, `descontoPromocional`
- `baseCalculo`: KWH_CHEIO | VALOR_FATURA | COMPONENTES_CUSTOM

### ConfiguracaoCobranca (REGRA DE DESCONTO)
- Cascata: Contrato.descontoOverride → Config(cooperativaId, usinaId) → Config(cooperativaId, null) → ERRO
- `@@unique([cooperativaId, usinaId])`

---

## DIAGRAMA ER (SIMPLIFICADO)

```
Cooperativa (TENANT ROOT)
    ├── Usina[]
    │     ├── GeracaoMensal[]
    │     └── ConfiguracaoCobranca[]
    ├── Cooperado[]
    │     ├── UC[]
    │     ├── PropostaCooperado[]
    │     ├── FaturaProcessada[]
    │     ├── CooperTokenSaldo
    │     └── ProgressaoClube
    └── Contrato[] ← VÍNCULO CENTRAL
          ├── cooperadoId → Cooperado
          ├── ucId → UC
          ├── usinaId → Usina
          ├── planoId → Plano
          ├── propostaId → PropostaCooperado
          └── Cobranca[]
                ├── geracaoMensalId → GeracaoMensal
                ├── faturaProcessadaId → FaturaProcessada
                └── AsaasCobranca[]
```

---

## FLUXOS DE NEGÓCIO

### Fluxo 1: Cadastro → Ativação
```
Cooperado se cadastra (público /cadastro ou admin wizard)
  → status: PENDENTE
  → Upload docs → PENDENTE_DOCUMENTOS
  → Admin valida → APROVADO
  → Admin ativa manualmente → ATIVO
  → Todos contratos PENDENTE_ATIVACAO → ATIVO (cascata)
```

### Fluxo 2: Proposta → Assinatura → Contrato (fluxo CORRETO — parte a implementar)
```
Upload fatura PDF
  → Claude OCR → FaturaProcessada (PENDENTE)
  → Admin curadoria histórico 12 meses
  → Motor calcula: kwhApurado, desconto, economia, percentualUsina
  → PropostaCooperado (PENDENTE)
  → Sistema envia link /assinar?token=xxx por WA + email [A IMPLEMENTAR]
  → PropostaCooperado → PENDENTE_ASSINATURA [A IMPLEMENTAR]
  → Se não assinar em 24h: lembrete WA + email [A IMPLEMENTAR]
  → Cooperado assina digitalmente
  → PropostaCooperado → ASSINADA [A IMPLEMENTAR]
  → Sistema envia cópia por WA + email [A IMPLEMENTAR]
  → aceitar() [TRANSAÇÃO ATÔMICA]:
      - Verifica capacidade usina (soma % ≤ 100%)
      - Cria Contrato (PENDENTE_ATIVACAO)
      - Se sem capacidade → LISTA_ESPERA
```

**O que EXISTS hoje:**
- `enviarAssinatura(propostaId)` gera token e link `/assinar?token=xxx` ✅
- Página `/assinar/page.tsx` existe ✅
- `assinarDocumento(token, tipo, nome)` registra timestamp + nome ✅

**O que FALTA:**
- Envio automático do link após geração da proposta
- Status PENDENTE_ASSINATURA no ciclo de vida
- Lembrete automático se não assinar em X horas
- Cópia pós-assinatura por WA + email
- Integração D4Sign/ClickSign (hoje é só timestamp+nome)

### Fluxo 3: Geração → Rateio → Cobrança
```
Admin registra GeracaoMensal (kwhGerado da usina no mês)
  → Gerador de cobranças busca contratos ATIVO da usina
  → kwhEntregue = kwhGerado × (percentualUsina / 100)
  → Aplica cascata de desconto
  → Cria Cobrança
  → Gera Asaas (PIX/boleto)
  → Notifica cooperado via WhatsApp
  → Cooperado paga → Webhook Asaas → status PAGO
```

### Fluxo 4: Email IMAP → OCR → Cobrança
```
contato@cooperebr.com.br recebe PDF da EDP
  → email-monitor detecta (cron 6h ou manual)
  → Claude OCR extrai dados
  → Cria FaturaProcessada (PENDENTE, vinculada por número UC)
  → Notifica admin via WhatsApp
  → Admin revisa na Central de Faturas (/dashboard/faturas/central)
  → Admin aprova → gera Cobrança com dados reais (kWhCompensado real)
```

### Fluxo 5A: Wizard Admin vs Cadastro Público (LACUNAS CRÍTICAS)

**Wizard Admin (`/dashboard/cooperados/novo`) — 7 steps:**
```
Step 1: Upload fatura → OCR
Step 2: Dados pessoais
Step 3: Simulação + escolha plano (admin define %)
Step 4: Envia proposta via wa.me ou mailto — NÃO salva no banco! ❌
Step 5: Documentos
Step 6: Contrato
Step 7: Alocação → chama /motor-proposta/calcular (TARDE DEMAIS)
```

**Cadastro Público (`/cadastro`) — 4 steps:**
```
Step 1: Dados pessoais + endereço + instalação
Step 2: Upload fatura → OCR (opcional)
Step 3: Simulação + escolha plano
  → usa DESCONTO_PERCENTUAL_FALLBACK = 0.20 (hardcoded) ❌
  → campo plano.publico existe no banco mas é IGNORADO ❌
  → troca de plano NÃO recalcula desconto automaticamente ❌
Step 4: Finaliza → salva via /cooperados/cadastroWeb
  → NÃO gera proposta no Motor de Proposta ❌
```

**Lacunas identificadas:**
- Proposta do wizard admin só chega ao Motor no Step 7 (após documentos e contrato)
- Cadastro público ignora planos marcados como públicos pelo admin
- Desconto 20% hardcoded no cadastro público
- Usuário público escolhe plano (deveria ser o admin)
- Troca de plano no wizard admin não recalcula simulação automaticamente

### Fluxo 5: Ciclo do Contrato
```
PENDENTE_ATIVACAO → (cooperado ativado) → ATIVO
ATIVO → (inadimplência) → SUSPENSO → (regulariza) → ATIVO
ATIVO → (saída voluntária) → ENCERRADO
  → Libera percentualUsina
  → verificarListaEspera() → próximo da fila ativa
```

---

### Fluxo 6: Alocação com Rebalanceamento (a implementar)
```
Cooperado assina proposta → entra na fila de alocação
  → Sistema verifica capacidade disponível por usina (mesma distribuidora)
  → Se há espaço: aloca direto → Contrato PENDENTE_ATIVACAO
  → Se sem espaço numa usina: verifica combinação de sobras em 2-3 usinas
  → Sistema gera proposta de rebalanceamento para o admin
  → Admin aprova rebalanceamento [OBRIGATÓRIO — nunca automático]
  → Contratos ajustados + lista por usina gerada automaticamente
  → Notificação aos cooperados afetados
```

---

## CASO REAL: HANGAR ACADEMIA (MLM)

### Contexto
- Academia Hangar: grande consumidora → 2 UCs → 2 contratos
- UC1 (12.000 kWh/mês): EDP R$ 12.396,91 → CoopereBR R$ 9.835,93 → Economia R$ 2.458,98/mês
- UC2 (9.000 kWh/mês): EDP R$ 9.212,88 → CoopereBR R$ 7.289,51 → Economia R$ 1.822,38/mês
- **Total economia: R$ 4.281,36/mês (R$ 51.376/ano)**

### Estrutura MLM definida
```
Hangar (raiz/agregador)
  └── Professores × 20 (nível 1, média 500 kWh/mês)
        └── Alunos × 200 (nível 2, média 500 kWh/mês)
```

### Regras de benefício por nível
| Quem indica | Quem é indicado | Benefício indicador |
|---|---|---|
| Hangar | Professor | R$ 0,05/kWh recorrente |
| Professor | Aluno da academia | R$ 0,03/kWh + Hangar R$ 0,02/kWh |
| Professor | Aluno externo | R$ 0,05/kWh (sobe de nível) |
| Aluno | Qualquer | Precisa subir de nível (Clube) |

### Simulação financeira (131.000 kWh/mês na rede)
- Hangar: paga ~R$ 13.776 - recebe MLM ~R$ 2.500 = custo efetivo ~R$ 11.276/mês (vs R$ 17.220 EDP)
- Professor (10 alunos): paga R$ 328 + recebe R$ 250 MLM = custo efetivo **R$ 78/mês**
- Aluno: paga R$ 328/mês (20% desconto, sem MLM)

### O que o sistema suporta hoje
- ✅ MLM multi-nível com `ConfigIndicacao` (maxNiveis configurável)
- ✅ Modalidade `REAIS_KWH_RECORRENTE` implementada
- ✅ Link de convite `/cadastro?ref=CODIGO`

### O que FALTA para Hangar
- ❌ TipoCooperado.AGREGADOR com painel próprio de gestão da rede
- ❌ Relatório de rede por origem (todos que vieram da Hangar)
- ❌ Benefício diferenciado por papel (hoje só por nível numérico)
- **Recomendação imediata:** cadastrar Hangar com `codigoIndicacao`, `maxNiveis=3`, benefício em R$/kWh — funciona 100% hoje

---

## MÓDULOS COMPLEMENTARES

### CooperToken
- Ledger contábil: `CooperTokenLedger` (tipo, valor, cooperadoId, cooperativaId)
- Saldo: `CooperTokenSaldo` (totalAcumulado, totalUsado, saldoAtual)
- Tipos de crédito: BONUS_INDICACAO | FATURA_CHEIA | BONUS_ADMIN | COMPRA
- Uso: SEMPRE MANUAL pelo cooperado (abater fatura ou usar no Clube)
- Plano FATURA_CHEIA_TOKEN: paga valor cheio e acumula tokens

### Clube de Vantagens
- Tiers: BRONZE → PRATA → OURO → DIAMANTE
- `ProgressaoClube`: pontos, tier atual, histórico
- `OfertaClube`: parceiros, desconto em tokens
- `ResgateClubeVantagens`: log de resgates

### Indicações (MLM)
- `Indicacao`: quem indicou quem, status
- `BeneficioIndicacao`: crédito gerado pela indicação
- `ConfigIndicacao`: regras de comissão por cooperativa
- Idempotência: verificar duplicata por `cooperativaId` + `cooperadoId`

### Motor de Propostas
- Calcula economia projetada com base no histórico de consumo
- Gera PDF da proposta (PropostaPdfService)
- Aprovação remota: link por token (WA/email)
- Assinatura digital: termo + procuração por token
- Endpoints públicos: `/proposta-por-token/:token`, `/aprovar`, `/assinar`

### WhatsApp Bot
- `CoopereAI`: bot educativo para novos usuários (antes do menu)
- Menu principal: simulação, fatura, cadastro, atendimento, tokens
- Handlers: texto, áudio, vídeo, sticker, documento, imagem
- Timeout de estado: 30 min
- Buffer de mensagens durante reconexão

### Contas a Pagar (NOVO — abr/14)
- `ContaAPagar`: arrendamentos de usinas, manutenção, outras despesas
- CRUD completo + frontend em `/dashboard/contas-a-pagar/`

---

## FÓRMULAS CRÍTICAS

```typescript
// Percentual de usina
percentualUsina = (kwhContratoAnual / (usina.capacidadeKwhMensal * 12)) * 100

// kWh entregue ao cooperado
kwhEntregue = geracaoMensal.kwhGerado * (contrato.percentualUsina / 100)

// Valor da cobrança
valorBruto = kwhEntregue * tarifaKwh  // ou kwhCompensado para CREDITOS_COMPENSADOS
valorDesconto = Math.round(valorBruto * (percentualDesconto / 100) * 100) / 100
valorLiquido = Math.round((valorBruto - valorDesconto) * 100) / 100

// Multa e juros (usar calcularMultaJuros padronizado)
multa = valorLiquido * (multaAtraso / 100)
juros = valorLiquido * (jurosDiarios / 100) * diasAtraso
```

---

## ENUMS IMPORTANTES

```
StatusCooperado: PENDENTE | PENDENTE_DOCUMENTOS | APROVADO | ATIVO | SUSPENSO | ENCERRADO
StatusContrato: PENDENTE_ATIVACAO | ATIVO | SUSPENSO | ENCERRADO | LISTA_ESPERA
ModeloCobranca: FIXO_MENSAL | CREDITOS_COMPENSADOS | CREDITOS_DINAMICO
StatusCobranca: PENDENTE | A_VENCER | PAGO | VENCIDO | CANCELADO
StatusUsina: CADASTRADA | HOMOLOGADA | EM_PRODUCAO | SUSPENSA
PerfilUsuario: SUPER_ADMIN | ADMIN | OPERADOR | COOPERADO | AGREGADOR
TipoCooperado: COM_UC | SEM_UC | GERADOR | CARREGADOR_VEICULAR
```
