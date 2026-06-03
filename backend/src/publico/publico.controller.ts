/// <reference types="multer" />
import { Controller, Post, Get, Body, Param, Query, BadRequestException, ConflictException, ForbiddenException, NotFoundException, Logger, UploadedFile, UseInterceptors, HttpCode } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Prisma, AdmissionOrigem } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { AuditLog } from '../audit/audit-log.decorator';
import { PrismaService } from '../prisma.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { CooperTokenService } from '../cooper-token/cooper-token.service';
import { FaturasService } from '../faturas/faturas.service';
import { MotorPropostaService } from '../motor-proposta/motor-proposta.service';
import { IndicacoesService } from '../indicacoes/indicacoes.service';
import { ConveniosMembrosService } from '../convenios/convenios-membros.service';
import { coerceDistribuidora } from '../ucs/ucs.service';
import { AutoInscreverConvenioDto } from './dto/auto-inscrever-convenio.dto';

@Controller('publico')
export class PublicoController {
  private readonly logger = new Logger(PublicoController.name);

  constructor(
    private prisma: PrismaService,
    private sender: WhatsappSenderService,
    private cooperToken: CooperTokenService,
    private faturasService: FaturasService,
    private motorProposta: MotorPropostaService,
    private indicacoes: IndicacoesService,
    private conveniosMembros: ConveniosMembrosService,
  ) {}

  @Public()
  @Get('desconto-padrao')
  async descontoPadrao() {
    const plano = await this.prisma.plano.findFirst({
      where: { ativo: true },
      orderBy: { descontoBase: 'desc' },
      select: { descontoBase: true },
    });
    const desconto = plano ? Number(plano.descontoBase) : 20;
    return { percentual: desconto / 100 };
  }

  // D-FISCAL-2.4.3 — selector custeio público.
  // Lista mínima de convênios pagador=EMPRESA + status=ATIVO do tenant.
  // Retorna SÓ id + empresaNome (nada sensível: sem CNPJ, sem desconto, sem regras MLM).
  // Usado pelo /cadastro público pra montar o select "Sou custeado por uma empresa cooperada".
  @Public()
  @Get('convenios-pagador-empresa')
  async listarConveniosPagadorEmpresa(@Query('tenant') tenant?: string) {
    if (!tenant) {
      throw new BadRequestException('Query param ?tenant= é obrigatório');
    }
    const convenios = await this.prisma.contratoConvenio.findMany({
      where: {
        cooperativaId: tenant,
        status: 'ATIVO',
        pagador: 'EMPRESA',
      },
      select: { id: true, empresaNome: true },
      orderBy: { empresaNome: 'asc' },
    });
    return convenios;
  }

  @Public()
  @Post('iniciar-cadastro')
  async iniciarCadastro(
    @Body() body: { nome: string; telefone: string; codigoRef?: string },
  ) {
    const { nome, codigoRef } = body;
    let { telefone } = body;

    if (!nome || !telefone) {
      throw new BadRequestException('Nome e telefone são obrigatórios');
    }

    // Formatar telefone: remover não-numéricos, adicionar 55 e dígito 9
    telefone = telefone.replace(/\D/g, '');
    if (!telefone.startsWith('55')) {
      telefone = '55' + telefone;
    }
    // Se DDD + número tem 10 dígitos (sem o 9), adicionar
    const semPais = telefone.slice(2);
    if (semPais.length === 10) {
      telefone = '55' + semPais.slice(0, 2) + '9' + semPais.slice(2);
    }

    // Verificar/criar conversa
    let conversa = await this.prisma.conversaWhatsapp.findUnique({
      where: { telefone },
    });

    const dadosTemp: Record<string, unknown> = { nomePublico: nome };
    if (codigoRef) {
      dadosTemp.codigoIndicacao = codigoRef;
    }

    if (conversa) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: {
          estado: 'INICIAL',
          dadosTemp: {
            ...((conversa.dadosTemp as Record<string, unknown>) ?? {}),
            ...dadosTemp,
          } as any,
        },
      });
    } else {
      conversa = await this.prisma.conversaWhatsapp.create({
        data: {
          telefone,
          estado: 'INICIAL',
          dadosTemp: dadosTemp as any,
        },
      });
    }

    // Enviar mensagem de boas-vindas
    const mensagem =
      `Olá, ${nome}! 👋 Bem-vindo(a) à CoopereBR! ` +
      `Somos uma cooperativa de energia solar e você pode economizar até 20% na sua conta de luz sem investir nada. ` +
      `Para começar sua simulação, envie uma foto ou PDF da sua última conta de energia elétrica! 💡`;

    try {
      await this.sender.enviarMensagem(telefone, mensagem);
    } catch (err) {
      // Log but don't fail — the conversation was created
    }

    return { ok: true, mensagem: 'Mensagem enviada! Verifique seu WhatsApp.' };
  }

  @Public()
  @Get('convite/:codigo')
  async getConvite(@Param('codigo') codigo: string) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { codigoIndicacao: codigo },
      select: { nomeCompleto: true },
    });

    if (!cooperado) {
      return { valido: false };
    }

    return { nomeIndicador: cooperado.nomeCompleto, valido: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('cadastro-web')
  async cadastroWeb(
    @Body()
    body: {
      nome: string;
      cpf: string;
      email: string;
      telefone: string;
      endereco: {
        cep: string;
        logradouro: string;
        numero: string;
        complemento?: string;
        bairro: string;
        cidade: string;
        estado: string;
      };
      instalacao: {
        numeroUC: string;
        distribuidora: string;
        consumoMedioKwh: number;
      };
      codigoRef?: string;
      planoSelecionado?: string;
      planoId?: string;
      cooperativaId?: string;
      aceitaClube?: boolean;
      pendenciaDocumentos?: boolean;
      faturaBase64?: string;
      faturaNome?: string;
      faturaTipo?: string;
      valorUltimaFatura?: number;
      temCreditosInjetados?: boolean;
      historicoConsumo?: Array<{ mesAno: string; consumoKwh: number; valorRS: number }>;
      dadosOcr?: {
        energiaFornecidaKwh?: number;
        energiaInjetadaKwh?: number;
        saldoCreditosKwh?: number;
        valorCompensadoReais?: number;
        valorTotalFatura?: number;
      };
      // D-FISCAL-2.4.3 — Caso 1 custeio: id do ContratoConvenio escolhido
      // pelo step "Tipo de cobrança" no /cadastro público. Vivendo em
      // memória até motorProposta.aceitar (não persistido na Proposta).
      convenioCusteioId?: string;
    },
    @Query('tenant') tenantParam?: string,
  ) {
    // Feature toggle: v2 cria Cooperado + UC + Proposta real; legado cria LeadWhatsapp
    const v2Ativo = process.env.CADASTRO_V2_ATIVO === 'true';
    if (v2Ativo) {
      const cooperativaId = body.cooperativaId ?? tenantParam;
      if (!cooperativaId) {
        throw new BadRequestException('cooperativaId ou query param ?tenant= é obrigatório no modo v2');
      }
      return this.cadastroWebV2(body as Parameters<typeof this.cadastroWebV2>[0], cooperativaId);
    }

    const cpfLimpo = (body.cpf || '').replace(/\D/g, '');
    const telefoneLimpo = (body.telefone || '').replace(/\D/g, '');

    // Validações controladas por env var: em dev fica desligado para facilitar testes,
    // em prod `CADASTRO_VALIDACOES_ATIVAS=true` rejeita leads inválidos.
    if (process.env.CADASTRO_VALIDACOES_ATIVAS === 'true') {
      if (!body.nome || !body.cpf || !body.email || !body.telefone) {
        throw new BadRequestException('Nome, CPF, email e telefone são obrigatórios');
      }
      if (cpfLimpo.length !== 11) {
        throw new BadRequestException('CPF inválido');
      }
      if (telefoneLimpo.length < 10) {
        throw new BadRequestException('Telefone inválido');
      }
    }

    try {
      const dadosLead: Record<string, unknown> = {
        endereco: body.endereco,
        instalacao: body.instalacao,
      };

      if (body.codigoRef) {
        dadosLead.codigoRef = body.codigoRef;
      }

      if (body.valorUltimaFatura) {
        dadosLead.valorUltimaFatura = body.valorUltimaFatura;
      }

      if (body.faturaBase64) {
        dadosLead.faturaArquivo = {
          base64: body.faturaBase64,
          nome: body.faturaNome ?? 'fatura',
          tipo: body.faturaTipo ?? 'application/octet-stream',
        };
      }

      // Flag de créditos injetados
      if (body.temCreditosInjetados) {
        dadosLead.temCreditosInjetados = true;
        dadosLead.motivoContato = 'Fatura com créditos de energia injetada detectados';
      }

      // Dados de créditos extraídos do OCR da fatura (histórico GD)
      if (body.dadosOcr) {
        const ocr = body.dadosOcr;
        dadosLead.creditosFatura = {
          ...(ocr.energiaFornecidaKwh != null && { energiaFornecidaKwh: ocr.energiaFornecidaKwh }),
          ...(ocr.energiaInjetadaKwh != null && { energiaInjetadaKwh: ocr.energiaInjetadaKwh }),
          ...(ocr.saldoCreditosKwh != null && { saldoCreditosKwh: ocr.saldoCreditosKwh }),
          ...(ocr.valorCompensadoReais != null && { valorCompensadoReais: ocr.valorCompensadoReais }),
          ...(ocr.valorTotalFatura != null && { valorTotalFatura: ocr.valorTotalFatura }),
        };
      }

      const lead = await this.prisma.leadWhatsapp.upsert({
        where: { telefone: telefoneLimpo },
        update: {
          nome: body.nome,
          email: body.email,
          cpf: cpfLimpo,
          fonte: 'cadastro-web',
          dados: dadosLead as any,
          planoSelecionado: body.planoSelecionado ?? null,
          aceitaClube: body.aceitaClube ?? false,
          pendenciaDocumentos: body.pendenciaDocumentos ?? false,
        },
        create: {
          telefone: telefoneLimpo,
          nome: body.nome,
          email: body.email,
          cpf: cpfLimpo,
          fonte: 'cadastro-web',
          dados: dadosLead as any,
          planoSelecionado: body.planoSelecionado ?? null,
          aceitaClube: body.aceitaClube ?? false,
          pendenciaDocumentos: body.pendenciaDocumentos ?? false,
        },
      });

      this.logger.log(`Lead cadastro-web criado: ${lead.id} (${body.nome})`);

      // Notificar admin se lead tem créditos injetados
      if (body.temCreditosInjetados) {
        this.notificarAdminCreditosInjetados(body.nome, body.instalacao?.numeroUC, lead.id).catch((err) => {
          this.logger.error(`Erro ao notificar admin sobre créditos injetados: ${err.message}`);
        });
      }

      // Processar indicação se veio com código de convite
      if (body.codigoRef) {
        this.processarIndicacao(body.codigoRef, body.nome, lead.id).catch((err) => {
          this.logger.error(`Erro ao processar indicação ref=${body.codigoRef}: ${err.message}`);
        });
      }

      return { ok: true, data: { id: lead.id } };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      this.logger.error(`Erro ao salvar cadastro-web: ${message}`);
      throw new BadRequestException('Erro ao processar cadastro. Tente novamente.');
    }
  }

  // ─── Sprint Convite-Convênio Fatia 2 (03/06/2026) ──────────────────────────
  // Endpoint público de auto-inscrição via link `?conv={convenioId}`.
  // Delega pra cadastroWebV2 com origem=CONVITE_PUBLICO (que propaga até
  // adicionarMembro que cria PENDENTE_APROVACAO_EMPRESA + magic link).
  //
  // Camadas de defesa:
  //  1. @Throttle 30/h por IP (camada amplitude).
  //  2. Validação multi-tenant cross-check (convenio.cooperativaId === body.cooperativaId).
  //  3. Convênio existe + status ATIVO + pagador=EMPRESA.
  //  4. Dedup CPF (Caso B cross-tenant rejeitado + Caso C já-membro rejeitado).
  //     Erros GENÉRICOS — não vazam se CPF/email existe (anti-enumeration).
  //  5. Quota limiteMembros (count ATIVOS + PENDENTES não-expirados).
  //  6. Quota kwhAlocadoMaxMensal só em CONSUMO_REAL.
  //  7. Rate-limit manual por CPF (3/h via count last 1h — usa novo índice
  //     ConvenioCooperado[cooperadoId, createdAt]).
  //
  // NUNCA retorna o token do magic link no body — envio = Fatia 6.
  @Public()
  @Throttle({ default: { limit: 30, ttl: 3600000 } }) // 30/h por IP
  @AuditLog({ acao: 'convenios.auto_inscrever', recurso: 'ConvenioCooperado' })
  @HttpCode(201)
  @Post('convenios/auto-inscrever')
  async autoInscreverConvenio(@Body() dto: AutoInscreverConvenioDto) {
    const ERRO_GENERICO = 'Não foi possível concluir o cadastro. Entre em contato com a empresa pra solicitar inclusão manual.';

    // (1) Validar convênio — multi-tenant cross-check ANTES de qualquer create
    const convenio = await this.prisma.contratoConvenio.findUnique({
      where: { id: dto.convenioId },
      select: {
        id: true,
        cooperativaId: true,
        status: true,
        pagador: true,
        empresaNome: true,
        limiteMembros: true,
        kwhAlocadoMaxMensal: true,
        baseCobrancaCusteio: true,
      },
    });

    if (
      !convenio ||
      convenio.cooperativaId !== dto.cooperativaId ||
      convenio.status !== 'ATIVO' ||
      convenio.pagador !== 'EMPRESA'
    ) {
      // Resposta única pros 4 casos (existência/tenant/status/pagador) —
      // evita enumeração de convênios via diffing de mensagem.
      this.logger.warn(
        `[auto-inscrever] Convenio inválido: id=${dto.convenioId} tenantBody=${dto.cooperativaId} ` +
          `existe=${!!convenio} tenantOk=${convenio?.cooperativaId === dto.cooperativaId} ` +
          `status=${convenio?.status} pagador=${convenio?.pagador}`,
      );
      throw new NotFoundException(ERRO_GENERICO);
    }

    const cpfLimpo = (dto.cpf || '').replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      throw new BadRequestException('CPF inválido.');
    }

    // (2) Dedup CPF — checagem prévia (P2002 do create é salvaguarda).
    // Erros genéricos pra não vazar existência. Caso B cross-tenant rejeitado
    // pelo log (não auto-vincula — vetor sequestro). Cooperado existente é
    // adicionado pelo admin/empresa manualmente.
    const cooperadoExistente = await this.prisma.cooperado.findUnique({
      where: { cpf: cpfLimpo },
      select: { id: true, cooperativaId: true },
    });
    if (cooperadoExistente) {
      this.logger.warn(
        `[auto-inscrever] CPF já existe — bloqueado: cpf=...${cpfLimpo.slice(-4)} ` +
          `tenantExistente=${cooperadoExistente.cooperativaId} tenantBody=${dto.cooperativaId} ` +
          `convenioId=${dto.convenioId}`,
      );
      throw new ConflictException(ERRO_GENERICO);
    }

    // (3) Rate-limit por CPF (3/h) — usa @@index([cooperadoId, createdAt]).
    // Como o CPF ainda não tem Cooperado, contamos auto-inscrições recentes
    // do mesmo tenant + convênio em janela 1h (defesa em profundidade — IP
    // throttle é camada 1). Se o usuário tentar criar 4× em 1h muda
    // pouca coisa (precisaria de 4 CPFs distintos pra bypass), mas trava
    // bots simples que iteram payload.
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
    const tentativasRecentes = await this.prisma.convenioCooperado.count({
      where: {
        convenioId: dto.convenioId,
        origem: 'CONVITE_PUBLICO',
        createdAt: { gte: umaHoraAtras },
      },
    });
    if (tentativasRecentes >= 60) {
      // Hard cap por convênio/hora pra impedir floods de bot rotativo.
      this.logger.warn(
        `[auto-inscrever] Rate-limit por convênio atingido: convenioId=${dto.convenioId} ` +
          `tentativas=${tentativasRecentes} janela=1h`,
      );
      throw new ConflictException(ERRO_GENERICO);
    }

    // (4) Quota: limiteMembros — conta MEMBRO_ATIVO + PENDENTE_*.
    // Pendentes EXPIRADOS (token usedAt null + expiresAt < now) NÃO contam (cron
    // de housekeeping virá na Fatia 3). Exclusão via filtro relação 1-1.
    if (convenio.limiteMembros != null) {
      const ocupacao = await this.prisma.convenioCooperado.count({
        where: {
          convenioId: dto.convenioId,
          OR: [
            { status: 'MEMBRO_ATIVO' },
            {
              status: { in: ['PENDENTE_APROVACAO_EMPRESA', 'PENDENTE_APROVACAO_ADMIN'] },
              OR: [
                // Sem token (defensivo): conta
                { aprovacao: null },
                // Token usado: conta (já decidiu)
                { aprovacao: { usedAt: { not: null } } },
                // Token vigente (não expirado): conta
                { aprovacao: { usedAt: null, expiresAt: { gte: new Date() } } },
              ],
            },
          ],
        },
      });
      if (ocupacao >= convenio.limiteMembros) {
        throw new ConflictException(
          `Este convênio atingiu o limite de ${convenio.limiteMembros} membros. ` +
            `Entre em contato com a empresa pra solicitar inclusão manual.`,
        );
      }
    }

    // (5) Quota energética: kwhAlocadoMaxMensal só em CONSUMO_REAL.
    // ALOCACAO_FIXA tem pacote total fixo do convênio (sem alocação per-member),
    // logo essa quota não se aplica.
    if (
      convenio.kwhAlocadoMaxMensal != null &&
      convenio.baseCobrancaCusteio === 'CONSUMO_REAL'
    ) {
      const membrosVivos = await this.prisma.convenioCooperado.findMany({
        where: {
          convenioId: dto.convenioId,
          status: { in: ['MEMBRO_ATIVO', 'PENDENTE_APROVACAO_EMPRESA', 'PENDENTE_APROVACAO_ADMIN'] },
        },
        include: { cooperado: { select: { cotaKwhMensal: true } } },
      });
      const somaAlocada = membrosVivos.reduce(
        (s, m) => s + Number(m.cooperado.cotaKwhMensal ?? 0),
        0,
      );
      const previstoNovo = dto.consumoMedioKwh ?? 0;
      const maxKwh = Number(convenio.kwhAlocadoMaxMensal);
      if (somaAlocada + previstoNovo > maxKwh) {
        throw new ConflictException(
          `A cota energética do convênio (${maxKwh.toFixed(2)} kWh/mês) está totalmente alocada. ` +
            `Entre em contato com a empresa pra solicitar inclusão manual.`,
        );
      }
    }

    // (6) Delega pra cadastroWebV2 com origem=CONVITE_PUBLICO.
    // cadastroWebV2 cuida de Cooperado/UC tx1, motor.aceitar tx2 (que chama
    // adicionarMembro com origem propagado — cria membro PENDENTE + magic link
    // atomicamente). Sem UC declarada → modo SEM_UC (Ponto 1 cfb4208 preserva
    // vínculo pendente do convênio).
    const telefoneLimpo = (dto.telefone || '').replace(/\D/g, '');

    const bodyDelegado: Parameters<typeof this.cadastroWebV2>[0] = {
      nome: dto.nome.trim(),
      cpf: cpfLimpo,
      email: dto.email.trim(),
      telefone: telefoneLimpo,
      // Endereço/UC vazios — auto-inscrição custeada NÃO exige fatura.
      // Admin/empresa anexa UC depois se necessário (modo SEM_UC).
      endereco: {
        cep: '',
        logradouro: '',
        numero: '',
        bairro: '',
        cidade: '',
        estado: '',
      },
      instalacao: {
        numeroUC: '',
        distribuidora: '',
        consumoMedioKwh: dto.consumoMedioKwh ?? 0,
      },
      convenioCusteioId: dto.convenioId,
      origem: 'CONVITE_PUBLICO',
    };

    let resultadoDelegado: any;
    try {
      resultadoDelegado = await this.cadastroWebV2(bodyDelegado, dto.cooperativaId);
    } catch (err: any) {
      // ConflictException de CPF duplicado do tx1 cai aqui — converter pra erro genérico.
      if (err instanceof ConflictException) {
        this.logger.warn(
          `[auto-inscrever] cadastroWebV2 ConflictException: ${err.message} ` +
            `cpf=...${cpfLimpo.slice(-4)} convenioId=${dto.convenioId}`,
        );
        throw new ConflictException(ERRO_GENERICO);
      }
      throw err;
    }

    const cooperadoId: string | undefined = resultadoDelegado?.data?.cooperadoId;
    if (!cooperadoId) {
      this.logger.error(
        `[auto-inscrever] cadastroWebV2 não retornou cooperadoId: ${JSON.stringify(resultadoDelegado)}`,
      );
      throw new BadRequestException(ERRO_GENERICO);
    }

    // (7) Localizar o membro PENDENTE recém-criado pra retornar status.
    // NÃO retorna o token do magic link — envio = Fatia 6 (notificações).
    const membro = await this.prisma.convenioCooperado.findUnique({
      where: { convenioId_cooperadoId: { convenioId: dto.convenioId, cooperadoId } },
      select: { id: true, status: true },
    });

    this.logger.log(
      `[auto-inscrever] OK: convenioId=${dto.convenioId} cooperadoId=${cooperadoId} ` +
        `membroId=${membro?.id} status=${membro?.status} empresa=${convenio.empresaNome}`,
    );

    return {
      ok: true,
      membroId: membro?.id,
      status: membro?.status ?? 'PENDENTE_APROVACAO_EMPRESA',
    };
  }

  // ── Cadastro V2: cria Cooperado + UC + Proposta real via motor ──────────────
  // Ativado por CADASTRO_V2_ATIVO=true. Legado (LeadWhatsapp) permanece como fallback.

  private async cadastroWebV2(
    body: {
      nome: string;
      cpf: string;
      email: string;
      telefone: string;
      endereco: { cep: string; logradouro: string; numero: string; complemento?: string; bairro: string; cidade: string; estado: string };
      instalacao: { numeroUC: string; numeroUCLegado?: string; numeroConcessionariaOriginal?: string; distribuidora: string; consumoMedioKwh: number };
      codigoRef?: string;
      planoId?: string;
      planoSelecionado?: string;
      aceitaClube?: boolean;
      valorUltimaFatura?: number;
      historicoConsumo?: Array<{ mesAno: string; consumoKwh: number; valorRS: number }>;
      // D-FISCAL-2.4.3 — Caso 1 custeio
      convenioCusteioId?: string;
      // Sprint Convite-Convênio Fatia 2 (03/06) — discrimina caminho de admissão.
      // Default ADMIN_MANUAL preserva os 4 callers legados. CONVITE_PUBLICO
      // propaga até adicionarMembro que cria PENDENTE_APROVACAO_EMPRESA + magic
      // link AprovacaoConvenioMembro no mesmo tx. CONVITE_PUBLICO ALSO força
      // fallback MEDIA_12M no outlier (sem UI pra escolher).
      origem?: AdmissionOrigem;
    },
    cooperativaId: string,
  ) {
    const cpfLimpo = (body.cpf || '').replace(/\D/g, '');
    const telefoneLimpo = (body.telefone || '').replace(/\D/g, '');

    // Validações (reutiliza as mesmas do legado, guardadas por CADASTRO_VALIDACOES_ATIVAS)
    if (process.env.CADASTRO_VALIDACOES_ATIVAS === 'true') {
      if (!body.nome || !body.cpf || !body.email || !body.telefone) {
        throw new BadRequestException('Nome, CPF, email e telefone são obrigatórios');
      }
      if (cpfLimpo.length !== 11) {
        throw new BadRequestException('CPF inválido');
      }
      if (telefoneLimpo.length < 10) {
        throw new BadRequestException('Telefone inválido');
      }
    }

    // PASSO 1+2 — Criar Cooperado + UC em transação atômica
    const { cooperadoId, ucId } = await this.prisma.$transaction(async (tx) => {
      let cooperado;
      try {
        // Sprint 8A: propagar modoRemuneracao do cadastro público
        const modoRemuneracao =
          body.planoSelecionado === 'FATURA_CHEIA_TOKEN' && body.aceitaClube
            ? 'CLUBE'
            : 'DESCONTO';

        cooperado = await tx.cooperado.create({
          data: {
            nomeCompleto: body.nome.trim(),
            cpf: cpfLimpo,
            email: body.email.trim(),
            telefone: telefoneLimpo || undefined,
            status: 'PENDENTE',
            tipoCooperado: 'COM_UC',
            cooperativaId,
            modoRemuneracao: modoRemuneracao as any,
            termoAdesaoAceito: true,
            termoAdesaoAceitoEm: new Date(),
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ConflictException('CPF já cadastrado');
        }
        throw err;
      }

      // Sprint 11 — Arquitetura UC: numero = canônico (até 10 díg) | numeroUC = legado (até 9 díg)
      const numeroCanonicoRaw = (body.instalacao.numeroUC || '').replace(/\D/g, '');
      const numeroCanonicoFinal = numeroCanonicoRaw
        ? numeroCanonicoRaw.slice(-10).padStart(10, '0')
        : `UC-${Date.now()}`;
      const numeroUCLegadoRaw = (body.instalacao.numeroUCLegado || '').replace(/\D/g, '');
      const numeroUCFinal = numeroUCLegadoRaw
        ? numeroUCLegadoRaw.slice(-9).padStart(9, '0')
        : undefined;

      const numeroOriginalRaw = (body.instalacao.numeroConcessionariaOriginal || '').trim();
      const numeroConcessionariaOriginal =
        numeroOriginalRaw && numeroOriginalRaw.length <= 50 ? numeroOriginalRaw : undefined;

      const uc = await tx.uc.create({
        data: {
          numero: numeroCanonicoFinal,
          numeroUC: numeroUCFinal,
          numeroConcessionariaOriginal,
          endereco: body.endereco.logradouro
            ? `${body.endereco.logradouro}, ${body.endereco.numero}`
            : '',
          cidade: body.endereco.cidade,
          estado: body.endereco.estado,
          cooperadoId: cooperado.id,
          cep: body.endereco.cep || undefined,
          bairro: body.endereco.bairro || undefined,
          distribuidora: coerceDistribuidora(body.instalacao.distribuidora),
        },
      });

      return { cooperadoId: cooperado.id, ucId: uc.id };
    });

    // PASSO 3+4 — Motor de Proposta (fora da transação — pode ser lento)
    let propostaId: string | null = null;
    let emListaEspera = false;
    try {
      const consumo = body.instalacao.consumoMedioKwh || 0;
      const valorFatura = body.valorUltimaFatura || 0;
      const historico = body.historicoConsumo ?? [];
      const ultimoMes = historico.length > 0 ? historico[historico.length - 1] : null;

      const primPlano = await this.prisma.plano.findFirst({ where: { ativo: true } });
      const planoId = body.planoId || primPlano?.id || '';

      let resultado = await this.motorProposta.calcular({
        cooperadoId,
        planoId,
        historico: historico.length > 0
          ? historico.map(h => ({ mesAno: h.mesAno, consumoKwh: h.consumoKwh, valorRS: h.valorRS }))
          : [{ mesAno: new Date().toISOString().slice(0, 7), consumoKwh: consumo, valorRS: valorFatura }],
        kwhMesRecente: ultimoMes?.consumoKwh ?? consumo,
        valorMesRecente: ultimoMes?.valorRS ?? valorFatura,
        mesReferencia: ultimoMes?.mesAno ?? new Date().toISOString().slice(0, 7),
      });

      // Motor detected a consumption outlier and needs user choice (MEDIA_12M vs MES_RECENTE).
      // Sprint Convite-Convênio Fatia 2 (03/06) — no caminho CONVITE_PUBLICO NÃO há UI
      // pra escolher; recalcula com `opcaoEscolhida='MEDIA_12M'` (fallback conservador)
      // e segue o fluxo normal. Empresa/admin podem ajustar depois na aprovação.
      if (resultado.outlierDetectado && resultado.aguardandoEscolha) {
        if (body.origem === 'CONVITE_PUBLICO') {
          this.logger.log(
            `[cadastro-v2] origem=CONVITE_PUBLICO outlier detectado — recalculando com fallback MEDIA_12M pro cooperado ${cooperadoId}`,
          );
          resultado = await this.motorProposta.calcular({
            cooperadoId,
            planoId,
            historico: historico.length > 0
              ? historico.map(h => ({ mesAno: h.mesAno, consumoKwh: h.consumoKwh, valorRS: h.valorRS }))
              : [{ mesAno: new Date().toISOString().slice(0, 7), consumoKwh: consumo, valorRS: valorFatura }],
            kwhMesRecente: ultimoMes?.consumoKwh ?? consumo,
            valorMesRecente: ultimoMes?.valorRS ?? valorFatura,
            mesReferencia: ultimoMes?.mesAno ?? new Date().toISOString().slice(0, 7),
            opcaoEscolhida: 'MEDIA_12M',
          });
        } else {
          return {
            ok: false,
            erro: 'OUTLIER_DETECTADO',
            opcoes: resultado.opcoes,
            data: { cooperadoId, ucId },
          };
        }
      }

      if (resultado.resultado) {
        const aceite = await this.motorProposta.aceitar({
          cooperadoId,
          resultado: resultado.resultado,
          mesReferencia: resultado.resultado.mesReferencia,
          planoId: body.planoId || undefined,
          // D-FISCAL-2.4.3 — Caso 1: força plano custeado + vincula ao convênio
          convenioCusteioId: body.convenioCusteioId || undefined,
          // Sprint Convite-Convênio Fatia 2 — propaga origem (default ADMIN_MANUAL)
          origem: body.origem,
        });
        propostaId = aceite.proposta?.id ?? null;
        emListaEspera = aceite.emListaEspera ?? false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'erro desconhecido';
      this.logger.warn(`[cadastro-v2] Motor falhou para cooperado ${cooperadoId}: ${msg}`);
    }

    // PASSO 5 — Indicação (fire-and-forget)
    if (body.codigoRef) {
      try {
        await this.indicacoes.registrarIndicacao(cooperadoId, body.codigoRef);

        // Sprint 9B: vincular ao convênio se indicador é membro/conveniado
        const indicador = await this.prisma.cooperado.findUnique({
          where: { codigoIndicacao: body.codigoRef },
          select: { id: true },
        });
        if (indicador) {
          // Buscar convênio do indicador (como conveniado ou membro)
          const conveniado = await this.prisma.contratoConvenio.findFirst({
            where: { conveniadoId: indicador.id, status: 'ATIVO' },
            select: { id: true },
          });
          const membro = !conveniado
            ? await this.prisma.convenioCooperado.findFirst({
                where: { cooperadoId: indicador.id, ativo: true },
                select: { convenioId: true },
              })
            : null;
          const convenioId = conveniado?.id ?? membro?.convenioId;

          if (convenioId) {
            // D-30P + D-30Q (01/05): usar adicionarMembro() que popula
            // indicacaoId via registrarIndicacaoConvenio + chama recalcularFaixa.
            // Caminho anterior criava direto via Prisma e pulava ambos.
            try {
              await this.conveniosMembros.adicionarMembro(convenioId, cooperadoId);
              this.logger.log(`[cadastro-v2] Cooperado ${cooperadoId} vinculado ao convênio ${convenioId} via indicação (adicionarMembro)`);
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'erro desconhecido';
              // Erros esperados (já vinculado, em outro convênio, etc) são fire-and-forget
              this.logger.warn(`[cadastro-v2] adicionarMembro falhou convenio=${convenioId} cooperado=${cooperadoId}: ${msg}`);
            }
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        this.logger.warn(`[cadastro-v2] Indicação falhou ref=${body.codigoRef}: ${msg}`);
      }
    }

    this.logger.log(`[cadastro-v2] Cooperado ${cooperadoId} criado (proposta=${propostaId ?? 'nenhuma'}, espera=${emListaEspera})`);
    return { ok: true, data: { cooperadoId, ucId, propostaId, emListaEspera } };
  }

  private async processarIndicacao(codigoRef: string, nomeNovo: string, leadId: string) {
    const indicador = await this.prisma.cooperado.findUnique({
      where: { codigoIndicacao: codigoRef },
      select: { id: true, nomeCompleto: true, telefone: true, cooperativaId: true },
    });

    if (!indicador || !indicador.cooperativaId) {
      this.logger.warn(`Código de convite não encontrado ou sem cooperativa: ${codigoRef}`);
      return;
    }

    // BUG-11-003: NÃO creditar tokens no momento do cadastro do lead.
    // Tokens BONUS_INDICACAO são creditados apenas quando o cooperado indicado
    // tem sua primeira fatura paga (via indicacoes.service.ts → processarPrimeiraFaturaPaga).
    this.logger.log(
      `BONUS_INDICACAO para indicador ${indicador.id} será creditado após aprovação/primeira fatura do lead ${leadId}`,
    );

    // Notificar indicador via WhatsApp
    if (indicador.telefone) {
      const telefoneIndicador = indicador.telefone.replace(/\D/g, '');
      const msgNotificacao =
        `Boa notícia! ${nomeNovo} acabou de iniciar o cadastro usando seu convite CoopereBR! 🎉 ` +
        `Quando ele for aprovado, você receberá seus tokens de indicação.`;

      try {
        await this.sender.enviarMensagem(telefoneIndicador, msgNotificacao);
      } catch {
        // Log but don't fail
      }
    }
  }

  private async notificarAdminCreditosInjetados(nome: string, numeroUC: string | undefined, leadId: string) {
    const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER ?? '5527981341348';
    const msg =
      `🔔 Novo lead com créditos injetados!\n` +
      `Nome: ${nome}\n` +
      `UC: ${numeroUC || 'não informada'}\n` +
      `Lead ID: ${leadId}\n` +
      `A UC já possui energia solar/GD. Entrar em contato para proposta personalizada.`;

    try {
      await this.sender.enviarMensagem(adminPhone, msg);
      this.logger.log(`Notificação de créditos injetados enviada ao admin para lead ${leadId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      this.logger.error(`Falha ao enviar notificação admin créditos injetados: ${message}`);
    }
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 por minuto para processamento em lote
  @Post('processar-fatura-ocr')
  @UseInterceptors(FileInterceptor('fatura'))
  async processarFaturaOcr(
    @UploadedFile() arquivo: Express.Multer.File,
    @Body() body?: { faturaBase64?: string; faturaTipo?: string; faturaNome?: string }
  ): Promise<{
    sucesso: boolean;
    mensagem?: string;
    dados: Record<string, unknown>;
  }> {
    // Aceitar base64 via JSON quando não vier arquivo multipart
    if (!arquivo && body?.faturaBase64) {
      const base64 = body.faturaBase64;
      const tipo = body.faturaTipo || 'application/pdf';
      const isPdf = tipo === 'application/pdf';
      const isImage = tipo.startsWith('image/');
      if (!isPdf && !isImage) throw new BadRequestException('Formato não suportado.');
      try {
        const tipoArquivo = isPdf ? 'pdf' as const : 'imagem' as const;
        const dadosExtraidos = await this.faturasService.extrairOcr(base64, tipoArquivo);
        const consumoMedio = dadosExtraidos.historicoConsumo?.length > 0
          ? Math.round(dadosExtraidos.historicoConsumo.reduce((s: number, h: any) => s + h.consumoKwh, 0) / dadosExtraidos.historicoConsumo.length)
          : dadosExtraidos.consumoAtualKwh || 0;
        const temCreditosInjetados = !!(dadosExtraidos as any).energiaInjetadaKwh && (dadosExtraidos as any).energiaInjetadaKwh > 0;
        return { sucesso: true, dados: { ...dadosExtraidos, consumoMedio, temCreditosInjetados } };
      } catch(e: any) {
        return { sucesso: false, mensagem: 'OCR não disponivel ou falhou: ' + (e.message || ''), dados: {} };
      }
    }
    if (!arquivo) {
      throw new BadRequestException('Arquivo da fatura é obrigatório');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (arquivo.size > maxSize) {
      throw new BadRequestException('Arquivo excede o limite de 10MB');
    }

    const isPdf = arquivo.mimetype === 'application/pdf';
    const isImage = arquivo.mimetype.startsWith('image/');

    if (!isPdf && !isImage) {
      throw new BadRequestException('Formato não suportado. Envie PDF ou imagem.');
    }

    try {
      const arquivoBase64 = arquivo.buffer.toString('base64');
      const tipoArquivo = isPdf ? 'pdf' as const : 'imagem' as const;
      const dadosExtraidos = await this.faturasService.extrairOcr(arquivoBase64, tipoArquivo);

      const consumoMedio = dadosExtraidos.historicoConsumo?.length > 0
        ? Math.round(dadosExtraidos.historicoConsumo.reduce((s, h) => s + h.consumoKwh, 0) / dadosExtraidos.historicoConsumo.length)
        : dadosExtraidos.consumoAtualKwh || 0;

      const temCreditosInjetados = !!(
        dadosExtraidos.temCreditosInjetados ||
        (dadosExtraidos.energiaInjetadaKwh && dadosExtraidos.energiaInjetadaKwh > 0) ||
        (dadosExtraidos.creditosRecebidosKwh && dadosExtraidos.creditosRecebidosKwh > 0) ||
        dadosExtraidos.possuiCompensacao
      );

      return {
        sucesso: true,
        dados: {
          nome: dadosExtraidos.titular || '',
          cpf: dadosExtraidos.documento || '',
          numeroUC: dadosExtraidos.numeroUC || '',
          distribuidora: dadosExtraidos.distribuidora || '',
          consumoMedioKwh: consumoMedio,
          totalAPagar: dadosExtraidos.totalAPagar || 0,
          endereco: dadosExtraidos.enderecoInstalacao || '',
          bairro: dadosExtraidos.bairro || '',
          cidade: dadosExtraidos.cidade || '',
          estado: dadosExtraidos.estado || '',
          cep: dadosExtraidos.cep || '',
          historicoConsumo: dadosExtraidos.historicoConsumo || [],
          temCreditosInjetados,
          energiaInjetadaKwh: dadosExtraidos.energiaInjetadaKwh || 0,
          energiaFornecidaKwh: dadosExtraidos.energiaFornecidaKwh || 0,
          saldoCreditosKwh: dadosExtraidos.saldoTotalKwh || 0,
          valorCompensadoReais: dadosExtraidos.valorCompensadoReais || 0,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      this.logger.warn(`OCR fatura pública falhou: ${message}`);
      return {
        sucesso: false,
        mensagem: 'Leitura automática não disponível. Preencha manualmente.',
        dados: {},
      };
    }
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('salvar-lead')
  async salvarLead(
    @Body() body: { telefone: string; nome?: string; email?: string; fonte?: string },
  ) {
    if (!body.telefone) {
      throw new BadRequestException('Telefone é obrigatório');
    }

    const telefone = body.telefone.replace(/\D/g, '');
    if (telefone.length < 10 || telefone.length > 13) {
      throw new BadRequestException('Telefone inválido');
    }

    try {
      const lead = await this.prisma.leadWhatsapp.upsert({
        where: { telefone },
        update: {
          ...(body.nome ? { nome: body.nome } : {}),
          ...(body.email ? { email: body.email } : {}),
        },
        create: {
          telefone,
          nome: body.nome ?? null,
          email: body.email ?? null,
          fonte: body.fonte ?? 'site',
        },
      });
      return { ok: true, data: { id: lead.id, telefone: lead.telefone } };
    } catch (err) {
      this.logger.error(`Erro ao salvar lead: ${err.message}`);
      return { ok: false, error: 'Erro ao salvar lead' };
    }
  }

  /**
   * Bloco C (16/05/2026) — Cadastro público de cooperado SEM unidade consumidora.
   * Cooperado SEM_UC participa apenas de MLM (indicação) + CooperToken Clube.
   * Não exige UC, distribuidora ou contrato.
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('cadastro-sem-uc')
  async cadastroSemUc(
    @Body()
    body: {
      nome: string;
      cpf: string;
      email: string;
      telefone?: string;
      tipoPessoa?: 'PF' | 'PJ';
      codigoRef?: string;
      cooperativaId?: string;
      representanteLegalNome?: string;
      representanteLegalCpf?: string;
      representanteLegalCargo?: string;
    },
    @Query('tenant') tenantParam?: string,
  ) {
    const cooperativaId = body.cooperativaId ?? tenantParam;
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId ou query param ?tenant= é obrigatório');
    }
    if (!body.nome || !body.cpf || !body.email) {
      throw new BadRequestException('Nome, CPF/CNPJ e email são obrigatórios');
    }

    const cpfLimpo = (body.cpf || '').replace(/\D/g, '');
    const telefoneLimpo = body.telefone ? body.telefone.replace(/\D/g, '') : undefined;

    try {
      const cooperado = await this.prisma.cooperado.create({
        data: {
          nomeCompleto: body.nome.trim(),
          cpf: cpfLimpo,
          email: body.email.trim(),
          telefone: telefoneLimpo,
          tipoPessoa: body.tipoPessoa ?? 'PF',
          tipoCooperado: 'SEM_UC',
          status: 'PENDENTE',
          cooperativaId,
          modoRemuneracao: 'CLUBE',
          termoAdesaoAceito: true,
          termoAdesaoAceitoEm: new Date(),
          representanteLegalNome: body.representanteLegalNome ?? null,
          representanteLegalCpf: body.representanteLegalCpf
            ? body.representanteLegalCpf.replace(/\D/g, '')
            : null,
          representanteLegalCargo: body.representanteLegalCargo ?? null,
        },
        select: { id: true, nomeCompleto: true, tipoCooperado: true, status: true, codigoIndicacao: true },
      });
      this.logger.log(`Cooperado SEM_UC criado via cadastro público: ${cooperado.id} (${cooperado.nomeCompleto})`);
      return { ok: true, data: cooperado };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('CPF/CNPJ ou email já cadastrado');
      }
      this.logger.error(`Erro ao salvar cooperado SEM_UC: ${err?.message}`);
      throw new BadRequestException('Erro ao salvar cooperado SEM_UC');
    }
  }
}
