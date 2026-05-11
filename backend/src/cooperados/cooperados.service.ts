/// <reference types="multer" />
import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { Prisma, StatusCooperado, TipoCooperado } from '@prisma/client';
import { CadastroCompletoDto } from './dto/cadastro-completo.dto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma.service';
import { coerceDistribuidora } from '../ucs/ucs.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { UsinasService } from '../usinas/usinas.service';
import { WhatsappCicloVidaService } from '../whatsapp/whatsapp-ciclo-vida.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { EmailService } from '../email/email.service';
import { FaturaMensalDto } from './dto/fatura-mensal.dto';
import { FaturasService } from '../faturas/faturas.service';
import * as jwt from 'jsonwebtoken';
import { getJwtSecret } from '../auth/jwt-secret';
import { calcularTarifaContratual, BaseCalculo } from '../motor-proposta/lib/calcular-tarifa-contratual';

const BUCKET = 'documentos-cooperados';

@Injectable()
export class CooperadosService {
  private supabase: SupabaseClient;

  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
    private usinasService: UsinasService,
    private whatsappCicloVida: WhatsappCicloVidaService,
    private whatsappSender: WhatsappSenderService,
    private emailService: EmailService,
    private faturasService: FaturasService,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
  }

  async meuPerfil(usuario: { id: string; email: string; cpf?: string }) {
    const where: any[] = [];
    if (usuario.email) where.push({ email: usuario.email });
    if (usuario.cpf) where.push({ cpf: usuario.cpf });
    if (where.length === 0) throw new NotFoundException('Cooperado não encontrado para este usuário');

    const cooperado = await this.prisma.cooperado.findFirst({
      where: { OR: where },
      include: {
        ucs: true,
        contratos: {
          where: { status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
          include: {
            plano: true,
            uc: true,
            usina: { select: { nome: true } },
            cobrancas: { orderBy: { dataVencimento: 'desc' }, take: 6 },
          },
        },
        documentos: {
          where: { status: { in: ['PENDENTE', 'REPROVADO'] } },
          orderBy: { createdAt: 'desc' },
        },
        indicacoesFeitas: {
          include: {
            cooperadoIndicado: {
              select: { nomeCompleto: true, status: true, createdAt: true },
            },
          },
        },
        beneficiosIndicacao: {
          where: { status: 'APLICADO' },
          select: { valorCalculado: true },
        },
      },
    });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado para este usuário');

    const c = cooperado as any;
    // Calcular resumo
    const contratoAtivo = c.contratos.find((ct: any) => ct.status === 'ATIVO');
    const todasCobrancas = c.contratos.flatMap((ct: any) => ct.cobrancas);
    const cobrancasPendentes = todasCobrancas.filter((cb: any) => cb.status === 'A_VENCER' || cb.status === 'VENCIDO');
    const proximaCobranca = todasCobrancas.find((cb: any) => cb.status === 'A_VENCER');

    return {
      ...cooperado,
      resumo: {
        descontoAtual: contratoAtivo ? Number(contratoAtivo.percentualDesconto) : null,
        proximoVencimento: proximaCobranca?.dataVencimento ?? null,
        statusConta: cooperado.status,
        kwhAlocados: Number(cooperado.cotaKwhMensal ?? 0),
        documentosPendentes: c.documentos.length,
        faturasPendentes: cobrancasPendentes.length,
      },
    };
  }

  /** UCs do cooperado logado */
  async minhasUcs(usuario: { id: string; email: string; cpf?: string }) {
    const cooperado = await this.findCooperadoByUsuario(usuario);
    return this.prisma.uc.findMany({
      where: { cooperadoId: cooperado.id },
      include: {
        contratos: {
          where: { status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
          select: { percentualDesconto: true, status: true },
          take: 1,
        },
        faturasProcessadas: {
          select: { mediaKwhCalculada: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Cobranças do cooperado logado */
  async minhasCobrancas(usuario: { id: string; email: string; cpf?: string }, ucId?: string) {
    const cooperado = await this.findCooperadoByUsuario(usuario);
    const contratoWhere: any = { cooperadoId: cooperado.id };
    if (ucId) contratoWhere.ucId = ucId;
    return this.prisma.cobranca.findMany({
      where: {
        contrato: { is: contratoWhere },
      },
      include: {
        contrato: { select: { numero: true, uc: { select: { numero: true } } } },
        asaasCobrancas: { select: { boletoUrl: true, linkPagamento: true }, take: 1 },
      },
      orderBy: { dataVencimento: 'desc' },
      take: 24,
    });
  }

  /** Documentos do cooperado logado (todos os status) */
  async meusDocumentos(usuario: { id: string; email: string; cpf?: string }) {
    const cooperado = await this.findCooperadoByUsuario(usuario);
    return this.prisma.documentoCooperado.findMany({
      where: { cooperadoId: cooperado.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Contratos do cooperado logado */
  async meusContratos(usuario: { id: string; email: string; cpf?: string }) {
    const cooperado = await this.findCooperadoByUsuario(usuario);
    return this.prisma.contrato.findMany({
      where: { cooperadoId: cooperado.id },
      include: {
        uc: { select: { numero: true, endereco: true } },
        usina: { select: { nome: true } },
        plano: { select: { nome: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Solicitar desligamento — cria ocorrência tipo DESLIGAMENTO */
  async solicitarDesligamento(
    usuario: { id: string; email: string; cpf?: string },
    dto: { motivo: string; observacao?: string },
  ) {
    const cooperado = await this.findCooperadoByUsuario(usuario);

    // Verificar se já tem pedido de desligamento aberto
    const existente = await this.prisma.ocorrencia.findFirst({
      where: { cooperadoId: cooperado.id, tipo: 'DESLIGAMENTO', status: { in: ['ABERTA', 'EM_ANDAMENTO'] } },
    });
    if (existente) {
      throw new BadRequestException('Já existe uma solicitação de desligamento em andamento.');
    }

    const ocorrencia = await this.prisma.ocorrencia.create({
      data: {
        cooperadoId: cooperado.id,
        cooperativaId: cooperado.cooperativaId ?? undefined,
        tipo: 'DESLIGAMENTO',
        descricao: `Motivo: ${dto.motivo}${dto.observacao ? `. Observação: ${dto.observacao}` : ''}`,
        prioridade: 'ALTA',
      },
    });

    await this.notificacoes.criar({
      tipo: 'SOLICITACAO',
      titulo: 'Solicitação de desligamento',
      mensagem: `${cooperado.nomeCompleto} solicitou desligamento. Motivo: ${dto.motivo}`,
      cooperadoId: cooperado.id,
      link: `/dashboard/ocorrencias`,
    });

    return { protocolo: ocorrencia.id, criadoEm: ocorrencia.createdAt };
  }

  /** Helper: busca cooperado pelo JWT */
  async findCooperadoByUsuarioPublic(usuario: { id: string; email: string; cpf?: string }) {
    return this.findCooperadoByUsuario(usuario);
  }

  private async findCooperadoByUsuario(usuario: { id: string; email: string; cpf?: string }) {
    const where: any[] = [];
    if (usuario.email) where.push({ email: usuario.email });
    if (usuario.cpf) where.push({ cpf: usuario.cpf });
    if (where.length === 0) throw new NotFoundException('Cooperado não encontrado para este usuário');
    const cooperado = await this.prisma.cooperado.findFirst({ where: { OR: where } });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado para este usuário');
    return cooperado;
  }

  async atualizarMeuPerfil(usuario: { id: string; email: string; cpf?: string }, dto: any) {
    const cooperado = await this.findCooperadoByUsuario(usuario);

    // Apenas campos seguros para o próprio cooperado editar
    const dadosPermitidos: any = {};
    if (dto.nomeCompleto) dadosPermitidos.nomeCompleto = dto.nomeCompleto;
    if (dto.email) dadosPermitidos.email = dto.email;
    if (dto.telefone) dadosPermitidos.telefone = dto.telefone;

    return this.prisma.cooperado.update({
      where: { id: cooperado.id },
      data: dadosPermitidos,
    });
  }

  /** Upload de documento pelo próprio cooperado (role COOPERADO) */
  async uploadMeuDocumento(
    usuario: { id: string; email: string; cpf?: string },
    tipo: string,
    arquivo: Express.Multer.File,
  ) {
    if (!arquivo) throw new BadRequestException('Arquivo obrigatório.');
    if (!tipo) throw new BadRequestException('Tipo de documento obrigatório.');

    const cooperado = await this.findCooperadoByUsuario(usuario);
    const ext = arquivo.originalname.split('.').pop() ?? 'bin';
    const storagePath = `${cooperado.id}/${tipo}_${Date.now()}.${ext}`;

    const { error } = await this.supabase.storage
      .from(BUCKET)
      .upload(storagePath, arquivo.buffer, { contentType: arquivo.mimetype });
    if (error) throw new BadRequestException(`Erro no upload: ${error.message}`);

    const { data: urlData } = this.supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    const existing = await this.prisma.documentoCooperado.findUnique({
      where: { cooperadoId_tipo: { cooperadoId: cooperado.id, tipo: tipo as any } },
    });

    const doc = existing
      ? await this.prisma.documentoCooperado.update({
          where: { id: existing.id },
          data: { url: urlData.publicUrl, nomeArquivo: arquivo.originalname, tamanhoBytes: arquivo.size, status: 'PENDENTE', motivoRejeicao: null },
        })
      : await this.prisma.documentoCooperado.create({
          data: { cooperadoId: cooperado.id, tipo: tipo as any, url: urlData.publicUrl, nomeArquivo: arquivo.originalname, tamanhoBytes: arquivo.size, status: 'PENDENTE' },
        });

    await this.notificacoes.criar({
      tipo: 'NOVO_DOCUMENTO',
      titulo: 'Novo documento enviado',
      mensagem: `Documento ${tipo} enviado pelo cooperado ${cooperado.nomeCompleto} para aprovação.`,
      cooperadoId: cooperado.id,
      link: `/dashboard/cooperados/${cooperado.id}`,
    });

    return doc;
  }

  async findAll(cooperativaId?: string, limit?: number, offset?: number, search?: string, administradoraId?: string) {
    const where: any = {};
    if (cooperativaId) where.cooperativaId = cooperativaId;
    if (administradoraId) where.administradoraId = administradoraId;
    if (search) where.OR = [
      { nomeCompleto: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { telefone: { contains: search } },
      { cpf: { contains: search } },
    ];

    const cooperados = await this.prisma.cooperado.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit ? Number(limit) : undefined,
      skip: offset ? Number(offset) : undefined,
      include: {
        cooperativa: cooperativaId ? false : { select: { nome: true, tipoParceiro: true } },
        contratos: {
          where: { status: { in: ['PENDENTE_ATIVACAO', 'ATIVO', 'LISTA_ESPERA'] } },
          include: { usina: { select: { nome: true } } },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        progressaoClube: {
          select: { nivelAtual: true, indicadosAtivos: true, beneficioPercentualAtual: true },
        },
        _count: {
          select: {
            faturasProcessadas: true,
            contratos: { where: { status: { in: ['PENDENTE_ATIVACAO', 'ATIVO', 'LISTA_ESPERA'] } } },
          },
        },
      },
    });

    // Calcular checklist resumido para cada cooperado
    const ids = cooperados.map(c => c.id);
    const [docsAprovados, propostasAceitas] = await Promise.all([
      this.prisma.documentoCooperado.groupBy({
        by: ['cooperadoId'],
        where: { cooperadoId: { in: ids }, status: 'APROVADO' },
        _count: true,
      }),
      this.prisma.propostaCooperado.groupBy({
        by: ['cooperadoId'],
        where: { cooperadoId: { in: ids }, status: 'ACEITA' },
        _count: true,
      }),
    ]);

    const docsMap = new Map(docsAprovados.map(d => [d.cooperadoId, d._count]));
    const propMap = new Map(propostasAceitas.map(p => [p.cooperadoId, p._count]));

    return cooperados.map(c => {
      const contrato = c.contratos[0] ?? null;
      const isSemUC = c.tipoCooperado === 'SEM_UC';
      const faturaOk = c._count.faturasProcessadas > 0;
      const docOk = (docsMap.get(c.id) ?? 0) > 0;
      const contratoOk = c._count.contratos > 0;
      const propostaOk = (propMap.get(c.id) ?? 0) > 0;

      const ativoRecebendo = c.status === 'ATIVO_RECEBENDO_CREDITOS';
      const checklistTotal = isSemUC ? 2 : 5;
      const checklistFeito = isSemUC
        ? (docOk ? 1 : 0) + (c.termoAdesaoAceito ? 1 : 0)
        : (faturaOk ? 1 : 0) + (docOk ? 1 : 0) + (contratoOk ? 1 : 0) + (propostaOk ? 1 : 0) + (ativoRecebendo ? 1 : 0);

      const checklistItems = isSemUC
        ? [
            { label: 'Documento aprovado', ok: docOk },
            { label: 'Termo de adesão aceito', ok: !!c.termoAdesaoAceito },
          ]
        : [
            { label: 'Fatura processada', ok: faturaOk },
            { label: 'Documento aprovado', ok: docOk },
            { label: 'Contrato criado', ok: contratoOk },
            { label: 'Proposta aceita', ok: propostaOk },
            { label: 'Ativo — Recebendo créditos', ok: ativoRecebendo },
          ];

      return {
        id: c.id,
        nomeCompleto: c.nomeCompleto,
        cpf: c.cpf,
        email: c.email,
        telefone: c.telefone,
        status: c.status,
        tipoCooperado: c.tipoCooperado,
        cotaKwhMensal: c.cotaKwhMensal,
        usinaVinculada: contrato?.usina?.nome ?? null,
        statusContrato: contrato?.status ?? null,
        kwhContrato: contrato ? Number(contrato.kwhContrato ?? 0) : null,
        reajusteRecente: contrato?.ultimoReajusteEm ? new Date(contrato.ultimoReajusteEm).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000 : false,
        checklist: `${checklistFeito}/${checklistTotal}`,
        checklistPronto: checklistFeito === checklistTotal,
        checklistItems,
        createdAt: c.createdAt,
        progressaoClube: (c as any).progressaoClube ?? null,
        // SUPER_ADMIN: info do parceiro (quando sem filtro cooperativaId)
        ...(!cooperativaId && (c as any).cooperativa ? {
          nomeParceiro: (c as any).cooperativa.nome,
          tipoParceiro: (c as any).cooperativa.tipoParceiro,
          cooperativaId: c.cooperativaId,
        } : {}),
      };
    });
  }

  async findOne(id: string, cooperativaId?: string) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id },
      include: {
        ucs: true,
        contratos: {
          include: {
            plano: true,
            uc: true,
            usina: true,
            cobrancas: { orderBy: { mesReferencia: 'desc' }, take: 12 },
          },
        },
        documentos: { orderBy: { createdAt: 'desc' } },
        ocorrencias: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!cooperado) throw new NotFoundException(`Cooperado com id ${id} não encontrado`);
    if (cooperativaId && cooperado.cooperativaId !== cooperativaId) {
      throw new NotFoundException(`Cooperado com id ${id} não encontrado`);
    }
    return cooperado;
  }

  async create(data: {
    nomeCompleto: string;
    cpf: string;
    email: string;
    telefone?: string;
    status?: StatusCooperado;
    preferenciaCobranca?: string;
    tipoCooperado?: TipoCooperado;
    termoAdesaoAceito?: boolean;
    termoAdesaoAceitoEm?: Date;
    tipoPessoa?: string;
    representanteLegalNome?: string;
    representanteLegalCpf?: string;
    representanteLegalCargo?: string;
    cooperativaId?: string;
    usinaPropriaId?: string;
    percentualRepasse?: number;
  }) {
    let cooperado;
    try {
      cooperado = await this.prisma.cooperado.create({ data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = (err.meta?.target as string[]) ?? [];
        if (target.includes('email')) {
          throw new ConflictException('Email já cadastrado');
        }
        throw new ConflictException('CPF já cadastrado');
      }
      throw err;
    }

    if (process.env.NOTIFICACOES_ATIVAS === 'true') {
      this.whatsappCicloVida.notificarMembroCriado(cooperado).catch(() => {});
      this.emailService.enviarBoasVindas(cooperado).catch(() => {});
    }

    return cooperado;
  }

  /**
   * Cadastro completo atômico: cooperado + UC + contrato (ou lista de espera)
   * em uma única transação Prisma. Rollback automático se qualquer etapa falhar.
   */
  async cadastroCompleto(dto: CadastroCompletoDto, cooperativaId?: string) {
    const SERIALIZABLE_TX = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Criar cooperado
      const cooperado = await tx.cooperado.create({
        data: {
          nomeCompleto: dto.nomeCompleto,
          cpf: dto.cpf,
          email: dto.email,
          telefone: dto.telefone,
          status: dto.status ?? 'PENDENTE',
          tipoPessoa: dto.tipoPessoa,
          tipoCooperado: dto.tipoCooperado,
          representanteLegalNome: dto.representanteLegalNome,
          representanteLegalCpf: dto.representanteLegalCpf,
          representanteLegalCargo: dto.representanteLegalCargo,
          cooperativaId: dto.cooperativaId || cooperativaId,
          preferenciaCobranca: dto.preferenciaCobranca,
          cotaKwhMensal: dto.cotaKwhMensal ?? undefined,
        },
      });

      // 2. Criar UC (se fornecida)
      let uc: any = null;
      if (dto.uc) {
        uc = await tx.uc.create({
          data: {
            numero: dto.uc.numero,
            endereco: dto.uc.endereco,
            cidade: dto.uc.cidade,
            estado: dto.uc.estado,
            cep: dto.uc.cep,
            bairro: dto.uc.bairro,
            numeroUC: dto.uc.numeroUC,
            distribuidora: coerceDistribuidora(dto.uc.distribuidora),
            classificacao: dto.uc.classificacao,
            codigoMedidor: dto.uc.codigoMedidor,
            cooperadoId: cooperado.id,
            cooperativaId: dto.cooperativaId || cooperativaId,
          },
        });
      }

      // 3. Criar contrato (se dados fornecidos e UC existe)
      let contrato: any = null;
      if (dto.contrato && uc) {
        const { usinaId, planoId, dataInicio, percentualDesconto, kwhContrato, kwhContratoAnual } = dto.contrato;

        // 3a. Validar regra ANEEL: mesma distribuidora UC x Usina
        if (usinaId) {
          const usina = await tx.usina.findUnique({ where: { id: usinaId }, select: { distribuidora: true } });
          if (uc.distribuidora && usina?.distribuidora) {
            const ucDist = uc.distribuidora.toUpperCase().trim();
            const usinaDist = usina.distribuidora.toUpperCase().trim();
            if (ucDist !== usinaDist && !ucDist.includes(usinaDist) && !usinaDist.includes(ucDist)) {
              throw new BadRequestException(
                `Distribuidora da UC (${uc.distribuidora}) diverge da usina (${usina.distribuidora}). Regra ANEEL exige mesma distribuidora.`,
              );
            }
          }
        }

        // 3b. Calcular kWh mensal/anual
        let anual = kwhContratoAnual;
        let mensal: number | undefined;
        if (anual) {
          mensal = Math.round((anual / 12) * 100) / 100;
        } else if (kwhContrato) {
          mensal = kwhContrato;
          anual = kwhContrato * 12;
        }

        // 3c. Validar capacidade da usina
        let percentualUsina: number | undefined;
        if (usinaId && anual) {
          const usina = await tx.usina.findUnique({ where: { id: usinaId } });
          if (usina?.capacidadeKwh && Number(usina.capacidadeKwh) > 0) {
            const capacidadeAnual = Number(usina.capacidadeKwh);
            const contratosAtivos = await tx.contrato.findMany({
              where: { usinaId, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
              select: { percentualUsina: true, kwhContratoAnual: true, kwhContrato: true },
            });
            const somaPercentual = contratosAtivos.reduce((acc: number, c: any) => {
              if (c.percentualUsina) return acc + Number(c.percentualUsina);
              const a = c.kwhContratoAnual ? Number(c.kwhContratoAnual) : Number(c.kwhContrato ?? 0) * 12;
              return acc + (a / capacidadeAnual) * 100;
            }, 0);
            const novoPercentual = (anual / capacidadeAnual) * 100;
            if (somaPercentual + novoPercentual > 100.0001) {
              const disponivel = Math.round((100 - somaPercentual) * 10000) / 10000;
              const solicitado = Math.round(novoPercentual * 10000) / 10000;
              throw new BadRequestException(
                `Capacidade da usina insuficiente. Disponível: ${disponivel}%, Solicitado: ${solicitado}%`,
              );
            }
            percentualUsina = Math.round(novoPercentual * 10000) / 10000;
          }
        }

        // 3d. Gerar número do contrato
        const ano = new Date().getFullYear();
        const ultimo = await tx.contrato.findFirst({
          where: { numero: { startsWith: `CTR-${ano}-` } },
          orderBy: { createdAt: 'desc' },
        });
        const seq = ultimo ? parseInt(ultimo.numero.split('-')[2] ?? '0', 10) + 1 : 1;
        const numero = `CTR-${ano}-${String(seq).padStart(4, '0')}`;

        // 3e. Preparar datas
        const dtInicio = new Date(dataInicio + 'T00:00:00.000Z');
        const dtFim = new Date(dtInicio);
        dtFim.setMonth(dtFim.getMonth() + 12);

        // 3f. Snapshots de tarifa (Fase B, Decisão B33). Best-effort: cooperado novo
        // pode não ter fatura processada ainda — nesse caso snapshot fica null e é
        // populado on-demand pela primeira aprovação de fatura/cobrança.
        let tarifaContratualSnap: number | null = null;
        let valorContratoSnap: number | null = null;
        let baseCalculoSnap: string | undefined;
        let tipoDescontoSnap: any | undefined;
        let valorCheioKwhAceiteSnap: number | null = null; // Fase B.5
        if (planoId) {
          const plano = await tx.plano.findUnique({
            where: { id: planoId },
            select: { modeloCobranca: true, baseCalculo: true, tipoDesconto: true },
          });
          const fatura = await tx.faturaProcessada.findFirst({
            where: {
              cooperadoId: cooperado.id,
              valorCheioKwh: { not: null },
              tarifaSemImpostos: { not: null },
            },
            orderBy: { createdAt: 'desc' },
            select: { valorCheioKwh: true, tarifaSemImpostos: true },
          });
          if (plano && fatura) {
            baseCalculoSnap = plano.baseCalculo;
            tipoDescontoSnap = plano.tipoDesconto;
            valorCheioKwhAceiteSnap = Number(fatura.valorCheioKwh); // Fase B.5
            try {
              tarifaContratualSnap = calcularTarifaContratual({
                valorCheioKwh: Number(fatura.valorCheioKwh),
                tarifaSemImpostos: Number(fatura.tarifaSemImpostos),
                baseCalculo: plano.baseCalculo as BaseCalculo,
                descontoPercentual: percentualDesconto,
              });
              if (plano.modeloCobranca === 'FIXO_MENSAL' && mensal) {
                valorContratoSnap = Math.round(tarifaContratualSnap * mensal * 100) / 100;
              }
            } catch {
              // helper lança em COM_ICMS/CUSTOM ou inputs inválidos — segue sem snapshot
            }
          }
        }

        // 3g. Criar contrato
        contrato = await tx.contrato.create({
          data: {
            cooperadoId: cooperado.id,
            ucId: uc.id,
            usinaId,
            planoId,
            numero,
            dataInicio: dtInicio,
            dataFim: dtFim,
            percentualDesconto,
            kwhContrato: mensal ?? kwhContrato,
            kwhContratoAnual: anual,
            kwhContratoMensal: mensal,
            percentualUsina,
            cooperativaId: dto.cooperativaId || cooperativaId,
            ...(tarifaContratualSnap !== null ? { tarifaContratual: tarifaContratualSnap } : {}),
            ...(valorContratoSnap !== null ? { valorContrato: valorContratoSnap } : {}),
            ...(baseCalculoSnap ? { baseCalculoAplicado: baseCalculoSnap } : {}),
            ...(tipoDescontoSnap ? { tipoDescontoAplicado: tipoDescontoSnap } : {}),
            ...(valorCheioKwhAceiteSnap !== null ? { valorCheioKwhAceite: valorCheioKwhAceiteSnap } : {}),
          } as any,
          include: { uc: true, usina: true, plano: true },
        });
      }

      // 4. Lista de espera (se sem usina disponível)
      let listaEspera: any = null;
      if (dto.listaEspera && !dto.contrato) {
        const posicaoAtual = await tx.listaEspera.count({
          where: { status: 'AGUARDANDO', ...(cooperativaId ? { cooperativaId } : {}) },
        });
        listaEspera = await tx.listaEspera.create({
          data: {
            cooperadoId: cooperado.id,
            kwhNecessario: dto.cotaKwhMensal ?? 0,
            posicao: posicaoAtual + 1,
            status: 'AGUARDANDO',
            cooperativaId: cooperativaId || dto.cooperativaId,
          },
        });
      }

      return { cooperado, uc, contrato, listaEspera };
    }, SERIALIZABLE_TX);

    // Side effects fora da transação (não devem causar rollback)
    this.whatsappCicloVida.notificarMembroCriado(result.cooperado).catch(() => {});
    this.emailService.enviarBoasVindas(result.cooperado).catch(() => {});

    if (result.contrato) {
      this.checkProntoParaAtivar(result.cooperado.id).catch(() => {});
      this.whatsappCicloVida.notificarContratoGerado(result.cooperado).catch(() => {});
    }

    return result;
  }

  async update(id: string, data: Partial<{
    nomeCompleto: string;
    email: string;
    telefone: string;
    status: StatusCooperado;
    preferenciaCobranca: string;
    tipoCooperado: TipoCooperado;
    termoAdesaoAceito: boolean;
    termoAdesaoAceitoEm: Date;
    dataInicioCreditos: Date;
    protocoloConcessionaria: string;
    tipoPessoa: string;
    representanteLegalNome: string;
    representanteLegalCpf: string;
    representanteLegalCargo: string;
    usinaPropriaId: string;
    percentualRepasse: number;
    dataNascimento: string;
    razaoSocial: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    estado: string;
  }>) {
    // Converter dataNascimento string → Date se presente
    const prismaData: any = { ...data };
    if (prismaData.dataNascimento && typeof prismaData.dataNascimento === 'string') {
      prismaData.dataNascimento = new Date(prismaData.dataNascimento);
    }

    // Buscar status anterior para lógica condicional
    const anterior = await this.prisma.cooperado.findUnique({
      where: { id },
      select: { status: true, ambienteTeste: true },
    });

    // Sprint 11 Bloco 2 Fase D — guard de ativação
    // Não permite mudar status pra ATIVO se alguma UC do cooperado não tem
    // `numeroUC` preenchido. Esse número (legado 9 díg) é exigido pela EDP nas
    // listas B2B de compensação. Sem ele, cooperado fica "ativo" mas não
    // entra nos relatórios da concessionária — situação inconsistente.
    //
    // Bypass: cooperado em ambienteTeste=true pula a validação (preserva os
    // 337 registros de teste atuais que ainda não têm numeroUC preenchido).
    if (data.status === 'ATIVO' && !anterior?.ambienteTeste) {
      const ucs = await this.prisma.uc.findMany({
        where: { cooperadoId: id },
        select: { id: true, numero: true, numeroUC: true },
      });
      if (ucs.length === 0) {
        throw new BadRequestException(
          'Cooperado não pode ser ativado: nenhuma UC cadastrada. Cadastre ao menos uma UC antes de ativar.',
        );
      }
      const semNumeroUC = ucs.filter(u => !u.numeroUC || String(u.numeroUC).trim() === '');
      if (semNumeroUC.length > 0) {
        const lista = semNumeroUC.map(u => `${u.id} (numero=${u.numero})`).join(', ');
        throw new BadRequestException(
          `Cooperado não pode ser ativado: UC(s) sem numeroUC preenchido — ${lista}. ` +
          `Preencher antes de ativar (vem do portal EDP, ver Sprint 12).`,
        );
      }
    }

    const cooperado = await this.prisma.cooperado.update({
      where: { id },
      data: prismaData,
    });

    // Ativação em cascata: ao ativar cooperado, contratos PENDENTE_ATIVACAO e SUSPENSO → ATIVO
    if (data.status === 'ATIVO') {
      // Usar transação para garantir atomicidade entre cooperado e contratos
      const contratosAtivados = await this.prisma.$transaction(async (tx) => {
        const result = await tx.contrato.updateMany({
          where: { cooperadoId: id, status: { in: ['PENDENTE_ATIVACAO', 'SUSPENSO'] } },
          data: { status: 'ATIVO' },
        });

        if (result.count > 0) {
          const contratos = await tx.contrato.findMany({
            where: { cooperadoId: id, status: 'ATIVO' },
            include: { usina: true },
          });
          for (const c of contratos) {
            if (c.usina && Number(c.usina.capacidadeKwh ?? 0) > 0 && !c.percentualUsina) {
              const percentual = (Number(c.kwhContrato ?? 0) / Number(c.usina.capacidadeKwh)) * 100;
              await tx.contrato.update({
                where: { id: c.id },
                data: { percentualUsina: Math.round(percentual * 10000) / 10000 },
              });
            }
          }
        }
        return result;
      });

      if (contratosAtivados.count > 0) {

        await this.notificacoes.criar({
          tipo: 'COOPERADO_ATIVADO',
          titulo: 'Cooperado ativado',
          mensagem: anterior?.status === 'AGUARDANDO_CONCESSIONARIA'
            ? `${cooperado.nomeCompleto} foi ativado (concessionária efetivou). ${contratosAtivados.count} contrato(s) ativado(s).`
            : `${cooperado.nomeCompleto} foi ativado. ${contratosAtivados.count} contrato(s) passaram para ATIVO.`,
          cooperadoId: id,
          link: `/dashboard/cooperados/${id}`,
        });

        // Notificar via WhatsApp que concessionária aprovou (contrato ativo)
        if (anterior?.status === 'AGUARDANDO_CONCESSIONARIA') {
          this.whatsappCicloVida.notificarConcessionariaAprovada(cooperado).catch(() => {});
        }
      }
    }

    // Suspensão em cascata: ao suspender cooperado, contratos ATIVO → SUSPENSO
    if (data.status === 'SUSPENSO') {
      await this.prisma.contrato.updateMany({
        where: { cooperadoId: id, status: 'ATIVO' },
        data: { status: 'SUSPENSO' },
      });
    }

    // Churn: ao encerrar/suspender cooperado, decrementar indicadosAtivos do indicador
    if (data.status && ['SUSPENSO', 'ENCERRADO'].includes(data.status) && anterior?.status && !['SUSPENSO', 'ENCERRADO'].includes(anterior.status)) {
      await this.decrementarIndicadosAtivosNoChurn(id);
    }

    // Reativação: ao reativar cooperado que estava churned, recalcular indicadosAtivos
    if (data.status === 'ATIVO' && anterior?.status && ['SUSPENSO', 'ENCERRADO'].includes(anterior.status)) {
      await this.reativarIndicacoesNoRetorno(id);
    }

    // Registrar histórico de mudança de status
    if (data.status && anterior?.status && data.status !== anterior.status) {
      await this.prisma.historicoStatusCooperado.create({
        data: {
          cooperadoId: id,
          cooperativaId: cooperado.cooperativaId ?? undefined,
          statusAnterior: anterior.status,
          statusNovo: data.status,
        },
      });
    }

    return cooperado;
  }

  /**
   * Transição AGUARDANDO_CONCESSIONARIA → APROVADO (etapa 11 da jornada).
   *
   * Aplicado em 11/05/2026 (D-J-1 reformulada em 05/05 tarde). Endpoint
   * dedicado pra fechar a UI admin de transição manual. Backend e schema
   * já tinham 80% — esta operação:
   *   - Valida status atual = AGUARDANDO_CONCESSIONARIA
   *   - Valida multi-tenant (ADMIN/OPERADOR só aprova da própria cooperativa;
   *     SUPER_ADMIN bypassa)
   *   - Popula `protocoloConcessionaria` (snapshot da decisão)
   *   - Transita status → APROVADO (cooperado entra na fila de espera de usina)
   *   - Registra histórico de transição
   *   - Dispara email `enviarCadastroAprovado` (whitelist LGPD em dev)
   *
   * Próxima transição (APROVADO → ATIVO) já é coberta pelo `update` genérico
   * + cascata de contratos (linhas 734-776).
   */
  async aprovarConcessionaria(
    id: string,
    dto: { protocoloConcessionaria: string },
    requester: { perfil?: string; cooperativaId?: string | null },
  ) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        status: true,
        cooperativaId: true,
        ambienteTeste: true,
      },
    });
    if (!cooperado) {
      throw new NotFoundException(`Cooperado ${id} não encontrado`);
    }

    // Multi-tenant: SUPER_ADMIN bypassa; demais só na própria cooperativa.
    if (
      requester.perfil !== 'SUPER_ADMIN' &&
      cooperado.cooperativaId !== requester.cooperativaId
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para aprovar cooperado de outra cooperativa',
      );
    }

    if (cooperado.status !== 'AGUARDANDO_CONCESSIONARIA') {
      throw new ConflictException(
        `Cooperado precisa estar em AGUARDANDO_CONCESSIONARIA pra ser aprovado (status atual: ${cooperado.status})`,
      );
    }

    const atualizado = await this.prisma.cooperado.update({
      where: { id },
      data: {
        status: 'APROVADO',
        protocoloConcessionaria: dto.protocoloConcessionaria.trim(),
      },
    });

    await this.prisma.historicoStatusCooperado.create({
      data: {
        cooperadoId: id,
        cooperativaId: cooperado.cooperativaId ?? undefined,
        statusAnterior: 'AGUARDANDO_CONCESSIONARIA',
        statusNovo: 'APROVADO',
      },
    });

    await this.notificacoes.criar({
      tipo: 'COOPERADO_APROVADO',
      titulo: 'Concessionária aprovou',
      mensagem: `${cooperado.nomeCompleto} foi aprovado pela concessionária (protocolo registrado). Pronto pra entrar na alocação de usina.`,
      cooperadoId: id,
      link: `/dashboard/cooperados/${id}`,
    });

    // Email — whitelist LGPD filtra em dev.
    this.emailService.enviarCadastroAprovado(atualizado as any).catch(() => {});

    return atualizado;
  }

  /** P1-1: Ao churnar cooperado, marcar Indicacao como CANCELADO e recalcular indicadosAtivos do indicador */
  private async decrementarIndicadosAtivosNoChurn(cooperadoId: string) {
    // Buscar indicações onde este cooperado é o indicado (nivel 1 = direto)
    const indicacoes = await this.prisma.indicacao.findMany({
      where: {
        cooperadoIndicadoId: cooperadoId,
        status: 'PRIMEIRA_FATURA_PAGA',
      },
      select: { id: true, cooperadoIndicadorId: true },
    });

    if (indicacoes.length === 0) return;

    // Marcar indicações como CANCELADO
    await this.prisma.indicacao.updateMany({
      where: {
        cooperadoIndicadoId: cooperadoId,
        status: 'PRIMEIRA_FATURA_PAGA',
      },
      data: { status: 'CANCELADO' },
    });

    // Recalcular indicadosAtivos para cada indicador afetado
    const indicadorIds = [...new Set(indicacoes.map(i => i.cooperadoIndicadorId))];
    for (const indicadorId of indicadorIds) {
      await this.recalcularIndicadosAtivos(indicadorId);
    }
  }

  /** Ao reativar cooperado, restaurar Indicacao e recalcular indicadosAtivos */
  private async reativarIndicacoesNoRetorno(cooperadoId: string) {
    const indicacoes = await this.prisma.indicacao.findMany({
      where: {
        cooperadoIndicadoId: cooperadoId,
        status: 'CANCELADO',
        primeiraFaturaPagaEm: { not: null },
      },
      select: { id: true, cooperadoIndicadorId: true },
    });

    if (indicacoes.length === 0) return;

    await this.prisma.indicacao.updateMany({
      where: {
        cooperadoIndicadoId: cooperadoId,
        status: 'CANCELADO',
        primeiraFaturaPagaEm: { not: null },
      },
      data: { status: 'PRIMEIRA_FATURA_PAGA' },
    });

    const indicadorIds = [...new Set(indicacoes.map(i => i.cooperadoIndicadorId))];
    for (const indicadorId of indicadorIds) {
      await this.recalcularIndicadosAtivos(indicadorId);
    }
  }

  /** Recalcular indicadosAtivos no ProgressaoClube (mesma lógica do ClubeVantagensService) */
  private async recalcularIndicadosAtivos(cooperadoId: string) {
    const count = await this.prisma.indicacao.count({
      where: {
        cooperadoIndicadorId: cooperadoId,
        nivel: 1,
        status: 'PRIMEIRA_FATURA_PAGA',
      },
    });

    const progressao = await this.prisma.progressaoClube.findUnique({
      where: { cooperadoId },
    });

    if (progressao) {
      await this.prisma.progressaoClube.update({
        where: { cooperadoId },
        data: { indicadosAtivos: count },
      });
    }
  }

  async getHistoricoStatus(cooperadoId: string, cooperativaId?: string) {
    return this.prisma.historicoStatusCooperado.findMany({
      where: {
        cooperadoId,
        ...(cooperativaId ? { cooperativaId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string) {
    const contratosAtivos = await this.prisma.contrato.count({
      where: { cooperadoId: id, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
    });
    if (contratosAtivos > 0) {
      throw new BadRequestException(
        'Cooperado possui contratos ativos. Encerre os contratos antes de remover.',
      );
    }

    const cobrancasPendentes = await this.prisma.cobranca.count({
      where: { contrato: { cooperadoId: id }, status: 'A_VENCER' },
    });
    if (cobrancasPendentes > 0) {
      throw new BadRequestException(
        'Cooperado possui cobranças pendentes. Quite as cobranças antes de remover.',
      );
    }

    return this.prisma.cooperado.delete({ where: { id } });
  }

  async getChecklist(cooperadoId: string) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { tipoCooperado: true, termoAdesaoAceito: true, status: true },
    });
    if (!cooperado) return null;

    if (cooperado.tipoCooperado === 'SEM_UC') {
      const docAprovado = await this.prisma.documentoCooperado.count({
        where: { cooperadoId, status: 'APROVADO' },
      });
      return {
        tipo: 'SEM_UC',
        status: cooperado.status,
        items: [
          { label: 'Documento aprovado', ok: docAprovado > 0 },
          { label: 'Termo de adesão aceito', ok: cooperado.termoAdesaoAceito },
        ],
        pronto: docAprovado > 0 && cooperado.termoAdesaoAceito,
      };
    }

    // COM_UC
    const faturaProcessada = await this.prisma.faturaProcessada.count({
      where: { cooperadoId },
    });
    const docAprovado = await this.prisma.documentoCooperado.count({
      where: { cooperadoId, status: 'APROVADO' },
    });
    const contrato = await this.prisma.contrato.count({
      where: { cooperadoId, status: { in: ['PENDENTE_ATIVACAO', 'ATIVO', 'LISTA_ESPERA'] } },
    });
    const proposta = await this.prisma.propostaCooperado.count({
      where: { cooperadoId, status: 'ACEITA' },
    });
    const ativoRecebendo = cooperado.status === 'ATIVO_RECEBENDO_CREDITOS';

    return {
      tipo: 'COM_UC',
      status: cooperado.status,
      items: [
        { label: 'Fatura processada', ok: faturaProcessada > 0 },
        { label: 'Documento aprovado', ok: docAprovado > 0 },
        { label: 'Contrato criado', ok: contrato > 0 },
        { label: 'Proposta aceita', ok: proposta > 0 },
        { label: 'Ativo — Recebendo creditos', ok: ativoRecebendo },
      ],
      pronto: faturaProcessada > 0 && docAprovado > 0 && contrato > 0 && proposta > 0,
    };
  }

  /**
   * FASE 1 → APROVADO: docs aprovados + fatura processada
   * FASE 2 → ATIVO: tem contrato ATIVO
   */
  /**
   * Marca cooperado como PENDENTE_DOCUMENTOS após aceite de proposta.
   * Só transiciona se status atual for "antes" do fluxo de docs
   * (PENDENTE, PENDENTE_VALIDACAO). Se já estiver em PENDENTE_DOCUMENTOS
   * ou mais adiante (APROVADO/ATIVO), é no-op para não regredir o ciclo.
   * Registra audit trail em HistoricoStatusCooperado.
   */
  async marcarPendenteDocumentos(cooperadoId: string, cooperativaId?: string) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { id: true, status: true, cooperativaId: true },
    });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado');
    // Multi-tenant: se o caller passar cooperativaId, exigir match
    if (cooperativaId && cooperado.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Cooperado não pertence à sua cooperativa');
    }
    const transicionaveis: string[] = ['PENDENTE', 'PENDENTE_VALIDACAO'];
    if (!transicionaveis.includes(cooperado.status)) {
      return { atualizado: false, statusAtual: cooperado.status };
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.cooperado.update({
        where: { id: cooperadoId },
        data: { status: 'PENDENTE_DOCUMENTOS' },
      });
      await tx.historicoStatusCooperado.create({
        data: {
          cooperadoId,
          cooperativaId: cooperado.cooperativaId ?? undefined,
          statusAnterior: cooperado.status,
          statusNovo: 'PENDENTE_DOCUMENTOS',
          motivo: 'Proposta aceita — aguardando envio de documentos',
        },
      });
    });
    return { atualizado: true, statusAnterior: cooperado.status, statusNovo: 'PENDENTE_DOCUMENTOS' };
  }

  /**
   * Marca cooperado como APROVADO após análise positiva de documentos.
   * Transiciona de PENDENTE_DOCUMENTOS | PENDENTE | PENDENTE_VALIDACAO → APROVADO.
   * No-op se já estiver APROVADO/ATIVO/ATIVO_RECEBENDO_CREDITOS.
   * Registra audit trail em HistoricoStatusCooperado.
   */
  async marcarAprovado(cooperadoId: string, cooperativaId?: string) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { id: true, status: true, cooperativaId: true },
    });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado');
    if (cooperativaId && cooperado.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Cooperado não pertence à sua cooperativa');
    }
    const transicionaveis: string[] = ['PENDENTE', 'PENDENTE_VALIDACAO', 'PENDENTE_DOCUMENTOS'];
    if (!transicionaveis.includes(cooperado.status)) {
      return { atualizado: false, statusAtual: cooperado.status };
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.cooperado.update({
        where: { id: cooperadoId },
        data: { status: 'APROVADO' },
      });
      await tx.historicoStatusCooperado.create({
        data: {
          cooperadoId,
          cooperativaId: cooperado.cooperativaId ?? undefined,
          statusAnterior: cooperado.status,
          statusNovo: 'APROVADO',
          motivo: 'Documentos aprovados — link de assinatura enviado',
        },
      });
    });
    return { atualizado: true, statusAnterior: cooperado.status, statusNovo: 'APROVADO' };
  }

  async checkProntoParaAtivar(cooperadoId: string) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { id: true, status: true, nomeCompleto: true, email: true, tipoCooperado: true, cooperativaId: true },
    });
    if (!cooperado) return;

    // FASE 2: cooperado APROVADO com contrato ATIVO → status ATIVO
    if (cooperado.status === 'APROVADO') {
      const contratoAtivo = await this.prisma.contrato.count({
        where: { cooperadoId, status: 'ATIVO' },
      });
      if (contratoAtivo > 0) {
        await this.prisma.cooperado.update({
          where: { id: cooperadoId },
          data: { status: 'ATIVO' },
        });
        await this.prisma.historicoStatusCooperado.create({
          data: {
            cooperadoId,
            cooperativaId: cooperado.cooperativaId ?? undefined,
            statusAnterior: cooperado.status,
            statusNovo: 'ATIVO',
            motivo: 'Ativação automática — contrato ativo detectado',
          },
        });
        await this.notificacoes.criar({
          tipo: 'COOPERADO_ATIVADO',
          titulo: 'Cooperado ativado',
          mensagem: `${cooperado.nomeCompleto} possui contrato ativo e foi ativado automaticamente.`,
          cooperadoId,
          link: `/dashboard/cooperados/${cooperadoId}`,
        });
        return;
      }
    }

    // FASE 1: cooperado PENDENTE com docs + fatura OK → status APROVADO
    if (cooperado.status === 'PENDENTE') {
      const docAprovado = await this.prisma.documentoCooperado.count({
        where: { cooperadoId, status: 'APROVADO' },
      });
      const faturaProcessada = await this.prisma.faturaProcessada.count({
        where: { cooperadoId },
      });

      const fase1Completa = cooperado.tipoCooperado === 'SEM_UC'
        ? docAprovado > 0
        : docAprovado > 0 && faturaProcessada > 0;

      if (fase1Completa) {
        await this.prisma.cooperado.update({
          where: { id: cooperadoId },
          data: { status: 'APROVADO' },
        });
        await this.prisma.historicoStatusCooperado.create({
          data: {
            cooperadoId,
            cooperativaId: cooperado.cooperativaId ?? undefined,
            statusAnterior: cooperado.status,
            statusNovo: 'APROVADO',
            motivo: 'Aprovação automática — documentação completa',
          },
        });
        await this.notificacoes.criar({
          tipo: 'COOPERADO_APROVADO',
          titulo: 'Cooperado aprovado — aguardando usina',
          mensagem: `${cooperado.nomeCompleto} completou a documentação e está na fila de espera.`,
          cooperadoId,
          link: `/dashboard/cooperados/${cooperadoId}`,
        });
        this.emailService.enviarCadastroAprovado(cooperado).catch(() => {});
      }
    }
  }

  /** Fila de espera: cooperados APROVADO sem contrato ATIVO (FIFO por updatedAt) */
  async filaEspera(cooperativaId?: string) {
    const cooperados = await this.prisma.cooperado.findMany({
      where: {
        status: 'APROVADO',
        contratos: { none: { status: 'ATIVO' } },
        ...(cooperativaId ? { cooperativaId } : {}),
      },
      include: {
        ucs: { select: { id: true, numero: true, distribuidora: true } },
        faturasProcessadas: {
          select: { mediaKwhCalculada: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return cooperados.map(c => {
      const mediaFatura = c.faturasProcessadas[0]
        ? Number(c.faturasProcessadas[0].mediaKwhCalculada)
        : null;
      const cotaCadastro = c.cotaKwhMensal ? Number(c.cotaKwhMensal) : null;
      const consumo = mediaFatura ?? cotaCadastro;

      return {
        id: c.id,
        nomeCompleto: c.nomeCompleto,
        email: c.email,
        telefone: c.telefone,
        uc: c.ucs[0] ?? null,
        distribuidora: c.ucs[0]?.distribuidora ?? null,
        consumoMedioMensal: consumo ?? 0,
        semHistorico: consumo === null,
        dataAprovacao: c.updatedAt,
      };
    });
  }

  /** Aloca cooperado APROVADO a uma usina, validando regra ANEEL (mesma distribuidora) e capacidade */
  async alocarUsina(cooperadoId: string, usinaId: string) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      include: {
        ucs: { select: { id: true, numero: true, distribuidora: true } },
        contratos: { where: { status: 'ATIVO' }, select: { id: true } },
        faturasProcessadas: {
          select: { mediaKwhCalculada: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado');
    if (cooperado.status !== 'APROVADO') {
      throw new BadRequestException('Cooperado precisa estar com status APROVADO para alocação');
    }
    if (cooperado.contratos.length > 0) {
      throw new BadRequestException('Cooperado já possui contrato ativo');
    }

    const uc = cooperado.ucs[0];
    if (!uc) throw new BadRequestException('Cooperado não possui UC cadastrada');

    const usina = await this.prisma.usina.findUnique({ where: { id: usinaId } });
    if (!usina) throw new NotFoundException('Usina não encontrada');

    // Regra ANEEL: mesma distribuidora (validação centralizada)
    await this.usinasService.validarCompatibilidadeAneel(uc.id, usinaId);

    // Verificar capacidade disponível
    const capacidade = Number(usina.capacidadeKwh ?? 0);
    if (capacidade <= 0) {
      throw new BadRequestException('Usina sem capacidade kWh definida');
    }

    const contratosUsina = await this.prisma.contrato.aggregate({
      where: { usinaId, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
      _sum: { kwhContratoMensal: true },
    });
    const kwhOcupado = Number(contratosUsina._sum.kwhContratoMensal ?? 0);
    const percentualOcupado = (kwhOcupado / capacidade) * 100;

    if (percentualOcupado >= 100) {
      throw new BadRequestException(
        `Usina sem capacidade disponível (${percentualOcupado.toFixed(1)}% ocupada)`,
      );
    }

    const consumoMedio = cooperado.faturasProcessadas[0]
      ? Number(cooperado.faturasProcessadas[0].mediaKwhCalculada)
      : Number(cooperado.cotaKwhMensal ?? 0);
    const kwhDisponivel = capacidade - kwhOcupado;

    return {
      cooperado: {
        id: cooperado.id,
        nomeCompleto: cooperado.nomeCompleto,
        uc: uc,
        consumoMedioMensal: consumoMedio,
      },
      usina: {
        id: usina.id,
        nome: usina.nome,
        distribuidora: usina.distribuidora,
        capacidadeKwh: capacidade,
        kwhOcupado,
        kwhDisponivel,
        percentualOcupado: Math.round(percentualOcupado * 100) / 100,
      },
      alocacaoViavel: consumoMedio <= kwhDisponivel,
      mensagem: consumoMedio <= kwhDisponivel
        ? 'Alocação viável. Gere a proposta para prosseguir.'
        : `Consumo médio (${consumoMedio} kWh) excede disponível (${kwhDisponivel.toFixed(2)} kWh). Considere outra usina.`,
    };
  }

  /** Upload mensal de fatura — cooperado já existente */
  async registrarFaturaMensal(cooperadoId: string, dto: FaturaMensalDto) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
    });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado');

    const dados = dto.dadosOcr as any;
    const historicoConsumo = Array.isArray(dados.historicoConsumo)
      ? dados.historicoConsumo
      : [];
    const consumoAtualKwh = Number(dados.consumoAtualKwh ?? 0);

    // Calcular média com descarte de meses atípicos (threshold padrão 50%)
    const media = this.calcularMediaConsumo(historicoConsumo, consumoAtualKwh);

    // Verificar duplicata (mesma competência)
    const existente = await this.prisma.faturaProcessada.findFirst({
      where: {
        cooperadoId,
        dadosExtraidos: { path: ['mesReferencia'], equals: `${String(dto.mesReferencia).padStart(2, '0')}/${dto.anoReferencia}` },
      },
    });
    if (existente) {
      throw new BadRequestException(
        `Já existe fatura processada para ${String(dto.mesReferencia).padStart(2, '0')}/${dto.anoReferencia}`,
      );
    }

    const fatura = await this.faturasService.criarFaturaProcessada({
      cooperadoId,
      ucId: dto.ucId ?? null,
      arquivoUrl: dto.arquivoUrl ?? null,
      dadosExtraidos: dto.dadosOcr as object,
      historicoConsumo: historicoConsumo as object,
      mesesUtilizados: media.mesesUtilizados,
      mesesDescartados: media.mesesDescartados,
      mediaKwhCalculada: media.media,
      thresholdUtilizado: 50,
      status: 'APROVADA',
      statusRevisao: 'APROVADO',
    });

    // Atualizar cotaKwhMensal se a nova média for diferente
    if (media.media > 0 && media.media !== Number(cooperado.cotaKwhMensal ?? 0)) {
      await this.prisma.cooperado.update({
        where: { id: cooperadoId },
        data: { cotaKwhMensal: media.media },
      });
    }

    return {
      faturaId: fatura.id,
      mesReferencia: dto.mesReferencia,
      anoReferencia: dto.anoReferencia,
      mediaKwhCalculada: media.media,
      mesesUtilizados: media.mesesUtilizados,
      mesesDescartados: media.mesesDescartados,
      cotaAtualizada: media.media > 0 && media.media !== Number(cooperado.cotaKwhMensal ?? 0),
    };
  }

  // ─── Ações em Lote ──────────────────────────────────────────────────────────

  async enviarWhatsappLote(cooperadoIds: string[], mensagem: string, cooperativaId?: string) {
    const ids = cooperadoIds.slice(0, 50); // máx 50 por chamada
    const cooperados = await this.prisma.cooperado.findMany({
      where: { id: { in: ids }, ...(cooperativaId ? { cooperativaId } : {}) },
      select: { id: true, telefone: true, nomeCompleto: true, cooperativaId: true },
    });

    let enviados = 0;
    let erros = 0;
    for (const c of cooperados) {
      if (!c.telefone) { erros++; continue; }
      try {
        await this.whatsappSender.enviarMensagem(c.telefone, mensagem, {
          tipoDisparo: 'LOTE_MANUAL',
          cooperadoId: c.id,
          cooperativaId: c.cooperativaId ?? undefined,
        });
        enviados++;
      } catch {
        erros++;
      }
      // Delay 3-5s entre envios
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
    }
    return { total: cooperados.length, enviados, erros };
  }

  async aplicarReajusteLote(cooperadoIds: string[], percentual: number, motivo: string, cooperativaId?: string) {
    const contratos = await this.prisma.contrato.findMany({
      where: {
        cooperadoId: { in: cooperadoIds },
        status: 'ATIVO',
        ...(cooperativaId ? { cooperativaId } : {}),
      },
    });

    let atualizados = 0;
    for (const contrato of contratos) {
      const novoDesconto = Math.max(0, Math.min(100, Number(contrato.percentualDesconto) + percentual));
      await this.prisma.contrato.update({
        where: { id: contrato.id },
        data: {
          percentualDesconto: novoDesconto,
          ultimoReajusteEm: new Date(),
        },
      });
      atualizados++;
    }
    return { total: contratos.length, atualizados };
  }

  async aplicarBeneficioManualLote(dto: { cooperadoIds: string[]; valor: number; tipo: string; mesReferencia: string }, cooperativaId?: string) {
    const cooperados = await this.prisma.cooperado.findMany({
      where: { id: { in: dto.cooperadoIds }, ...(cooperativaId ? { cooperativaId } : {}) },
      select: { id: true, nomeCompleto: true },
    });

    const criados: any[] = [];
    for (const c of cooperados) {
      const lancamento = await this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'DESPESA',
          descricao: `Beneficio manual - ${c.nomeCompleto} - ${dto.mesReferencia}`,
          valor: dto.valor,
          competencia: dto.mesReferencia,
          status: 'PENDENTE',
          cooperadoId: c.id,
          cooperativaId: cooperativaId ?? undefined,
          observacoes: `Tipo: ${dto.tipo || 'MANUAL'}`,
        },
      });
      criados.push(lancamento);
    }
    return { total: cooperados.length, criados: criados.length };
  }

  async alterarStatusLote(dto: { cooperadoIds: string[]; status: string }, cooperativaId?: string, usuarioId?: string) {
    // Buscar status anterior de cada cooperado para histórico e churn
    const cooperados = await this.prisma.cooperado.findMany({
      where: {
        id: { in: dto.cooperadoIds },
        ...(cooperativaId ? { cooperativaId } : {}),
      },
      select: { id: true, status: true, cooperativaId: true },
    });

    const { count } = await this.prisma.cooperado.updateMany({
      where: {
        id: { in: dto.cooperadoIds },
        ...(cooperativaId ? { cooperativaId } : {}),
      },
      data: { status: dto.status as any },
    });

    // Registrar histórico e tratar churn para cada cooperado que mudou de status
    for (const c of cooperados) {
      if (c.status === dto.status) continue;

      await this.prisma.historicoStatusCooperado.create({
        data: {
          cooperadoId: c.id,
          cooperativaId: c.cooperativaId ?? undefined,
          statusAnterior: c.status,
          statusNovo: dto.status,
          usuarioId,
        },
      });

      if (['SUSPENSO', 'ENCERRADO'].includes(dto.status) && !['SUSPENSO', 'ENCERRADO'].includes(c.status)) {
        await this.decrementarIndicadosAtivosNoChurn(c.id);
      }

      if (dto.status === 'ATIVO' && ['SUSPENSO', 'ENCERRADO'].includes(c.status)) {
        await this.reativarIndicacoesNoRetorno(c.id);
      }
    }

    return { total: dto.cooperadoIds.length, atualizados: count };
  }

  private calcularMediaConsumo(
    historico: Array<{ mesAno: string; consumoKwh: number }>,
    consumoAtualKwh: number,
  ) {
    if (historico.length === 0) {
      return { media: consumoAtualKwh, mesesUtilizados: 0, mesesDescartados: 0 };
    }
    const threshold = 50;
    const mediaGeral =
      historico.reduce((acc, m) => acc + m.consumoKwh, 0) / historico.length;
    const limiteMinimo = mediaGeral * (threshold / 100);
    const filtrados = historico.filter((m) => m.consumoKwh >= limiteMinimo);
    if (filtrados.length === 0) {
      return { media: consumoAtualKwh, mesesUtilizados: 0, mesesDescartados: historico.length };
    }
    const media = filtrados.reduce((acc, m) => acc + m.consumoKwh, 0) / filtrados.length;
    return {
      media: Math.round(media * 100) / 100,
      mesesUtilizados: filtrados.length,
      mesesDescartados: historico.length - filtrados.length,
    };
  }

  // ─── Cadastro por Proxy (assinatura remota) ─────────────────────────────────

  async preCadastroProxy(data: {
    nomeCompleto: string;
    telefone: string;
    numeroUC?: string;
    distribuidora?: string;
    cidade?: string;
    estado?: string;
    economiaEstimada?: number;
    indicadorId: string;
    cooperativaId: string;
  }) {
    const cooperado = await this.prisma.cooperado.create({
      data: {
        nomeCompleto: data.nomeCompleto,
        cpf: `PROXY_${Date.now()}`,
        email: `proxy_${Date.now()}@pendente.cooperebr`,
        telefone: data.telefone,
        status: 'PENDENTE_ASSINATURA',
        cooperadoIndicadorId: data.indicadorId,
        cooperativaId: data.cooperativaId,
        cidade: data.cidade,
        estado: data.estado,
      },
    });

    const secret = getJwtSecret();
    const token = jwt.sign(
      { cooperadoId: cooperado.id, tipo: 'assinatura' },
      secret,
      { expiresIn: '7d' },
    );

    const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.cooperado.update({
      where: { id: cooperado.id },
      data: { tokenAssinatura: token, tokenAssinaturaExp: expiraEm },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';
    const link = `${frontendUrl}/portal/assinar/${token}`;

    return {
      cooperadoId: cooperado.id,
      tokenAssinatura: token,
      link,
      economiaEstimada: data.economiaEstimada,
    };
  }

  async verificarTokenAssinatura(token: string) {
    const secret = getJwtSecret();
    let payload: any;
    try {
      payload = jwt.verify(token, secret);
    } catch {
      throw new BadRequestException('Token inválido ou expirado');
    }

    if (payload.tipo !== 'assinatura') {
      throw new BadRequestException('Token inválido');
    }

    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: payload.cooperadoId },
      select: {
        id: true,
        nomeCompleto: true,
        status: true,
        cidade: true,
        estado: true,
        tokenAssinatura: true,
        tokenAssinaturaExp: true,
        ucs: { select: { numero: true, distribuidora: true } },
        cooperativa: { select: { nome: true } },
      },
    });

    if (!cooperado || cooperado.tokenAssinatura !== token) {
      throw new BadRequestException('Token inválido ou já utilizado');
    }

    if (cooperado.tokenAssinaturaExp && new Date() > cooperado.tokenAssinaturaExp) {
      throw new BadRequestException('Token expirado');
    }

    return cooperado;
  }

  async confirmarAssinatura(token: string) {
    const cooperado = await this.verificarTokenAssinatura(token);

    await this.prisma.cooperado.update({
      where: { id: cooperado.id },
      data: {
        status: 'PENDENTE',
        tokenAssinatura: null,
        tokenAssinaturaExp: null,
        termoAdesaoAceito: true,
        termoAdesaoAceitoEm: new Date(),
      },
    });

    return { ok: true };
  }
}
