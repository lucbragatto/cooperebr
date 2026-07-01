/// <reference types="multer" />
import { Controller, Post, Get, Body, Param, Query, Req, BadRequestException, ConflictException, ForbiddenException, NotFoundException, Logger, UploadedFile, UseInterceptors, HttpCode } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Prisma, AdmissionOrigem } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { AuditLog } from '../audit/audit-log.decorator';
import { PrismaService } from '../prisma.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { CooperTokenService } from '../cooper-token/cooper-token.service';
import { FaturasService, OcrFalhaError, OcrFalhaMotivo } from '../faturas/faturas.service';
import { MotorPropostaService } from '../motor-proposta/motor-proposta.service';
import { IndicacoesService } from '../indicacoes/indicacoes.service';
import { ConveniosMembrosService } from '../convenios/convenios-membros.service';
import { ConvitesConvenioService } from '../convenios/convites-convenio.service';
import { ConvenioAprovacaoService } from '../convenios/convenios-aprovacao.service';
import { DecidirAprovacaoEmpresaDto } from '../convenios/dto/decidir-aprovacao-empresa.dto';
import { coerceDistribuidora } from '../ucs/ucs.service';
import { AutoInscreverConvenioDto } from './dto/auto-inscrever-convenio.dto';
import { ValidarOtpConviteDto } from './dto/validar-otp-convite.dto';
import { isAmbienteReal } from '../common/safety/ambiente';
import { validarENormalizarCadastro } from '../common/safety/cadastro-validacao';
import { CadastroUploadService } from './cadastro-upload.service';
// Sprint Funil M48 (22/06/2026) — Camada 1 Motor Roteador A/B/C (advisory).
import { RoteamentoCadastroService } from '../roteamento-cadastro/roteamento-cadastro.service';

/**
 * Sprint Onboarding Bloco 1 Fatia 1.2 (06/06/2026).
 *
 * Deriva cota mensal pra gravar em `Cooperado.cotaKwhMensal` durante o
 * cadastro. Regra acordada com Luciano:
 *   consumoMedioKwh ?? média(historicoConsumo)
 *
 * Arredonda 2 casas (Decimal evita lixo de float).
 * Retorna 0 quando ambas fontes vazias — caller decide se grava (não-zero
 * apenas) ou se deixa nulo (campo opcional no schema).
 */
export function derivarCotaKwhMensal(input: {
  consumoMedioKwh?: number | null;
  historicoConsumo?: Array<{ consumoKwh: number }> | null;
}): number {
  const direto = Number(input.consumoMedioKwh ?? 0);
  if (Number.isFinite(direto) && direto > 0) {
    return Math.round(direto * 100) / 100;
  }
  const historico = input.historicoConsumo ?? [];
  if (historico.length === 0) return 0;
  const soma = historico.reduce(
    (acc, h) => acc + Number(h.consumoKwh ?? 0),
    0,
  );
  if (soma <= 0) return 0;
  return Math.round((soma / historico.length) * 100) / 100;
}

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
    // Sprint Convite-Convênio Fatia 2a (03/06/2026) — validação pública do token
    private convitesConvenio: ConvitesConvenioService,
    // Sprint Convite-Convênio Fatia 3 (03/06/2026) — magic link aprovação empresa
    private convenioAprovacao: ConvenioAprovacaoService,
    // Convergência convite custeio Fatia 1 (04/06/2026) — upload pré-cadastro
    private cadastroUpload: CadastroUploadService,
    // Sprint Funil M48 (22/06/2026) — Camada 1 Motor Roteador A/B/C (advisory).
    private roteamentoCadastroService: RoteamentoCadastroService,
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
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('convenios-pagador-empresa')
  async listarConveniosPagadorEmpresa(@Query('tenant') tenant?: string) {
    // Sprint Hardening Tenant-Spoof (20/06/2026) — validação de existência
    // do tenant antes da query. Sem validação, ?tenant=<id-fake> retornava
    // [] silencioso (vazamento por enumeração / probe).
    if (!tenant) {
      throw new BadRequestException('Query param ?tenant=<cooperativaId> é obrigatório');
    }
    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: tenant },
      select: { id: true, ativo: true },
    });
    if (!coop || !coop.ativo) {
      throw new NotFoundException('Cooperativa não encontrada ou inativa.');
    }
    const convenios = await this.prisma.contratoConvenio.findMany({
      where: {
        cooperativaId: coop.id,
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
      // Sprint Convênio-Token-Cooperado (20/06/2026) — slice "recebe créditos
      // GD como DADO". Propagado pro cadastroWebV2 → Cooperado.create.
      jaRecebeCreditosGd?: boolean;
      fornecedorGdAtual?: string;
    },
    @Query('tenant') tenantParam?: string,
  ) {
    // Feature toggle: v2 cria Cooperado + UC + Proposta real; legado cria LeadWhatsapp
    const v2Ativo = process.env.CADASTRO_V2_ATIVO === 'true';
    if (v2Ativo) {
      // Sprint Hardening Tenant-Spoof (20/06/2026) —
      // D-novo-CADASTRO-PUBLICO-TENANT-SPOOF P1. Tenant resolvido por
      // ordem de confiança: (1) convite público — token sobrepõe tudo;
      // (2) ?tenant=<id> validado contra Cooperativa ativa.
      // body.cooperativaId é DESCARTADO (compat-only, ignorado).
      let cooperativaId: string | null = null;

      // Convergência Fatia 2 (05/06/2026) — quando o cadastro vem via convite
      // público (?conv=<token>), deriva cooperativaId do convênio do convite
      // server-side. Espelha o padrão anti-spoof de /auto-inscrever (linha 568):
      // tenant DO CONVITE sobrepõe qualquer ?tenant= do client.
      // Validação completa do convite (OTP/expiração/consume-once) fica dentro
      // do cadastroWebV2 quando origem=CONVITE_PUBLICO.
      const conviteTokenHint = (body as { token?: string }).token;
      if (conviteTokenHint) {
        const convite = await this.prisma.conviteConvenioMembro.findUnique({
          where: { token: conviteTokenHint },
          select: { cooperativaId: true },
        });
        if (!convite?.cooperativaId) {
          // Token presente mas não resolve = convite inexistente, expirado ou
          // revogado. Mensagem específica em vez do genérico "cooperativaId
          // obrigatório" pra não confundir admin durante smoke.
          throw new BadRequestException('Convite inválido ou expirado.');
        }
        cooperativaId = convite.cooperativaId;
      } else {
        if (!tenantParam) {
          throw new BadRequestException('Query param ?tenant=<cooperativaId> é obrigatório no modo v2');
        }
        const coop = await this.prisma.cooperativa.findUnique({
          where: { id: tenantParam },
          select: { id: true, ativo: true },
        });
        if (!coop || !coop.ativo) {
          throw new NotFoundException('Cooperativa não encontrada ou inativa.');
        }
        cooperativaId = coop.id;
      }

      // Sprint Funil M48 (22/06/2026) — Camada 1 Motor Roteador A/B/C.
      // ADVISORY only: decide o caminho ANTES de chamar cadastroWebV2 (fora
      // da tx, sem queries aninhadas). Resultado gravado em 4 campos do
      // Cooperado pelo cadastroWebV2. NÃO bloqueia cadastro.
      const roteamento = await this.roteamentoCadastroService.decidirCaminho({
        jaRecebeCreditosGd: (body as any).jaRecebeCreditosGd ?? null,
        fornecedorGdAtual: (body as any).fornecedorGdAtual ?? null,
        cooperativaIdSugerida: cooperativaId,
      });

      const resultV2 = await this.cadastroWebV2(
        body as Parameters<PublicoController['cadastroWebV2']>[0],
        cooperativaId,
        roteamento,
      );

      // FIX A.2 Frente 2 vitrines mínimas (01/07/2026) — notificar admin
      // quando o motor detecta caminho A_MIGRACAO (lead de captação) ou
      // AMBIGUO_ADMIN (caso ambíguo — decisão manual). Sem esse disparo o
      // link OCR→captação ficava quebrado: motor gravava metadata mas admin
      // NUNCA recebia aviso. Fire-and-forget (não bloqueia resposta).
      const precisaAvisarAdmin =
        roteamento.caminho === 'A_MIGRACAO' ||
        roteamento.caminho === 'AMBIGUO_ADMIN';

      if (precisaAvisarAdmin && resultV2?.data?.cooperadoId) {
        this.notificarAdminRoteamentoCaptacao({
          cooperadoId: resultV2.data.cooperadoId,
          nome: body.nome,
          numeroUC: body.instalacao?.numeroUC,
          caminho: roteamento.caminho,
          razao: roteamento.razao,
        }).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'erro desconhecido';
          this.logger.error(
            `Erro ao notificar admin roteamento V2 (${roteamento.caminho}): ${message}`,
          );
        });
      }

      return resultV2;
    }

    const cpfLimpo = (body.cpf || '').replace(/\D/g, '');
    const telefoneLimpo = (body.telefone || '').replace(/\D/g, '');

    // Convergência Fatia 1 (04/06/2026) — gate UNIFICADO via isAmbienteReal().
    // Substitui o CADASTRO_VALIDACOES_ATIVAS legado (discriminador frágil).
    // Em REAL: nome/cpf/email/telefone obrigatórios. Em DEV/teste: relaxado.
    if (isAmbienteReal()) {
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

  // ─── Sprint Convite-Convênio Fatia 2a (03/06/2026) ─────────────────────────
  // Validação pública do token de convite (página /convite/[token] consulta este
  // endpoint pra mostrar { empresaNome, nomeConvidado, telefoneSufixo }).
  // NÃO retorna telefone integral — defesa LGPD/anti-enumeration.
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('convites/:token')
  async validarConviteConvenio(@Param('token') token: string) {
    const r = await this.convitesConvenio.validarToken(token);
    // Resposta uniforme — não vazar diferença entre "não existe" e "expirou"
    // pra cliente não-autenticado (anti-enumeration). Apenas { valido } + dados
    // quando válido.
    if (!r.valido) {
      return { valido: false, motivo: r.motivo ?? 'Convite indisponível.' };
    }
    return {
      valido: true,
      empresaNome: r.dados!.empresaNome,
      nomeConvidado: r.dados!.nomeConvidado,
      telefoneSufixo: r.dados!.telefoneSufixo,
      expiresAt: r.dados!.expiresAt,
      otpJaValidado: r.dados!.otpJaValidado,
      // Sprint Onboarding Bloco 1 Fatia 1.1 (06/06/2026) — repasse do convite.
      // Frontend setState(convenioCusteioId, permiteSemUc) → payload do POST
      // /cadastro-web já leva convênio CERTO e respeita slim path.
      convenioId: r.dados!.convenioId,
      permiteSemUc: r.dados!.permiteSemUc,
    };
  }

  // ─── Sprint Convite-Convênio Fatia 2b (03/06/2026) — OTP ──────────────────
  // Solicita OTP: gera código 6 dígitos + envia WA pro convite.telefone (NUNCA
  // pra outro número). Service aplica guards (bloqueio/reenvios/cooldown).
  // @Throttle 5/min por IP (camada amplitude) — guard de cooldown 60s é a
  // camada por-convite (mais granular).
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(200)
  @Post('convites/:token/solicitar-otp')
  async solicitarOtpConvite(@Param('token') token: string) {
    return this.convitesConvenio.solicitarOtp(token);
  }

  // Valida OTP digitado pelo usuário. Comparação constant-time. Conta
  // tentativas; 5 erros → bloqueio 1h. @Throttle agressivo por IP (10/min)
  // pra dificultar brute-force distribuído (5 tentativas × código de 6 dig =
  // 1 em 200k chance; throttle limita rounds).
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(200)
  @Post('convites/:token/validar-otp')
  async validarOtpConvite(
    @Param('token') token: string,
    @Body() dto: ValidarOtpConviteDto,
  ) {
    return this.convitesConvenio.validarOtp(token, dto.codigo);
  }

  // ─── Sprint Convite-Convênio Fatia 3 (03/06/2026) — Empresa via magic link ──
  // Magic link da empresa (gerado quando origem=CONVITE_PUBLICO, ver Fatia 2c.1)
  // permite que o pagadorCooperado (representante da empresa) APROVE ou REJEITE
  // o cadastro sem precisar de login no portal. Token single-use TTL 7d.
  //
  // GET /publico/aprovacao-membro/:token — valida pra UI mostrar nome do
  // cooperado + sufixos (LGPD).
  //
  // POST /publico/aprovacao-membro/:token { decisao, motivo? } — registra a
  // decisão atomicamente. Captura ip+userAgent pra audit forense.

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('aprovacao-membro/:token')
  async validarTokenAprovacaoEmpresa(@Param('token') token: string) {
    return this.convenioAprovacao.validarTokenAprovacao(token);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @AuditLog({ acao: 'convenio.aprovacao_empresa', recurso: 'AprovacaoConvenioMembro' })
  @HttpCode(200)
  @Post('aprovacao-membro/:token')
  async decidirAprovacaoEmpresa(
    @Param('token') token: string,
    @Body() dto: DecidirAprovacaoEmpresaDto,
    @Req() req: any,
  ) {
    const ip =
      (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      undefined;
    const userAgent = req.headers?.['user-agent'] as string | undefined;
    return this.convenioAprovacao.decidirAprovacaoEmpresa({
      token,
      decisao: dto.decisao,
      motivo: dto.motivo,
      ip,
      userAgent,
    });
  }

  // ─── Sprint Convite-Convênio Fatia 2c (03/06/2026) ─────────────────────────
  // Endpoint público de auto-inscrição. NOVO DESIGN (substitui o body Fatia 2):
  //
  //  - EXIGE `token` do convite (Fatia 2a) — convenioId/cooperativaId resolvidos
  //    DO CONVITE (não do body), removendo a superfície de spoof de tenant.
  //  - EXIGE `otpValidadoEm` no convite (Fatia 2b) dentro da janela de 30min —
  //    prova de posse do telefone alvo do convite.
  //  - Consume-once: convite.usedAt setado atomicamente ANTES de cadastroWebV2
  //    (update where {id, usedAt:null} — P2025 se race). Se cadastro falhar,
  //    rollback do usedAt.
  //  - Delega pra cadastroWebV2(origem=CONVITE_PUBLICO) que cria Cooperado+UC+
  //    Proposta+Membro PENDENTE_APROVACAO_EMPRESA + AprovacaoConvenioMembro
  //    (magic link da empresa) atomicamente via tx interna do motor.aceitar.
  //  - Feature flag CONVITE_OTP_ATIVO (default true): kill-switch emergencial
  //    (false desativa o endpoint inteiro, retorna 404 genérico).
  //
  // Dedup CPF + quota + rate-limit preservados da Fatia 2 (030b22d), agora
  // APÓS validar token/OTP (não permitem brute-force sem convite + OTP).
  /**
   * Convergência convite custeio Fatia 1 (04/06/2026) — Upload pré-cadastro.
   *
   * Gated por token de convite + otpValidadoEm (janela 30min, mesma do
   * auto-inscrever). Salva o arquivo em Supabase Storage no path tmp
   * `documentos-cooperados/tmp/convite-uploads/<conviteId>/`. Fatia 2 vai
   * mover esses blobs pro path final do cooperado quando o cadastroWebV2
   * concluir.
   *
   * Body multipart: `arquivo` (File) + form-data `tipo`
   *   (FATURA|RG_FRENTE|RG_VERSO|CNH_FRENTE|CNH_VERSO|SELFIE).
   *
   * Throttle agressivo: 30/h por IP (mesmo do auto-inscrever; alinhado com
   * o caminho convite).
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 3600000 } })
  @AuditLog({ acao: 'cadastro.upload_doc', recurso: 'ConviteConvenioMembro' })
  @HttpCode(200)
  @Post('cadastro/upload-doc')
  @UseInterceptors(FileInterceptor('arquivo'))
  async uploadDocCadastro(
    @Body('token') token: string,
    @Body('tipo') tipo: string,
    @UploadedFile() arquivo: Express.Multer.File,
  ) {
    return this.cadastroUpload.uploadComConvite(token, tipo, arquivo);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 3600000 } }) // 30/h por IP
  @AuditLog({ acao: 'convenios.auto_inscrever', recurso: 'ConvenioCooperado' })
  @HttpCode(201)
  @Post('convenios/auto-inscrever')
  async autoInscreverConvenio(@Body() dto: AutoInscreverConvenioDto) {
    const ERRO_GENERICO = 'Não foi possível concluir o cadastro. Entre em contato com a empresa pra solicitar inclusão manual.';
    const OTP_JANELA_AUTO_INSCREVER_MIN = 30;

    // HOTFIX (04/06/2026) — em DEV (!isAmbienteReal()), surfaceia o motivo
    // real do bloqueio pra acelerar diagnóstico do Luciano. Em PROD mantém
    // o genérico (anti-enumeração — quem ataca não sabe se é CPF duplicado,
    // convite usado, quota, etc.). O payload usa o mesmo shape dos erros
    // OTP estruturados ({ erro, mensagem }).
    const ehDev = !isAmbienteReal();
    const erroDetalhe = (erro: string, motivoDev: string) =>
      ehDev ? { erro, mensagem: ERRO_GENERICO, dev_motivo: motivoDev } : ERRO_GENERICO;

    // Kill-switch emergencial. Default 'true' = endpoint ativo.
    // Set 'false' pra desligar o caminho público (rollback emergencial).
    const conviteOtpAtivo = (process.env.CONVITE_OTP_ATIVO ?? 'true').toLowerCase() !== 'false';
    if (!conviteOtpAtivo) {
      this.logger.warn(
        `[auto-inscrever] DESLIGADO por feature flag CONVITE_OTP_ATIVO=false. ` +
          `tokenSufixo=...${(dto.token ?? '').slice(-6)} cpfSufixo=...${(dto.cpf ?? '').slice(-4)}`,
      );
      const ehDevKill = !isAmbienteReal();
      throw new NotFoundException(
        ehDevKill
          ? { erro: 'kill_switch', mensagem: ERRO_GENERICO, dev_motivo: 'CONVITE_OTP_ATIVO=false' }
          : ERRO_GENERICO,
      );
    }

    // (1) Carregar convite — token é a chave; convenio + cooperativaId vêm DELE.
    const convite = await this.prisma.conviteConvenioMembro.findUnique({
      where: { token: dto.token },
      include: {
        convenio: {
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
        },
      },
    });

    if (!convite) {
      this.logger.warn(
        `[auto-inscrever] Convite não encontrado: tokenSufixo=...${dto.token.slice(-6)}`,
      );
      throw new NotFoundException(erroDetalhe('convite_inexistente', 'token não encontrado'));
    }
    if (convite.usedAt) {
      this.logger.warn(
        `[auto-inscrever] Convite JÁ USADO (consume-once): conviteId=${convite.id} ` +
          `tokenSufixo=...${dto.token.slice(-6)} usedAt=${convite.usedAt.toISOString()}`,
      );
      throw new ConflictException(
        erroDetalhe('convite_ja_usado', `convite usado em ${convite.usedAt.toISOString()}`),
      );
    }
    if (convite.expiresAt <= new Date()) {
      this.logger.warn(
        `[auto-inscrever] Convite expirado: conviteId=${convite.id} expiresAt=${convite.expiresAt.toISOString()}`,
      );
      throw new BadRequestException(
        erroDetalhe('convite_expirado', `convite expirou em ${convite.expiresAt.toISOString()}`),
      );
    }

    // (2) OTP validado dentro de 30min
    if (!convite.otpValidadoEm) {
      throw new BadRequestException({
        erro: 'otp_pendente',
        mensagem: 'Confirme o código de verificação primeiro.',
      });
    }
    const idadeOtpMin =
      (Date.now() - convite.otpValidadoEm.getTime()) / 1000 / 60;
    if (idadeOtpMin > OTP_JANELA_AUTO_INSCREVER_MIN) {
      throw new BadRequestException({
        erro: 'otp_sessao_expirada',
        mensagem:
          `Sessão expirada (validação OTP > ${OTP_JANELA_AUTO_INSCREVER_MIN}min). ` +
          `Solicite um novo código e valide de novo.`,
      });
    }

    // (3) Resolve convenio + cooperativa DO CONVITE — NÃO do body (anti-spoof)
    const convenio = convite.convenio;
    if (
      convenio.status !== 'ATIVO' ||
      convenio.pagador !== 'EMPRESA'
    ) {
      this.logger.warn(
        `[auto-inscrever] Convenio do convite inválido: convenioId=${convenio.id} ` +
          `status=${convenio.status} pagador=${convenio.pagador}`,
      );
      throw new NotFoundException(
        erroDetalhe(
          'convenio_invalido',
          `convenio status=${convenio.status} pagador=${convenio.pagador} (esperado ATIVO+EMPRESA)`,
        ),
      );
    }
    const cooperativaId = convenio.cooperativaId!;

    const cpfLimpo = (dto.cpf || '').replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      throw new BadRequestException('CPF inválido.');
    }

    // (4) Dedup CPF — qualquer cooperado existente (mesmo tenant OU cross) rejeitado.
    // Erro genérico pra não vazar via diffing.
    const cooperadoExistente = await this.prisma.cooperado.findUnique({
      where: { cpf: cpfLimpo },
      select: { id: true, cooperativaId: true },
    });
    if (cooperadoExistente) {
      this.logger.warn(
        `[auto-inscrever] CPF já existe — bloqueado (Caso B cross-tenant ou B mesmo-tenant): ` +
          `cpf=...${cpfLimpo.slice(-4)} tenantExistente=${cooperadoExistente.cooperativaId} ` +
          `convenioId=${convenio.id}`,
      );
      throw new ConflictException(
        erroDetalhe(
          'cpf_ja_cadastrado',
          `CPF ...${cpfLimpo.slice(-4)} já existe em outro cooperado (id=${cooperadoExistente.id} tenant=${cooperadoExistente.cooperativaId})`,
        ),
      );
    }

    // (5) Rate-limit por convênio/hora — usa @@index([cooperadoId, createdAt]).
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
    const tentativasRecentes = await this.prisma.convenioCooperado.count({
      where: {
        convenioId: convenio.id,
        origem: 'CONVITE_PUBLICO',
        createdAt: { gte: umaHoraAtras },
      },
    });
    if (tentativasRecentes >= 60) {
      this.logger.warn(
        `[auto-inscrever] Rate-limit por convênio atingido: convenioId=${convenio.id} ` +
          `tentativas=${tentativasRecentes} janela=1h`,
      );
      throw new ConflictException(
        erroDetalhe(
          'rate_limit_convenio',
          `${tentativasRecentes} cadastros via convite na última 1h pro convenio (limite 60)`,
        ),
      );
    }

    // (6) Quota: limiteMembros — conta MEMBRO_ATIVO + PENDENTE_* (não-expirados)
    if (convenio.limiteMembros != null) {
      const ocupacao = await this.prisma.convenioCooperado.count({
        where: {
          convenioId: convenio.id,
          OR: [
            { status: 'MEMBRO_ATIVO' },
            {
              status: { in: ['PENDENTE_APROVACAO_EMPRESA', 'PENDENTE_APROVACAO_ADMIN'] },
              OR: [
                { aprovacao: null },
                { aprovacao: { usedAt: { not: null } } },
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

    // (7) Quota energética: kwhAlocadoMaxMensal só em CONSUMO_REAL
    if (
      convenio.kwhAlocadoMaxMensal != null &&
      convenio.baseCobrancaCusteio === 'CONSUMO_REAL'
    ) {
      const membrosVivos = await this.prisma.convenioCooperado.findMany({
        where: {
          convenioId: convenio.id,
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

    // ─── ATOMICIDADE (Fatia 2c.1 hardening) ──────────────────────────────
    // Etapas (9)-(12) em UMA $transaction Serializable. Se qualquer create
    // falhar no meio, rollback NATIVO do Postgres reverte tudo (consume-once
    // + Cooperado + Membro + AprovacaoConvenioMembro + cross-ref). Sem mais
    // compensação manual (cooperado.delete .catch + rollbackConviteUsedAt) —
    // tx faz o trabalho corretamente. Garante: zero Cooperado órfão, zero
    // Membro sem magic link, zero convite consumido sem membro.
    //
    // Decisão Fatia 2c: caminho CONVITE_PUBLICO NÃO precisa de Proposta+Contrato+UC
    // no momento do cadastro — tudo isso vem na aprovação (Fatia 3/5) quando empresa
    // confirma + admin anexa UC. cadastroWebV2 cria UC fake + roda motor que pode
    // falhar com kWh=0; aqui criamos o mínimo necessário (Cooperado + Membro
    // PENDENTE + magic link) e deixamos o resto pro fluxo de aprovação.
    const telefoneLimpo =
      (dto.telefone || '').replace(/\D/g, '') || convite.telefone;

    let cooperadoId: string;
    let membroId: string;

    try {
      const resultadoTx = await this.prisma.$transaction(
        async (tx) => {
          // TODO M48-Camada2 (D-novo-M48-AUTO-INSCREVER-SEM-ROTEADOR P3):
          // este path (convite público auto-inscrever) NÃO chama o roteador
          // A/B/C — Cooperado é criado sem campos `roteamento*`. Decisão de
          // produto se: (a) opcional pq convite implica intenção explícita;
          // (b) deveria rodar mesmo assim pra detectar caminho B (cliente
          // de outro parceiro SISGD chega via convite). Catalogado pra
          // avaliação na Camada 2 (vitrine).
          //
          // (9) Consume-once atômico DENTRO do tx. P2025 = outro POST consumiu
          // antes (race) → 409 genérico. Em Serializable, dois POSTs concorrentes
          // serializam ou um deles aborta com erro 40001 (Prisma traduz pra
          // PrismaClientUnknownRequestError) — capturado fora do try.
          try {
            await tx.conviteConvenioMembro.update({
              where: { id: convite.id, usedAt: null },
              data: { usedAt: new Date() },
            });
          } catch (err: any) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
              throw new ConflictException('CONSUME_ONCE_RACE');
            }
            throw err;
          }

          // (10) Cria Cooperado. P2002 (CPF/email já existe) → 409 genérico.
          let cooperadoNovo;
          try {
            cooperadoNovo = await tx.cooperado.create({
              data: {
                nomeCompleto: dto.nome.trim(),
                cpf: cpfLimpo,
                email: dto.email.trim(),
                telefone: telefoneLimpo,
                status: 'PENDENTE',
                tipoCooperado: 'SEM_UC',
                cooperativaId,
                termoAdesaoAceito: true,
                termoAdesaoAceitoEm: new Date(),
              },
              select: { id: true },
            });
          } catch (err: any) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
              throw new ConflictException('CPF_OU_EMAIL_EXISTE');
            }
            throw err;
          }

          // (11) Cria Membro PENDENTE + AprovacaoConvenioMembro (magic link)
          // DENTRO do mesmo tx. ConveniosMembrosService.adicionarMembro usa
          // o tx passado (db = tx ?? this.prisma) — Membro + AprovacaoConvenioMembro
          // ficam atômicos com o consume-once + Cooperado.
          const membroNovo = await this.conveniosMembros.adicionarMembro(
            convenio.id,
            cooperadoNovo.id,
            undefined,
            tx,
            'CONVITE_PUBLICO',
          );

          // (12) Cross-ref convite → membro (também dentro do tx)
          await tx.conviteConvenioMembro.update({
            where: { id: convite.id },
            data: { membroId: membroNovo.id },
          });

          return { cooperadoId: cooperadoNovo.id, membroId: membroNovo.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      cooperadoId = resultadoTx.cooperadoId;
      membroId = resultadoTx.membroId;
    } catch (err: any) {
      // Erros marcados internamente → erro genérico anti-enumeration
      if (err instanceof ConflictException) {
        const motivo = err.message;
        if (motivo === 'CONSUME_ONCE_RACE') {
          this.logger.warn(
            `[auto-inscrever] Race condition consume-once: conviteId=${convite.id} já consumido por outro POST`,
          );
        } else if (motivo === 'CPF_OU_EMAIL_EXISTE') {
          this.logger.warn(
            `[auto-inscrever] P2002 ao criar Cooperado (tx rolled back): ` +
              `cpf=...${cpfLimpo.slice(-4)} convenioId=${convenio.id}`,
          );
        }
        throw new ConflictException(ERRO_GENERICO);
      }
      // Serialization conflict do Postgres (40001) — tx aborta, rollback nativo,
      // outro POST ganhou. Genérico.
      if (
        err instanceof Prisma.PrismaClientUnknownRequestError ||
        (err?.code === '40001' || /serialization|concurrent|serializable/i.test(err?.message ?? ''))
      ) {
        this.logger.warn(
          `[auto-inscrever] Serialization conflict (tx rolled back): conviteId=${convite.id}`,
        );
        throw new ConflictException(ERRO_GENERICO);
      }
      this.logger.error(
        `[auto-inscrever] Falha no tx atômico (rollback total feito pelo Prisma): ` +
          `conviteId=${convite.id} ${err?.message ?? 'erro'}`,
      );
      throw new BadRequestException(ERRO_GENERICO);
    }

    this.logger.log(
      `[auto-inscrever] OK (tx atômico): conviteId=${convite.id} convenioId=${convenio.id} ` +
        `cooperadoId=${cooperadoId} membroId=${membroId} empresa=${convenio.empresaNome}`,
    );

    return {
      ok: true,
      membroId,
      status: 'PENDENTE_APROVACAO_EMPRESA',
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
      // Convergência convite custeio Fatia 1 (04/06/2026) — quando true (vindo
      // de convite com `permiteSemUc=true`), cria UC sintética em vez de
      // exigir numeroUC real. Fatia 2 (frontend) resolverá via token do convite.
      permiteSemUc?: boolean;
      // Convergência Fatia 2 (04/06/2026) — token do convite, usado pra:
      //  (a) localizar o conviteId pra moverUploadsConviteParaCooperado;
      //  (b) marcar consume-once + cross-ref membroId (fluxo CONVITE_PUBLICO);
      //  (c) gravar Cooperado.consentimentoDocsAceito quando consentimentoDocs=true.
      token?: string;
      consentimentoDocs?: boolean;
      // Sprint Convênio-Token-Cooperado (20/06/2026) — slice "recebe créditos
      // GD como DADO". Cliente declara que já recebe créditos de geração
      // distribuída (outra cooperativa/gerador). Aditivo, opcional, default
      // false. NÃO bloqueia o cadastro — é dado defensivo anti-double-count
      // SCEE + insumo pra futuro fluxo de migração (Fase 3 do convênio).
      jaRecebeCreditosGd?: boolean;
      fornecedorGdAtual?: string;
    },
    cooperativaId: string,
    // Sprint Funil M48 (22/06/2026) — resultado advisory do roteador A/B/C
    // decidido pelo caller (cadastroWeb). Persistido em 4 campos aditivos no
    // Cooperado.create. Opcional pra retro-compat com callers internos.
    roteamento?: {
      caminho: string;
      tenantAlvo?: string;
      razao: string;
    },
  ) {
    // Convergência Fatia 1 — gate UNIFICADO via isAmbienteReal() em vez do
    // CADASTRO_VALIDACOES_ATIVAS legado. Fecha D-novo-CAD-UC-FALSA +
    // D-novo-CAD-CONSUMO-ZERO. Aceita modo teste (relaxa tudo); REAL strict.
    const normalizado = validarENormalizarCadastro(
      {
        nome: body.nome,
        cpf: body.cpf,
        email: body.email,
        telefone: body.telefone,
        instalacao: body.instalacao,
      },
      { permiteSemUc: body.permiteSemUc },
    );
    const { cpfLimpo, telefoneLimpo, email, nome, numeroUC, strict } = normalizado;

    // PASSO 1+2+3 — Criar Cooperado + UC + (opcional) Membro Convênio em
    // transação atômica Serializable.
    //
    // D-novo-CADWEB-CONV-MEMBRO (05/06/2026) — quando vem via convite público
    // (?conv=), consume-once + criação de Membro PENDENTE_APROVACAO_EMPRESA +
    // magic link da empresa ficam DENTRO do mesmo tx que cria Cooperado/UC.
    // Atomicidade total: se qualquer passo falhar, rollback nativo do Postgres
    // reverte tudo (zero estado órfão: cooperado sem membro, convite consumido
    // sem membro, magic link sem cooperado). Espelha o padrão consolidado em
    // /auto-inscrever:710-792 (Fatia 2c.1) — mesma decisão arquitetural.
    const { cooperadoId, ucId, membroId: _membroIdCriado } = await this.prisma.$transaction(
      async (tx) => {
      // (0) Resolve + consume-once do convite quando vem via ?conv=. Falha
      // aqui aborta tudo antes de criar Cooperado órfão.
      let conviteResolved: { id: string; convenioId: string } | null = null;
      if (body.token && body.origem === 'CONVITE_PUBLICO') {
        const convite = await tx.conviteConvenioMembro.findUnique({
          where: { token: body.token },
          select: { id: true, convenioId: true, usedAt: true, expiresAt: true },
        });
        if (!convite) {
          throw new BadRequestException('Convite inválido ou expirado.');
        }
        if (convite.usedAt) {
          throw new ConflictException('Convite já utilizado.');
        }
        if (convite.expiresAt <= new Date()) {
          throw new BadRequestException('Convite expirado.');
        }
        // Consume-once: where {id, usedAt:null} + update → P2025 em race com
        // 2º POST concorrente. Em Serializable os POSTs serializam OU um aborta
        // com 40001 (capturado fora do try).
        try {
          await tx.conviteConvenioMembro.update({
            where: { id: convite.id, usedAt: null },
            data: { usedAt: new Date() },
          });
        } catch (err: any) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            throw new ConflictException('Convite já utilizado.');
          }
          throw err;
        }
        conviteResolved = { id: convite.id, convenioId: convite.convenioId };
      }

      let cooperado;
      try {
        // Sprint 8A: propagar modoRemuneracao do cadastro público
        const modoRemuneracao =
          body.planoSelecionado === 'FATURA_CHEIA_TOKEN' && body.aceitaClube
            ? 'CLUBE'
            : 'DESCONTO';

        // Convergência Fatia 1: tipoCooperado discrimina o caminho. Quando
        // permiteSemUc + numeroUC=null, cria SEM_UC (slim path). Senão COM_UC
        // padrão (caminho /cadastro completo).
        const tipoCooperado = body.permiteSemUc && numeroUC === null ? 'SEM_UC' : 'COM_UC';

        // Sprint Onboarding Bloco 1 Fatia 1.2 (06/06/2026) — capturar cota
        // mensal do cooperado no cadastro. Antes era descartado (motor
        // recebia via body via outro caminho); agora persistimos pra a
        // aprovação (Fatia 1.3) reconstruir o membro mesmo sem o body.
        //
        // Regra: consumoMedioKwh ?? média(historicoConsumo). Se ambos vazios,
        // grava 0 (motor falha → pendência visível Fatia 1.3).
        const cotaKwhMensal = derivarCotaKwhMensal({
          consumoMedioKwh: body.instalacao?.consumoMedioKwh,
          historicoConsumo: body.historicoConsumo,
        });

        cooperado = await tx.cooperado.create({
          data: {
            nomeCompleto: nome.trim(),
            cpf: cpfLimpo,
            email: email.trim(),
            telefone: telefoneLimpo || undefined,
            status: 'PENDENTE',
            tipoCooperado,
            cooperativaId,
            modoRemuneracao: modoRemuneracao as any,
            termoAdesaoAceito: true,
            termoAdesaoAceitoEm: new Date(),
            // Fatia 1.2 — cota mensal gravada na fonte (não descarta mais o OCR).
            ...(cotaKwhMensal > 0 ? { cotaKwhMensal } : {}),
            // Convergência Fatia 2 — checkbox LGPD docs (RG/selfie) do Step 3.
            // Aceito apenas quando o caller (frontend wizard) marca explícito.
            ...(body.consentimentoDocs
              ? {
                  consentimentoDocsAceito: true,
                  consentimentoDocsAceitoEm: new Date(),
                }
              : {}),
            // Sprint Convênio-Token-Cooperado (20/06/2026) — slice "recebe
            // créditos GD como DADO". Persiste declaração do cliente quando
            // vem do frontend. Schema tem default(false), então só set
            // explícito se body trouxe; idem fornecedor (String? nullable).
            ...(body.jaRecebeCreditosGd === true
              ? { jaRecebeCreditosGd: true }
              : {}),
            ...(body.fornecedorGdAtual && body.fornecedorGdAtual.trim()
              ? { fornecedorGdAtual: body.fornecedorGdAtual.trim() }
              : {}),
            // Sprint Funil M48 (22/06/2026) — Camada 1 Motor Roteador A/B/C
            // (advisory). 4 campos persistidos quando o caller passou.
            ...(roteamento
              ? {
                  roteamentoCaminho: roteamento.caminho,
                  roteamentoTenantAlvo: roteamento.tenantAlvo ?? null,
                  roteamentoRazao: roteamento.razao,
                  roteamentoDecididoEm: new Date(),
                }
              : {}),
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ConflictException('CPF já cadastrado');
        }
        throw err;
      }

      // Convergência Fatia 1 (04/06/2026) — REMOVIDO o fallback fake
      // `'UC-' + Date.now()` (D-novo-CAD-UC-FALSA P1). numeroUC=null vindo
      // do helper SÓ acontece quando permiteSemUc=true (caso contrário o
      // helper lança BadRequestException). Nesse caso cria UC SINTÉTICA
      // explícita (tipoUc=SINTETICA) que NUNCA recebe fatura nem entra em
      // listas de envio à concessionária.
      let uc;
      if (numeroUC === null) {
        // Caminho SEM_UC explícito (slim path com permiteSemUc=true)
        uc = await tx.uc.create({
          data: {
            numero: `SINTETICA-${cooperado.id}`,
            tipoUc: 'SINTETICA' as any,
            endereco: body.endereco?.logradouro
              ? `${body.endereco.logradouro}, ${body.endereco.numero}`
              : '(sem endereço — UC sintética)',
            cidade: body.endereco?.cidade ?? '',
            estado: body.endereco?.estado ?? '',
            cooperadoId: cooperado.id,
            cep: body.endereco?.cep || undefined,
            bairro: body.endereco?.bairro || undefined,
            distribuidora: 'OUTRAS',
          },
        });
      } else {
        // Caminho COM_UC normal — numeroUC já validado e normalizado
        const numeroUCLegadoRaw = (body.instalacao.numeroUCLegado || '').replace(/\D/g, '');
        const numeroUCFinal = numeroUCLegadoRaw
          ? numeroUCLegadoRaw.slice(-9).padStart(9, '0')
          : undefined;

        const numeroOriginalRaw = (body.instalacao.numeroConcessionariaOriginal || '').trim();
        const numeroConcessionariaOriginal =
          numeroOriginalRaw && numeroOriginalRaw.length <= 50 ? numeroOriginalRaw : undefined;

        uc = await tx.uc.create({
          data: {
            numero: numeroUC,
            tipoUc: 'NORMAL' as any,
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
      }

      // D-novo-CADWEB-CONV-MEMBRO — cria Membro PENDENTE_APROVACAO_EMPRESA +
      // magic link da empresa dentro do MESMO tx. adicionarMembro com tx +
      // origem=CONVITE_PUBLICO faz: status PENDENTE_APROVACAO_EMPRESA,
      // ativo=false, cria AprovacaoConvenioMembro (magic link), pula MLM e
      // recálculo de faixa (custeio puro). Cross-ref convite→membro fecha o
      // ciclo (usedAt + membroId apontam um pro outro).
      let membroIdCriado: string | null = null;
      if (conviteResolved) {
        const membro = await this.conveniosMembros.adicionarMembro(
          conviteResolved.convenioId,
          cooperado.id,
          undefined,
          tx,
          'CONVITE_PUBLICO',
        );
        membroIdCriado = membro.id;
        await tx.conviteConvenioMembro.update({
          where: { id: conviteResolved.id },
          data: { membroId: membro.id },
        });
      }

      return { cooperadoId: cooperado.id, ucId: uc.id, membroId: membroIdCriado };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!strict) {
      this.logger.warn(
        `[cadastro-v2] DEV/teste relaxed — cooperadoId=${cooperadoId} nome="${nome}" ` +
          `numeroUC=${numeroUC ?? 'SINTETICA'}. Em PROD essas validações seriam strict.`,
      );
    }

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

      // Sprint Onboarding Bloco 1 Fatia 1.2 (06/06/2026) — não engolir erro.
      // Grava pendência VISÍVEL no cooperado pra admin ver "Cadastro
      // incompleto" na listagem/detalhe (selo amarelo). Limpa na Fatia 1.3
      // quando construirMembroCompleto cria o contrato.
      // Best-effort (fora do tx do Cooperado): se gravação da pendência
      // falhar, log mas não derruba o cadastro — admin pode usar a
      // reconciliação manual da Fatia 1.4.
      try {
        await this.prisma.cooperado.update({
          where: { id: cooperadoId },
          data: {
            pendenciaMotorMsg: msg.slice(0, 500),
            pendenciaMotorEm: new Date(),
          },
        });
      } catch (gravarErr: unknown) {
        const gMsg = gravarErr instanceof Error ? gravarErr.message : 'erro';
        this.logger.warn(
          `[cadastro-v2] Falha ao gravar pendenciaMotorMsg para ${cooperadoId}: ${gMsg}`,
        );
      }
    }

    // Sprint Onboarding Bloco 1 Fatia 1.2 (06/06/2026) — stash do consumo
    // (best-effort, fora do tx). Permite reconciliação futura (Fatia 1.4)
    // reconstruir membro oco sem reupload de fatura. Decisão Luciano:
    // persistir JSON leve aqui em vez de FaturaProcessada completa (esta
    // exige 28 campos + pipeline OCR — fica como D-novo-CADWEB-FATURA-
    // PROCESSADA P3).
    try {
      const temAlgoPraStash =
        body.instalacao?.consumoMedioKwh ||
        (body.historicoConsumo && body.historicoConsumo.length > 0) ||
        body.valorUltimaFatura;
      if (temAlgoPraStash) {
        await this.prisma.cooperado.update({
          where: { id: cooperadoId },
          data: {
            consumoStashOcr: {
              consumoMedioKwh: body.instalacao?.consumoMedioKwh ?? null,
              historicoConsumo: body.historicoConsumo ?? [],
              valorUltimaFatura: body.valorUltimaFatura ?? null,
              dadosOcr: (body as any).dadosOcr ?? null,
              capturadoEm: new Date().toISOString(),
              fonteRota: 'cadastroWebV2',
            },
          },
        });
      }
    } catch (err: unknown) {
      const sMsg = err instanceof Error ? err.message : 'erro';
      this.logger.warn(`[cadastro-v2] stash consumoStashOcr falhou pra ${cooperadoId}: ${sMsg}`);
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

    // Convergência Fatia 2 (04/06/2026) — doc-move: blobs tmp do convite
    // foram colados em tmp/convite-uploads/<conviteId>/. Agora que o Cooperado
    // existe, MOVE pra path final cooperados/<id>/ + cria DocumentoCooperado
    // (RG/SELFIE; FATURA só move o blob, não cria registro de KYC).
    // Best-effort: falha não derruba o cadastro (admin pode subir manual).
    let docsResult: { movidos: number; documentos: number; falhas: number } | null = null;
    if (body.token && body.token.length === 64) {
      try {
        const convite = await this.prisma.conviteConvenioMembro.findUnique({
          where: { token: body.token },
          select: { id: true },
        });
        if (convite) {
          docsResult = await this.cadastroUpload.moverUploadsConviteParaCooperado(
            convite.id,
            cooperadoId,
          );
        }
      } catch (err: any) {
        this.logger.warn(
          `[cadastro-v2] doc-move falhou pra cooperado=${cooperadoId} token=...${body.token.slice(-6)}: ${err?.message ?? 'erro'}`,
        );
      }
    }

    this.logger.log(
      `[cadastro-v2] Cooperado ${cooperadoId} criado ` +
        `(proposta=${propostaId ?? 'nenhuma'}, espera=${emListaEspera}` +
        `${docsResult ? `, docs movidos=${docsResult.movidos} kyc=${docsResult.documentos}` : ''})`,
    );
    return {
      ok: true,
      data: {
        cooperadoId,
        ucId,
        propostaId,
        emListaEspera,
        ...(docsResult ? { docs: docsResult } : {}),
      },
    };
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

  // FIX A.2 Frente 2 vitrines mínimas (01/07/2026) — dispara no caminho V2
  // quando o motor roteador M48 classifica como A_MIGRACAO ou AMBIGUO_ADMIN.
  // Public pra viabilizar mock em specs Jest do wiring.
  async notificarAdminRoteamentoCaptacao(params: {
    cooperadoId: string;
    nome: string;
    numeroUC?: string;
    caminho: string;
    razao: string;
  }) {
    const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER ?? '5527981341348';
    const { cooperadoId, nome, numeroUC, caminho, razao } = params;

    const cabecalho =
      caminho === 'A_MIGRACAO'
        ? '🎯 Novo lead de CAPTAÇÃO detectado pelo motor!'
        : '❓ Novo cadastro AMBÍGUO — revisar!';

    const rodape =
      caminho === 'A_MIGRACAO'
        ? 'Vendas: entrar em contato para proposta de migração.'
        : 'Admin: revisar manualmente — motor não conseguiu decidir.';

    const msg =
      `${cabecalho}\n` +
      `Nome: ${nome}\n` +
      `UC: ${numeroUC || 'não informada'}\n` +
      `Cooperado ID: ${cooperadoId}\n` +
      `Razão: ${razao}\n` +
      rodape;

    try {
      await this.sender.enviarMensagem(adminPhone, msg);
      this.logger.log(
        `Notificação de roteamento (${caminho}) enviada ao admin para cooperado ${cooperadoId}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      this.logger.error(
        `Falha ao enviar notificação admin roteamento (${caminho}): ${message}`,
      );
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
    motivo?: OcrFalhaMotivo;
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
      } catch (e: unknown) {
        return this.respostaOcrFalha(e);
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
          // D-novo-OCR-UC-PREFILL (05/06/2026) — expor as 3 variantes de UC.
          // Antes só `numeroUC` (legado 9 díg) era retornado; faturas EDP-ES
          // atuais trazem o número predominantemente em formato `numeroConcessionariaOriginal`
          // (com pontos, ex `0.000.374.127.054-59`), com o legado ausente. Resultado:
          // form ficava vazio e quebrava o golden path do convite. Frontend usa
          // `mapearOcrParaInstalacao` (web/lib/ocr-mapping.ts) com prioridade
          // canônico → legado → dígitos-do-original.
          numero: dadosExtraidos.numero || '',
          numeroUC: dadosExtraidos.numeroUC || '',
          numeroConcessionariaOriginal: dadosExtraidos.numeroConcessionariaOriginal || '',
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
      return this.respostaOcrFalha(err);
    }
  }

  /**
   * D-novo-OCR-RESILIENCIA (05/06/2026) — converte erro do OCR em payload
   * estruturado com `motivo` categorizado pra UI decidir a mensagem.
   *
   * Mensagens diferenciam:
   * - `anthropic-overload` / `anthropic-rate-limit` / `anthropic-server` /
   *   `timeout` → recuperáveis: UI sugere tentar de novo.
   * - `response-truncated` / `response-invalid-json` / `unknown` → terminais
   *   nesta tentativa: UI orienta preencher manualmente.
   */
  private respostaOcrFalha(err: unknown): {
    sucesso: false;
    mensagem: string;
    motivo: OcrFalhaMotivo;
    dados: Record<string, unknown>;
  } {
    if (err instanceof OcrFalhaError) {
      this.logger.warn(
        `OCR fatura pública falhou: motivo=${err.motivo} status=${err.status} requestId=${err.requestId} tamanhoBase64=${err.tamanhoBase64} message="${err.message.slice(0, 250)}"`,
      );
      return {
        sucesso: false,
        mensagem: this.mensagemPorMotivo(err.motivo),
        motivo: err.motivo,
        dados: {},
      };
    }
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    this.logger.warn(`OCR fatura pública falhou (não categorizado): ${message}`);
    return {
      sucesso: false,
      mensagem: 'Leitura automática não disponível. Preencha manualmente.',
      motivo: 'unknown',
      dados: {},
    };
  }

  private mensagemPorMotivo(motivo: OcrFalhaMotivo): string {
    switch (motivo) {
      case 'anthropic-overload':
        return 'Serviço de leitura ocupado agora. Tente de novo em ~30 segundos.';
      case 'anthropic-rate-limit':
        return 'Muitas leituras em sequência. Aguarde ~30 segundos e tente de novo.';
      case 'anthropic-server':
      case 'timeout':
        return 'Falha temporária na leitura. Tente de novo em alguns segundos.';
      case 'response-truncated':
      case 'response-invalid-json':
      case 'unknown':
      default:
        return 'Leitura automática não disponível. Preencha manualmente.';
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
      // Sprint Convênio-Token-Cooperado (20/06/2026) — slice "recebe créditos
      // GD como DADO". Caminho SEM_UC é especialmente relevante pro cenário do
      // parecer 19/06 "cliente migra de cooperativa concorrente" — esses
      // chegam frequentemente já recebendo créditos GD.
      jaRecebeCreditosGd?: boolean;
      fornecedorGdAtual?: string;
    },
    @Query('tenant') tenantParam?: string,
  ) {
    // Sprint Hardening Tenant-Spoof (20/06/2026) —
    // D-novo-CADASTRO-PUBLICO-TENANT-SPOOF P1. Tenant vem SÓ de
    // ?tenant=<cooperativaId> validado contra Cooperativa ativa.
    // body.cooperativaId é DESCARTADO (compat-only, ignorado).
    if (!tenantParam) {
      throw new BadRequestException('Query param ?tenant=<cooperativaId> é obrigatório');
    }
    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: tenantParam },
      select: { id: true, ativo: true },
    });
    if (!coop || !coop.ativo) {
      throw new NotFoundException('Cooperativa não encontrada ou inativa.');
    }
    const cooperativaId = coop.id;
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
          // Sprint Convênio-Token-Cooperado (20/06/2026) — slice GD como DADO.
          ...(body.jaRecebeCreditosGd === true
            ? { jaRecebeCreditosGd: true }
            : {}),
          ...(body.fornecedorGdAtual && body.fornecedorGdAtual.trim()
            ? { fornecedorGdAtual: body.fornecedorGdAtual.trim() }
            : {}),
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
