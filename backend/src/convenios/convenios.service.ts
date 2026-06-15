import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service';
import { CreateConvenioDto, UpdateConvenioDto, TipoConvenioDto } from './convenios.dto';
import { ConveniosProgressaoService, ConfigBeneficio } from './convenios-progressao.service';

const TIER_ORDEM: Record<string, number> = { BRONZE: 0, PRATA: 1, OURO: 2, DIAMANTE: 3 };

@Injectable()
export class ConveniosService {
  private readonly logger = new Logger(ConveniosService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ConveniosProgressaoService))
    private progressaoService: ConveniosProgressaoService,
  ) {}

  /** D-FISCAL-2.3 (CT.9.1 TZ fix): parseia 'YYYY-MM-DD' como LOCAL midnight
   *  (não UTC — em GMT-3 UTC vira dia anterior). */
  private parseLocalDate(iso: string): Date {
    const [ano, mes, dia] = iso.substring(0, 10).split('-').map(Number);
    return new Date(ano, mes - 1, dia);
  }

  private async gerarNumero(tentativa = 0): Promise<string> {
    if (tentativa > 5) throw new BadRequestException('Falha ao gerar número do convênio após 5 tentativas');
    const ano = new Date().getFullYear();
    const ultimo = await this.prisma.contratoConvenio.findFirst({
      where: { numero: { startsWith: `CV-${ano}-` } },
      orderBy: { numero: 'desc' },
    });
    const seq = ultimo
      ? parseInt(ultimo.numero.split('-')[2] ?? '0', 10) + 1 + tentativa
      : 1 + tentativa;
    return `CV-${ano}-${String(seq).padStart(4, '0')}`;
  }

  async create(cooperativaId: string, dto: CreateConvenioDto) {
    // Validações
    if (dto.tipo === TipoConvenioDto.CONDOMINIO && dto.condominioId) {
      const cond = await this.prisma.condominio.findUnique({ where: { id: dto.condominioId } });
      if (!cond) throw new NotFoundException('Condomínio não encontrado');
      const existente = await this.prisma.contratoConvenio.findFirst({
        where: { condominioId: dto.condominioId },
      });
      if (existente) throw new BadRequestException('Este condomínio já possui um convênio');
    }

    if (dto.tipo === TipoConvenioDto.ADMINISTRADORA && !dto.administradoraId) {
      throw new BadRequestException('Administradora é obrigatória para convênios do tipo ADMINISTRADORA');
    }

    if (dto.administradoraId) {
      const adm = await this.prisma.administradora.findUnique({ where: { id: dto.administradoraId } });
      if (!adm) throw new NotFoundException('Administradora não encontrada');
    }

    // Criar cooperado SEM_UC para conveniado se solicitado
    let conveniadoId = dto.conveniadoId ?? null;
    if (!conveniadoId && dto.criarCooperadoSemUc && dto.conveniadoNome) {
      const cooperadoSemUc = await this.prisma.cooperado.create({
        data: {
          nomeCompleto: dto.conveniadoNome,
          cpf: dto.conveniadoCpf ?? `CONV-${randomUUID().slice(0, 8)}`,
          email: dto.conveniadoEmail ?? `conveniado-${randomUUID().slice(0, 8)}@cooperebr.local`,
          telefone: dto.conveniadoTelefone,
          tipoCooperado: 'SEM_UC',
          status: 'ATIVO',
          cooperativaId,
        },
      });
      conveniadoId = cooperadoSemUc.id;
    }

    if (conveniadoId) {
      const cooperado = await this.prisma.cooperado.findUnique({ where: { id: conveniadoId } });
      if (!cooperado) throw new NotFoundException('Cooperado conveniado não encontrado');
    }

    // Validar faixas
    if (dto.configBeneficio?.faixas) {
      this.validarFaixas(dto.configBeneficio.faixas);
    }

    // D-FISCAL-2.4.4e + D-novo-CT-TARIFA-FIXA-EMPRESA — Validação bloco custeio (Caso 1)
    await this.validarBlocoCusteio(
      cooperativaId,
      dto.pagador,
      dto.pagadorCooperadoId,
      dto.baseCobrancaCusteio,
      dto.kwhAlocadoMensal,
      dto.tipoTarifaEmpresa,
      dto.tarifaFixaKwhEmpresa,
    );

    // Sprint Onboarding Bloco 0 Fatia 0.2 — valida PlanoClube vinculado
    // (tenant + ativo). null/vazio = sem clube, sem validação.
    await this.validarPlanoClube(cooperativaId, dto.planoClubeId);

    // Retry loop para lidar com race condition no numero sequencial
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const numero = await this.gerarNumero(tentativa);
      try {
        const modalidade = dto.modalidade ?? 'STANDALONE';
        return await this.prisma.contratoConvenio.create({
          data: {
            numero,
            cooperativaId,
            empresaNome: dto.nome,
            empresaCnpj: dto.cnpj,
            empresaEmail: dto.email,
            empresaTelefone: dto.telefone,
            tipo: dto.tipo as any,
            condominioId: dto.condominioId,
            administradoraId: dto.administradoraId,
            conveniadoId,
            conveniadoNome: dto.conveniadoNome,
            conveniadoCpf: dto.conveniadoCpf,
            conveniadoEmail: dto.conveniadoEmail,
            conveniadoTelefone: dto.conveniadoTelefone,
            configBeneficio: (dto.configBeneficio ?? {}) as any,
            registrarComoIndicacao: dto.registrarComoIndicacao ?? true,
            diaEnvioRelatorio: dto.diaEnvioRelatorio ?? 5,
            tipoDesconto: 'PERCENTUAL',
            status: 'ATIVO',
            tierMinimoClube: dto.tierMinimoClube ?? null,
            modalidade,
            statusAprovacao: modalidade === 'GLOBAL' ? 'PENDENTE' : 'APROVADO',
            taxaAprovacaoSisgd: dto.taxaAprovacaoSisgd ?? null,
            // D-FISCAL-2.3 — bloco fiscal opcional na criação
            geraLancamentoContabil: dto.geraLancamentoContabil ?? false,
            naturezaAtoCooperativo: dto.naturezaAtoCooperativo ?? null,
            fluxoFinanceiro: dto.fluxoFinanceiro ?? null,
            classificacaoFiscal: dto.classificacaoFiscal ?? null,
            vigenciaInicio: dto.vigenciaInicio ? this.parseLocalDate(dto.vigenciaInicio) : null,
            vigenciaFim: dto.vigenciaFim ? this.parseLocalDate(dto.vigenciaFim) : null,
            // D-FISCAL-2.4.4e — bloco custeio Caso 1
            pagador: (dto.pagador ?? 'CADA_MEMBRO') as any,
            pagadorCooperadoId: dto.pagadorCooperadoId ?? null,
            baseCobrancaCusteio: (dto.baseCobrancaCusteio ?? 'CONSUMO_REAL') as any,
            kwhAlocadoMensal: dto.kwhAlocadoMensal ?? null,
            descontoKwhCusteio: dto.descontoKwhCusteio ?? null,
            // D-novo-CT-TARIFA-FIXA-EMPRESA
            tipoTarifaEmpresa: (dto.tipoTarifaEmpresa ?? 'PERCENTUAL_DESCONTO') as any,
            tarifaFixaKwhEmpresa: dto.tarifaFixaKwhEmpresa ?? null,
            // Sprint Onboarding Bloco 0 Fatia 0.2 — Plano de Clube vinculado.
            planoClubeId: dto.planoClubeId || null,
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002' && tentativa < 4) continue;
        throw err;
      }
    }
    throw new BadRequestException('Falha ao criar convênio');
  }

  /**
   * D-FISCAL-2.4.4e — Validação do bloco custeio (Caso 1: empresa paga total).
   * pagador=EMPRESA exige pagadorCooperadoId + baseCobrancaCusteio.
   * baseCobrancaCusteio=ALOCACAO_FIXA exige kwhAlocadoMensal>0.
   * pagador=CADA_MEMBRO (default) ignora os outros campos.
   */
  private async validarBlocoCusteio(
    cooperativaId: string,
    pagador: string | undefined,
    pagadorCooperadoId: string | null | undefined,
    baseCobrancaCusteio: string | null | undefined,
    kwhAlocadoMensal: number | null | undefined,
    tipoTarifaEmpresa?: string | null,
    tarifaFixaKwhEmpresa?: number | null,
  ) {
    if (pagador !== 'EMPRESA') return; // CADA_MEMBRO (default) — sem validação

    if (!pagadorCooperadoId) {
      throw new BadRequestException(
        'pagador=EMPRESA exige pagadorCooperadoId (empresa cooperada que paga a consolidada).',
      );
    }
    const pagadorCoop = await this.prisma.cooperado.findFirst({
      where: { id: pagadorCooperadoId, cooperativaId },
      select: { id: true, status: true, nomeCompleto: true },
    });
    if (!pagadorCoop) {
      throw new BadRequestException(
        `pagadorCooperadoId "${pagadorCooperadoId}" não encontrado neste tenant.`,
      );
    }
    if (pagadorCoop.status !== 'ATIVO') {
      throw new BadRequestException(
        `Cooperado pagador "${pagadorCoop.nomeCompleto}" não está ATIVO (status=${pagadorCoop.status}).`,
      );
    }
    if (!baseCobrancaCusteio) {
      throw new BadRequestException(
        'pagador=EMPRESA exige baseCobrancaCusteio (CONSUMO_REAL ou ALOCACAO_FIXA).',
      );
    }
    if (baseCobrancaCusteio === 'ALOCACAO_FIXA' && (!kwhAlocadoMensal || kwhAlocadoMensal <= 0)) {
      throw new BadRequestException(
        'baseCobrancaCusteio=ALOCACAO_FIXA exige kwhAlocadoMensal > 0.',
      );
    }
    // D-novo-CT-TARIFA-FIXA-EMPRESA (02/06/2026): VALOR_FIXO exige tarifaFixaKwhEmpresa>0.
    if (tipoTarifaEmpresa === 'VALOR_FIXO' && (!tarifaFixaKwhEmpresa || tarifaFixaKwhEmpresa <= 0)) {
      throw new BadRequestException(
        'tipoTarifaEmpresa=VALOR_FIXO exige tarifaFixaKwhEmpresa > 0 (R$/kWh negociado com a empresa).',
      );
    }
  }

  /**
   * Sprint Onboarding Bloco 0 Fatia 0.2 (06/06/2026) — valida PlanoClube
   * vinculado ao convênio.
   *
   * Regras:
   *  - null/undefined/'' = sem clube (válido, sem validação).
   *  - planoClubeId presente: precisa pertencer ao tenant + estar ativo.
   *    Caso contrário, 400 com mensagem clara (anti-vazamento cross-tenant
   *    + bloqueia vinculação de plano inativo).
   */
  private async validarPlanoClube(
    cooperativaId: string,
    planoClubeId: string | null | undefined,
  ): Promise<void> {
    if (!planoClubeId) return;
    const plano = await this.prisma.planoClube.findFirst({
      where: { id: planoClubeId, cooperativaId },
      select: { id: true, ativo: true },
    });
    if (!plano) {
      throw new BadRequestException(
        'planoClubeId inválido ou pertence a outra cooperativa.',
      );
    }
    if (!plano.ativo) {
      throw new BadRequestException(
        'planoClubeId aponta pra um PlanoClube inativo. Reative o plano ou escolha outro.',
      );
    }
  }

  async findAll(cooperativaId: string, params?: {
    tipo?: string;
    status?: string;
    pagador?: string;
    busca?: string;
    page?: number;
    limit?: number;
  }) {
    const { tipo, status, pagador, busca, page = 1, limit = 20 } = params ?? {};
    const where: any = { cooperativaId };

    if (tipo) where.tipo = tipo;
    if (status) where.status = status;
    // D-FISCAL-2.4.3 — selector custeio: admin filtra pagador=EMPRESA pra montar o select
    if (pagador) where.pagador = pagador;
    if (busca) {
      where.OR = [
        { empresaNome: { contains: busca, mode: 'insensitive' } },
        { empresaCnpj: { contains: busca } },
        { conveniadoNome: { contains: busca, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.contratoConvenio.findMany({
        where,
        include: {
          _count: { select: { cooperados: { where: { ativo: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contratoConvenio.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, cooperativaId?: string) {
    const convenio = await this.prisma.contratoConvenio.findFirst({
      where: { id, ...(cooperativaId && { cooperativaId }) },
      include: {
        cooperados: {
          include: {
            cooperado: { select: { id: true, nomeCompleto: true, cpf: true, email: true, tipoCooperado: true } },
            indicacao: { select: { id: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        historicoFaixas: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        condominio: { select: { id: true, nome: true } },
        administradora: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        conveniado: { select: { id: true, nomeCompleto: true, cpf: true, email: true, tipoCooperado: true } },
      },
    });
    if (!convenio) throw new NotFoundException('Convênio não encontrado');
    return convenio;
  }

  async update(id: string, dto: UpdateConvenioDto) {
    const convenio = await this.findOne(id);

    if (dto.configBeneficio?.faixas) {
      this.validarFaixas(dto.configBeneficio.faixas);
    }

    // D-FISCAL-2.4.4e + D-novo-CT-TARIFA-FIXA-EMPRESA — Validação bloco custeio.
    // Resolve "pagador efetivo" (dto.pagador se enviado; senão usa o atual no
    // banco) pra checar dependentes corretamente em updates parciais.
    if (convenio.cooperativaId) {
      const pagadorEfetivo = dto.pagador ?? convenio.pagador;
      const pagadorCoopEfetivo = dto.pagadorCooperadoId !== undefined
        ? dto.pagadorCooperadoId
        : convenio.pagadorCooperadoId;
      const baseEfetiva = dto.baseCobrancaCusteio !== undefined
        ? dto.baseCobrancaCusteio
        : convenio.baseCobrancaCusteio;
      const kwhEfetivo = dto.kwhAlocadoMensal !== undefined
        ? dto.kwhAlocadoMensal
        : convenio.kwhAlocadoMensal;
      const tipoTarifaEfetivo = dto.tipoTarifaEmpresa !== undefined
        ? dto.tipoTarifaEmpresa
        : (convenio as any).tipoTarifaEmpresa;
      const tarifaFixaEfetiva = dto.tarifaFixaKwhEmpresa !== undefined
        ? dto.tarifaFixaKwhEmpresa
        : (convenio as any).tarifaFixaKwhEmpresa;
      await this.validarBlocoCusteio(
        convenio.cooperativaId,
        pagadorEfetivo as any,
        pagadorCoopEfetivo,
        baseEfetiva as any,
        kwhEfetivo as any,
        tipoTarifaEfetivo as any,
        tarifaFixaEfetiva as any,
      );

      // Fatia 0.2 — valida PlanoClube quando vier no patch. null/'' = desvincular.
      if (dto.planoClubeId !== undefined) {
        await this.validarPlanoClube(convenio.cooperativaId, dto.planoClubeId);
      }
    }

    const data: any = {};

    if (dto.nome !== undefined) data.empresaNome = dto.nome;
    if (dto.cnpj !== undefined) data.empresaCnpj = dto.cnpj;
    if (dto.email !== undefined) data.empresaEmail = dto.email;
    if (dto.telefone !== undefined) data.empresaTelefone = dto.telefone;
    if (dto.tipo !== undefined) data.tipo = dto.tipo;
    if (dto.condominioId !== undefined) data.condominioId = dto.condominioId;
    if (dto.administradoraId !== undefined) data.administradoraId = dto.administradoraId;
    if (dto.conveniadoId !== undefined) data.conveniadoId = dto.conveniadoId;
    if (dto.conveniadoNome !== undefined) data.conveniadoNome = dto.conveniadoNome;
    if (dto.conveniadoCpf !== undefined) data.conveniadoCpf = dto.conveniadoCpf;
    if (dto.conveniadoEmail !== undefined) data.conveniadoEmail = dto.conveniadoEmail;
    if (dto.conveniadoTelefone !== undefined) data.conveniadoTelefone = dto.conveniadoTelefone;
    if (dto.configBeneficio !== undefined) data.configBeneficio = dto.configBeneficio;
    if (dto.registrarComoIndicacao !== undefined) data.registrarComoIndicacao = dto.registrarComoIndicacao;
    if (dto.diaEnvioRelatorio !== undefined) data.diaEnvioRelatorio = dto.diaEnvioRelatorio;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.tierMinimoClube !== undefined) data.tierMinimoClube = dto.tierMinimoClube;
    if (dto.modalidade !== undefined) data.modalidade = dto.modalidade;
    if (dto.taxaAprovacaoSisgd !== undefined) data.taxaAprovacaoSisgd = dto.taxaAprovacaoSisgd;

    // D-FISCAL-2.3 — bloco fiscal (campos da fatia 2.1)
    if (dto.geraLancamentoContabil !== undefined) data.geraLancamentoContabil = dto.geraLancamentoContabil;
    if (dto.naturezaAtoCooperativo !== undefined) data.naturezaAtoCooperativo = dto.naturezaAtoCooperativo;
    if (dto.fluxoFinanceiro !== undefined) data.fluxoFinanceiro = dto.fluxoFinanceiro;
    if (dto.classificacaoFiscal !== undefined) data.classificacaoFiscal = dto.classificacaoFiscal;
    if (dto.vigenciaInicio !== undefined) {
      data.vigenciaInicio = dto.vigenciaInicio ? this.parseLocalDate(dto.vigenciaInicio) : null;
    }
    if (dto.vigenciaFim !== undefined) {
      data.vigenciaFim = dto.vigenciaFim ? this.parseLocalDate(dto.vigenciaFim) : null;
    }

    // D-FISCAL-2.4.4e — bloco custeio editável
    if (dto.pagador !== undefined) data.pagador = dto.pagador;
    if (dto.pagadorCooperadoId !== undefined) data.pagadorCooperadoId = dto.pagadorCooperadoId;
    if (dto.baseCobrancaCusteio !== undefined) data.baseCobrancaCusteio = dto.baseCobrancaCusteio;
    if (dto.kwhAlocadoMensal !== undefined) data.kwhAlocadoMensal = dto.kwhAlocadoMensal;
    if (dto.descontoKwhCusteio !== undefined) data.descontoKwhCusteio = dto.descontoKwhCusteio;
    // D-novo-CT-TARIFA-FIXA-EMPRESA
    if (dto.tipoTarifaEmpresa !== undefined) data.tipoTarifaEmpresa = dto.tipoTarifaEmpresa;
    if (dto.tarifaFixaKwhEmpresa !== undefined) data.tarifaFixaKwhEmpresa = dto.tarifaFixaKwhEmpresa;

    // Sprint Onboarding Bloco 0 Fatia 0.2 — Plano de Clube editável.
    // Normaliza '' → null pra desvincular.
    if (dto.planoClubeId !== undefined) {
      data.planoClubeId = dto.planoClubeId || null;
    }

    const updated = await this.prisma.contratoConvenio.update({
      where: { id },
      data,
    });

    // Se encerrou, desligar todos os membros ativos
    if (dto.status === 'ENCERRADO') {
      await this.prisma.convenioCooperado.updateMany({
        where: { convenioId: id, ativo: true },
        data: {
          ativo: false,
          status: 'MEMBRO_DESLIGADO' as any,
          dataDesligamento: new Date(),
        },
      });
    }

    // Recalcular faixa se configBeneficio mudou
    if (dto.configBeneficio !== undefined) {
      await this.progressaoService.recalcularFaixa(id, 'CONFIG_ALTERADA');
    }

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.convenioCooperado.updateMany({
      where: { convenioId: id, ativo: true },
      data: {
        ativo: false,
        status: 'MEMBRO_DESLIGADO' as any,
        dataDesligamento: new Date(),
      },
    });
    return this.prisma.contratoConvenio.update({
      where: { id },
      data: { status: 'ENCERRADO' },
    });
  }

  // ─── Relatório (mantido da lógica existente) ───────────────────────────────

  async relatorio(convenioId: string, competencia: string) {
    const convenio = await this.prisma.contratoConvenio.findUnique({
      where: { id: convenioId },
      include: {
        cooperados: {
          where: { ativo: true },
          include: { cooperado: { select: { id: true, nomeCompleto: true, cpf: true } } },
        },
      },
    });
    if (!convenio) throw new NotFoundException('Convênio não encontrado');

    const cooperadoIds = convenio.cooperados.map(c => c.cooperadoId);
    const lancamentos = await this.prisma.lancamentoCaixa.findMany({
      where: {
        cooperadoId: { in: cooperadoIds },
        competencia,
        status: { not: 'CANCELADO' },
      },
    });

    const lancamentosMap = new Map<string, number>();
    for (const l of lancamentos) {
      if (l.cooperadoId) {
        lancamentosMap.set(l.cooperadoId, (lancamentosMap.get(l.cooperadoId) ?? 0) + Number(l.valor));
      }
    }

    const itens = convenio.cooperados.map(vc => ({
      cooperadoId: vc.cooperadoId,
      nomeCompleto: vc.cooperado.nomeCompleto,
      cpf: vc.cooperado.cpf,
      matricula: vc.matricula ?? '',
      valor: lancamentosMap.get(vc.cooperadoId) ?? 0,
    }));

    return {
      empresa: convenio.empresaNome,
      cnpj: convenio.empresaCnpj,
      competencia,
      tipoDesconto: convenio.tipoDesconto,
      totalCooperados: itens.length,
      totalGeral: itens.reduce((acc, i) => acc + i.valor, 0),
      itens,
    };
  }

  relatorioCsv(relatorio: {
    empresa: string;
    cnpj: string | null;
    competencia: string;
    itens: { nomeCompleto: string; matricula: string; valor: number }[];
  }): string {
    const linhas: string[] = [];
    linhas.push(`Empresa;${relatorio.empresa}`);
    linhas.push(`CNPJ;${relatorio.cnpj ?? ''}`);
    linhas.push(`Competencia;${relatorio.competencia}`);
    linhas.push('');
    linhas.push('Cooperado;Matricula;Valor');
    for (const item of relatorio.itens) {
      linhas.push(`${item.nomeCompleto};${item.matricula};${item.valor.toFixed(2)}`);
    }
    return linhas.join('\n');
  }

  // ─── Portal do Conveniado ─────────────────────────────────────────────────

  async meusConvenios(cooperadoId: string) {
    // Bug fix 15/06/2026 (Track B.2): cooperadoId vem do JWT do portal.
    // Pode ser tanto o REPRESENTANTE legado (`conveniadoId`) quanto a
    // EMPRESA-PJ-PAGADORA novo (`pagadorCooperadoId`, D-FISCAL-2.4.1 Caso 1).
    // OR cobre ambos sem quebrar convênios legados (representante PF antigo).
    // Limita-se ao status ATIVO; demais filtros multi-tenant ficam a cargo
    // do `cooperativaId` do JWT (controllers passam o filtro).
    return this.prisma.contratoConvenio.findMany({
      where: {
        OR: [
          { conveniadoId: cooperadoId },
          { pagadorCooperadoId: cooperadoId },
        ],
        status: 'ATIVO',
      },
      include: {
        _count: { select: { cooperados: { where: { ativo: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async dashboardConveniado(convenioId: string, cooperadoId: string) {
    // Bug fix 15/06/2026 (Track B.2): mesmo padrão do meusConvenios — aceita
    // pagador OU representante (cooperadoId do JWT pode ser qualquer um).
    const convenio = await this.prisma.contratoConvenio.findFirst({
      where: {
        id: convenioId,
        OR: [
          { conveniadoId: cooperadoId },
          { pagadorCooperadoId: cooperadoId },
        ],
      },
      include: {
        cooperados: {
          where: { ativo: true },
          include: {
            cooperado: { select: { id: true, nomeCompleto: true, cpf: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        historicoFaixas: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!convenio) throw new NotFoundException('Convênio não encontrado ou você não é o conveniado');

    const config = convenio.configBeneficio as ConfigBeneficio;
    const faixas = config?.faixas ?? [];
    const faixaAtual = faixas[convenio.faixaAtualIndex] ?? null;
    const proximaFaixa = faixas[convenio.faixaAtualIndex + 1] ?? null;

    return {
      convenio: {
        id: convenio.id,
        numero: convenio.numero,
        nome: convenio.empresaNome,
        tipo: convenio.tipo,
        status: convenio.status,
      },
      faixaAtual: faixaAtual
        ? {
            ...faixaAtual,
            index: convenio.faixaAtualIndex,
            descontoMembrosAtual: Number(convenio.descontoMembrosAtual),
            descontoConveniadoAtual: Number(convenio.descontoConveniadoAtual),
          }
        : null,
      proximaFaixa: proximaFaixa
        ? {
            membrosNecessarios: proximaFaixa.minMembros - convenio.membrosAtivosCache,
            ...proximaFaixa,
          }
        : null,
      membrosAtivos: convenio.membrosAtivosCache,
      membros: convenio.cooperados.map(m => ({
        id: m.id,
        cooperadoId: m.cooperadoId,
        nome: m.cooperado.nomeCompleto,
        cpf: m.cooperado.cpf,
        matricula: m.matricula,
        dataAdesao: m.dataAdesao,
        status: m.status,
      })),
      historicoFaixas: convenio.historicoFaixas,
    };
  }

  // ─── Tier check ──────────────────────────────────────────────────────────

  async checkTierRequisito(cooperadoId: string, convenioId: string): Promise<boolean> {
    const convenio = await this.prisma.contratoConvenio.findUnique({ where: { id: convenioId } });
    if (!convenio?.tierMinimoClube) return true;
    const progressao = await this.prisma.progressaoClube.findUnique({ where: { cooperadoId } });
    const tierAtual = progressao?.nivelAtual ?? 'BRONZE';
    return (TIER_ORDEM[tierAtual] ?? 0) >= (TIER_ORDEM[convenio.tierMinimoClube] ?? 0);
  }

  // ─── Governança GLOBAL ─────────────────────────────────────────────────

  async listarPendentesGlobal() {
    return this.prisma.contratoConvenio.findMany({
      where: { modalidade: 'GLOBAL', statusAprovacao: 'PENDENTE' },
      include: {
        _count: { select: { cooperados: { where: { ativo: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async aprovarGlobal(id: string) {
    const convenio = await this.findOne(id);
    if (convenio.modalidade !== 'GLOBAL') throw new BadRequestException('Convênio não é GLOBAL');
    return this.prisma.contratoConvenio.update({
      where: { id },
      data: { statusAprovacao: 'APROVADO' },
    });
  }

  async rejeitarGlobal(id: string, motivoRejeicao: string) {
    const convenio = await this.findOne(id);
    if (convenio.modalidade !== 'GLOBAL') throw new BadRequestException('Convênio não é GLOBAL');
    return this.prisma.contratoConvenio.update({
      where: { id },
      data: { statusAprovacao: 'REJEITADO', motivoRejeicao },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private validarFaixas(faixas: { minMembros: number; maxMembros: number | null; descontoMembros: number; descontoConveniado: number }[]) {
    if (faixas.length === 0) return;

    const sorted = [...faixas].sort((a, b) => a.minMembros - b.minMembros);

    for (let i = 0; i < sorted.length; i++) {
      const faixa = sorted[i];
      if (faixa.descontoMembros < 0 || faixa.descontoMembros > 100) {
        throw new BadRequestException(`Desconto de membros na faixa ${i + 1} deve estar entre 0 e 100`);
      }
      if (faixa.descontoConveniado < 0 || faixa.descontoConveniado > 100) {
        throw new BadRequestException(`Desconto do conveniado na faixa ${i + 1} deve estar entre 0 e 100`);
      }
      if (i > 0) {
        const anterior = sorted[i - 1];
        if (anterior.maxMembros != null && faixa.minMembros > anterior.maxMembros + 1) {
          throw new BadRequestException(`Gap entre faixas ${i} e ${i + 1}: ${anterior.maxMembros} → ${faixa.minMembros}`);
        }
      }
    }
  }
}
