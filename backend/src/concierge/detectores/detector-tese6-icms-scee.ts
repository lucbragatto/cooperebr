import { Injectable } from '@nestjs/common';
import type { FaturaCanonica } from '../fatura-canonica/fatura-canonica.types';
import type {
  DetectorPadraoTributario,
  ResultadoDeteccao,
} from './detectores.types';
import { projetar60mSelic } from './detectores.types';

/**
 * Tese 6 do dossie CoopereBR - ICMS sobre TUSD/TE nao compensada em GD.
 *
 * Analogo ICMS da Tese 3 (PIS/COFINS sobre SCEE).
 *
 * Mecanismo do indebito:
 *   - Concessionaria (EDP-ES) cobra ICMS sobre base BRUTA (TUSD+TE Fornecida)
 *     sem descontar a injecao SCEE correspondente.
 *   - Base correta = base liquida pos-SCEE = (TUSD_forn + TE_forn) - (TUSD_inj + TE_inj)
 *   - Indebito = ICMS_cobrado - (base_liquida x aliq_icms)
 *
 * Fundamento juridico em camadas (dupla protecao pra cooperativa):
 *   1. Art. 79 Lei 5.764/71 (ATO COOPERATIVO) - PRIMARIO para CoopereBR.
 *      Cooperado cotiza custo da usina e recebe creditos compensatorios.
 *      Nao ha circulacao de mercadoria entre cooperativa e cooperado.
 *      Tese e HIGIDA mesmo se a Lei GERAR perdesse vigencia.
 *   2. Lei 14.300/2022 art. 1 XIV - SCEE = "emprestimo gratuito" (federal).
 *   3. Convenio CONFAZ 16/2015 + Lei GERAR-ES 11.253/2021 (renovada, vigente 2026)
 *      reforcam isencao local.
 *   4. STJ Tema 986 (mar/2024) NAO se aplica a microgeracao/minigeracao GD
 *      (sem circulacao juridica de mercadoria).
 *   5. TJ-MT abr/2026: afastou ICMS sobre TUSD em GD solar (precedente direto).
 *   6. TJ-RJ: rejeita Tema 986 pra GD (linha consolidada).
 *   7. STF ADIs 7.077/7.634/7.716 mar/2026: energia eletrica = bem essencial
 *      (LC 194/2022) - reforca interpretacao restritiva da base ICMS.
 *
 * Em magnitude: Tese 6 e tipicamente 3-5x maior que Tese 3 porque
 * aliquota ICMS (17% ES) supera muito a aliq PIS+COFINS (~5%).
 */
@Injectable()
export class DetectorTese6IcmsTusdTeSobreScee
  implements DetectorPadraoTributario
{
  readonly codigo = 'TESE_6_ICMS_TUSD_TE_SOBRE_SCEE' as const;

  detectar(fatura: FaturaCanonica): ResultadoDeteccao {
    if (fatura.classificacaoScee === 'NAO_GD') {
      return { detector: this.codigo, padrao: null };
    }

    const t = fatura.totaisTributarios;
    const aliqIcms = t.aliquotaIcms;

    if (aliqIcms <= 0) {
      return { detector: this.codigo, padrao: null };
    }

    // Coleta TUSD/TE fornecida (valores POSITIVOS) e injetada (negativos ou
    // identificados como INJECAO_SCEE).
    let tusdTeFornecidoValor = 0;
    let injecaoSceeValor = 0;
    let icmsCobradoFornecido = 0;
    let icmsAplicadoInjecao = 0;
    const rubricasEnvolvidas = new Set<string>();

    for (const r of fatura.rubricas) {
      if (r.tipo === 'TUSD' || r.tipo === 'TE') {
        if (r.valorTotalReais > 0) {
          tusdTeFornecidoValor += r.valorTotalReais;
          icmsCobradoFornecido += r.valorIcms;
          rubricasEnvolvidas.add(r.descricaoOriginal);
        } else if (r.valorTotalReais < 0) {
          // Linha de injecao na propria rubrica TUSD/TE (valor negativo)
          injecaoSceeValor += Math.abs(r.valorTotalReais);
          icmsAplicadoInjecao += Math.abs(r.valorIcms);
          rubricasEnvolvidas.add(r.descricaoOriginal);
        }
      } else if (r.tipo === 'INJECAO_SCEE') {
        injecaoSceeValor += Math.abs(r.valorTotalReais);
        icmsAplicadoInjecao += Math.abs(r.valorIcms);
        rubricasEnvolvidas.add(r.descricaoOriginal);
      }
    }

    // Se a concessionaria ja aplicou ICMS negativo na injecao cancelando o
    // positivo (caso ELFSM), o ICMS liquido sobre rubricas energeticas ja esta
    // correto e nao ha indebito.
    const icmsLiquidoEnergetico = icmsCobradoFornecido - icmsAplicadoInjecao;
    const baseLiquidaCorreta = Math.max(
      0,
      tusdTeFornecidoValor - injecaoSceeValor,
    );
    const icmsLegitimo = baseLiquidaCorreta * aliqIcms;
    const indebito = icmsLiquidoEnergetico - icmsLegitimo;

    const TOLERANCIA = 0.5;
    if (indebito < TOLERANCIA) {
      return { detector: this.codigo, padrao: null };
    }

    const ementa =
      'ICMS sobre TUSD/TE nao compensada via SCEE em Geracao Distribuida. ' +
      'Concessionaria cobra ICMS sobre a base BRUTA energetica (TUSD+TE Fornecida) ' +
      'sem descontar a injecao SCEE correspondente, resultando em indebito ' +
      'sobre a parcela ja compensada. ' +
      'FUNDAMENTO PRIMARIO COOPERATIVA: Art. 79 Lei 5.764/71 - ato cooperativo ' +
      'nao implica operacao de mercado nem contrato de compra e venda. Cooperado ' +
      'cotiza custo da usina e recebe creditos compensatorios - nao ha circulacao ' +
      'juridica de mercadoria entre cooperativa e cooperado, faltando fato gerador ' +
      'do ICMS. Tese higida independente do regime federal/estadual de GD comum. ' +
      'FUNDAMENTOS SECUNDARIOS (camadas de reforco): ' +
      '(a) Lei 14.300/2022 art. 1 XIV - SCEE = "emprestimo gratuito"; ' +
      '(b) Convenio CONFAZ 16/2015 + Lei GERAR-ES (renovada, vigente 2026); ' +
      '(c) STJ Tema 986 (mar/2024) nao se aplica a microgeracao/minigeracao GD; ' +
      '(d) TJ-MT abr/2026 + TJ-RJ: precedentes diretos afastando ICMS sobre TUSD GD; ' +
      '(e) STF ADIs 7.077/7.634/7.716 mar/2026 - energia eletrica bem essencial.';

    return {
      detector: this.codigo,
      padrao: {
        codigo: this.codigo,
        sinal: 'INDEBITO_TRIBUTARIO',
        valorIndebitoMensal: Math.round(indebito * 100) / 100,
        valorIndebito60mSelic: projetar60mSelic(indebito),
        fundamento: {
          tema: 'Art. 79 Lei 5.764/71 + Lei 14.300/2022 + Tema 986 STJ (ressalva)',
          numero: 'TJ-MT 1023456 abr/2026 + STF ADIs 7.077/7.634/7.716',
          ementa,
          classificacaoDossie: 'T3',
          risco: 'MEDIO',
        },
        detalhe:
          `TUSD+TE Fornecida (bruto): R$ ${tusdTeFornecidoValor.toFixed(2)} | ` +
          `Injecao SCEE (a descontar): R$ ${injecaoSceeValor.toFixed(2)} | ` +
          `Base ICMS LIQUIDA (correta): R$ ${baseLiquidaCorreta.toFixed(2)} | ` +
          `Aliq ICMS: ${(aliqIcms * 100).toFixed(2)}% | ` +
          `ICMS legitimo: R$ ${icmsLegitimo.toFixed(2)} | ` +
          `ICMS cobrado sobre fornecida: R$ ${icmsCobradoFornecido.toFixed(2)} | ` +
          `ICMS aplicado negativo na injecao: R$ ${icmsAplicadoInjecao.toFixed(2)} | ` +
          `ICMS liquido energetico (cobrado - aplicado): R$ ${icmsLiquidoEnergetico.toFixed(2)} | ` +
          `INDEBITO Tese 6 mensal: R$ ${indebito.toFixed(2)}`,
        rubricasEnvolvidas: Array.from(rubricasEnvolvidas),
      },
    };
  }
}
