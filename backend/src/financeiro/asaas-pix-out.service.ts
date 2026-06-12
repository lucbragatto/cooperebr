/**
 * Sprint Clube P1 — F6 Bloco A (12/06/2026).
 *
 * Helper extraído do `pix-excedente.service.ts` (linhas 132-157). Centraliza
 * a chamada Asaas `POST /transfers` (PIX-out) pra ser reusado por:
 *
 *  - F6 `resgatarTokens` (estabelecimento → R$ via PIX)
 *  - Sobra mensal cooperado (futuro)
 *  - Pix-excedente (migração — carry-over P3 nesta sprint)
 *
 * Capacidade confirmada via `pix-excedente.service.ts:132-157` (cron em
 * produção). Diferenças vs pix-excedente:
 *
 *  - Centraliza o `pixTipoMap` (CPF/CNPJ/EMAIL/TELEFONE/ALEATORIA →
 *    Asaas CPF/CNPJ/EMAIL/PHONE/EVP).
 *  - Discrimina ambiente via `isAmbienteReal()` em vez de
 *    `ASAAS_PIX_EXCEDENTE_ATIVO` (cron-específico). F6 sandbox NUNCA
 *    dispara PIX real — diretriz inegociável (NODE_ENV NÃO discrimina;
 *    `isAmbienteReal` é a fonte autoritária — postmortem 18/05).
 *  - Retorna shape estruturado `{asaasTransferId, status, raw}` pra
 *    consumer decidir transição de estado.
 *  - Sem persistência interna — quem chama persiste no modelo próprio
 *    (F6 = `ResgateRecibo`; pix-excedente migrado = `TransferenciaPix`).
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AsaasService } from '../asaas/asaas.service';
import { isAmbienteReal } from '../common/safety/ambiente';

export type PixTipoLogico = 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA';

/** Mapper PixTipo lógico (SISGD/Cooperado.pixTipo) → enum Asaas. */
const PIX_TIPO_MAP: Record<PixTipoLogico, string> = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  EMAIL: 'EMAIL',
  TELEFONE: 'PHONE',
  ALEATORIA: 'EVP',
};

/** Status normalizado pelo helper (não confundir com Asaas raw). */
export type AsaasPixOutStatus =
  | 'SIMULATED' // ambiente NÃO-real — só log, sem Asaas
  | 'PENDING' // Asaas aceitou (resposta != DONE) — aguarda webhook
  | 'DONE' // Asaas processou na hora (rare, mas tratamos)
  | 'ERROR'; // Asaas rejeitou

export interface AsaasPixOutTransferirParams {
  cooperativaId: string;
  pixChave: string;
  pixTipo: string; // string livre — helper valida contra PIX_TIPO_MAP
  /** Em R$ (não centavos). 2 casas decimais. */
  valor: number;
  /** Descrição que aparece no extrato Asaas / banco do recebedor. */
  descricao: string;
}

export interface AsaasPixOutTransferirResult {
  asaasTransferId: string | null;
  status: AsaasPixOutStatus;
  /** Raw response Asaas (pra debug + log persistente do consumer). */
  raw: Record<string, unknown> | null;
  /** Mensagem humana do erro (quando status=ERROR). */
  erro?: string;
}

@Injectable()
export class AsaasPixOutService {
  private readonly logger = new Logger(AsaasPixOutService.name);

  constructor(private readonly asaasService: AsaasService) {}

  /**
   * Dispara PIX-out via Asaas. NÃO persiste — consumer salva o
   * `asaasTransferId` no modelo próprio (ResgateRecibo, TransferenciaPix, etc).
   *
   * Em ambiente NÃO-real (isAmbienteReal() === false), retorna SIMULATED
   * sem chamar Asaas. Diretriz inegociável (postmortem 18/05): NODE_ENV
   * NÃO discrimina — `isAmbienteReal` é a fonte autoritária.
   *
   * Multi-tenant: `cooperativaId` é injetado pelo caller (do JWT). Helper
   * propaga pro `getApiClient(cooperativaId)` do AsaasService (cliente
   * Axios per-tenant com AsaasConfig próprio).
   */
  async transferir(
    params: AsaasPixOutTransferirParams,
  ): Promise<AsaasPixOutTransferirResult> {
    // ── Validações universais ──
    if (!params.cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatório no PIX-out.');
    }
    if (!params.pixChave || params.pixChave.trim().length === 0) {
      throw new BadRequestException(
        'pixChave obrigatória. Estabelecimento deve cadastrar PIX em /portal/seguranca antes de solicitar resgate (anti-fraude — chave nunca vem do body).',
      );
    }
    const pixTipoUpper = (params.pixTipo ?? 'ALEATORIA').toUpperCase();
    if (!(pixTipoUpper in PIX_TIPO_MAP)) {
      throw new BadRequestException(
        `pixTipo inválido: '${params.pixTipo}'. Aceitos: CPF, CNPJ, EMAIL, TELEFONE, ALEATORIA.`,
      );
    }
    if (!Number.isFinite(params.valor) || params.valor <= 0) {
      throw new BadRequestException('valor R$ deve ser positivo.');
    }

    // ── Ambiente NÃO-real → SIMULATED ──
    if (!isAmbienteReal()) {
      this.logger.log(
        `[asaas-pix-out] AMBIENTE_REAL=false — SIMULATED transfer (cooperativa=${params.cooperativaId} valor=R$${params.valor.toFixed(2)} chave=${params.pixChave.slice(0, 4)}***)`,
      );
      return {
        asaasTransferId: `simulated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: 'SIMULATED',
        raw: { simulated: true, valor: params.valor },
      };
    }

    // ── Ambiente REAL → chama Asaas ──
    try {
      const client = await this.asaasService.getApiClient(params.cooperativaId);
      const valorArredondado = Math.round(params.valor * 100) / 100;
      const { data: transfer } = await client.post('/transfers', {
        value: valorArredondado,
        operationType: 'PIX',
        pixAddressKey: params.pixChave,
        pixAddressKeyType: PIX_TIPO_MAP[pixTipoUpper as PixTipoLogico],
        description: params.descricao,
      });

      const status: AsaasPixOutStatus = transfer?.status === 'DONE' ? 'DONE' : 'PENDING';

      this.logger.log(
        `[asaas-pix-out] transfer ${transfer.id} status=${transfer.status} (cooperativa=${params.cooperativaId} valor=R$${valorArredondado})`,
      );

      return {
        asaasTransferId: transfer.id ?? null,
        status,
        raw: transfer,
      };
    } catch (err: any) {
      const errorsAsaas =
        err.response?.data?.errors ?? err.response?.data ?? err.message;
      const mensagem = typeof errorsAsaas === 'string' ? errorsAsaas : JSON.stringify(errorsAsaas);
      this.logger.error(
        `[asaas-pix-out] ERRO Asaas cooperativa=${params.cooperativaId}: ${mensagem}`,
      );
      return {
        asaasTransferId: null,
        status: 'ERROR',
        raw: err.response?.data ?? null,
        erro: mensagem,
      };
    }
  }
}
