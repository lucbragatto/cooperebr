import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { StatusFaturaCampanha } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { FaturasService } from '../faturas/faturas.service';
import { sanitizarTextoOcr, sanitizarNumeroUc } from './lib/campanha-alias';

/**
 * Sprint Máscara de e-mail por convênio (06/07/2026).
 *
 * Trata o RAMO CAMPANHA do email-monitor + endpoints admin do convênio.
 * Fluxo cooperado normal segue no email-monitor.service — este service é
 * SÓ pra faturas de campanha (pré-cadastro).
 *
 * Isolamento multi-tenant:
 *  - Todas as queries filtram por cooperativaId; ramo campanha grava o
 *    cooperativaId denormalizado do convênio (defesa em profundidade).
 *  - Endpoints usam cooperativaId do JWT (lição M45).
 *
 * Reviewers pós-build: cooperebr-multitenant-reviewer + code-reviewer.
 */

/** Guard de tamanho de anexo aprovado pelo orquestrador (06/07). */
export const CAMPANHA_ANEXO_MAX_BYTES = 15 * 1024 * 1024; // 15MB

/** Raiz do diretório de anexos — coberta pelo .gitignore (uploads/). */
export const CAMPANHA_UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads', 'campanha');

export interface AnexoIn {
  filename: string;
  content: Buffer;
}

export interface ProcessarFaturaCampanhaInput {
  convenioId: string;
  cooperativaId: string;
  emailRemetente: string;
  emailAssunto?: string;
  anexo: AnexoIn;
}

@Injectable()
export class FaturasCampanhaService {
  private readonly logger = new Logger(FaturasCampanhaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly faturasService: FaturasService,
  ) {}

  /**
   * Processa uma fatura de campanha capturada pelo email-monitor.
   *
   * Passos:
   *  1. Guard 15MB (rejeita anexo grande sem gastar OCR).
   *  2. Salva anexo em `uploads/campanha/<convenioId>/<hash>.pdf`.
   *  3. Tenta OCR — se falhar, grava status=OCR_FALHOU pra revisão manual.
   *  4. Sanitiza campos OCR (Acréscimo B).
   *  5. Dedupe SEMÂNTICA por (convenioId, numeroUC): findFirst → update
   *     se existir e a UC bater, senão create.
   *
   * Retorna o registro criado/atualizado + o status resolvido.
   */
  async processarFaturaCampanha(input: ProcessarFaturaCampanhaInput): Promise<{
    id: string;
    status: StatusFaturaCampanha;
    upserted: 'CREATED' | 'UPDATED';
  }> {
    const { convenioId, cooperativaId, emailRemetente, emailAssunto, anexo } = input;

    if (anexo.content.length > CAMPANHA_ANEXO_MAX_BYTES) {
      this.logger.warn(
        `[campanha] Anexo grande demais (${anexo.content.length} B > ${CAMPANHA_ANEXO_MAX_BYTES} B) — convenio=${convenioId}, remetente=${this.mask(emailRemetente)}`,
      );
      throw new BadRequestException(
        `Anexo excede o limite de ${Math.round(CAMPANHA_ANEXO_MAX_BYTES / 1024 / 1024)} MB.`,
      );
    }

    const anexoPath = await this.salvarAnexoEmDisco(convenioId, anexo);
    const remetenteSan = sanitizarTextoOcr(emailRemetente) ?? 'desconhecido@';
    const assuntoSan = sanitizarTextoOcr(emailAssunto);

    let statusOcr: 'OCR_OK' | 'OCR_FALHOU' = 'OCR_OK';
    let dadosOcr: Record<string, unknown> = {};
    let numeroUC: string | undefined;
    let nomeExtraido: string | undefined;
    let cpfExtraido: string | undefined;
    let distribuidora: string | undefined;
    let consumoMedioKwh: number | undefined;
    let valorFatura: number | undefined;

    try {
      const base64 = anexo.content.toString('base64');
      const bruto = (await this.faturasService.extrairOcr(base64, 'pdf')) as unknown as Record<
        string,
        unknown
      >;
      dadosOcr = bruto;
      numeroUC = sanitizarNumeroUc(bruto.numeroUC as string | undefined);
      nomeExtraido = sanitizarTextoOcr(bruto.titular as string | undefined);
      cpfExtraido = sanitizarTextoOcr(bruto.documento as string | undefined, 20);
      distribuidora = sanitizarTextoOcr(bruto.distribuidora as string | undefined, 40);
      const consumoRaw = Number(bruto.consumoAtualKwh ?? bruto.consumoMedioKwh ?? NaN);
      if (Number.isFinite(consumoRaw) && consumoRaw > 0) consumoMedioKwh = consumoRaw;
      const valorRaw = Number(bruto.totalAPagar ?? bruto.valorFatura ?? NaN);
      if (Number.isFinite(valorRaw) && valorRaw > 0) valorFatura = valorRaw;
    } catch (err) {
      statusOcr = 'OCR_FALHOU';
      this.logger.warn(
        `[campanha] OCR falhou (registro salvo pra revisão manual) — convenio=${convenioId}: ${(err as Error).message}`,
      );
    }

    const status: StatusFaturaCampanha = statusOcr === 'OCR_OK' ? 'OCR_OK' : 'OCR_FALHOU';

    // Dedupe semântica: findFirst por (convenioId, numeroUC) quando UC extraída.
    // Sem UC (OCR_FALHOU) sempre cria — humano revisa depois.
    let upserted: 'CREATED' | 'UPDATED' = 'CREATED';
    let registroId: string;

    if (numeroUC) {
      const existente = await this.prisma.faturaCampanhaConvenio.findFirst({
        where: { convenioId, numeroUC },
        select: { id: true },
      });
      if (existente) {
        const atualizado = await this.prisma.faturaCampanhaConvenio.update({
          where: { id: existente.id },
          data: {
            emailRemetente: remetenteSan,
            emailAssunto: assuntoSan ?? null,
            nomeExtraido: nomeExtraido ?? null,
            cpfExtraido: cpfExtraido ?? null,
            distribuidora: distribuidora ?? null,
            consumoMedioKwh: consumoMedioKwh ?? null,
            valorFatura: valorFatura ?? null,
            dadosOcr: dadosOcr as any,
            anexoPath,
            status,
          },
          select: { id: true },
        });
        registroId = atualizado.id;
        upserted = 'UPDATED';
      } else {
        const criado = await this.prisma.faturaCampanhaConvenio.create({
          data: {
            convenioId,
            cooperativaId,
            emailRemetente: remetenteSan,
            emailAssunto: assuntoSan,
            nomeExtraido,
            cpfExtraido,
            numeroUC,
            distribuidora,
            consumoMedioKwh,
            valorFatura,
            dadosOcr: dadosOcr as any,
            anexoPath,
            status,
          },
          select: { id: true },
        });
        registroId = criado.id;
      }
    } else {
      const criado = await this.prisma.faturaCampanhaConvenio.create({
        data: {
          convenioId,
          cooperativaId,
          emailRemetente: remetenteSan,
          emailAssunto: assuntoSan,
          nomeExtraido,
          cpfExtraido,
          numeroUC: undefined,
          distribuidora,
          consumoMedioKwh,
          valorFatura,
          dadosOcr: dadosOcr as any,
          anexoPath,
          status,
        },
        select: { id: true },
      });
      registroId = criado.id;
    }

    return { id: registroId, status, upserted };
  }

  /**
   * Lista faturas de campanha do convênio + agregados pra dimensionar o
   * ágio + prova social. Filtra por cooperativaId do JWT (M45).
   */
  async listarPorConvenio(convenioId: string, cooperativaId: string) {
    // Guarda posse do convênio (multi-tenant strict).
    const convenio = await this.prisma.contratoConvenio.findFirst({
      where: { id: convenioId, cooperativaId },
      select: { id: true, empresaNome: true, emailAliasCampanha: true },
    });
    if (!convenio) {
      throw new NotFoundException('Convênio não encontrado neste tenant.');
    }

    // Sprint Máscara (06/07/2026) — preview do alias completo pra UI.
    // Local-part vem do config email.monitor.user DO TENANT (Acréscimo A).
    const emailMonitorUser = await this.prisma.configTenant.findFirst({
      where: { chave: 'email.monitor.user', cooperativaId },
      select: { valor: true },
    });
    const previewLocalPart = emailMonitorUser?.valor
      ? emailMonitorUser.valor.split('@')[0]?.toLowerCase() ?? null
      : null;
    const previewDomain = emailMonitorUser?.valor
      ? emailMonitorUser.valor.split('@')[1]?.toLowerCase() ?? null
      : null;
    const previewAlias =
      convenio.emailAliasCampanha && previewLocalPart && previewDomain
        ? `${previewLocalPart}+${convenio.emailAliasCampanha}@${previewDomain}`
        : null;

    const registros = await this.prisma.faturaCampanhaConvenio.findMany({
      where: { convenioId, cooperativaId },
      orderBy: { createdAt: 'desc' },
      include: {
        vinculadoCooperado: {
          select: { id: true, nomeCompleto: true },
        },
      },
    });

    // Agregados só sobre OCR_OK/VINCULADA (dados confiáveis).
    const agregaveis = registros.filter(
      (r) => r.status === 'OCR_OK' || r.status === 'VINCULADA',
    );
    const totalKwh = agregaveis.reduce((s, r) => s + Number(r.consumoMedioKwh ?? 0), 0);
    const totalValor = agregaveis.reduce((s, r) => s + Number(r.valorFatura ?? 0), 0);

    return {
      convenio: {
        id: convenio.id,
        empresaNome: convenio.empresaNome,
        emailAliasCampanha: convenio.emailAliasCampanha,
        previewAlias,
        previewLocalPart,
        previewDomain,
      },
      agregados: {
        total: registros.length,
        totalAgregaveis: agregaveis.length,
        somaKwh: Math.round(totalKwh * 100) / 100,
        somaValor: Math.round(totalValor * 100) / 100,
      },
      registros,
    };
  }

  /**
   * Atualiza status de uma FaturaCampanhaConvenio.
   *  - DESCARTADA: livre (admin fecha o registro).
   *  - VINCULADA: exige cooperadoId no MESMO tenant.
   *
   * cooperativaId vem do JWT (M45); registro precisa pertencer ao tenant.
   */
  async atualizarStatus(input: {
    convenioId: string;
    faturaId: string;
    cooperativaId: string;
    status: 'DESCARTADA' | 'VINCULADA';
    cooperadoId?: string;
  }) {
    const { convenioId, faturaId, cooperativaId, status, cooperadoId } = input;

    // Guard: registro pertence ao convênio + tenant.
    const registro = await this.prisma.faturaCampanhaConvenio.findFirst({
      where: { id: faturaId, convenioId, cooperativaId },
      select: { id: true, status: true },
    });
    if (!registro) {
      throw new NotFoundException('Fatura de campanha não encontrada.');
    }
    if (registro.status === 'DESCARTADA' || registro.status === 'VINCULADA') {
      throw new BadRequestException('Fatura já foi finalizada (DESCARTADA ou VINCULADA).');
    }

    if (status === 'VINCULADA') {
      if (!cooperadoId) {
        throw new BadRequestException('cooperadoId obrigatório para status VINCULADA.');
      }
      const coop = await this.prisma.cooperado.findFirst({
        where: { id: cooperadoId, cooperativaId },
        select: { id: true },
      });
      if (!coop) {
        throw new BadRequestException('Cooperado não encontrado neste tenant.');
      }
    }

    return this.prisma.faturaCampanhaConvenio.update({
      where: { id: registro.id },
      data: {
        status,
        vinculadoCooperadoId: status === 'VINCULADA' ? cooperadoId : null,
        vinculadoEm: status === 'VINCULADA' ? new Date() : null,
      },
    });
  }

  // ─── Helpers privados ────────────────────────────────────────────

  /**
   * Salva o PDF em uploads/campanha/<convenioId>/<hash>.pdf.
   * Retorna o path relativo (não absoluto) pra portabilidade cross-machine.
   * Reuso: se o hash já existe, aproveita.
   */
  private async salvarAnexoEmDisco(convenioId: string, anexo: AnexoIn): Promise<string> {
    // Sanitiza o convenioId contra path traversal (paranoia — é CUID, mas
    // defense-in-depth pra futuros callers).
    const convenioIdLimpo = convenioId.replace(/[^a-zA-Z0-9-]/g, '');
    if (!convenioIdLimpo) {
      throw new BadRequestException('convenioId inválido.');
    }

    const hash = createHash('sha256').update(anexo.content).digest('hex').slice(0, 16);
    const nomeArquivo = `${hash}.pdf`;
    const dirAbsoluto = path.join(CAMPANHA_UPLOADS_ROOT, convenioIdLimpo);
    const pathAbsoluto = path.join(dirAbsoluto, nomeArquivo);

    await fs.mkdir(dirAbsoluto, { recursive: true });
    // Reuso: se já existe (mesmo conteúdo), evita re-write.
    try {
      await fs.access(pathAbsoluto);
    } catch {
      await fs.writeFile(pathAbsoluto, anexo.content);
    }

    return path.posix.join('uploads', 'campanha', convenioIdLimpo, nomeArquivo);
  }

  /** Máscara defensiva pra log — remetente é PII. */
  private mask(email: string): string {
    if (!email) return '***';
    const at = email.indexOf('@');
    if (at < 3) return '***' + email.slice(at);
    return email.slice(0, 2) + '***' + email.slice(at);
  }
}
