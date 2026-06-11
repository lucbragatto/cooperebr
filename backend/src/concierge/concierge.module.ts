import { Module } from '@nestjs/common';
import { EdpEsFaturaAdapter } from './fatura-canonica/edp-es.adapter';
import { ElfsmFaturaAdapter } from './fatura-canonica/elfsm.adapter';
import { EnergisaToFaturaAdapter } from './fatura-canonica/energisa-to.adapter';
import { FaturaAdapterRegistry } from './fatura-canonica/registry';

/**
 * Modulo Concierge - auditor tributario de fatura de energia.
 *
 * Sprint C2 (Fatura Canonica + Adapters):
 *  - EdpEsFaturaAdapter: cobre 3 formatos (B1 residencial cativo/GD, B3 cooperada, A4 CUSD usina)
 *  - ElfsmFaturaAdapter: esqueleto (NAO_IMPLEMENTADO)
 *  - EnergisaToFaturaAdapter: esqueleto (NAO_IMPLEMENTADO)
 *
 * Sprint C3 (proximo): 3 detectores de padroes tributarios consumindo FaturaCanonica.
 * Sprint C4: orquestrador, classificador de teses por perfil, endpoint POST /concierge/diagnostico.
 */
@Module({
  providers: [
    EdpEsFaturaAdapter,
    ElfsmFaturaAdapter,
    EnergisaToFaturaAdapter,
    FaturaAdapterRegistry,
  ],
  exports: [FaturaAdapterRegistry],
})
export class ConciergeModule {}
