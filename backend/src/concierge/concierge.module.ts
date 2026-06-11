import { Module } from '@nestjs/common';
import { EdpEsFaturaAdapter } from './fatura-canonica/edp-es.adapter';
import { ElfsmFaturaAdapter } from './fatura-canonica/elfsm.adapter';
import { EnergisaToFaturaAdapter } from './fatura-canonica/energisa-to.adapter';
import { FaturaAdapterRegistry } from './fatura-canonica/registry';
import { DetectorTema69Stricto } from './detectores/detector-tema69-stricto';
import { DetectorTese3PisCofinsSobreScee } from './detectores/detector-tese3-pis-sobre-scee';
import { DetectorTese2IcmsTusdGeracao } from './detectores/detector-tese2-icms-tusd-g';
import { DetectoresRegistry } from './detectores/detectores.registry';

/**
 * Modulo Concierge - auditor tributario de fatura de energia.
 *
 * Sprint C2 (Fatura Canonica + Adapters):
 *  - EdpEsFaturaAdapter: cobre 3 formatos (B1 residencial cativo/GD, B3 cooperada, A4 CUSD usina)
 *  - ElfsmFaturaAdapter: esqueleto (NAO_IMPLEMENTADO)
 *  - EnergisaToFaturaAdapter: esqueleto (NAO_IMPLEMENTADO)
 *
 * Sprint C3 (Detectores tributarios determinis ticos):
 *  - DetectorTema69Stricto: PIS/COFINS sem ICMS na base (RE 574.706)
 *  - DetectorTese3PisCofinsSobreScee: PIS/COFINS sobre energia compensada (Tema 69 por analogia)
 *  - DetectorTese2IcmsTusdGeracao: ICMS sobre TUSD-G/demanda/encargos (Tema 176 + Sumula 391)
 *
 * Sprint C4 (proximo): orquestrador + classificador de teses por perfil + POST /concierge/diagnostico.
 */
@Module({
  providers: [
    EdpEsFaturaAdapter,
    ElfsmFaturaAdapter,
    EnergisaToFaturaAdapter,
    FaturaAdapterRegistry,
    DetectorTema69Stricto,
    DetectorTese3PisCofinsSobreScee,
    DetectorTese2IcmsTusdGeracao,
    DetectoresRegistry,
  ],
  exports: [FaturaAdapterRegistry, DetectoresRegistry],
})
export class ConciergeModule {}
