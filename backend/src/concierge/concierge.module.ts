import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ConciergeService } from './concierge.service';
import { ConciergeController } from './concierge.controller';
import { EdpEsFaturaAdapter } from './fatura-canonica/edp-es.adapter';
import { ElfsmFaturaAdapter } from './fatura-canonica/elfsm.adapter';
import { EnergisaToFaturaAdapter } from './fatura-canonica/energisa-to.adapter';
import { FaturaAdapterRegistry } from './fatura-canonica/registry';
import { DetectorTema69Stricto } from './detectores/detector-tema69-stricto';
import { DetectorTese3PisCofinsSobreScee } from './detectores/detector-tese3-pis-sobre-scee';
import { DetectorTese2IcmsTusdGeracao } from './detectores/detector-tese2-icms-tusd-g';
import { DetectorTese6IcmsTusdTeSobreScee } from './detectores/detector-tese6-icms-scee';
import { DetectoresRegistry } from './detectores/detectores.registry';

/**
 * Modulo Concierge - auditor tributario de fatura de energia.
 *
 * Sprint C2 (Fatura Canonica + Adapters): EDP_ES + ELFSM (C2.5) + ENERGISA_TO esqueleto.
 * Sprint C3 (Detectores): Tema 69 stricto + Tese 3 SCEE + Tese 2 TUSD-G.
 * Sprint C2.6 (ratificacao ELFSM): ementa Tese 3 reforcada.
 * Sprint MVP-SaaS (11/06/2026): service + controller + 7 endpoints + feature flag.
 * Sprint C3.6 (12/06/2026): Tese 6 - ICMS sobre TUSD/TE nao compensada em GD.
 *   Fundamento primario cooperativa: Art. 79 Lei 5.764/71 (ato cooperativo).
 *   Camadas secundarias: Lei 14.300/22 + Conv 16/2015 + STJ Tema 986 ressalva GD +
 *   TJ-MT abr/2026 + TJ-RJ + STF ADIs 7.077/7.634/7.716 mar/2026.
 */
@Module({
  providers: [
    PrismaService,
    ConciergeService,
    EdpEsFaturaAdapter,
    ElfsmFaturaAdapter,
    EnergisaToFaturaAdapter,
    FaturaAdapterRegistry,
    DetectorTema69Stricto,
    DetectorTese3PisCofinsSobreScee,
    DetectorTese2IcmsTusdGeracao,
    DetectorTese6IcmsTusdTeSobreScee,
    DetectoresRegistry,
  ],
  controllers: [ConciergeController],
  exports: [FaturaAdapterRegistry, DetectoresRegistry, ConciergeService],
})
export class ConciergeModule {}
