import { Injectable } from '@nestjs/common';
import type { FaturaCanonica } from '../fatura-canonica/fatura-canonica.types';
import type {
  DetectorPadraoTributario,
  PadraoDetectado,
} from './detectores.types';
import { DetectorTema69Stricto } from './detector-tema69-stricto';
import { DetectorTese3PisCofinsSobreScee } from './detector-tese3-pis-sobre-scee';
import { DetectorTese2IcmsTusdGeracao } from './detector-tese2-icms-tusd-g';

/**
 * Resultado consolidado de TODOS os detectores rodando sobre uma fatura.
 *
 * Usado pelo orquestrador (Sprint C4) pra alimentar:
 *   - DiagnosticoIndebito.padroesDetectados (Sprint C1)
 *   - DiagnosticoIndebito.indebitoMensal (soma de valoresMensais)
 *   - DiagnosticoIndebito.indebito60mSelic (soma de 60mSelic)
 */
export interface ResultadoConsolidadoDetectores {
  /** Padroes encontrados (ordem: maior indebito primeiro) */
  padroes: PadraoDetectado[];
  /** Soma dos indebitos mensais */
  indebitoMensalTotal: number;
  /** Soma das projecoes 60m+SELIC */
  indebito60mSelicTotal: number;
}

/**
 * Registry/factory dos detectores tributarios.
 *
 * Sprint C3 entrega 3 detectores. Sprint C8+ podera adicionar:
 *   - DetectorTese4InconstGerar - Lei GERAR §3 (risco alto, retaguarda)
 *   - DetectorTeseCdeEscassezHidrica - CDE escassez hidrica (sem precedente STF)
 *   - DetectorIcmsBaseGrossUp - assimetria gross-up calculo "por dentro"
 */
@Injectable()
export class DetectoresRegistry {
  private readonly detectores: DetectorPadraoTributario[];

  constructor(
    tema69: DetectorTema69Stricto,
    tese3: DetectorTese3PisCofinsSobreScee,
    tese2: DetectorTese2IcmsTusdGeracao,
  ) {
    this.detectores = [tema69, tese3, tese2];
  }

  /**
   * Roda todos os detectores e devolve resultado consolidado.
   */
  detectarTodos(fatura: FaturaCanonica): ResultadoConsolidadoDetectores {
    const padroes: PadraoDetectado[] = [];

    for (const det of this.detectores) {
      const res = det.detectar(fatura);
      if (res.padrao !== null) {
        padroes.push(res.padrao);
      }
    }

    // Ordena por maior indebito primeiro (priorizar no briefing).
    padroes.sort((a, b) => b.valorIndebitoMensal - a.valorIndebitoMensal);

    const indebitoMensalTotal = padroes.reduce(
      (acc, p) => acc + p.valorIndebitoMensal,
      0,
    );
    const indebito60mSelicTotal = padroes.reduce(
      (acc, p) => acc + p.valorIndebito60mSelic,
      0,
    );

    return {
      padroes,
      indebitoMensalTotal: Math.round(indebitoMensalTotal * 100) / 100,
      indebito60mSelicTotal: Math.round(indebito60mSelicTotal * 100) / 100,
    };
  }

  listarDetectores(): string[] {
    return this.detectores.map((d) => d.codigo);
  }
}
