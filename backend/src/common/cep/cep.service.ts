import { Injectable, Logger } from '@nestjs/common';

/**
 * Endereco resolvido pelo ViaCEP. Campos `cidade` e `estado` sao remapeados
 * dos campos `localidade` e `uf` que o ViaCEP devolve.
 */
export interface CepEndereco {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
}

/**
 * Resultado da consulta de CEP. Tagged union:
 * - ENCONTRADO: ViaCEP devolveu endereco valido. Use `endereco`.
 * - CEP_INVALIDO: input nao tem 8 digitos (validacao local, ViaCEP NAO chamado).
 * - NAO_ENCONTRADO: ViaCEP devolveu `{ erro: true }` (CEP nao existe).
 * - FORA_DO_AR: timeout, erro de rede, status code nao-OK, JSON invalido.
 *   Chamador deve seguir com degradacao graciosa (salvar so o CEP digitado).
 */
export type CepResultado =
  | { status: 'ENCONTRADO'; endereco: CepEndereco }
  | { status: 'CEP_INVALIDO' }
  | { status: 'NAO_ENCONTRADO' }
  | { status: 'FORA_DO_AR' };

/**
 * Consulta de CEP via ViaCEP (https://viacep.com.br).
 *
 * Bloco 4 Sprint Bot Autoatendimento (22/05): permite ao bot WhatsApp
 * autopopular logradouro/bairro/cidade/estado quando o cooperado atualiza o
 * CEP. Frontend ja usa ViaCEP em 4 lugares via fetch direto; este service
 * centraliza no backend pra reuso (bot + admin + portal futuros).
 *
 * Decisao Luciano 22/05: ViaCEP fora do ar -> degradacao graciosa (salva
 * so o CEP digitado, NAO trava o cooperado).
 */
@Injectable()
export class CepService {
  private readonly logger = new Logger(CepService.name);
  private readonly VIACEP_BASE_URL = 'https://viacep.com.br/ws';
  private readonly TIMEOUT_MS = 3000;

  async consultar(cep: string): Promise<CepResultado> {
    const cepLimpo = (cep ?? '').replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      return { status: 'CEP_INVALIDO' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(
        `${this.VIACEP_BASE_URL}/${cepLimpo}/json/`,
        { signal: controller.signal },
      );

      if (!response.ok) {
        this.logger.warn(
          `ViaCEP respondeu status ${response.status} para CEP ${cepLimpo}`,
        );
        return { status: 'FORA_DO_AR' };
      }

      const data = (await response.json()) as ViaCepResponse;

      if (data?.erro) {
        return { status: 'NAO_ENCONTRADO' };
      }

      return {
        status: 'ENCONTRADO',
        endereco: {
          cep: data.cep ?? this.formatarCep(cepLimpo),
          logradouro: data.logradouro ?? '',
          bairro: data.bairro ?? '',
          cidade: data.localidade ?? '',
          estado: data.uf ?? '',
        },
      };
    } catch (err) {
      const nome = (err as Error)?.name;
      const msg = (err as Error)?.message ?? 'erro desconhecido';
      this.logger.warn(
        `ViaCEP falhou para CEP ${cepLimpo} (${nome ?? 'Error'}): ${msg}`,
      );
      return { status: 'FORA_DO_AR' };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private formatarCep(cepLimpo: string): string {
    return `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}`;
  }
}

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}
