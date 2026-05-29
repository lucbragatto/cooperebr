import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { ContasPagarService } from './contas-pagar.service';
import { CreateContaAPagarDto } from './dto/create-conta-a-pagar.dto';
import { UpdateContaAPagarDto } from './dto/update-conta-a-pagar.dto';
import { ProporDespesaDto } from './dto/propor-despesa.dto';
import { AprovarDespesaDto } from './dto/aprovar-despesa.dto';
import { RejeitarDespesaDto } from './dto/rejeitar-despesa.dto';
import { ResolverDespesaDto } from './dto/resolver-despesa.dto';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { AuditLog } from '../audit/audit-log.decorator';

const { SUPER_ADMIN, ADMIN, OPERADOR, PROPRIETARIO } = PerfilUsuario;

@Controller('contas-pagar')
export class ContasPagarController {
  constructor(private readonly contasPagarService: ContasPagarService) {}

  // ─── Endpoints legacy (mantidos intactos) ────────────────────────

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll(@Req() req: any, @Query('status') status?: string, @Query('categoria') categoria?: string) {
    return this.contasPagarService.findAll(req.user.cooperativaId, { status, categoria });
  }

  // ─── D-novo-BH (M37, 29/05/2026) — Workflow despesas operacionais ──
  // IMPORTANTE: rotas estáticas ('operacionais', 'proprietario', 'propor',
  // 'upload-comprovante') ficam ANTES de :id pra Nest router casar prefixos primeiro.

  /**
   * POST /contas-pagar/upload-comprovante
   * BH.3.1 (M37, 29/05/2026) — upload nativo JPG/PNG/PDF max 5MB.
   * Storage local: backend/uploads/comprovantes/<cooperativaId>/<ano>/<mês>/.
   * Servido via rota estática `/uploads/` configurada em main.ts.
   *
   * Catalogados débitos futuros:
   * - D-novo-BJ: URL assinada com expiração (LGPD)
   * - D-novo-BK: migração pra Supabase Storage / S3
   */
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, PROPRIETARIO)
  @AuditLog({ acao: 'despesa.upload-comprovante', recurso: 'Comprovante' })
  @Post('upload-comprovante')
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const reqAny = req as any;
          const cooperativaId = reqAny.user?.cooperativaId ?? 'sem-coop';
          const ano = new Date().getFullYear();
          const mes = String(new Date().getMonth() + 1).padStart(2, '0');
          const dir = `./uploads/comprovantes/${cooperativaId}/${ano}/${mes}`;
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          // Nome único: timestamp + 8 chars random hex + ext original
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
          cb(
            new BadRequestException('Tipo inválido. Aceitos: JPG, PNG, PDF.'),
            false,
          );
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  uploadComprovante(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('Arquivo obrigatório.');
    const cooperativaId = req.user?.cooperativaId ?? 'sem-coop';
    const ano = new Date().getFullYear();
    const mes = String(new Date().getMonth() + 1).padStart(2, '0');
    const url = `/uploads/comprovantes/${cooperativaId}/${ano}/${mes}/${file.filename}`;
    return { url, tamanho: file.size, mimetype: file.mimetype, nomeOriginal: file.originalname };
  }

  /**
   * POST /contas-pagar/propor
   * Aceita PROPRIETARIO (cria PROPOSTA) e ADMIN/SUPER_ADMIN/OPERADOR (APROVADA direto).
   * Service detecta role via parâmetro pra decidir.
   */
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, PROPRIETARIO)
  @AuditLog({ acao: 'despesa.propor', recurso: 'ContaAPagar' })
  @Post('propor')
  proporDespesa(@Body() dto: ProporDespesaDto, @Req() req: any) {
    const usuarioId = req.user.id ?? req.user.userId;
    const perfil = req.user.perfil ?? req.user.role;
    return this.contasPagarService.proporDespesa(dto, usuarioId, perfil, req.user.cooperativaId);
  }

  /**
   * PUT /contas-pagar/:id/aprovar
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'despesa.aprovar', recurso: 'ContaAPagar', recursoIdParam: 'id' })
  @Put(':id/aprovar')
  aprovarDespesa(@Param('id') id: string, @Body() _dto: AprovarDespesaDto, @Req() req: any) {
    const usuarioId = req.user.id ?? req.user.userId;
    return this.contasPagarService.aprovarDespesa(id, usuarioId, req.user.cooperativaId);
  }

  /**
   * PUT /contas-pagar/:id/rejeitar
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'despesa.rejeitar', recurso: 'ContaAPagar', recursoIdParam: 'id' })
  @Put(':id/rejeitar')
  rejeitarDespesa(@Param('id') id: string, @Body() dto: RejeitarDespesaDto, @Req() req: any) {
    const usuarioId = req.user.id ?? req.user.userId;
    return this.contasPagarService.rejeitarDespesa(id, dto, usuarioId, req.user.cooperativaId);
  }

  /**
   * PUT /contas-pagar/:id/resolver
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'despesa.resolver', recurso: 'ContaAPagar', recursoIdParam: 'id' })
  @Put(':id/resolver')
  resolverDespesa(@Param('id') id: string, @Body() dto: ResolverDespesaDto, @Req() req: any) {
    return this.contasPagarService.resolverDespesa(id, dto, req.user.cooperativaId);
  }

  /**
   * GET /contas-pagar/operacionais — admin com filtros opcionais.
   */
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('operacionais')
  listarOperacionais(
    @Req() req: any,
    @Query('usinaId') usinaId?: string,
    @Query('statusAprovacao') statusAprovacao?: 'PROPOSTA' | 'APROVADA' | 'REJEITADA',
    @Query('statusResolucao') statusResolucao?: 'PENDENTE' | 'RESOLVIDA',
    @Query('tratamento') tratamento?: 'REEMBOLSO' | 'DESCONTO_NO_REPASSE' | 'ASSUMIDO',
    @Query('categoria') categoria?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.contasPagarService.listarDespesasOperacionais(req.user.cooperativaId, {
      usinaId,
      statusAprovacao,
      statusResolucao,
      tratamento,
      categoria,
      dataOcorrenciaInicio: dataInicio ? new Date(dataInicio) : undefined,
      dataOcorrenciaFim: dataFim ? new Date(dataFim) : undefined,
    });
  }

  /**
   * GET /contas-pagar/proprietario — proprietário vê suas despesas (respeita flag visibilidade).
   * Admin pode chamar pra debug (vê como proprietário).
   */
  @Roles(SUPER_ADMIN, ADMIN, PROPRIETARIO)
  @Get('proprietario')
  listarProprietario(@Req() req: any) {
    const usuarioId = req.user.id ?? req.user.userId;
    const email = req.user.email ?? null;
    const cooperadoId = req.user.cooperadoId ?? null;
    return this.contasPagarService.listarDespesasProprietario(
      usuarioId,
      email,
      cooperadoId,
      req.user.cooperativaId,
    );
  }

  // ─── Endpoints legacy individuais (mantidos) ─────────────────────

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.contasPagarService.findOne(id, req.user.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post()
  create(@Req() req: any, @Body() dto: CreateContaAPagarDto) {
    return this.contasPagarService.create(req.user.cooperativaId, dto);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Req() req: any, @Body() dto: UpdateContaAPagarDto) {
    return this.contasPagarService.update(id, req.user.cooperativaId, dto);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.contasPagarService.remove(id, req.user.cooperativaId);
  }
}
