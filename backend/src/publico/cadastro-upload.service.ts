/**
 * Convergência convite custeio Fatia 1 (04/06/2026) — Upload pré-cadastro
 * (gated por token de convite + OTP validado).
 *
 * Permite que o convidado anexe fatura/RG/selfie ANTES do cadastroWebV2
 * criar o Cooperado. Salva em Supabase Storage no path temporário:
 *   `${BUCKET}/tmp/convite-uploads/<conviteId>/<tipo>_<timestamp>.<ext>`
 *
 * Fatia 2 (frontend) consumirá `{ref, publicUrl}` retornados aqui pra
 * mostrar no wizard. cadastroWebV2 final move os blobs pra
 * `${BUCKET}/<cooperadoId>/...` + cria DocumentoCooperado (move via copy+delete
 * porque Supabase não tem move API direto — implementação Fatia 2).
 *
 * Provider storage CONFIRMADO: Supabase Storage (bucket `documentos-cooperados`),
 * mesmo usado por DocumentosService. Reuso de credenciais SUPABASE_URL +
 * SUPABASE_SERVICE_KEY. NÃO usa S3/MinIO/local — não precisa.
 *
 * Gates:
 *  - Convite vivo (não usedAt, não expirado).
 *  - otpValidadoEm dentro de janela 30min (mesma do auto-inscrever).
 *  - Tipo whitelisted: FATURA | RG_FRENTE | RG_VERSO | CNH_FRENTE | CNH_VERSO | SELFIE.
 *  - Arquivo < 5MB.
 *  - Mime: image/jpeg, image/png, image/jpg, application/pdf.
 *
 * Cleanup: arquivos tmp ficam órfãos se o cadastro nunca for completado.
 * Cron de housekeeping (fatia separada) limpa após N dias.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma.service';

const BUCKET = 'documentos-cooperados';
const TMP_PREFIX = 'tmp/convite-uploads';
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const MIMES_PERMITIDOS = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
]);
const TIPOS_PERMITIDOS = new Set([
  'FATURA',
  'RG_FRENTE',
  'RG_VERSO',
  'CNH_FRENTE',
  'CNH_VERSO',
  'SELFIE',
]);
const OTP_JANELA_MIN = 30;

export type TipoUploadCadastro =
  | 'FATURA'
  | 'RG_FRENTE'
  | 'RG_VERSO'
  | 'CNH_FRENTE'
  | 'CNH_VERSO'
  | 'SELFIE';

export interface UploadCadastroResult {
  ok: true;
  tipo: TipoUploadCadastro;
  ref: string; // storagePath relativo ao bucket (input pro move final na Fatia 2)
  publicUrl: string;
  bytes: number;
  mime: string;
}

@Injectable()
export class CadastroUploadService {
  private readonly logger = new Logger(CadastroUploadService.name);
  private supabase: SupabaseClient;

  constructor(private prisma: PrismaService) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
  }

  async uploadComConvite(
    token: string,
    tipo: string,
    arquivo: Express.Multer.File,
  ): Promise<UploadCadastroResult> {
    // ── (1) Validação básica do arquivo ────────────────────────────────
    if (!arquivo) {
      throw new BadRequestException('Arquivo obrigatório.');
    }
    if (!arquivo.buffer || arquivo.size === 0) {
      throw new BadRequestException('Arquivo vazio.');
    }
    if (arquivo.size > MAX_BYTES) {
      throw new BadRequestException(
        `Arquivo maior que ${MAX_BYTES / 1024 / 1024}MB. Reduza e tente de novo.`,
      );
    }
    if (!MIMES_PERMITIDOS.has(arquivo.mimetype)) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido. Use JPG, PNG ou PDF.`,
      );
    }

    // ── (2) Validação do tipo de documento ─────────────────────────────
    const tipoNormalizado = tipo?.toUpperCase().trim();
    if (!tipoNormalizado || !TIPOS_PERMITIDOS.has(tipoNormalizado)) {
      throw new BadRequestException(
        `Tipo inválido. Use: ${Array.from(TIPOS_PERMITIDOS).join(', ')}.`,
      );
    }

    // ── (3) Gate por convite ───────────────────────────────────────────
    if (!token || token.length !== 64) {
      throw new BadRequestException('Token de convite inválido.');
    }
    const convite = await this.prisma.conviteConvenioMembro.findUnique({
      where: { token },
      select: {
        id: true,
        usedAt: true,
        expiresAt: true,
        otpValidadoEm: true,
        cooperativaId: true,
      },
    });
    if (!convite) {
      throw new NotFoundException('Convite não encontrado.');
    }
    if (convite.usedAt) {
      throw new BadRequestException('Convite já foi usado.');
    }
    if (convite.expiresAt <= new Date()) {
      throw new BadRequestException('Convite expirou. Solicite um novo à empresa.');
    }
    if (!convite.otpValidadoEm) {
      throw new BadRequestException(
        'Valide o código de verificação (OTP) antes de enviar arquivos.',
      );
    }
    const idadeOtpMin =
      (Date.now() - convite.otpValidadoEm.getTime()) / 1000 / 60;
    if (idadeOtpMin > OTP_JANELA_MIN) {
      throw new BadRequestException(
        `Sessão expirada (OTP > ${OTP_JANELA_MIN}min). Solicite um novo código.`,
      );
    }

    // ── (4) Upload no Supabase Storage ─────────────────────────────────
    const ext = (arquivo.originalname.split('.').pop() ?? 'bin').toLowerCase().slice(0, 5);
    const storagePath = `${TMP_PREFIX}/${convite.id}/${tipoNormalizado}_${Date.now()}.${ext}`;

    const { error } = await this.supabase.storage
      .from(BUCKET)
      .upload(storagePath, arquivo.buffer, {
        contentType: arquivo.mimetype,
        upsert: true, // re-enviar mesmo tipo sobrescreve
      });
    if (error) {
      this.logger.error(
        `[cadastro-upload] Falha no upload Supabase: ${error.message} (conviteId=${convite.id})`,
      );
      throw new BadRequestException(`Erro no upload: ${error.message}`);
    }

    const { data: urlData } = this.supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    this.logger.log(
      `[cadastro-upload] OK conviteId=${convite.id} tipo=${tipoNormalizado} ` +
        `path=${storagePath} bytes=${arquivo.size}`,
    );

    return {
      ok: true,
      tipo: tipoNormalizado as TipoUploadCadastro,
      ref: storagePath,
      publicUrl: urlData.publicUrl,
      bytes: arquivo.size,
      mime: arquivo.mimetype,
    };
  }

  /**
   * Convergência Fatia 2 (04/06/2026) — Move TODOS os blobs tmp do convite
   * pra path final do cooperado + cria DocumentoCooperado registros.
   *
   * Chamado APÓS cadastroWebV2 criar o Cooperado (fim do fluxo). Best-effort:
   * se falhar, registra warning mas NÃO derruba o cadastro (o blob fica tmp
   * + admin pode subir manual depois).
   *
   * Mapeamento tipos:
   *  - FATURA: NÃO vira DocumentoCooperado (já é processada pelo OCR
   *    pré-cadastro; só ref é guardado em separado pra anexar à proposta).
   *    Por enquanto, MOVE pra path final do cooperado mas NÃO grava registro
   *    em DocumentoCooperado (que é só pra docs de KYC).
   *  - RG_FRENTE / RG_VERSO / CNH_FRENTE / CNH_VERSO / SELFIE: cria
   *    DocumentoCooperado com status=PENDENTE.
   *
   * Supabase não tem move atômico — copy+delete. Falha no delete não
   * derruba (blob fica órfão tmp; cron de housekeeping limpa).
   */
  async moverUploadsConviteParaCooperado(
    conviteId: string,
    cooperadoId: string,
  ): Promise<{
    movidos: number;
    documentos: number;
    falhas: number;
  }> {
    const prefix = `${TMP_PREFIX}/${conviteId}/`;
    let movidos = 0;
    let documentos = 0;
    let falhas = 0;

    // Lista blobs do tmp
    const { data: arquivos, error: listErr } = await this.supabase.storage
      .from(BUCKET)
      .list(prefix.replace(/\/$/, ''), { limit: 50 });

    if (listErr) {
      this.logger.warn(
        `[doc-move] Erro ao listar tmp uploads convite=${conviteId}: ${listErr.message}`,
      );
      return { movidos: 0, documentos: 0, falhas: 1 };
    }

    if (!arquivos || arquivos.length === 0) {
      // Nada pra mover — cooperado não fez upload no wizard. Normal.
      return { movidos: 0, documentos: 0, falhas: 0 };
    }

    for (const blob of arquivos) {
      const fonte = `${prefix}${blob.name}`;
      // Pattern do nome: `<TIPO>_<timestamp>.<ext>` — ver uploadComConvite
      const match = blob.name.match(/^([A-Z_]+)_\d+\.(\w+)$/);
      if (!match) {
        this.logger.warn(`[doc-move] Nome de blob não-reconhecido: ${fonte}`);
        falhas++;
        continue;
      }
      const tipo = match[1];
      const ext = match[2];
      const destino = `${cooperadoId}/${tipo.toLowerCase()}_${Date.now()}.${ext}`;

      // copy
      const { error: copyErr } = await this.supabase.storage
        .from(BUCKET)
        .copy(fonte, destino);
      if (copyErr) {
        this.logger.warn(`[doc-move] copy falhou ${fonte}→${destino}: ${copyErr.message}`);
        falhas++;
        continue;
      }

      const { data: urlData } = this.supabase.storage
        .from(BUCKET)
        .getPublicUrl(destino);

      // Cria DocumentoCooperado SE tipo for KYC (não cria pra FATURA)
      const tiposKyc = new Set(['RG_FRENTE', 'RG_VERSO', 'CNH_FRENTE', 'CNH_VERSO', 'SELFIE']);
      if (tiposKyc.has(tipo)) {
        try {
          await this.prisma.documentoCooperado.upsert({
            where: { cooperadoId_tipo: { cooperadoId, tipo: tipo as any } },
            update: {
              url: urlData.publicUrl,
              nomeArquivo: blob.name,
              status: 'PENDENTE',
              motivoRejeicao: null,
            },
            create: {
              cooperadoId,
              tipo: tipo as any,
              url: urlData.publicUrl,
              nomeArquivo: blob.name,
              status: 'PENDENTE',
            },
          });
          documentos++;
        } catch (err: any) {
          this.logger.warn(
            `[doc-move] DocumentoCooperado upsert falhou cooperado=${cooperadoId} tipo=${tipo}: ${err?.message ?? 'erro'}`,
          );
          falhas++;
          continue;
        }
      }

      movidos++;

      // best-effort delete do tmp (não bloqueia se falhar)
      await this.supabase.storage
        .from(BUCKET)
        .remove([fonte])
        .catch((err) =>
          this.logger.warn(
            `[doc-move] remove tmp falhou ${fonte}: ${err?.message ?? 'erro'}`,
          ),
        );
    }

    this.logger.log(
      `[doc-move] convite=${conviteId} cooperado=${cooperadoId} — movidos=${movidos} ` +
        `documentos=${documentos} falhas=${falhas}`,
    );

    return { movidos, documentos, falhas };
  }
}
