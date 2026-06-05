/**
 * Fatia F-G1 (05/06/2026) — Cooperado institucional fantasma por cooperativa.
 *
 * Resolve o problema de "convite institucional não tem indicador real": quando
 * o ADMIN da cooperativa cria/envia convite de indicação pela web (sem um
 * cooperado-pessoa por trás), precisamos de um `cooperadoIndicadorId` pra
 * preservar:
 *  - Constraint `@@unique([cooperadoIndicadorId, telefoneConvidado])` do model
 *    ConviteIndicacao (Prisma trata null como "qualquer valor" em unique
 *    composto → quebra).
 *  - Cadeia `processarPrimeiraFaturaPaga` (FK `Indicacao.cooperadoIndicadorId`
 *    é NOT NULL).
 *  - Audit limpa.
 *
 * Solução: cooperado fantasma `{Cooperativa.nome} — Institucional`, CNPJ da
 * cooperativa, `tipoCooperado=SEM_UC`, email `institucional+<coopId>@sisgd.invalid`
 * (RFC 2606 — domínio reservado nunca roteável; bate `ehEmailFake` da
 * whitelist-teste → comms estruturalmente bloqueadas nas 3 camadas).
 *
 * Idempotente: seed por cooperativa. Reusa cooperado existente se já criado.
 *
 * Decisão Luciano 05/06: quando o indicador for o institucional, NÃO emitir
 * bônus (BeneficioIndicacao + tokens). A `Indicacao` ainda é criada
 * (rastreabilidade do "veio via convite institucional"), mas o
 * processarPrimeiraFaturaPaga consulta `ehIndicadorInstitucional(id)` e dá
 * early-return na parte de bônus.
 *
 * SALVAGUARDA: cooperados institucionais NUNCA devem ser deletados por
 * rotinas de limpeza de dados de teste. Documentado em CLAUDE.md.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * Domínio reservado RFC 2606 — nunca roteável. Bate `ehEmailFake` (.invalid)
 * → comms estruturalmente bloqueadas (whitelist LGPD + isAmbienteReal + dev
 * pattern check).
 */
const DOMINIO_INSTITUCIONAL = 'sisgd.invalid';

@Injectable()
export class CooperadoInstitucionalService {
  private readonly logger = new Logger(CooperadoInstitucionalService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Gera/recupera o cooperado institucional da cooperativa. Idempotente.
   * Chamado on-demand pelo POST admin de criar convite de indicação
   * (em vez de seed eager no onModuleInit pra evitar criação em
   * cooperativas que nunca vão usar G1).
   */
  async garantirInstitucional(cooperativaId: string): Promise<{
    id: string;
    nomeCompleto: string;
    email: string;
    cooperativaId: string;
    isInstitucional: true;
  }> {
    const emailInstitucional = `institucional+${cooperativaId}@${DOMINIO_INSTITUCIONAL}`;

    // 1. Já existe?
    const existente = await this.prisma.cooperado.findUnique({
      where: { email: emailInstitucional },
      select: { id: true, nomeCompleto: true, email: true, cooperativaId: true },
    });
    if (existente) {
      return { ...existente, cooperativaId: existente.cooperativaId!, isInstitucional: true };
    }

    // 2. Carrega cooperativa (pra nome + cnpj)
    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: cooperativaId },
      select: { id: true, nome: true, cnpj: true },
    });
    if (!coop) {
      throw new NotFoundException(`Cooperativa ${cooperativaId} não encontrada.`);
    }

    // 3. CPF fake "institucional" (15 dígitos, fora do padrão CPF/CNPJ válidos)
    // se cooperativa não tiver CNPJ. CNPJ real tem 14 dígitos — fallback usa
    // padrão repetido que `ehEmailFake` reconhece como teste (defesa adicional).
    // Schema exige cooperado.cpf @unique (String?) — usamos CNPJ se houver,
    // senão padrão sintético inválido.
    const cpfInstitucional = coop.cnpj
      ? coop.cnpj.replace(/\D/g, '')
      : `INST-${cooperativaId.slice(0, 11)}`;

    // 4. Cria. tipoCooperado=SEM_UC pra nunca aparecer em fluxos COM_UC.
    const criado = await this.prisma.cooperado.create({
      data: {
        nomeCompleto: `${coop.nome} — Institucional`,
        email: emailInstitucional,
        cpf: cpfInstitucional,
        telefone: undefined, // sem telefone — nunca recebe WA
        status: 'ATIVO',
        tipoCooperado: 'SEM_UC',
        cooperativaId,
        termoAdesaoAceito: true,
        termoAdesaoAceitoEm: new Date(),
      },
      select: { id: true, nomeCompleto: true, email: true, cooperativaId: true },
    });

    this.logger.log(
      `[institucional] Cooperado fantasma criado: ${criado.id} (${criado.nomeCompleto}) ` +
        `pra cooperativa ${cooperativaId}`,
    );
    return { ...criado, cooperativaId: criado.cooperativaId!, isInstitucional: true };
  }

  /**
   * Verifica se um cooperado é o institucional da cooperativa dele.
   * Usado em processarPrimeiraFaturaPaga pra skip do bônus (decisão Luciano
   * 05/06: institucional NÃO emite BeneficioIndicacao nem tokens — não há
   * referrer real).
   *
   * Match leve via prefix do email (não precisa carregar cooperativa).
   */
  async ehInstitucional(cooperadoId: string): Promise<boolean> {
    const c = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { email: true },
    });
    if (!c?.email) return false;
    return (
      c.email.startsWith('institucional+') && c.email.endsWith(`@${DOMINIO_INSTITUCIONAL}`)
    );
  }
}
