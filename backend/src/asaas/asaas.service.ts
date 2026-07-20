import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { CredentialsEncryptor } from '../gateways-pagamento-config/credentials-encryptor.service';
import type { CobrancasService } from '../cobrancas/cobrancas.service';

@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private credentialsEncryptor: CredentialsEncryptor,
    // Corretiva Asaas Webhook 2026-07-20 — ModuleRef pra resolver o
    // CobrancasService LAZY (runtime), sem adicionar aresta no grafo
    // de módulos. Evita o ciclo triangular Gateway→Asaas→Cobrancas→Gateway
    // que forwardRef não conseguia resolver com Whatsapp/Faturas no grafo.
    // O import de CobrancasService acima é `import type` — não gera
    // dependência de módulo, só de tipo em compile-time.
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Corretiva Asaas Webhook 2026-07-20 — resolve CobrancasService no
   * primeiro uso e cacheia. `{ strict: false }` busca em todo o app,
   * não só no AsaasModule.
   */
  private _cobrancasService: CobrancasService | null = null;
  private getCobrancasService(): CobrancasService {
    if (this._cobrancasService) return this._cobrancasService;
    // Import dinâmico pra evitar circular no compile-time (import type
    // acima já é só type-only e vira nada em runtime).
    const { CobrancasService: CobrancasServiceClass } = require('../cobrancas/cobrancas.service');
    this._cobrancasService = this.moduleRef.get(CobrancasServiceClass, { strict: false });
    if (!this._cobrancasService) {
      throw new Error('AsaasService: CobrancasService não resolvido via ModuleRef.');
    }
    return this._cobrancasService;
  }

  // ─── Criptografia ──────────────────────────────────────────

  private getEncryptKey(): Buffer {
    const key = process.env.ASAAS_ENCRYPT_KEY;
    if (!key) {
      throw new Error('ASAAS_ENCRYPT_KEY não configurada. Defina no .env');
    }
    return crypto.createHash('sha256').update(key).digest();
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.getEncryptKey(), iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('hex'), encrypted.toString('hex'), tag.toString('hex')].join(':');
  }

  decrypt(encrypted: string): string {
    const parts = encrypted.split(':');
    if (parts.length !== 3) return encrypted; // não está criptografado (legado)
    const [ivHex, encHex, tagHex] = parts;
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.getEncryptKey(),
        Buffer.from(ivHex, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
    } catch {
      return encrypted; // fallback: retorna como está (pode ser plain text legado)
    }
  }

  maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length <= 4) return '****';
    return '****' + apiKey.slice(-4);
  }

  // ─── Config ──────────────────────────────────────────────

  async getConfig(cooperativaId: string) {
    const config = await this.prisma.asaasConfig.findUnique({
      where: { cooperativaId },
    });
    if (!config) return null;
    return config;
  }

  async getConfigMasked(cooperativaId: string) {
    const config = await this.getConfig(cooperativaId);
    if (!config) return null;
    const decrypted = this.decrypt(config.apiKey);
    return { ...config, apiKey: this.maskApiKey(decrypted) };
  }

  async salvarConfig(cooperativaId: string, data: { apiKey: string; ambiente: string; webhookToken?: string }) {
    // ── F2 Dual-Write (M29, 2026-05-26) ─────────────────────────
    // Mantem caminho legado (AsaasConfig) intacto + grava espelho em
    // ConfigGateway encryptado com GATEWAY_ENCRYPT_KEY (chave forte).
    // Coexistencia 30 dias antes de descontinuar AsaasConfig.
    //
    // Transacao atomica: se um lado falhar, o outro tambem rollback.
    const encryptedKeyLegado = this.encrypt(data.apiKey);
    const apiKeyEncForte = this.credentialsEncryptor.encrypt(data.apiKey);
    const apiKeyMasked = this.maskApiKey(data.apiKey);

    return this.prisma.$transaction(async (tx) => {
      // Caminho legado — AsaasConfig (consumido pelo AsaasService.getApiClient
      // hoje). Fica intacto durante coexistencia.
      const asaasConfig = await tx.asaasConfig.upsert({
        where: { cooperativaId },
        update: {
          apiKey: encryptedKeyLegado,
          ambiente: data.ambiente,
          webhookToken: data.webhookToken,
        },
        create: {
          cooperativaId,
          apiKey: encryptedKeyLegado,
          ambiente: data.ambiente,
          webhookToken: data.webhookToken,
        },
      });

      // Caminho novo — ConfigGateway (consumido por GatewayPagamentoService
      // factory + uso futuro F4 frontend genérico).
      const credenciaisCriptografadas: Prisma.InputJsonValue = {
        apiKey: apiKeyEncForte,
      };
      const metadados: Prisma.InputJsonValue = {
        apiKeyMasked,
        webhookTokenDefinido: !!data.webhookToken,
        atualizadoEm: new Date().toISOString(),
        origem: 'dual-write-asaas-salvarConfig',
      };

      await tx.configGateway.upsert({
        where: {
          cooperativaId_gateway: { cooperativaId, gateway: 'ASAAS' },
        },
        update: {
          ambiente: data.ambiente,
          credenciaisCriptografadas,
          metadados,
          webhookToken: data.webhookToken ?? null,
          ativo: true,
        },
        create: {
          cooperativaId,
          gateway: 'ASAAS',
          ambiente: data.ambiente,
          credenciaisCriptografadas,
          metadados,
          webhookToken: data.webhookToken ?? null,
          ativo: true,
        },
      });

      this.logger.log(
        `Dual-write Asaas OK (cooperativa=${cooperativaId}, ambiente=${data.ambiente}, ` +
          `apiKey=${apiKeyMasked}). AsaasConfig legado + ConfigGateway ASAAS gravados.`,
      );

      return asaasConfig;
    });
  }

  // ─── API Client ──────────────────────────────────────────

  async getApiClient(cooperativaId: string): Promise<AxiosInstance> {
    const config = await this.getConfig(cooperativaId);
    if (!config) {
      throw new BadRequestException('Configuração Asaas não encontrada para esta cooperativa');
    }

    const decryptedKey = this.decrypt(config.apiKey);

    const baseURL =
      config.ambiente === 'PRODUCAO'
        ? 'https://www.asaas.com/api/v3'
        : 'https://sandbox.asaas.com/api/v3';

    return axios.create({
      baseURL,
      headers: { access_token: decryptedKey },
      timeout: 30000,
    });
  }

  // ─── Customer ────────────────────────────────────────────

  async criarOuBuscarCustomer(cooperadoId: string, cooperativaId: string) {
    // Verifica se já existe no banco local
    const existing = await this.prisma.asaasCustomer.findUnique({
      where: { cooperadoId },
    });
    if (existing) return existing;

    // Busca dados do cooperado
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
    });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado');

    const client = await this.getApiClient(cooperativaId);

    // Tenta buscar no Asaas por cpfCnpj
    try {
      const { data: searchResult } = await client.get('/customers', {
        params: { cpfCnpj: cooperado.cpf },
      });
      if (searchResult.data && searchResult.data.length > 0) {
        const asaasCustomer = searchResult.data[0];
        return this.prisma.asaasCustomer.create({
          data: {
            cooperadoId,
            asaasId: asaasCustomer.id,
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Erro ao buscar customer no Asaas: ${err.message}`);
    }

    // Cria novo customer no Asaas
    try {
      const { data: newCustomer } = await client.post('/customers', {
        name: cooperado.nomeCompleto,
        cpfCnpj: cooperado.cpf,
        email: cooperado.email,
        phone: cooperado.telefone,
      });

      return this.prisma.asaasCustomer.create({
        data: {
          cooperadoId,
          asaasId: newCustomer.id,
        },
      });
    } catch (err) {
      this.logger.error(`Erro ao criar customer no Asaas: ${err.response?.data?.errors || err.message}`);
      throw new BadRequestException(
        `Falha ao criar cliente no Asaas: ${JSON.stringify(err.response?.data?.errors || err.message)}`,
      );
    }
  }

  // ─── Cobranças ───────────────────────────────────────────

  async emitirCobranca(
    cooperadoId: string,
    cooperativaId: string,
    dados: {
      valor: number;
      vencimento: string;
      descricao: string;
      formaPagamento: string; // BOLETO | PIX | CREDIT_CARD
      cobrancaId?: string; // FK para Cobranca do sistema
    },
  ) {
    const customer = await this.criarOuBuscarCustomer(cooperadoId, cooperativaId);
    const client = await this.getApiClient(cooperativaId);

    // Mapear forma de pagamento
    const billingTypeMap: Record<string, string> = {
      BOLETO: 'BOLETO',
      PIX: 'PIX',
      CREDIT_CARD: 'CREDIT_CARD',
      CARTAO_CREDITO: 'CREDIT_CARD',
    };
    const billingType = billingTypeMap[dados.formaPagamento] || 'BOLETO';

    try {
      const { data: payment } = await client.post('/payments', {
        customer: customer.asaasId,
        billingType,
        value: dados.valor,
        dueDate: dados.vencimento,
        description: dados.descricao,
      });

      // Salvar no banco local
      const asaasCobranca = await this.prisma.asaasCobranca.create({
        data: {
          cobrancaId: dados.cobrancaId || null,
          cooperadoId,
          asaasId: payment.id,
          status: payment.status,
          valor: dados.valor,
          vencimento: new Date(dados.vencimento),
          linkPagamento: payment.invoiceUrl || null,
          boletoUrl: payment.bankSlipUrl || null,
          nossoNumero: payment.nossoNumero || null,
          formaPagamento: billingType,
        },
      });

      // Se for PIX, buscar QR Code
      if (billingType === 'PIX' && payment.status !== 'RECEIVED') {
        try {
          const { data: pixData } = await client.get(`/payments/${payment.id}/pixQrCode`);
          await this.prisma.asaasCobranca.update({
            where: { id: asaasCobranca.id },
            data: {
              pixQrCode: pixData.encodedImage || null,
              pixCopiaECola: pixData.payload || null,
            },
          });
          return {
            ...asaasCobranca,
            pixQrCode: pixData.encodedImage,
            pixCopiaECola: pixData.payload,
          };
        } catch {
          // PIX QR code pode não estar disponível imediatamente
        }
      }

      // Se for BOLETO, buscar linha digitável
      if (billingType === 'BOLETO') {
        try {
          const { data: idField } = await client.get(`/payments/${payment.id}/identificationField`);
          if (idField?.identificationField) {
            await this.prisma.asaasCobranca.update({
              where: { id: asaasCobranca.id },
              data: { linhaDigitavel: idField.identificationField },
            });
            return { ...asaasCobranca, linhaDigitavel: idField.identificationField };
          }
        } catch {
          // Linha digitável pode não estar disponível imediatamente
        }
      }

      return asaasCobranca;
    } catch (err) {
      this.logger.error(`Erro ao emitir cobrança Asaas: ${err.response?.data?.errors || err.message}`);
      throw new BadRequestException(
        `Falha ao emitir cobrança no Asaas: ${JSON.stringify(err.response?.data?.errors || err.message)}`,
      );
    }
  }

  async buscarStatusCobranca(asaasId: string, cooperativaId: string) {
    const client = await this.getApiClient(cooperativaId);
    try {
      const { data } = await client.get(`/payments/${asaasId}`);
      // Atualizar status local
      await this.prisma.asaasCobranca.updateMany({
        where: { asaasId },
        data: { status: data.status },
      });
      return data;
    } catch (err) {
      throw new BadRequestException(`Erro ao consultar cobrança: ${err.message}`);
    }
  }

  async cancelarCobranca(asaasId: string, cooperativaId?: string | null) {
    // D-novo-BR F0.5 CRITICO (31/05/2026) — posse via cooperado.cooperativaId
    // (AsaasCobranca não tem coluna direta). Bloqueia cancelamento cross-tenant.
    // cooperativaId null = SUPER_ADMIN bypass.
    let cooperativaIdEfetiva: string;
    if (cooperativaId) {
      const cobranca = await this.prisma.asaasCobranca.findFirst({
        where: { asaasId, cooperado: { cooperativaId } },
        select: { id: true, cooperado: { select: { cooperativaId: true } } },
      });
      if (!cobranca) {
        throw new BadRequestException('Cobrança não encontrada');
      }
      cooperativaIdEfetiva = cooperativaId;
    } else {
      // SUPER_ADMIN bypass — descobrir o tenant da cobrança pra getApiClient
      const cobranca = await this.prisma.asaasCobranca.findFirst({
        where: { asaasId },
        select: { id: true, cooperado: { select: { cooperativaId: true } } },
      });
      if (!cobranca?.cooperado?.cooperativaId) {
        throw new BadRequestException('Cobrança não encontrada ou sem tenant');
      }
      cooperativaIdEfetiva = cobranca.cooperado.cooperativaId;
    }
    const client = await this.getApiClient(cooperativaIdEfetiva);
    try {
      await client.delete(`/payments/${asaasId}`);
      await this.prisma.asaasCobranca.updateMany({
        where: { asaasId },
        data: { status: 'CANCELLED' },
      });
      return { message: 'Cobrança cancelada com sucesso' };
    } catch (err) {
      throw new BadRequestException(
        `Erro ao cancelar cobrança: ${JSON.stringify(err.response?.data?.errors || err.message)}`,
      );
    }
  }

  async listarCobrancasCooperado(cooperadoId: string) {
    return this.prisma.asaasCobranca.findMany({
      where: { cooperadoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Assinatura (recorrência) ────────────────────────────

  async criarAssinatura(
    cooperadoId: string,
    cooperativaId: string,
    dados: { valor: number; ciclo?: string; descricao: string },
  ) {
    const customer = await this.criarOuBuscarCustomer(cooperadoId, cooperativaId);
    const client = await this.getApiClient(cooperativaId);

    try {
      const { data } = await client.post('/subscriptions', {
        customer: customer.asaasId,
        billingType: 'BOLETO',
        value: dados.valor,
        cycle: dados.ciclo || 'MONTHLY',
        description: dados.descricao,
        nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      });
      return data;
    } catch (err) {
      throw new BadRequestException(
        `Erro ao criar assinatura: ${JSON.stringify(err.response?.data?.errors || err.message)}`,
      );
    }
  }

  // ─── Webhook ─────────────────────────────────────────────

  async processarWebhook(payload: any, token: string) {
    // Validar token do webhook
    if (!token) {
      throw new UnauthorizedException('Token de webhook ausente');
    }

    // Buscar configs com webhookToken definido e comparar com timing-safe
    const configs = await this.prisma.asaasConfig.findMany({
      where: { webhookToken: { not: null } },
      select: { id: true, cooperativaId: true, webhookToken: true },
    });

    const config = configs.find((c) => {
      if (!c.webhookToken) return false;
      const a = Buffer.from(token);
      const b = Buffer.from(c.webhookToken);
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    });

    if (!config) {
      this.logger.warn('Webhook Asaas recebido com token inválido — rejeitando');
      throw new UnauthorizedException('Token de webhook inválido');
    }

    const event = payload.event;
    const payment = payload.payment;
    // F6 Bloco C.4 P0-B (14/06/2026): TRANSFER_* = PIX-out (resgate F6).
    const transfer = payload.transfer;

    // Rota TRANSFER_* (PIX-out do F6) ANTES da rota PAYMENT_*. Resolve tenant
    // via recibo + valida que o token do webhook bate com a cooperativa
    // emissora — fecha de carona D-novo-ASAAS-WEBHOOK-AUTH (sem este
    // cruzamento, token válido em tenant X poderia processar TRANSFER de
    // tenant Y).
    if (event && typeof event === 'string' && event.startsWith('TRANSFER_')) {
      return this.processarWebhookTransfer({
        event,
        transfer,
        configCooperativaId: config.cooperativaId,
      });
    }

    if (!payment?.id) {
      this.logger.warn('Webhook sem payment ID');
      return { received: true };
    }

    // Idempotency: usar combinação event+payment.id como chave
    const eventId = `${event}_${payment.id}`;

    this.logger.log(`Webhook Asaas: ${event} para payment ${payment.id}`);

    const statusMap: Record<string, string> = {
      PAYMENT_RECEIVED: 'RECEIVED',
      PAYMENT_CONFIRMED: 'CONFIRMED',
      PAYMENT_OVERDUE: 'OVERDUE',
      PAYMENT_DELETED: 'CANCELLED',
      PAYMENT_REFUNDED: 'REFUNDED',
      PAYMENT_CREATED: 'PENDING',
      PAYMENT_UPDATED: payment.status || 'PENDING',
    };

    const newStatus = statusMap[event];
    if (!newStatus) {
      this.logger.log(`Evento não mapeado: ${event}`);
      return { received: true };
    }

    // Atualizar AsaasCobranca
    const asaasCobranca = await this.prisma.asaasCobranca.findFirst({
      where: { asaasId: payment.id },
    });

    // Corretiva Asaas Webhook 2026-07-20 — fluxo INSERT-FIRST idempotente
    // + efeitos ESSENCIAIS atômicos numa única $transaction:
    //  1. WebhookEvent.create — P2002 no @@unique([provider, eventId]) =
    //     duplicado → catch abaixo retorna 200 idempotente sem re-aplicar.
    //  2. AsaasCobranca.update — mantém metadados atualizados.
    //  3. Se PAYMENT_RECEIVED/CONFIRMED com cobrancaId associado, chamada
    //     awaited direta pro CobrancasService.darBaixaTx (substitui o
    //     eventEmitter.emit('pagamento.confirmado') fire-and-forget).
    //  Erro em (2)/(3) → throw → tx rollback → WebhookEvent NÃO commita
    //  → controller retorna 500 → Asaas re-tenta (backoff próprio dele).
    //  Best-effort pós-commit (notif WA/email, evento MLM, hook CT.3,
    //  métricas Clube) rodam FORA da tx via executarPosBaixaBestEffort.
    let darBaixaResult: { cobrancaId: string; valorFinal: number } | null = null;
    const isPaymentConfirmed =
      (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') &&
      asaasCobranca?.cobrancaId;
    const dtPagamento = payment.paymentDate
      ? new Date(payment.paymentDate)
      : new Date();

    try {
      await this.prisma.$transaction(async (tx) => {
        // (1) Insert-first — fonte única de idempotência.
        await tx.webhookEvent.create({
          data: {
            provider: 'ASAAS',
            eventId,
            payload,
            status: 'PROCESSED',
            processadoEm: new Date(),
          },
        });

        // (2) Update AsaasCobranca dentro da tx (mesmos metadados de antes).
        //     `ultimoWebhookEventId` continua sendo escrito pra compat com
        //     leituras/scripts externos, mas NÃO é mais fonte de idempotência
        //     (agora é o WebhookEvent). Vai virar débito removê-lo depois.
        if (asaasCobranca) {
          await tx.asaasCobranca.update({
            where: { id: asaasCobranca.id },
            data: {
              status: newStatus,
              linkPagamento: payment.invoiceUrl || asaasCobranca.linkPagamento,
              boletoUrl: payment.bankSlipUrl || asaasCobranca.boletoUrl,
              nossoNumero: payment.nossoNumero || asaasCobranca.nossoNumero,
              ultimoWebhookEventId: eventId,
            },
          });
        }

        // (3) Essencial: dar baixa na Cobranca (síncrono, awaited, dentro
        //     da mesma tx). Substitui fire-and-forget do eventEmitter.
        if (isPaymentConfirmed) {
          const r = await this.getCobrancasService().darBaixaTx(tx, {
            cobrancaId: asaasCobranca!.cobrancaId!,
            dataPagamento: dtPagamento,
            valorPago: payment.value,
            metodoPagamento: 'ASAAS',
          });
          darBaixaResult = { cobrancaId: r.cobrancaId, valorFinal: r.valorFinal };
        }

        // (3b) PAYMENT_OVERDUE — Corretiva 2026-07-20 (A3 P2 revisor):
        //   update de status VENCIDO agora DENTRO da tx (antes ficava fora
        //   pós-return 200 → falha silenciosa não re-tentava, admin via
        //   status inconsistente e regras de multa/juros baseadas em
        //   status='VENCIDO' quebravam). Se update falha aqui, tx aborta
        //   → WebhookEvent NÃO commita → Asaas re-tenta.
        if (event === 'PAYMENT_OVERDUE' && asaasCobranca?.cobrancaId) {
          await tx.cobranca.update({
            where: { id: asaasCobranca.cobrancaId },
            data: { status: 'VENCIDO' },
          });
        }
      });
    } catch (err) {
      // Duplicado — P2002 no unique do WebhookEvent = idempotente 200.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const target = Array.isArray(err.meta?.target)
          ? (err.meta.target as string[])
          : [];
        const targetStr = typeof err.meta?.target === 'string' ? err.meta.target : '';
        const isWebhookEventUnique =
          (target.includes('provider') && target.includes('eventId')) ||
          targetStr === 'webhook_events_provider_eventId_key' ||
          targetStr === 'webhook_events_provider_eventid_key';
        if (isWebhookEventUnique) {
          this.logger.log(`Webhook duplicado ignorado (WebhookEvent unique): ${eventId}`);
          return { received: true, skipped: 'duplicado' };
        }
      }
      // Erro real em efeito essencial (darBaixaTx, LancamentoCaixa,
      // token CLUBE, etc). Tx rollback já aconteceu — WebhookEvent NÃO
      // ficou marcado. Propaga → controller devolve 500 → Asaas re-tenta.
      this.logger.error(
        `[Webhook Asaas] efeito essencial falhou — Asaas vai re-tentar: eventId=${eventId} err=${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }

    // (4) Best-effort pós-commit (fora da tx — falha NÃO reverte pagamento).
    //     WebhookEvent JÁ está marcado PROCESSED; Asaas NÃO re-tenta.
    //     Se algum listener aqui falhar, log warn e segue — o pagamento
    //     está confirmado do ponto de vista financeiro.
    if (darBaixaResult) {
      const r = darBaixaResult as { cobrancaId: string; valorFinal: number };
      this.getCobrancasService()
        .executarPosBaixaBestEffort(r.cobrancaId, r.valorFinal, dtPagamento)
        .catch((posErr) =>
          this.logger.warn(
            `[Webhook Asaas] pós-baixa best-effort falhou (não reverte pagamento): ${(posErr as Error).message}`,
          ),
        );
    }

    // (5) PAYMENT_OVERDUE — movido pra DENTRO da tx principal (bloco 3b acima).
    //     Corretiva 2026-07-20 A3 P2 (revisor financeiro): antes rodava
    //     aqui FORA da tx com try/catch swallow → falha silenciosa não
    //     re-tentava, cobrança ficava sem status='VENCIDO', regras de
    //     multa/juros baseadas em status quebravam. Agora atômico com
    //     WebhookEvent — se update falha, tx rollback → 500 → Asaas retry.

    // Sprint Clube P1 — Fase 2 Bloco 3 (11/06/2026): roteamento de webhook pra
    // CooperTokenCompra. Emite evento sem dependencia direta de CooperToken
    // (evita ciclo Asaas↔CooperToken). Listener registrado em
    // cooper-token-compra-pj.listener.ts processa o credito via creditar()
    // com tipo COMPRA_PJ_COOPERADA + idempotencia 2 camadas
    // (CooperTokenCompra.ultimoWebhookEventId + ledger.referenciaId).
    if (
      (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') &&
      payment.id
    ) {
      const compraToken = await this.prisma.cooperTokenCompra.findFirst({
        where: { asaasId: payment.id },
      });
      if (compraToken) {
        this.logger.log(
          `[webhook→cooper-token] match CooperTokenCompra ${compraToken.id} via payment ${payment.id} — emite cooper-token-compra-pj.paga`,
        );
        this.eventEmitter.emit('cooper-token-compra-pj.paga', {
          compraId: compraToken.id,
          eventId,
          paymentId: payment.id,
        });
      }
    }

    return { received: true };
  }

  /**
   * F6 Bloco C.4 P0-B (14/06/2026) — Rota TRANSFER_* do webhook Asaas
   * (PIX-out do resgate F6).
   *
   * Eventos Asaas considerados:
   *  - TRANSFER_DONE / TRANSFER_CONFIRMED → sucesso (libera queima + ledger).
   *  - TRANSFER_FAILED / TRANSFER_CANCELLED → falha (estorno auditável).
   *  - TRANSFER_CREATED / TRANSFER_PENDING / outros → intermediário, ignora.
   *
   * Tenant via recibo (D-novo-ASAAS-WEBHOOK-AUTH fechado de carona):
   *  - Recibo identifica a cooperativa emissora.
   *  - Token do webhook foi validado contra alguma AsaasConfig — cruza
   *    contra a cooperativa do recibo aqui. Token de tenant X NÃO pode
   *    processar TRANSFER de tenant Y (anti-fraude cross-tenant via
   *    webhook).
   *
   * Idempotência (REFORÇO 2) + compare-and-swap (REFORÇO 3) ficam no
   * `CooperTokenService.processarWebhookResgate` — invocado via
   * EventEmitter pra evitar ciclo Asaas↔CooperToken (mesmo padrão
   * F2 compra-PJ).
   */
  private async processarWebhookTransfer(params: {
    event: string;
    transfer: any;
    configCooperativaId: string;
  }): Promise<{ received: true; skipped?: string }> {
    const { event, transfer, configCooperativaId } = params;

    if (!transfer?.id) {
      this.logger.warn(`Webhook ${event} sem transfer.id — ignorando`);
      return { received: true, skipped: 'sem-transfer-id' };
    }

    const eventId = `${event}_${transfer.id}`;
    this.logger.log(`Webhook Asaas TRANSFER: ${event} para transfer ${transfer.id}`);

    // Resolve recibo + cooperativa emissora.
    const recibo = await this.prisma.resgateRecibo.findFirst({
      where: { asaasTransferId: transfer.id },
      select: { id: true, cooperativaId: true, numeroRecibo: true, status: true },
    });
    if (!recibo) {
      this.logger.warn(
        `[webhook→resgate] TRANSFER ${transfer.id} sem recibo correspondente — pode ser de outra origem ou janela de ${''
        }race solicitar→aprovar; ignorando`,
      );
      return { received: true, skipped: 'recibo-nao-encontrado' };
    }

    // Auth cruzada: o token do webhook tem que pertencer ao MESMO tenant
    // que emitiu o recibo. Token X processando TRANSFER de Y = anti-fraude.
    if (configCooperativaId !== recibo.cooperativaId) {
      this.logger.error(
        `[webhook→resgate] CROSS-TENANT BLOQUEADO: token de cooperativa=${configCooperativaId} tentou processar recibo ${recibo.numeroRecibo} (cooperativa=${recibo.cooperativaId}) — rejeitando`,
      );
      throw new UnauthorizedException(
        'Token de webhook não corresponde à cooperativa emissora do recibo.',
      );
    }

    // Decide sucesso/falha.
    let sucesso: boolean;
    let motivoFalha: string | undefined;
    if (event === 'TRANSFER_DONE' || event === 'TRANSFER_CONFIRMED') {
      sucesso = true;
    } else if (event === 'TRANSFER_FAILED' || event === 'TRANSFER_CANCELLED') {
      sucesso = false;
      // Asaas usa `failReason` em alguns eventos; fallback razoável.
      motivoFalha =
        transfer.failReason ||
        transfer.statusReason ||
        `Asaas reportou ${event}`;
    } else {
      // CREATED/PENDING e outros intermediários — recibo já está em
      // APROVADO_PIX_DISPARADO; nada a fazer até confirmação final.
      this.logger.log(
        `[webhook→resgate] TRANSFER intermediário ${event} ignorado pra recibo ${recibo.numeroRecibo}`,
      );
      return { received: true, skipped: 'evento-intermediario' };
    }

    // Emit evento — listener (CooperTokenResgateListener) chama
    // CooperTokenService.processarWebhookResgate com REFORÇOS 2+3.
    this.eventEmitter.emit('cooper-token-resgate.transfer', {
      asaasTransferId: transfer.id,
      eventId,
      sucesso,
      motivoFalha,
      cooperativaId: recibo.cooperativaId,
    });

    return { received: true };
  }

  // ─── Teste de conexão ────────────────────────────────────

  async testarConexao(cooperativaId: string) {
    const client = await this.getApiClient(cooperativaId);
    try {
      const { data } = await client.get('/customers', { params: { limit: 1 } });
      return { ok: true, totalCustomers: data.totalCount ?? 0 };
    } catch (err) {
      return { ok: false, erro: err.response?.data?.errors || err.message };
    }
  }
}
