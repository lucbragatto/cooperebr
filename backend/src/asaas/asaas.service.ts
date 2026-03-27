import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);

  constructor(private prisma: PrismaService) {}

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
    const encryptedKey = this.encrypt(data.apiKey);
    return this.prisma.asaasConfig.upsert({
      where: { cooperativaId },
      update: {
        apiKey: encryptedKey,
        ambiente: data.ambiente,
        webhookToken: data.webhookToken,
      },
      create: {
        cooperativaId,
        apiKey: encryptedKey,
        ambiente: data.ambiente,
        webhookToken: data.webhookToken,
      },
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

  async cancelarCobranca(asaasId: string, cooperativaId: string) {
    const client = await this.getApiClient(cooperativaId);
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

    const config = await this.prisma.asaasConfig.findFirst({
      where: { webhookToken: token },
    });

    if (!config) {
      this.logger.warn('Webhook Asaas recebido com token inválido — rejeitando');
      throw new UnauthorizedException('Token de webhook inválido');
    }

    const event = payload.event;
    const payment = payload.payment;

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

    if (asaasCobranca) {
      // Verificar idempotency — ignorar se já processamos este evento
      if (asaasCobranca.ultimoWebhookEventId === eventId) {
        this.logger.log(`Webhook duplicado ignorado: ${eventId}`);
        return { received: true, skipped: 'duplicado' };
      }

      await this.prisma.asaasCobranca.update({
        where: { id: asaasCobranca.id },
        data: {
          status: newStatus,
          linkPagamento: payment.invoiceUrl || asaasCobranca.linkPagamento,
          boletoUrl: payment.bankSlipUrl || asaasCobranca.boletoUrl,
          nossoNumero: payment.nossoNumero || asaasCobranca.nossoNumero,
          ultimoWebhookEventId: eventId,
        },
      });

      // Se pagamento confirmado/recebido, atualizar Cobranca vinculada
      if (
        (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') &&
        asaasCobranca.cobrancaId
      ) {
        try {
          await this.prisma.cobranca.update({
            where: { id: asaasCobranca.cobrancaId },
            data: {
              status: 'PAGO',
              dataPagamento: payment.paymentDate
                ? new Date(payment.paymentDate)
                : new Date(),
              valorPago: payment.value,
            },
          });
        } catch (err) {
          this.logger.warn(`Não foi possível atualizar cobrança vinculada: ${err.message}`);
        }
      }

      // Se vencido, atualizar Cobranca vinculada
      if (event === 'PAYMENT_OVERDUE' && asaasCobranca.cobrancaId) {
        try {
          await this.prisma.cobranca.update({
            where: { id: asaasCobranca.cobrancaId },
            data: { status: 'VENCIDO' },
          });
        } catch {
          // silently ignore
        }
      }
    }

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
