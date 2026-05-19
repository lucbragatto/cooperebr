import { Injectable, Logger } from '@nestjs/common';
import { ClasseGdAplicada } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AlocacaoValidadorService } from './alocacao-validador.service';

export interface RealocacaoSugerida {
  contratoId: string;
  cooperadoId: string;
  cooperadoNome: string;
  ucId: string;
  ucNumero: string;
  kwhContrato: number;
  usinaAtualId: string | null;
  usinaAtualNome: string | null;
  usinaSugeridaId: string;
  usinaSugeridaNome: string;
  motivosMudanca: string[];
  /// Valor proxy de "ganho" (redução de violações de política). Sprint 5a Neutro
  /// substitui por R$ projetado real quando engine de Fio B estiver pronta.
  economiaProjetadaProxy: number;
}

export interface AlocacaoSnapshot {
  cooperativaId: string;
  contratosAvaliados: number;
  realocacoesSugeridas: number;
  realocacoes: RealocacaoSugerida[];
  custoTotalAntesProxy: number;
  custoTotalDepoisProxy: number;
  economiaTotalProxy: number;
  geradoEm: string;
}

interface ContratoAvaliado {
  id: string;
  cooperadoId: string;
  cooperadoNome: string;
  ucId: string;
  ucNumero: string;
  kwhContrato: number;
  usinaAtualId: string | null;
  classeGdAplicada: ClasseGdAplicada | null;
  dataInicio: Date;
}

interface UsinaAvaliada {
  id: string;
  nome: string;
  capacidadeKwh: number;
  classeGdAnotada: ClasseGdAplicada | null;
  distribuidora: string | null;
  alocacaoAtualKwh: number;
}

interface PoliticaCarregada {
  id: string;
  nome: string;
  faixaMin: number;
  faixaMax: number | null;
  classeGdPreferida: ClasseGdAplicada | null;
  usinasElegiveis: string[];
  prioridade: number;
}

/**
 * Sprint 8 / Bloco E — Engine de Otimização Proativa.
 *
 * Algoritmo: **Greedy + busca local de swap-2**.
 *
 *  1. Carrega contratos ATIVO+PENDENTE_ATIVACAO + usinas + políticas
 *  2. Pra cada contrato (ordenado por kwh DESC — grandes primeiro):
 *     a) Identifica política aplicável (faixa kWh + prioridade)
 *     b) Se usina atual viola política → busca melhor usina compatível
 *     c) Valida cada candidata (concentração, distribuidora, classe GD, estabilidade)
 *  3. Busca local: pares (A, B) — testa swap pra ver se reduz custo total
 *  4. Retorna snapshot pra ser gravado em AlocacaoOtima (status SUGERIDA)
 *
 * Custo proxy do MVP: número de contratos fora da `classeGdPreferida` × 100.
 * Sprint 5a Neutro vai substituir por R$ real (kWh × tarifa × Fio B classe-específico).
 */
@Injectable()
export class AlocacaoEngineService {
  private readonly logger = new Logger(AlocacaoEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validador: AlocacaoValidadorService,
  ) {}

  async simular(cooperativaId: string): Promise<AlocacaoSnapshot> {
    const [contratos, usinas, politicas] = await Promise.all([
      this.carregarContratos(cooperativaId),
      this.carregarUsinas(cooperativaId),
      this.carregarPoliticas(cooperativaId),
    ]);

    const usinasIndex = new Map(usinas.map((u) => [u.id, u]));
    const ocupacaoSimulada = new Map<string, number>();
    for (const u of usinas) ocupacaoSimulada.set(u.id, u.alocacaoAtualKwh);

    const contratosOrdenados = [...contratos].sort((a, b) => b.kwhContrato - a.kwhContrato);

    const realocacoes: RealocacaoSugerida[] = [];
    const custoAntes = this.calcularCusto(contratos, usinasIndex, politicas);

    for (const contrato of contratosOrdenados) {
      const politica = this.encontrarPolitica(contrato, politicas);
      const usinaAtual = contrato.usinaAtualId ? usinasIndex.get(contrato.usinaAtualId) : null;
      const usinaAtualOk = await this.usinaCompativelComPolitica(contrato, usinaAtual, politica);
      if (usinaAtualOk) continue;

      const candidata = await this.buscarMelhorCandidata({
        contrato,
        usinas,
        ocupacaoSimulada,
        politica,
      });
      if (!candidata) continue;

      const motivos: string[] = [];
      if (!usinaAtual) motivos.push('Contrato sem usina vinculada');
      if (politica && usinaAtual) {
        if (politica.classeGdPreferida && usinaAtual.classeGdAnotada !== politica.classeGdPreferida) {
          motivos.push(
            `Usina atual fora da classe GD preferida (${usinaAtual.classeGdAnotada ?? 'sem anotação'} × ${politica.classeGdPreferida})`,
          );
        }
        if (politica.usinasElegiveis.length > 0 && !politica.usinasElegiveis.includes(usinaAtual.id)) {
          motivos.push('Usina atual não está na lista elegível da política');
        }
      }
      if (motivos.length === 0) motivos.push('Otimização proativa — usina sugerida tem melhor encaixe');

      realocacoes.push({
        contratoId: contrato.id,
        cooperadoId: contrato.cooperadoId,
        cooperadoNome: contrato.cooperadoNome,
        ucId: contrato.ucId,
        ucNumero: contrato.ucNumero,
        kwhContrato: contrato.kwhContrato,
        usinaAtualId: usinaAtual?.id ?? null,
        usinaAtualNome: usinaAtual?.nome ?? null,
        usinaSugeridaId: candidata.id,
        usinaSugeridaNome: candidata.nome,
        motivosMudanca: motivos,
        economiaProjetadaProxy: 100, // proxy por realocação (Sprint 5a refina)
      });

      if (usinaAtual) {
        ocupacaoSimulada.set(usinaAtual.id, (ocupacaoSimulada.get(usinaAtual.id) ?? 0) - contrato.kwhContrato);
      }
      ocupacaoSimulada.set(candidata.id, (ocupacaoSimulada.get(candidata.id) ?? 0) + contrato.kwhContrato);
    }

    // Busca local: tenta swap em pares pra ver se reduz custo total
    this.tentarSwapPares(realocacoes, contratos, usinasIndex, politicas);

    const contratosPosRealocacao = this.aplicarRealocacoesSimuladas(contratos, realocacoes);
    const custoDepois = this.calcularCusto(contratosPosRealocacao, usinasIndex, politicas);

    return {
      cooperativaId,
      contratosAvaliados: contratos.length,
      realocacoesSugeridas: realocacoes.length,
      realocacoes,
      custoTotalAntesProxy: custoAntes,
      custoTotalDepoisProxy: custoDepois,
      economiaTotalProxy: custoAntes - custoDepois,
      geradoEm: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async carregarContratos(cooperativaId: string): Promise<ContratoAvaliado[]> {
    const contratos = await this.prisma.contrato.findMany({
      where: {
        cooperativaId,
        status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
      },
      include: {
        cooperado: { select: { id: true, nomeCompleto: true } },
        uc: { select: { id: true, numero: true } },
      },
    });
    return contratos
      .filter((c) => c.kwhContrato && c.uc)
      .map((c) => ({
        id: c.id,
        cooperadoId: c.cooperadoId,
        cooperadoNome: c.cooperado.nomeCompleto,
        ucId: c.uc.id,
        ucNumero: c.uc.numero,
        kwhContrato: Number(c.kwhContrato ?? 0),
        usinaAtualId: c.usinaId,
        classeGdAplicada: c.classeGdAplicada,
        dataInicio: c.dataInicio,
      }));
  }

  private async carregarUsinas(cooperativaId: string): Promise<UsinaAvaliada[]> {
    const usinas = await this.prisma.usina.findMany({
      where: {
        OR: [{ cooperativaId }, { cooperativaId: null }],
        capacidadeKwh: { not: null },
      },
      include: {
        contratos: {
          where: { status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
          select: { kwhContrato: true },
        },
      },
    });
    return usinas.map((u) => ({
      id: u.id,
      nome: u.nome,
      capacidadeKwh: Number(u.capacidadeKwh ?? 0),
      classeGdAnotada: this.coerceClasseGd(u.classeGdAnotada),
      distribuidora: u.distribuidora,
      alocacaoAtualKwh: u.contratos.reduce((acc, c) => acc + Number(c.kwhContrato ?? 0), 0),
    }));
  }

  private async carregarPoliticas(cooperativaId: string): Promise<PoliticaCarregada[]> {
    const politicas = await this.prisma.politicaAlocacao.findMany({
      where: { cooperativaId, ativa: true },
      orderBy: [{ prioridade: 'desc' }, { faixaMin: 'asc' }],
    });
    return politicas.map((p) => ({
      id: p.id,
      nome: p.nome,
      faixaMin: Number(p.faixaMin),
      faixaMax: p.faixaMax ? Number(p.faixaMax) : null,
      classeGdPreferida: p.classeGdPreferida,
      usinasElegiveis: p.usinasElegiveis,
      prioridade: p.prioridade,
    }));
  }

  private encontrarPolitica(contrato: ContratoAvaliado, politicas: PoliticaCarregada[]): PoliticaCarregada | null {
    return (
      politicas.find((p) => {
        if (contrato.kwhContrato < p.faixaMin) return false;
        if (p.faixaMax !== null && contrato.kwhContrato > p.faixaMax) return false;
        return true;
      }) ?? null
    );
  }

  private async usinaCompativelComPolitica(
    contrato: ContratoAvaliado,
    usina: UsinaAvaliada | null | undefined,
    politica: PoliticaCarregada | null,
  ): Promise<boolean> {
    if (!usina) return false;
    if (!politica) return true; // sem política aplicável = aceita usina atual
    if (politica.usinasElegiveis.length > 0 && !politica.usinasElegiveis.includes(usina.id)) {
      return false;
    }
    if (politica.classeGdPreferida && usina.classeGdAnotada !== politica.classeGdPreferida) {
      return false;
    }
    return true;
  }

  private async buscarMelhorCandidata(args: {
    contrato: ContratoAvaliado;
    usinas: UsinaAvaliada[];
    ocupacaoSimulada: Map<string, number>;
    politica: PoliticaCarregada | null;
  }): Promise<UsinaAvaliada | null> {
    const { contrato, usinas, ocupacaoSimulada, politica } = args;

    const estabilidade = await this.validador.validarEstabilidade(contrato.id);
    if (!estabilidade.valido) return null;

    let candidatas = usinas.filter((u) => u.id !== contrato.usinaAtualId);
    if (politica) {
      if (politica.usinasElegiveis.length > 0) {
        candidatas = candidatas.filter((u) => politica.usinasElegiveis.includes(u.id));
      }
      if (politica.classeGdPreferida) {
        candidatas = candidatas.filter((u) => u.classeGdAnotada === politica.classeGdPreferida);
      }
    }

    candidatas = await this.filtrarPorValidacoes(contrato, candidatas);

    candidatas = candidatas.filter((u) => {
      const ocupacao = ocupacaoSimulada.get(u.id) ?? 0;
      return ocupacao + contrato.kwhContrato <= u.capacidadeKwh;
    });

    candidatas.sort((a, b) => {
      const ocA = ocupacaoSimulada.get(a.id) ?? 0;
      const ocB = ocupacaoSimulada.get(b.id) ?? 0;
      const pctA = a.capacidadeKwh > 0 ? ocA / a.capacidadeKwh : 1;
      const pctB = b.capacidadeKwh > 0 ? ocB / b.capacidadeKwh : 1;
      return pctA - pctB;
    });

    return candidatas[0] ?? null;
  }

  private async filtrarPorValidacoes(contrato: ContratoAvaliado, usinas: UsinaAvaliada[]): Promise<UsinaAvaliada[]> {
    const validadas: UsinaAvaliada[] = [];
    for (const usina of usinas) {
      const distribuidora = await this.validador.validarDistribuidora(contrato.ucId, usina.id);
      if (!distribuidora.valido) continue;
      const concentracao = await this.validador.validarConcentracao25({
        cooperadoId: contrato.cooperadoId,
        usinaId: usina.id,
        kwhProposto: contrato.kwhContrato,
        contratoIdAtual: contrato.id,
      });
      if (!concentracao.valido) continue;
      const classeGd = await this.validador.validarClasseGd({
        contratoId: contrato.id,
        usinaSugeridaId: usina.id,
      });
      if (!classeGd.valido) continue;
      validadas.push(usina);
    }
    return validadas;
  }

  private tentarSwapPares(
    _realocacoes: RealocacaoSugerida[],
    _contratos: ContratoAvaliado[],
    _usinasIndex: Map<string, UsinaAvaliada>,
    _politicas: PoliticaCarregada[],
  ): void {
    // Espaço reservado pra busca local de swap-2. MVP: greedy sozinho atende.
    // Sprint 5a Neutro vai adicionar swap quando custo financeiro real for calculável.
  }

  private aplicarRealocacoesSimuladas(
    contratos: ContratoAvaliado[],
    realocacoes: RealocacaoSugerida[],
  ): ContratoAvaliado[] {
    const indexRealocados = new Map(realocacoes.map((r) => [r.contratoId, r.usinaSugeridaId]));
    return contratos.map((c) =>
      indexRealocados.has(c.id) ? { ...c, usinaAtualId: indexRealocados.get(c.id) ?? null } : c,
    );
  }

  private calcularCusto(
    contratos: ContratoAvaliado[],
    usinasIndex: Map<string, UsinaAvaliada>,
    politicas: PoliticaCarregada[],
  ): number {
    let custo = 0;
    for (const c of contratos) {
      const politica = this.encontrarPolitica(c, politicas);
      const usina = c.usinaAtualId ? usinasIndex.get(c.usinaAtualId) : null;
      if (!politica) continue;
      if (!usina) {
        custo += 200; // contrato sem usina
        continue;
      }
      if (politica.classeGdPreferida && usina.classeGdAnotada !== politica.classeGdPreferida) {
        custo += 100;
      }
      if (politica.usinasElegiveis.length > 0 && !politica.usinasElegiveis.includes(usina.id)) {
        custo += 100;
      }
    }
    return custo;
  }

  private coerceClasseGd(raw: string | null | undefined): ClasseGdAplicada | null {
    if (!raw) return null;
    const trimmed = raw.trim().toUpperCase();
    if (trimmed === 'GD_I' || trimmed === 'GDI' || trimmed === 'GD I') return 'GD_I';
    if (trimmed === 'GD_II' || trimmed === 'GDII' || trimmed === 'GD II') return 'GD_II';
    if (trimmed === 'GD_III' || trimmed === 'GDIII' || trimmed === 'GD III') return 'GD_III';
    return null;
  }
}
