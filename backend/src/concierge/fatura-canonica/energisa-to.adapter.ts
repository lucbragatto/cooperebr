import { Injectable } from '@nestjs/common';
import type { FaturaRawInput } from './fatura-canonica.types';
import type { FaturaAdapter, ResultadoAdapter } from './adapter.interface';

/**
 * Adapter esqueleto - Energisa Tocantins.
 *
 * Concierge MVP cobre apenas ES (decisao Luciano). Quando expandir pra TO:
 *
 * Base regulatoria conhecida (pesquisa subagente 11/06/2026):
 *  - Decreto TO 5.338/2015 (adesao Convenio CONFAZ ICMS 16/2015)
 *  - Aliquota ICMS TO: 20% (Lei Estadual 4.141/2023, em vigor desde 01/04/2023)
 *  - Isenta kWh compensado via SCEE; exclui da isencao: disponibilidade,
 *    demanda, energia reativa, encargos de conexao e TUSD sobre nao-compensado.
 *  - Espelha o paragrafo 3 do art. 5-D da Lei 11.253/2021-ES GERAR.
 *
 * Tarefa do C8 ou similar futuro: implementar parsear() seguindo padrao
 * do EdpEsFaturaAdapter, ajustando aliquota ICMS=20% e classificador de
 * rubricas pro layout Energisa (rubricas mais agregadas que EDP).
 */
@Injectable()
export class EnergisaToFaturaAdapter implements FaturaAdapter {
  readonly distribuidora = 'OUTRAS' as const; // ENERGISA_TO nao esta no enum hoje

  parsear(_input: FaturaRawInput): ResultadoAdapter {
    return {
      sucesso: false,
      motivo: 'NAO_IMPLEMENTADO',
      detalhe:
        'Adapter Energisa Tocantins e esqueleto - MVP Concierge cobre apenas ES. ' +
        'Decreto TO 5.338/2015 + aliquota 20% mapeados; ativar quando entrar cliente TO.',
    };
  }
}
