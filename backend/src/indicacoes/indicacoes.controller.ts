import { Controller, Get, Put, Post, Body, Req, Query } from '@nestjs/common';
import { IndicacoesService } from './indicacoes.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO } = PerfilUsuario;

@Controller('indicacoes')
export class IndicacoesController {
  constructor(private readonly service: IndicacoesService) {}

  // ─── Config ──────────────────────────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('config')
  getConfig(@Req() req: any) {
    return this.service.getConfig(req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put('config')
  upsertConfig(@Req() req: any, @Body() body: any) {
    return this.service.upsertConfig(req.user?.cooperativaId, body);
  }

  // ─── Listagens admin ─────────────────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('arvore')
  getArvore(@Req() req: any) {
    return this.service.getArvore(req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('relatorio')
  getRelatorio(@Req() req: any) {
    return this.service.getRelatorio(req.user?.cooperativaId);
  }

  // ─── Cooperado ───────────────────────────────────────────────────────────────

  @Get('meu-codigo')
  getMeuCodigo(@Req() req: any) {
    return this.service.getMeuCodigo(req.user?.cooperadoId || req.query?.cooperadoId);
  }

  @Get('meu-link')
  getMeuLink(@Req() req: any) {
    const cooperadoId = req.user?.cooperadoId || req.query?.cooperadoId;
    if (!cooperadoId) {
      return { codigoIndicacao: null, link: null, totalIndicados: 0, indicadosAtivos: 0, semCooperado: true };
    }
    return this.service.getMeuLink(cooperadoId);
  }

  @Get('minhas')
  getMinhasIndicacoes(@Req() req: any) {
    return this.service.getMinhasIndicacoes(req.user?.cooperadoId || req.query?.cooperadoId);
  }

  @Get('beneficios')
  getBeneficios(@Req() req: any) {
    return this.service.getBeneficios(req.user?.cooperadoId || req.query?.cooperadoId);
  }

  // ─── Registrar indicação ─────────────────────────────────────────────────────

  @Post('registrar')
  registrar(@Body() body: { cooperadoIndicadoId: string; codigoIndicador: string }) {
    return this.service.registrarIndicacao(body.cooperadoIndicadoId, body.codigoIndicador);
  }

  // ─── Processar pagamento (chamado internamente) ──────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('processar-pagamento')
  processarPagamento(@Body() body: { cooperadoId: string; valorFatura: number }) {
    return this.service.processarPrimeiraFaturaPaga(body.cooperadoId, body.valorFatura);
  }
}
