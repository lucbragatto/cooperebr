import { Injectable } from '@nestjs/common';
import type { DistribuidoraEnum } from '@prisma/client';
import type { FaturaAdapter } from './adapter.interface';
import { EdpEsFaturaAdapter } from './edp-es.adapter';
import { ElfsmFaturaAdapter } from './elfsm.adapter';
import { EnergisaToFaturaAdapter } from './energisa-to.adapter';

/**
 * Registry/factory dos adapters de fatura.
 *
 * Padrao Strategy: codigo cliente nao depende de qual concessionaria -
 * pede um adapter pra ela e processa o ResultadoAdapter retornado.
 *
 * Adapters nao implementados retornam ResultadoAdapter.sucesso=false
 * com motivo NAO_IMPLEMENTADO - sistema nao crasha, endpoint expoe
 * mensagem clara pro admin.
 */
@Injectable()
export class FaturaAdapterRegistry {
  private readonly adapters: Map<string, FaturaAdapter>;

  constructor(
    edpEs: EdpEsFaturaAdapter,
    elfsm: ElfsmFaturaAdapter,
    energisaTo: EnergisaToFaturaAdapter,
  ) {
    this.adapters = new Map<string, FaturaAdapter>([
      ['EDP_ES', edpEs],
      ['ELFSM', elfsm],
      // ENERGISA_TO ainda nao esta no enum DistribuidoraEnum. Quando
      // adicionar (Sprint expansao), incluir aqui a chave correta.
      ['OUTRAS_ENERGISA_TO', energisaTo],
    ]);
  }

  /**
   * Retorna o adapter da distribuidora ou null se nao houver.
   */
  obterAdapter(distribuidora: DistribuidoraEnum): FaturaAdapter | null {
    return this.adapters.get(distribuidora) ?? null;
  }

  /**
   * Lista distribuidoras com adapter registrado (debug/observabilidade).
   */
  listarDistribuidorasComAdapter(): string[] {
    return Array.from(this.adapters.keys());
  }
}
