import { Injectable } from '@nestjs/common';
import type { FaturaRawInput } from './fatura-canonica.types';
import type { FaturaAdapter, ResultadoAdapter } from './adapter.interface';

/**
 * Adapter para faturas da ELFSM (Empresa Luz e Forca Santa Maria, ES regiao serrana).
 *
 * MVP Concierge C2: esqueleto. Sem fatura real de ELFSM no momento.
 * Quando aparecer fatura, calibrar metodo parsear() seguindo o padrao
 * do EdpEsFaturaAdapter (classificacao de rubricas + montagem canonica).
 *
 * Por design, retorna NAO_IMPLEMENTADO em vez de crashar - o endpoint
 * que orquestra captura o motivo e responde 422 com mensagem clara.
 */
@Injectable()
export class ElfsmFaturaAdapter implements FaturaAdapter {
  readonly distribuidora = 'ELFSM' as const;

  parsear(_input: FaturaRawInput): ResultadoAdapter {
    return {
      sucesso: false,
      motivo: 'NAO_IMPLEMENTADO',
      detalhe:
        'Adapter ELFSM e esqueleto - aguarda fatura real pra calibracao. ' +
        'Sprint Concierge C2.5 ou quando aparecer cliente ELFSM.',
    };
  }
}
