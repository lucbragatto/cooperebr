/// <reference types="multer" />
import { Controller, Get, Post, Put, Delete, Param, Body, Req, Query, UploadedFile, UseInterceptors, ForbiddenException, BadRequestException, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { CooperadosService } from './cooperados.service';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { CreateCooperadoDto } from './dto/create-cooperado.dto';
import { UpdateCooperadoDto } from './dto/update-cooperado.dto';
import { FaturaMensalDto } from './dto/fatura-mensal.dto';
import { CadastroCompletoDto } from './dto/cadastro-completo.dto';
import { AprovarConcessionariaDto } from './dto/aprovar-concessionaria.dto';
import { AuditLog } from '../audit/audit-log.decorator';
import { PrismaService } from '../prisma.service';
import { FaturasService } from '../faturas/faturas.service';
import { UcsService } from '../ucs/ucs.service';
import { MotorPropostaService } from '../motor-proposta/motor-proposta.service';
// Sprint M47 (21/06/2026) — 3 endpoints de migração externa (concorrente → SISGD).
import { MigracaoExternaService } from '../migracoes-usina/migracao-externa.service';
// Sprint Funil M48 (22/06/2026) — Camada 1 Motor Roteador A/B/C (advisory).
import { RoteamentoCadastroService } from '../roteamento-cadastro/roteamento-cadastro.service';
// Sprint Hardening Lateral (23/06/2026) — guard helper canônico.
import { assertSameTenantOrSuperAdmin } from '../auth/tenant-guard.helper';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO, AGREGADOR } = PerfilUsuario;

@Controller('cooperados')
export class CooperadosController {
  private readonly logger = new Logger(CooperadosController.name);

  constructor(
    private readonly cooperadosService: CooperadosService,
    private readonly prisma: PrismaService,
    private readonly faturasService: FaturasService,
    private readonly ucsService: UcsService,
    private readonly motorProposta: MotorPropostaService,
    private readonly migracaoExternaService: MigracaoExternaService,
    private readonly roteamentoCadastroService: RoteamentoCadastroService,
  ) {}

  /**
   * Verifica se um usuário com perfil COOPERADO tem permissão para acessar o cooperado :id.
   * Admins/operadores passam direto; cooperados só podem acessar seus próprios dados.
   */
  private async assertCooperadoOwnership(user: any, cooperadoId: string): Promise<void> {
    if (!user || user.perfil !== COOPERADO) return;
    const cooperado = await this.prisma.cooperado.findFirst({
      where: {
        id: cooperadoId,
        OR: [
          ...(user.email ? [{ email: user.email }] : []),
          ...(user.cpf ? [{ cpf: user.cpf }] : []),
        ],
      },
      select: { id: true },
    });
    if (!cooperado) {
      throw new ForbiddenException('Você não tem permissão para acessar dados de outro cooperado');
    }
  }

  // ─── Cadastro por Proxy (rotas públicas) ────────────────────────────────────

  // Sprint Hardening Lateral (23/06/2026) — fix
  // D-novo-PRE-CADASTRO-PROXY-PUBLIC-TENANT-SPOOF P1 (4ª ocorrência do
  // padrão M45 — descoberto na varredura @Public da sprint):
  //
  //  - `cooperativaId` NUNCA vem do body (descartado).
  //  - `?tenant=<id>` é obrigatório aqui: pre-cadastro proxy é vinculado a
  //    UM indicador (cooperado existente da cooperativa). Sem tenant, não
  //    sabemos onde criar. `findUnique({id, ativo:true})` valida.
  //  - 404 em tenant inexistente/inativo (anti-enumeração).
  //
  // Fix P2 security 23/06: @Throttle 10/min — antes só herdava global 100/min.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('pre-cadastro-proxy')
  async preCadastroProxy(
    @Body() body: {
      nomeCompleto: string;
      telefone: string;
      numeroUC?: string;
      distribuidora?: string;
      cidade?: string;
      estado?: string;
      economiaEstimada?: number;
      indicadorId: string;
      // Aceito no shape pra compat, sempre DESCARTADO (Hardening Lateral 23/06).
      cooperativaId?: string;
    },
    @Query('tenant') tenantParam?: string,
  ) {
    const {
      cooperativaId: _ignored,
      ...safeBody
    } = body;

    if (!tenantParam) {
      throw new BadRequestException(
        'Query param ?tenant=<cooperativaId> é obrigatório (pré-cadastro proxy precisa do tenant alvo).',
      );
    }
    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: tenantParam },
      select: { id: true, ativo: true },
    });
    if (!coop || !coop.ativo) {
      throw new NotFoundException('Cooperativa não encontrada ou inativa.');
    }
    return this.cooperadosService.preCadastroProxy({
      ...safeBody,
      cooperativaId: coop.id,
    });
  }

  @Public()
  @Get('verificar-token/:token')
  verificarToken(@Param('token') token: string) {
    return this.cooperadosService.verificarTokenAssinatura(token);
  }

  @Public()
  @Post('confirmar-assinatura/:token')
  confirmarAssinatura(@Param('token') token: string) {
    return this.cooperadosService.confirmarAssinatura(token);
  }

  // ─── Rotas autenticadas ────────────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, AGREGADOR)
  @Get()
  findAll(@Req() req: any, @Query('limit') limit?: number, @Query('offset') offset?: number, @Query('search') search?: string, @Query('administradoraId') administradoraId?: string) {
    const admId = req.user?.perfil === AGREGADOR ? req.user.administradoraId : administradoraId;
    return this.cooperadosService.findAll(req.user?.cooperativaId, limit, offset, search, admId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('fila-espera')
  filaEspera(@Req() req: any) {
    return this.cooperadosService.filaEspera(req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('fila-espera/count')
  async filaEsperaCount(@Req() req: any) {
    const lista = await this.cooperadosService.filaEspera(req.user?.cooperativaId);
    return { count: lista.length };
  }

  @Roles(COOPERADO)
  @Get('meu-perfil')
  meuPerfil(@Req() req: any) {
    return this.cooperadosService.meuPerfil(req.user);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get(':id/checklist')
  async getChecklist(@Param('id') id: string, @Req() req: any) {
    await this.assertCooperadoOwnership(req.user, id);
    return this.cooperadosService.getChecklist(id);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':id/historico-status')
  getHistoricoStatus(@Param('id') id: string, @Req() req: any) {
    return this.cooperadosService.getHistoricoStatus(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    await this.assertCooperadoOwnership(req.user, id);
    return this.cooperadosService.findOne(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, AGREGADOR)
  @AuditLog({ acao: 'cooperado.criar', recurso: 'Cooperado' })
  @Post()
  async create(@Body() body: CreateCooperadoDto, @Req() req: any) {
    // Sprint Hardening Tenant-Spoof (20/06/2026) — D-novo-COOPERADOS-
    // CONTROLLER-TENANT-SPOOF P0. Descartamos body.cooperativaId
    // sempre. Tenant vem do JWT; SUPER_ADMIN pode operar cross-tenant
    // via body.cooperativaIdAlvo (campo explícito + DTO @Matches CUID +
    // validação Cooperativa.ativo neste controller — P1 reviewers 20/06).
    const { termoAdesaoAceitoEm, cooperativaId: _ignorado, cooperativaIdAlvo, ...rest } = body;

    let cooperativaId: string | undefined =
      req.user?.cooperativaId ?? undefined;

    if (req.user?.perfil === SUPER_ADMIN && cooperativaIdAlvo) {
      const coopAlvo = await this.prisma.cooperativa.findUnique({
        where: { id: cooperativaIdAlvo },
        select: { id: true, ativo: true },
      });
      if (!coopAlvo || !coopAlvo.ativo) {
        throw new BadRequestException(
          'cooperativaIdAlvo: cooperativa não encontrada ou inativa.',
        );
      }
      cooperativaId = coopAlvo.id;
    }

    if (!cooperativaId) {
      throw new ForbiddenException(
        'cooperativaId obrigatório — derivado do JWT, ou `cooperativaIdAlvo` se SUPER_ADMIN',
      );
    }

    // Sprint Funil M48 (22/06/2026) — Camada 1 Motor Roteador A/B/C.
    // ADVISORY only: decide o caminho + grava metadata em 4 campos do
    // Cooperado. NÃO bloqueia o cadastro (Camadas 2/3 fazem enforcement).
    const roteamento = await this.roteamentoCadastroService.decidirCaminho({
      jaRecebeCreditosGd: rest.jaRecebeCreditosGd ?? null,
      fornecedorGdAtual: rest.fornecedorGdAtual ?? null,
      cooperativaIdSugerida: cooperativaId,
    });

    return this.cooperadosService.create({
      ...rest,
      cooperativaId,
      termoAdesaoAceitoEm: termoAdesaoAceitoEm ? new Date(termoAdesaoAceitoEm) : undefined,
      roteamentoCaminho: roteamento.caminho,
      roteamentoTenantAlvo: roteamento.tenantAlvo ?? null,
      roteamentoRazao: roteamento.razao,
      roteamentoDecididoEm: new Date(),
      ...(req.user?.perfil === AGREGADOR && req.user.administradoraId
        ? { administradoraId: req.user.administradoraId }
        : {}),
    });
  }

  // Sprint Hardening Lateral (23/06/2026) — fix
  // D-novo-CADASTRO-COMPLETO-TENANT-SPOOF P1.
  //
  // Comportamento ANTES (vulnerável): `dto.cooperativaId || cooperativaIdJwt`
  // permitia ADMIN passar `dto.cooperativaId=OUTRO_TENANT` e o `||` IGNORAVA
  // a checagem (jwt vence só quando dto vazio).
  //
  // Agora: `assertSameTenantOrSuperAdmin(req.user, alvo)` é chamado quando
  // `dto.cooperativaId` é passado. SA passa livre; ADMIN só passa o próprio.
  // Quando dto vazio, usa o JWT. SA sem JWT cooperativaId + sem dto → 400.
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @AuditLog({ acao: 'cooperado.cadastro-completo', recurso: 'Cooperado', cooperativaIdSource: 'body:cooperativaId' })
  @Post('cadastro-completo')
  cadastroCompleto(@Body() body: CadastroCompletoDto, @Req() req: any) {
    const cooperativaIdJwt: string | undefined = req.user?.cooperativaId;
    const cooperativaIdAlvo = body.cooperativaId ?? cooperativaIdJwt;
    if (!cooperativaIdAlvo) {
      throw new BadRequestException(
        'cooperativaId obrigatório (no JWT ou no body — SA precisa passar via body).',
      );
    }
    // Fix P2 security 23/06 — OPERADOR ∈ @Roles também passa body cooperativaId
    // (era inconsistente: guard bloqueava OPERADOR mesmo na própria coop).
    // Só chamamos assert quando body.cooperativaId DIVERGE do JWT — caso
    // mesmo tenant, qualquer perfil autorizado pode passar. SA sem JWT
    // sempre pode passar (já é o caso esperado).
    if (body.cooperativaId && body.cooperativaId !== cooperativaIdJwt) {
      // assertSameTenantOrSuperAdmin: SA livre; ADMIN só própria (bloqueado se
      // diferente do JWT — barra spoof); OPERADOR/COOPERADO/AGREGADOR bloqueados.
      assertSameTenantOrSuperAdmin(req.user, body.cooperativaId);
    }
    return this.cooperadosService.cadastroCompleto(body, cooperativaIdAlvo);
  }

  // ─── Migração externa (concorrente → SISGD) — Sprint M47 (21/06/2026) ────
  //
  // 3 endpoints admin pra mecânica de migração:
  //  - POST /cooperados/:id/migrar          (iniciar — PENDENTE_MIGRACAO)
  //  - POST /cooperados/:id/migrar/concluir (ATIVO + statusMigracao CONCLUIDA)
  //  - POST /cooperados/:id/migrar/rejeitar (DESLIGADO + REJEITADA)
  //
  // cooperativaId SEMPRE do JWT (lição M45 — NUNCA do body). SUPER_ADMIN
  // sem cooperativaId é rejeitado: pra migrar, precisa estar no contexto
  // de um tenant específico (via impersonate ou login direto).

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @AuditLog({ acao: 'cooperado.migrar.iniciar', recurso: 'Cooperado', recursoIdParam: 'id' })
  @Post(':id/migrar')
  async iniciarMigracao(
    @Param('id') id: string,
    @Body() body: {
      distribuidoraOrigem: string;
      numeroUcOrigem?: string;
      motivo?: string;
    },
    @Req() req: any,
  ) {
    const cooperativaId: string | undefined = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException(
        'cooperativaId obrigatório no JWT pra operação de migração externa.',
      );
    }
    const realizadoPorId: string | undefined =
      req.user?.id ?? req.user?.userId ?? req.user?.sub;
    if (!realizadoPorId) {
      throw new ForbiddenException('Token sem id do usuário — auditoria bloqueada.');
    }
    return this.migracaoExternaService.iniciar({
      cooperadoId: id,
      cooperativaId,
      realizadoPorId,
      distribuidoraOrigem: body.distribuidoraOrigem,
      numeroUcOrigem: body.numeroUcOrigem,
      motivo: body.motivo,
    });
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @AuditLog({ acao: 'cooperado.migrar.concluir', recurso: 'Cooperado', recursoIdParam: 'id' })
  @Post(':id/migrar/concluir')
  async concluirMigracao(@Param('id') id: string, @Req() req: any) {
    const cooperativaId: string | undefined = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException(
        'cooperativaId obrigatório no JWT pra operação de migração externa.',
      );
    }
    const realizadoPorId: string | undefined =
      req.user?.id ?? req.user?.userId ?? req.user?.sub;
    if (!realizadoPorId) {
      throw new ForbiddenException('Token sem id do usuário — auditoria bloqueada.');
    }
    return this.migracaoExternaService.concluir({
      cooperadoId: id,
      cooperativaId,
      realizadoPorId,
    });
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @AuditLog({ acao: 'cooperado.migrar.rejeitar', recurso: 'Cooperado', recursoIdParam: 'id' })
  @Post(':id/migrar/rejeitar')
  async rejeitarMigracao(
    @Param('id') id: string,
    @Body() body: { motivo: string },
    @Req() req: any,
  ) {
    const cooperativaId: string | undefined = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException(
        'cooperativaId obrigatório no JWT pra operação de migração externa.',
      );
    }
    const realizadoPorId: string | undefined =
      req.user?.id ?? req.user?.userId ?? req.user?.sub;
    if (!realizadoPorId) {
      throw new ForbiddenException('Token sem id do usuário — auditoria bloqueada.');
    }
    return this.migracaoExternaService.rejeitar({
      cooperadoId: id,
      cooperativaId,
      realizadoPorId,
      motivo: body.motivo,
    });
  }

  @Roles(COOPERADO)
  @Get('meu-perfil/ucs')
  minhasUcs(@Req() req: any) {
    return this.cooperadosService.minhasUcs(req.user);
  }

  @Roles(COOPERADO)
  @Get('meu-perfil/cobrancas')
  minhasCobrancas(@Req() req: any, @Query('ucId') ucId?: string) {
    return this.cooperadosService.minhasCobrancas(req.user, ucId);
  }

  @Roles(COOPERADO)
  @Get('meu-perfil/documentos')
  meusDocumentos(@Req() req: any) {
    return this.cooperadosService.meusDocumentos(req.user);
  }

  @Roles(COOPERADO)
  @Post('meu-perfil/documentos')
  @UseInterceptors(FileInterceptor('file'))
  uploadMeuDocumento(
    @Req() req: any,
    @Body('tipo') tipo: string,
    @UploadedFile() arquivo: Express.Multer.File,
  ) {
    return this.cooperadosService.uploadMeuDocumento(req.user, tipo, arquivo);
  }

  // ── Portal: Nova UC com fatura (OCR + UC + simulação) ────────────────────

  @Roles(COOPERADO)
  @Post('meu-perfil/nova-uc-com-fatura')
  @UseInterceptors(FileInterceptor('fatura'))
  async novaUcComFatura(
    @Req() req: any,
    @UploadedFile() arquivo: Express.Multer.File,
    @Body('numeroUC') numeroUC: string,
    @Body('planoId') planoId?: string,
  ) {
    if (!arquivo) throw new BadRequestException('Arquivo da fatura é obrigatório');
    if (!numeroUC?.trim()) throw new BadRequestException('Número da UC é obrigatório');

    const cooperado = await this.cooperadosService.findCooperadoByUsuarioPublic(req.user);
    const cooperativaId = cooperado.cooperativaId;
    if (!cooperativaId) throw new BadRequestException('Cooperado sem cooperativa vinculada');

    // 1. Verificar UC duplicada
    const ucExistente = await this.prisma.uc.findFirst({
      where: { cooperadoId: cooperado.id, numero: numeroUC.trim() },
    });
    if (ucExistente) throw new ConflictException('UC já cadastrada para este cooperado');

    // 2. OCR da fatura
    const isPdf = arquivo.mimetype === 'application/pdf';
    const isImage = arquivo.mimetype.startsWith('image/');
    if (!isPdf && !isImage) throw new BadRequestException('Formato não suportado. Envie PDF ou imagem.');
    if (arquivo.size > 10 * 1024 * 1024) throw new BadRequestException('Arquivo excede 10MB');

    const base64 = arquivo.buffer.toString('base64');
    const tipoArquivo = isPdf ? 'pdf' as const : 'imagem' as const;
    const dadosOcr: Record<string, any> = await this.faturasService.extrairOcr(base64, tipoArquivo);

    // 3. Preparar dados de simulação antes de criar UC
    const historico = dadosOcr.historicoConsumo ?? [];
    const ultimo = historico.length > 0 ? historico[historico.length - 1] : null;
    const consumo = dadosOcr.consumoAtualKwh ?? ultimo?.consumoKwh ?? 0;
    const valor = dadosOcr.totalAPagar ?? ultimo?.valorRS ?? 0;

    // Fix P2 multitenant 23/06 — fallback plano por tenant do cooperado +
    // globais. Antes: findFirst({ativo: true}) sem cooperativaId — qualquer
    // tenant podia retornar primeiro.
    const primPlano = await this.prisma.plano.findFirst({
      where: {
        ativo: true,
        OR: [
          { cooperativaId: cooperado.cooperativaId },
          { cooperativaId: null },
        ],
      },
    });
    const planoIdResolvido = planoId || primPlano?.id || '';

    // 4. Validar motor ANTES de criar UC (evita UC órfã).
    // Fix P2 multitenant 23/06 — passa cooperado.cooperativaId pra service
    // filtrar plano (antes COOPERADO podia spoofar planoId de outro tenant).
    const resultado = await this.motorProposta.calcular({
      cooperadoId: cooperado.id,
      planoId: planoIdResolvido,
      historico: historico.length > 0
        ? historico.map((h: { mesAno?: string; consumoKwh: number; valorRS?: number }) => ({
            mesAno: h.mesAno ?? new Date().toISOString().slice(0, 7),
            consumoKwh: h.consumoKwh,
            valorRS: h.valorRS ?? 0,
          }))
        : [{ mesAno: new Date().toISOString().slice(0, 7), consumoKwh: consumo, valorRS: valor }],
      kwhMesRecente: consumo,
      valorMesRecente: valor,
      mesReferencia: ultimo?.mesAno ?? new Date().toISOString().slice(0, 7),
    }, cooperado.cooperativaId ?? undefined);

    const outlierDetectado = resultado.outlierDetectado && !!resultado.aguardandoEscolha;
    let simulacao: Record<string, unknown> | null = null;
    if (resultado.resultado) {
      simulacao = {
        base: resultado.resultado.base,
        kwhContrato: resultado.resultado.kwhContrato,
        descontoPercentual: resultado.resultado.descontoPercentual,
        economiaMensal: resultado.resultado.economiaMensal,
        economiaAnual: resultado.resultado.economiaAnual,
        valorCooperado: resultado.resultado.valorCooperado,
        tarifaUnitSemTrib: resultado.resultado.tarifaUnitSemTrib,
        mesReferencia: resultado.resultado.mesReferencia,
      };
    }

    // 5. Motor OK → agora criar UC (sem risco de órfã)
    const uc = await this.ucsService.create({
      numero: numeroUC.trim(),
      endereco: dadosOcr.enderecoInstalacao || '',
      cidade: dadosOcr.cidade || '',
      estado: dadosOcr.estado || '',
      cooperadoId: cooperado.id,
      cep: dadosOcr.cep || undefined,
      bairro: dadosOcr.bairro || undefined,
      distribuidora: dadosOcr.distribuidora || undefined,
    });

    return {
      ok: true,
      ucId: uc.id,
      outlierDetectado,
      simulacao,
      dadosOcr: {
        consumoMedioKwh: consumo,
        totalAPagar: valor,
        distribuidora: dadosOcr.distribuidora || null,
        historicoConsumo: historico,
      },
    };
  }

  // ── Portal: Confirmar nova UC (aceitar proposta + contrato) ─────────────

  @Roles(COOPERADO)
  @Post('meu-perfil/confirmar-nova-uc')
  async confirmarNovaUc(
    @Req() req: any,
    @Body() body: {
      ucId: string;
      planoId?: string;
      consumoKwh?: number;
      valorFatura?: number;
      mesReferencia?: string;
    },
  ) {
    if (!body.ucId) throw new BadRequestException('ucId é obrigatório');

    const cooperado = await this.cooperadosService.findCooperadoByUsuarioPublic(req.user);
    const cooperativaId = cooperado.cooperativaId;

    // Validar que a UC pertence ao cooperado
    const uc = await this.prisma.uc.findFirst({
      where: { id: body.ucId, cooperadoId: cooperado.id },
    });
    if (!uc) throw new BadRequestException('UC não encontrada ou não pertence ao cooperado');

    let consumo: number;
    let valor: number;
    let mesRef: string;

    if (body.consumoKwh && body.valorFatura) {
      // Preferir dados enviados pelo frontend (vindos do OCR de novaUcComFatura)
      consumo = body.consumoKwh;
      valor = body.valorFatura;
      mesRef = body.mesReferencia ?? new Date().toISOString().slice(0, 7);
    } else {
      // Fallback: buscar FaturaProcessada persistida
      const historico = await this.prisma.faturaProcessada.findMany({
        where: { cooperadoId: cooperado.id },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { mesReferencia: true, dadosExtraidos: true },
      });

      const lastFatura = historico[0];
      if (!lastFatura) {
        throw new BadRequestException(
          'Dados de consumo não informados e nenhuma fatura processada encontrada. ' +
          'Envie consumoKwh e valorFatura no body.',
        );
      }

      const dados = (lastFatura.dadosExtraidos as Record<string, unknown>) ?? {};
      consumo = Number(dados.consumoAtualKwh ?? 0);
      valor = Number(dados.totalAPagar ?? 0);
      mesRef = lastFatura.mesReferencia ?? new Date().toISOString().slice(0, 7);

      if (!consumo || !valor) {
        throw new BadRequestException(
          'Fatura processada encontrada mas sem dados de consumo/valor válidos. ' +
          'Envie consumoKwh e valorFatura no body.',
        );
      }
    }

    // Fix P2 multitenant 23/06 — fallback plano filtrado por tenant do
    // cooperado + globais (igual ao novaUcComFatura).
    const primPlano = await this.prisma.plano.findFirst({
      where: {
        ativo: true,
        OR: [
          { cooperativaId: cooperado.cooperativaId },
          { cooperativaId: null },
        ],
      },
    });
    const planoId = body.planoId || primPlano?.id || '';

    const resultado = await this.motorProposta.calcular({
      cooperadoId: cooperado.id,
      planoId,
      historico: [{ mesAno: mesRef, consumoKwh: consumo, valorRS: valor }],
      kwhMesRecente: consumo,
      valorMesRecente: valor,
      mesReferencia: mesRef,
    }, cooperado.cooperativaId ?? undefined);

    if (!resultado.resultado) {
      throw new BadRequestException('Não foi possível calcular a proposta. Verifique se a tarifa da distribuidora está cadastrada.');
    }

    const aceite = await this.motorProposta.aceitar({
      cooperadoId: cooperado.id,
      resultado: resultado.resultado,
      mesReferencia: resultado.resultado.mesReferencia,
      planoId: body.planoId || undefined,
    }, cooperativaId ?? undefined);

    this.logger.log(`[confirmar-uc] Cooperado ${cooperado.id} — proposta ${aceite.proposta?.id}, espera=${aceite.emListaEspera}`);

    return {
      ok: true,
      propostaId: aceite.proposta?.id ?? null,
      contratoNumero: aceite.contrato?.numero ?? null,
      emListaEspera: aceite.emListaEspera ?? false,
    };
  }

  @Roles(COOPERADO)
  @Get('meu-perfil/contratos')
  meusContratos(@Req() req: any) {
    return this.cooperadosService.meusContratos(req.user);
  }

  @Roles(COOPERADO)
  @Post('meu-perfil/solicitar-desligamento')
  solicitarDesligamento(@Req() req: any, @Body() body: { motivo: string; observacao?: string }) {
    return this.cooperadosService.solicitarDesligamento(req.user, body);
  }

  @Roles(COOPERADO)
  @Put('meu-perfil')
  atualizarMeuPerfil(@Req() req: any, @Body() dto: UpdateCooperadoDto) {
    return this.cooperadosService.atualizarMeuPerfil(req.user, dto);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @AuditLog({ acao: 'cooperado.atualizar', recurso: 'Cooperado', recursoIdParam: 'id' })
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCooperadoDto, @Req() req: any) {
    const { termoAdesaoAceitoEm, dataInicioCreditos, ...rest } = dto;
    return this.cooperadosService.update(id, {
      ...rest,
      ...(termoAdesaoAceitoEm && { termoAdesaoAceitoEm: new Date(termoAdesaoAceitoEm) }),
      ...(dataInicioCreditos && { dataInicioCreditos: new Date(dataInicioCreditos) }),
    } as any, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'cooperado.modo-remuneracao', recurso: 'Cooperado', recursoIdParam: 'id' })
  @Put(':id/modo-remuneracao')
  async alterarModoRemuneracao(
    @Param('id') id: string,
    @Body() body: { modoRemuneracao: 'DESCONTO' | 'CLUBE' },
    @Req() req: any,
  ) {
    if (!['DESCONTO', 'CLUBE'].includes(body.modoRemuneracao)) {
      throw new BadRequestException('modoRemuneracao deve ser DESCONTO ou CLUBE');
    }
    return this.cooperadosService.update(id, { modoRemuneracao: body.modoRemuneracao } as any, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post(':id/fatura-mensal')
  registrarFaturaMensal(@Param('id') id: string, @Body() dto: FaturaMensalDto, @Req() req: any) {
    // D-novo-BQ.3 A2 — cooperativaId do JWT (null = SUPER_ADMIN bypass)
    return this.cooperadosService.registrarFaturaMensal(id, dto, req.user?.cooperativaId ?? null);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post(':id/alocar-usina')
  alocarUsina(@Param('id') id: string, @Body() body: { usinaId: string }, @Req() req: any) {
    // D-novo-BQ.3 M1 — cooperativaId do JWT (null = SUPER_ADMIN bypass)
    return this.cooperadosService.alocarUsina(id, body.usinaId, req.user?.cooperativaId ?? null);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @AuditLog({ acao: 'cooperado.aprovar-concessionaria', recurso: 'Cooperado', recursoIdParam: 'id' })
  @Post(':id/aprovar-concessionaria')
  aprovarConcessionaria(
    @Param('id') id: string,
    @Body() dto: AprovarConcessionariaDto,
    @Req() req: any,
  ) {
    return this.cooperadosService.aprovarConcessionaria(id, dto, req.user);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'cooperado.deletar', recurso: 'Cooperado', recursoIdParam: 'id' })
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.cooperadosService.remove(id, req.user?.cooperativaId);
  }

  // ─── Ações em Lote ──────────────────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('batch/whatsapp')
  enviarWhatsappLote(@Body() body: { cooperadoIds: string[]; mensagem: string }, @Req() req: any) {
    return this.cooperadosService.enviarWhatsappLote(body.cooperadoIds, body.mensagem, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('batch/reajuste')
  aplicarReajusteLote(@Body() body: { cooperadoIds: string[]; percentual: number; motivo: string }, @Req() req: any) {
    return this.cooperadosService.aplicarReajusteLote(body.cooperadoIds, body.percentual, body.motivo, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('batch/beneficio')
  aplicarBeneficioManualLote(@Body() body: { cooperadoIds: string[]; valor: number; tipo: string; mesReferencia: string }, @Req() req: any) {
    return this.cooperadosService.aplicarBeneficioManualLote(body, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'cooperado.lote-status', recurso: 'Cooperado' })
  @Post('batch/status')
  alterarStatusLote(@Body() body: { cooperadoIds: string[]; status: string }, @Req() req: any) {
    return this.cooperadosService.alterarStatusLote(body, req.user?.cooperativaId, req.user?.id);
  }

  // ─── Aliases /lote/* (compatibilidade com spec Fase 2) ───────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('lote/whatsapp')
  enviarWhatsappLoteAlias(@Body() body: { cooperadoIds: string[]; mensagem: string }, @Req() req: any) {
    return this.cooperadosService.enviarWhatsappLote(body.cooperadoIds, body.mensagem, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('lote/reajuste')
  aplicarReajusteLoteAlias(@Body() body: { cooperadoIds: string[]; percentual: number; motivo: string }, @Req() req: any) {
    return this.cooperadosService.aplicarReajusteLote(body.cooperadoIds, body.percentual, body.motivo, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('lote/beneficio')
  aplicarBeneficioLoteAlias(@Body() body: { cooperadoIds: string[]; valor: number; tipo: string; mesReferencia: string }, @Req() req: any) {
    return this.cooperadosService.aplicarBeneficioManualLote(body, req.user?.cooperativaId);
  }
}
