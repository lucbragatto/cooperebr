# Sondagem T4 complemento — 21/04/2026

## HEAD
```
c5d01cd6af6b70b0f6e908240b1522b2689af780
```

## Item 1 — Função de cálculo unificado

### Localização

```
faturas.service.ts:1577:  private async calcularValorCobrancaPorModelo(args: {
```

Início: linha 1577. Fim: linha 1710.

### Funções auxiliares chamadas

```
faturas.service.ts:1712:  private async resolverModeloCobranca(...)   // linhas 1712-1736
faturas.service.ts:1555:  private resolverDescontoContrato(...)       // linhas 1555-1558
faturas.service.ts:1561:  private resolverPoliticaBandeira(...)       // linhas 1561-1569
```

### Código completo

```typescript
  private resolverDescontoContrato(contrato: any): number {
    const pct = Number(contrato.descontoOverride ?? contrato.percentualDesconto ?? 0);
    return pct / 100;
  }

  /** Retorna se bandeira deve ser cobrada para esse contrato. */
  private resolverPoliticaBandeira(contrato: any): boolean {
    const politica =
      contrato.usina?.politicaBandeira ??
      contrato.cooperativa?.politicaBandeira ??
      'DECIDIR_MENSAL';
    return politica === 'APLICAR';
  }

  /**
   * Núcleo único de cálculo de cobrança. Retorna objeto com valores
   * calculados + snapshots de auditoria. NÃO persiste.
   *
   * Consumidores: gerarCobrancaPosFatura (Path A) e aprovarFatura (Path B).
   */
  private async calcularValorCobrancaPorModelo(args: {
    contrato: any;
    fatura: any;
    cooperativaId: string;
  }): Promise<{
    valorBruto: number;
    valorDesconto: number;
    valorLiquido: number;
    kwhEntregue: number | null;
    kwhCompensado: number | null;
    modeloCobrancaUsado: ModeloCobranca;
    consumoBruto: number | null;
    tarifaApurada: number | null;
    tarifaContratualAplicada: number | null;
    bandeiraAplicada: boolean;
    valorTotalFatura: number | null;
  }> {
    const { contrato, fatura, cooperativaId } = args;

    // ─── Blindagem multi-tenant ─────────────────────────────────────
    const tenantId = contrato.cooperativaId;
    if (!tenantId) {
      throw new BadRequestException(
        `Contrato ${contrato.numero} sem cooperativaId — dados corrompidos.`,
      );
    }
    const divergencias: string[] = [];
    if (contrato.cooperado?.cooperativaId && contrato.cooperado.cooperativaId !== tenantId) {
      divergencias.push(`cooperado=${contrato.cooperado.cooperativaId}`);
    }
    if (contrato.usina?.cooperativaId && contrato.usina.cooperativaId !== tenantId) {
      divergencias.push(`usina=${contrato.usina.cooperativaId}`);
    }
    if (fatura?.cooperativaId && fatura.cooperativaId !== tenantId) {
      divergencias.push(`fatura=${fatura.cooperativaId}`);
    }
    if (divergencias.length > 0) {
      throw new ForbiddenException(
        `Violação multi-tenant no contrato ${contrato.numero}. ` +
        `Esperado cooperativaId=${tenantId}, divergem: ${divergencias.join(', ')}.`,
      );
    }

    // ─── Resolução de parâmetros ────────────────────────────────────
    const modelo = await this.resolverModeloCobranca(contrato, contrato.usina, cooperativaId);
    const desconto = this.resolverDescontoContrato(contrato);
    const bandeiraCobrada = this.resolverPoliticaBandeira(contrato);

    // Extração de dados do OCR
    const dadosOCR = (fatura?.dadosExtraidos ?? {}) as any;
    const kwhCompensadoOCR = Number(dadosOCR.creditosRecebidosKwh ?? 0) || 0;
    const kwhConsumidoOCR = Number(dadosOCR.consumoAtualKwh ?? 0) || 0;
    const valorTotalOCR = Number(dadosOCR.totalAPagar ?? 0) || null;

    switch (modelo) {
      case 'FIXO_MENSAL': {
        const valorContrato = Number(contrato.valorContrato ?? 0);
        if (!valorContrato || valorContrato <= 0) {
          throw new BadRequestException(
            `Contrato ${contrato.numero} está em FIXO_MENSAL mas ` +
            `valorContrato não foi preenchido. Preencha o valor mensal ` +
            `fixo antes de gerar cobrança.`,
          );
        }
        // FIXO: valor já embute tudo. Desconto NÃO é aplicado de novo.
        return {
          valorBruto: valorContrato,
          valorDesconto: 0,
          valorLiquido: Math.round(valorContrato * 100) / 100,
          kwhEntregue: null,
          kwhCompensado: null,
          modeloCobrancaUsado: 'FIXO_MENSAL',
          consumoBruto: kwhConsumidoOCR || null,
          tarifaApurada: null,
          tarifaContratualAplicada: null,
          bandeiraAplicada: false,
          valorTotalFatura: valorTotalOCR,
        };
      }

      case 'CREDITOS_COMPENSADOS': {
        const tarifaContratual = Number(contrato.tarifaContratual ?? 0);
        // Fallback: tarifa apurada da fatura OCR (valorTotal / consumo)
        const tarifaApuradaOCR = kwhConsumidoOCR > 0 && valorTotalOCR
          ? Math.round((valorTotalOCR / kwhConsumidoOCR) * 100000) / 100000
          : 0;
        const tarifaUsada = tarifaContratual > 0 ? tarifaContratual : tarifaApuradaOCR;

        if (!kwhCompensadoOCR || !tarifaUsada) {
          throw new BadRequestException(
            `Contrato ${contrato.numero} (COMPENSADOS): faltam dados. ` +
            `kwhCompensado=${kwhCompensadoOCR}, tarifa=${tarifaUsada}. ` +
            `Verifique se a fatura foi OCR corretamente e se tarifaContratual ` +
            `está preenchida no contrato.`,
          );
        }

        const valorBruto = Math.round(kwhCompensadoOCR * tarifaUsada * 100) / 100;
        const valorDescontoCalc = Math.round(valorBruto * desconto * 100) / 100;
        const valorLiquido = Math.round((valorBruto - valorDescontoCalc) * 100) / 100;

        return {
          valorBruto,
          valorDesconto: valorDescontoCalc,
          valorLiquido,
          kwhEntregue: kwhCompensadoOCR,
          kwhCompensado: kwhCompensadoOCR,
          modeloCobrancaUsado: 'CREDITOS_COMPENSADOS',
          consumoBruto: kwhConsumidoOCR || null,
          tarifaApurada: tarifaApuradaOCR || null,
          tarifaContratualAplicada: tarifaContratual || null,
          bandeiraAplicada: bandeiraCobrada,
          valorTotalFatura: valorTotalOCR,
        };
      }

      case 'CREDITOS_DINAMICO': {
        throw new NotImplementedException(
          `Modelo CREDITOS_DINAMICO ainda não implementado. ` +
          `Previsto pra Sprint 6+. Contrato afetado: ${contrato.numero}.`,
        );
      }

      default: {
        throw new BadRequestException(
          `Modelo de cobrança desconhecido: ${modelo}`,
        );
      }
    }
  }

  private async resolverModeloCobranca(
    contrato: { modeloCobrancaOverride?: ModeloCobranca | null; plano?: { modeloCobranca: ModeloCobranca } | null },
    usina: { modeloCobrancaOverride?: ModeloCobranca | null } | null,
    cooperativaId?: string,
  ): Promise<ModeloCobranca> {
    // 1. Override do contrato (maior prioridade)
    if (contrato.modeloCobrancaOverride) return contrato.modeloCobrancaOverride;

    // 2. Override da usina
    if (usina?.modeloCobrancaOverride) return usina.modeloCobrancaOverride;

    // 3. ConfigTenant por cooperativa
    const configPadrao = cooperativaId
      ? await this.configTenant.get('modelo_cobranca_padrao', cooperativaId)
      : null;
    if (configPadrao && ['FIXO_MENSAL', 'CREDITOS_COMPENSADOS', 'CREDITOS_DINAMICO'].includes(configPadrao)) {
      return configPadrao as ModeloCobranca;
    }

    // 4. Modelo do plano vinculado ao contrato
    if (contrato.plano?.modeloCobranca) return contrato.plano.modeloCobranca;

    // 5. Padrão
    return 'FIXO_MENSAL';
  }
```

## Item 2 — cobrancas.service.ts create() e update()

### create() — linhas 76-255

```typescript
  async create(data: {
    contratoId: string;
    mesReferencia: number;
    anoReferencia: number;
    valorBruto: number;
    percentualDesconto: number;
    valorDesconto: number;
    valorLiquido: number;
    dataVencimento: Date;
    dataPagamento?: Date;
  }, cooperativaId?: string) {
    // Buscar contrato para obter cooperativaId e dados do cooperado
    const contrato = await this.prisma.contrato.findUnique({
      where: { id: data.contratoId },
      include: { cooperado: true, plano: true },
    });

    // Resolver cooperativaId: parâmetro > contrato
    const resolvedCoopId = cooperativaId || contrato?.cooperativaId || undefined;

    const cobranca = await this.prisma.cobranca.create({
      data: {
        ...data,
        ...(resolvedCoopId ? { cooperativaId: resolvedCoopId } : {}),
      },
    });

    // ── CooperToken: desconto automático ou crédito FATURA_CHEIA_TOKEN ──
    // ... (linhas 103-190 — lógica CooperToken)

    // Emitir automaticamente no Asaas se configurado
    // ... (linhas 192-208 — emissão Asaas)

    // Notificar cooperado via WhatsApp sobre nova cobrança
    // ... (linhas 210-224 — WA)

    // Criar LancamentoCaixa PREVISTO (Contas a Receber)
    // ... (linhas 226-252 — contabilidade)

    return cobranca;
  }
```

**Observação:** `create()` recebe valores PRONTOS (valorBruto, valorDesconto, valorLiquido). NÃO calcula nada. É um service de persistência + integrações.

### update() — linhas 257-269

```typescript
  async update(id: string, data: Partial<{
    mesReferencia: number;
    anoReferencia: number;
    valorBruto: number;
    percentualDesconto: number;
    valorDesconto: number;
    valorLiquido: number;
    status: 'A_VENCER' | 'PAGO' | 'VENCIDO' | 'CANCELADO';
    dataVencimento: Date;
    dataPagamento: Date;
  }>) {
    return this.prisma.cobranca.update({ where: { id }, data });
  }
```

Passthrough puro — sem lógica de negócio.

## Item 3 — Edição de contrato

### (a) Backend — PUT/PATCH em /contratos/:id

```
backend\src\contratos\contratos.controller.ts:45:  @Put(':id')
backend\src\contratos\contratos.controller.ts:47:    return this.contratosService.update(id, dto as any);
backend\src\contratos\contratos.service.ts:322:        return tx.contrato.update({ where: { id }, data: data as any });
backend\src\contratos\contratos.service.ts:326:    return this.prisma.contrato.update({ where: { id }, data: data as any });
backend\src\contratos\contratos.service.ts:356:      const updated = await tx.contrato.update({
backend\src\contratos\contratos.service.ts:363:      await tx.cooperado.update({
```

**SIM**, existe `PUT /contratos/:id` no backend. Aceita DTO genérico (`dto as any`). Admin pode editar campos do contrato depois de criado.

### (b) Frontend — tela de contrato

```
web\app\dashboard\contratos\[id]\page.tsx:179:  <Campo label="Atualizado em" value={...} />
```

**SIM**, existe tela `/dashboard/contratos/[id]` no frontend. Atualmente parece ser read-only (mostra dados, inclui "Atualizado em"), mas a rota backend aceita PUT.
