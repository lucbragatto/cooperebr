/**
 * V4 (Fase B, Decisão B33): warnings de combinações estranhas em planos.
 *
 * Lança AVISOS, não erros. PlanosService loga; frontend pode exibir aviso amarelo
 * sem impedir o salvamento. Combinações marcadas como "⚠️" na seção 4.5 da
 * docs/referencia/REGRAS-PLANOS-E-COBRANCA.md.
 */

interface PlanoSnapshot {
  modeloCobranca?: string;
  baseCalculo?: string;
  tipoDesconto?: string;
  referenciaValor?: string;
  temPromocao?: boolean;
  descontoBase?: number;
  descontoPromocional?: number | null;
}

export function gerarWarningsPlano(plano: PlanoSnapshot): string[] {
  const warnings: string[] = [];

  // W1: COMPENSADOS com referência ≠ ULTIMA_FATURA — esperado é ULTIMA_FATURA
  // pra capturar tarifa atual no aceite. Médias podem distorcer dimensionamento.
  if (
    plano.modeloCobranca === 'CREDITOS_COMPENSADOS' &&
    plano.referenciaValor &&
    plano.referenciaValor !== 'ULTIMA_FATURA'
  ) {
    warnings.push(
      `COMPENSADOS com referenciaValor=${plano.referenciaValor}: esperado ULTIMA_FATURA ` +
      `pra capturar tarifa do mês de aceite (snapshot fica congelado).`,
    );
  }

  // W2: ABATER_DA_CHEIA + KWH_CHEIO é matematicamente equivalente a APLICAR_SOBRE_BASE + KWH_CHEIO.
  // Combinação redundante — ver REGRAS-PLANOS Seção 4.6.
  if (plano.tipoDesconto === 'ABATER_DA_CHEIA' && plano.baseCalculo === 'KWH_CHEIO') {
    warnings.push(
      `tipoDesconto=ABATER_DA_CHEIA + baseCalculo=KWH_CHEIO é matematicamente ` +
      `equivalente a APLICAR_SOBRE_BASE + KWH_CHEIO. Combinação redundante — ` +
      `prefira APLICAR_SOBRE_BASE pra clareza semântica.`,
    );
  }

  // W3: APLICAR_SOBRE_BASE + SEM_TRIBUTO produz desconto efetivo "muito alto"
  // (cooperado paga só TUSD+TE × (1-desc), economiza 40%+). Ver Seção 4.5.
  if (plano.tipoDesconto === 'APLICAR_SOBRE_BASE' && plano.baseCalculo === 'SEM_TRIBUTO') {
    warnings.push(
      `tipoDesconto=APLICAR_SOBRE_BASE + baseCalculo=SEM_TRIBUTO: cooperado paga ` +
      `apenas TUSD+TE com desconto. Economia efetiva fica acima de 40% — só faz ` +
      `sentido em acordos específicos. Confira se é intencional.`,
    );
  }

  return warnings;
}
