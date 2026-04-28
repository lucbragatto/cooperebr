# Central de Faturas da Concessionária — Fase 1

## CONTEXTO
Sistema SISGD — NestJS backend (porta 3000) + Next.js frontend em /web (porta 3001)
Já existe: FaturaProcessada no banco, POST /faturas/extrair (OCR), POST /faturas/processar

## OBJETIVO
Criar o fluxo completo:
1. Admin faz upload da fatura da concessionária na tela do cooperado
2. OCR extrai dados automaticamente
3. Sistema compara com contrato/plano do cooperado
4. Central de Faturas: fila de revisão para o admin
5. Admin aprova → sistema gera cobrança CoopereBR automaticamente
6. Email + WA enviado ao cooperado com relatório + fatura

---

## PARTE 1 — ABA "FATURAS" NA TELA DO COOPERADO

### 1.1 Backend — novo endpoint de upload com processamento automático
Arquivo: backend/src/faturas/faturas.controller.ts e faturas.service.ts

Novo endpoint POST /faturas/upload-concessionaria:
- Recebe: cooperadoId, arquivo PDF em base64, mesReferencia (ex: '2026-03')
- Chama extrairOcr() já existente
- Faz match automático: dadosExtraidos.numeroUC → busca UC no banco → vincula ao cooperado
- Salva FaturaProcessada com status 'PENDENTE_REVISAO'
- Puxa contrato ativo do cooperado para comparação
- Calcula análise: { kwhEsperado, kwhCompensado, kwhInjetado, saldoAtual, divergencia, divergenciaPerc }
- Salva análise em dadosExtraidos junto com os dados da OCR
- Se divergência < 5%: status = 'AUTO_APROVADO' e já dispara geração de cobrança
- Se divergência >= 5%: status = 'PENDENTE_REVISAO' (admin precisa revisar)
- Retorna: fatura processada + análise + sugestão de cobrança

Adicionar ao modelo FaturaProcessada no schema (se não existir):
```prisma
analise         Json?   // { kwhEsperado, kwhCompensado, kwhInjetado, saldoAtual, divergencia, divergenciaPerc, statusAnalise }
mesReferencia   String? // '2026-03'
statusRevisao   String  @default("PENDENTE_REVISAO") // PENDENTE_REVISAO | AUTO_APROVADO | APROVADO | REJEITADO
cobrandaGeradaId String? // ID da cobrança gerada após aprovação
```
Aplicar: cd backend && npx prisma db push

### 1.2 Backend — gerar cobrança após aprovação
Arquivo: backend/src/faturas/faturas.service.ts

Método gerarCobrancaPosFatura(faturaId: string):
- Busca FaturaProcessada com dadosExtraidos e analise
- Busca cooperado, contrato ativo, plano
- Calcula valor da cobrança CoopereBR conforme modelo de cobrança do plano:
  - Se modelo PERCENTUAL: valor = kwhCompensado * tarifaKwh * percentualPlano
  - Se modelo FIXO: valor = mensalidadeFixa do contrato
  - Aplica benefícios de indicação se houver (chama aplicarBeneficiosNoFechamento)
- Cria Cobrança no banco (modelo já existe)
- Retorna cobrança criada

Endpoint PATCH /faturas/:id/aprovar já existe — expandir para chamar gerarCobrancaPosFatura() após aprovação

### 1.3 Frontend — aba na tela do cooperado
Arquivo: web/app/dashboard/cooperados/[id]/page.tsx (ou rota equivalente — verificar onde está a tela do cooperado)

Adicionar aba "Faturas Concessionária" na tela do cooperado com:
- Lista de faturas processadas do cooperado (GET /faturas/cooperado/:id)
- Cada fatura mostra: mês, distribuidora, kWh compensado, saldo, status, valor cobrança gerada
- Botão "Upload fatura" que abre modal:
  - Input de arquivo PDF
  - Campo mês de referência
  - Ao enviar: POST /faturas/upload-concessionaria com arquivo em base64
  - Mostra resultado da análise: comparativo contrato vs fatura + badge verde/amarelo/vermelho
- Se status PENDENTE_REVISAO: botão "Aprovar" e "Rejeitar" (PATCH /faturas/:id/aprovar)
- Se AUTO_APROVADO ou APROVADO: badge verde + link para a cobrança gerada

---

## PARTE 2 — CENTRAL DE FATURAS (FILA DE REVISÃO)

### 2.1 Backend
Arquivo: backend/src/faturas/faturas.controller.ts

Novo endpoint GET /faturas/central:
- Parâmetros: cooperativaId (do JWT), status?, mesReferencia?, page, limit
- Retorna lista de FaturaProcessada com join em cooperado, uc, cobrança gerada
- Ordenação: PENDENTE_REVISAO primeiro, depois AUTO_APROVADO, depois APROVADO
- Inclui métricas: total pendentes, total auto-aprovados, total aprovados, total sem fatura no mês

Novo endpoint GET /faturas/central/resumo:
- Retorna por mês: { mesReferencia, totalCooperados, comFatura, semFatura, pendentes, aprovados, totalCobrancas }

### 2.2 Frontend — página da Central de Faturas
Criar: web/app/dashboard/faturas/central/page.tsx
(ou web/app/parceiro/faturas/page.tsx para o admin do parceiro)

Layout em duas seções:

**Seção superior — Cards de resumo do mês:**
```
[📄 Total faturado: 47]  [✅ Aprovados: 32]  [⚠️ Revisar: 8]  [🔴 Sem fatura: 7]
```

**Seção principal — Tabela de cooperados:**
Colunas: Nome | UC | Mês | kWh Injetado | kWh Compensado | Saldo | Divergência | Cobrança | Status | Ações

- Status badges: ✅ AUTO_APROVADO (verde) | ⚠️ PENDENTE_REVISAO (amarelo) | 🔴 SEM_FATURA (vermelho)
- Filtros: por mês, por status
- Ação rápida: botão Aprovar inline (sem abrir tela do cooperado)
- Ação upload: botão "Enviar fatura" para cooperados sem fatura no mês
- Click na linha: abre modal com detalhes completos da fatura + análise

**Modal de detalhe (ao clicar na linha):**
- Dados extraídos da concessionária (todos os campos)
- Comparativo lado a lado: Contrato vs Fatura real
- Histórico de consumo (gráfico de barras últimos 12 meses)
- Valor sugerido de cobrança com detalhamento
- Botões: Aprovar / Rejeitar / Editar valor

Adicionar item no menu dashboard (ADMIN/SUPER_ADMIN): "Central de Faturas" → /dashboard/faturas/central
Adicionar no menu parceiro: "Central de Faturas" → /parceiro/faturas

---

## PARTE 3 — RELATÓRIO MENSAL BONITO (PDF ou HTML)

### 3.1 Backend — gerar relatório
Arquivo: novo backend/src/faturas/relatorio-fatura.service.ts

Método gerarRelatorioMensal(cooperadoId, mesReferencia):
Retorna objeto estruturado com:
```typescript
{
  cooperado: { nome, uc, distribuidora, endereco },
  periodo: { mes, ano },
  faturaConcessionaria: {
    totalPago,
    consumoKwh,
    kwhCompensado,
    kwhInjetado,
    saldoAnterior,
    saldoAtual,
    tarifaTUSD,
    tarifaTE,
    bandeira,
    impostos: { icms, pisCofins, cip },
  },
  faturaCoopereBR: {
    valorCobrado,
    kwhUtilizados,
    beneficiosAplicados,
    totalDesconto,
    valorLiquido,
  },
  economia: {
    valorSemGD,           // quanto pagaria sem a cooperativa
    valorComGD,           // quanto pagou de fato (concessionária + CoopereBR)
    economiaReais,        // diferença
    economiaPercentual,   // %
    economiaAcumuladaAno, // soma do ano
  },
  historico: [           // últimos 6 meses
    { mes, kwhCompensado, valorCobrado, economia }
  ],
  mensagem: string,      // mensagem personalizada do admin (opcional)
}
```

Endpoint GET /faturas/:id/relatorio → retorna esse objeto
Endpoint GET /faturas/:id/relatorio/html → retorna HTML formatado para envio

### 3.2 Frontend — componente de relatório visual
Criar: web/components/RelatorioFaturaCooperado.tsx

Componente bonito com:

**Header:**
- Logo SISGD + Nome do parceiro (CoopereBR)
- Nome do cooperado + UC + mês de referência
- Badge verde "Energia Solar Compartilhada ☀️"

**Bloco 1 — Sua economia este mês:**
- Destaque grande: "Você economizou R$ 127,40 (32%)"
- Barra de progresso: valor sem GD vs valor com GD
- Economia acumulada no ano

**Bloco 2 — Seus créditos:**
- kWh injetados na rede
- kWh compensados na sua UC
- Saldo atual em kWh
- Mini gráfico de barras: histórico 6 meses

**Bloco 3 — Detalhamento da fatura concessionária:**
- Tabela compacta: consumo, TUSD, TE, bandeira, impostos, compensação GD
- Total pago à concessionária

**Bloco 4 — Fatura CoopereBR:**
- Valor base
- Benefícios de indicação descontados (se houver)
- Total a pagar
- Código de barras / PIX QR code (se cobrança já gerada)

**Footer:**
- "Dúvidas? Fale conosco via WhatsApp"
- Link para portal do cooperado

Usar Tailwind + shadcn para o design. Deve ser bonito o suficiente para o cooperado querer mostrar para os amigos.

### 3.3 Envio automático após aprovação
Arquivo: backend/src/faturas/faturas.service.ts

No método aprovarFatura() (após gerar cobrança):
1. Buscar dados do cooperado + fatura + cobrança
2. Chamar gerarRelatorioMensal() para montar o HTML
3. Enviar email com HTML do relatório + link para portal (via EmailService já existente)
4. Enviar WA: mensagem resumida com os dados principais + link para ver relatório completo
   Formato WA: "Olá [Nome]! 🌞 Sua fatura de [mês] está disponível. Você economizou R$[X] ([Y]%) este mês! Ver relatório completo: [link]"

---

## PARTE 4 — PORTAL DO COOPERADO: HISTÓRICO DE FATURAS

### 4.1 Expandir web/app/portal/financeiro/page.tsx
Adicionar seção "Minhas Faturas da Concessionária":
- Lista das faturas processadas (GET /faturas/cooperado/:cooperadoId com cooperadoId do JWT)
- Cada item: mês, kWh compensado, economia, status
- Click: abre modal com RelatorioFaturaCooperado.tsx completo
- Botão "Enviar minha fatura" (self-service — POST /faturas/upload-concessionaria)
  Com instrução: "Escaneie ou fotografe sua fatura e envie para análise"

---

## ORDEM DE EXECUÇÃO
1. Schema (db push)
2. Backend: upload-concessionaria + análise automática
3. Backend: gerarCobrancaPosFatura + aprovarFatura expandido
4. Backend: GET /faturas/central + resumo
5. Backend: relatorio-fatura.service.ts
6. Frontend: aba na tela do cooperado (dashboard)
7. Frontend: Central de Faturas (página)
8. Frontend: componente RelatorioFaturaCooperado
9. Frontend: portal do cooperado (histórico + self-service)
10. Backend: envio automático email + WA após aprovação

## APÓS CONCLUIR
Commit: 'feat: central de faturas, relatorio mensal cooperado, upload concessionaria'
Execute: openclaw system event --text "Done: central faturas, relatorio mensal, upload concessionaria" --mode now
