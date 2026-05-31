import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { AuditLog } from '../audit/audit-log.decorator';
import { RepassesProprietarioService } from './repasses-proprietario.service';
import { MarcarRepassePagoDto } from './dto/marcar-repasse-pago.dto';
import { CancelarRepasseDto } from './dto/cancelar-repasse.dto';
import { EstornarRepasseDto } from './dto/estornar-repasse.dto';
import { ListarRepassesQueryDto } from './dto/listar-repasses-query.dto';
import { TenantResource } from '../auth/tenant-resource.decorator';

const { SUPER_ADMIN, ADMIN, OPERADOR, PROPRIETARIO, COOPERADO } = PerfilUsuario;

/**
 * D-novo-AN AN.2 (M42, 2026-05-30) — Controller REST RepasseProprietario.
 *
 * Endpoints:
 *   GET    /repasses                              admin/SA global (filtros)
 *   GET    /repasses/proprietario                 portal proprietário (Caminho A/B)
 *   GET    /usinas/:usinaId/repasses              admin por usina (definido aqui pra evitar conflito de route)
 *   POST   /repasses/upload-comprovante           upload JPG/PNG/PDF max 5MB
 *   GET    /repasses/:id                          admin findOne com multi-tenant
 *   PUT    /repasses/:id/marcar-pago              admin marca PAGO (transação atômica)
 *   PUT    /repasses/:id/cancelar                 admin cancela
 *
 * Multi-tenant via service.assertSameTenantOrSuperAdmin.
 */
@Controller('repasses')
export class RepassesProprietarioController {
  constructor(private readonly service: RepassesProprietarioService) {}

  // ─── Rotas estáticas ANTES de :id ────────────────────────────────

  /**
   * Portal proprietário lê via tabela RepasseProprietario (não mais on-the-fly).
   * Aceita COOPERADO (Caminho A — Luciano é cooperado E proprietário) e
   * PROPRIETARIO (Caminho B — dono não-cooperado). SA/ADMIN também pra debug.
   */
  @Roles(SUPER_ADMIN, ADMIN, COOPERADO, PROPRIETARIO)
  @Get('proprietario')
  listarPorProprietario(@Req() req: any, @Query() q: ListarRepassesQueryDto) {
    return this.service.listarPorProprietario(req.user, q);
  }

  /**
   * Upload de comprovante de repasse. Reusa pattern BH.3.1.
   * Storage: backend/uploads/repasses/<cooperativaId>/<ano>/<mês>/.
   * Servido via rota estática `/uploads/` (main.ts).
   */
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @AuditLog({ acao: 'repasse.upload-comprovante', recurso: 'Comprovante' })
  @Post('upload-comprovante')
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const reqAny = req as any;
          const cooperativaId = reqAny.user?.cooperativaId ?? 'sem-coop';
          const ano = new Date().getFullYear();
          const mes = String(new Date().getMonth() + 1).padStart(2, '0');
          const dir = `./uploads/repasses/${cooperativaId}/${ano}/${mes}`;
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const stamp = Date.now();
          const rand = randomBytes(4).toString('hex');
          const ext = extname(file.originalname).toLowerCase().slice(0, 5);
          const safeBase = file.originalname
            .replace(/\.[^.]+$/, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .substring(0, 40);
          cb(null, `${stamp}-${rand}-${safeBase}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowed.includes(file.mimetype)) {
          cb(new BadRequestException('Tipo inválido. Aceitos: JPG, PNG, PDF.'), false);
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadComprovante(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('Arquivo obrigatório.');
    const cooperativaId = req.user?.cooperativaId ?? 'sem-coop';
    const ano = new Date().getFullYear();
    const mes = String(new Date().getMonth() + 1).padStart(2, '0');
    const url = `/uploads/repasses/${cooperativaId}/${ano}/${mes}/${file.filename}`;
    return { url, tamanho: file.size, mimetype: file.mimetype, nomeOriginal: file.originalname };
  }

  // ─── Listagens / Detalhe ────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  listarGlobal(@Req() req: any, @Query() q: ListarRepassesQueryDto) {
    return this.service.listarGlobal(req.user?.cooperativaId, req.user?.perfil, q);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user?.cooperativaId, req.user?.perfil);
  }

  // ─── Mutations ─────────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'repasse.marcar-pago', recurso: 'RepasseProprietario', recursoIdParam: 'id' })
  @HttpCode(200)
  @Put(':id/marcar-pago')
  marcarPago(@Param('id') id: string, @Body() dto: MarcarRepassePagoDto, @Req() req: any) {
    const usuarioId = req.user?.id ?? req.user?.userId;
    return this.service.marcarPago(id, dto, usuarioId, req.user?.cooperativaId, req.user?.perfil);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'repasse.cancelar', recurso: 'RepasseProprietario', recursoIdParam: 'id' })
  @HttpCode(200)
  @Put(':id/cancelar')
  cancelar(@Param('id') id: string, @Body() dto: CancelarRepasseDto, @Req() req: any) {
    const usuarioId = req.user?.id ?? req.user?.userId;
    return this.service.cancelar(id, dto, usuarioId, req.user?.cooperativaId, req.user?.perfil);
  }

  /**
   * D-novo-BR-CT estorno (31/05/2026 noite) — admin reverte PAGO → PENDENTE.
   * Gate contábil: apuração do mês de dataPagamento NÃO pode estar FECHADA.
   * Reverte LancamentoCaixa + desvincula despesas (transação atômica).
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'repasseProprietario' })
  @AuditLog({ acao: 'repasse.estornar', recurso: 'RepasseProprietario', recursoIdParam: 'id' })
  @HttpCode(200)
  @Put(':id/estornar')
  estornar(@Param('id') id: string, @Body() dto: EstornarRepasseDto, @Req() req: any) {
    const usuarioId = req.user?.id ?? req.user?.userId;
    return this.service.estornarRepasse(
      id,
      dto.motivo,
      usuarioId,
      req.user?.cooperativaId,
      req.user?.perfil,
    );
  }

  /**
   * D-novo-BR-CT estorno (31/05/2026 noite) — visibilidade contábil do ciclo:
   * { repasse, lancamentoGerado, despesasAbatidas[] }.
   */
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @TenantResource({ model: 'repasseProprietario' })
  @Get(':id/ciclo')
  ciclo(@Param('id') id: string, @Req() req: any) {
    return this.service.obterCicloRepasse(
      id,
      req.user?.cooperativaId,
      req.user?.perfil,
    );
  }
}

