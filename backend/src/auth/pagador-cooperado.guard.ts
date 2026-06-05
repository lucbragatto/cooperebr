import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma.service';
import { PerfilUsuario } from './perfil.enum';

/**
 * Sprint Portal Empresa 9.0 (04/06/2026) — Guard exclusivo do Portal da
 * Empresa Conveniada (/portal/meus-convenios/*).
 *
 * Garante que o Usuario autenticado (perfil EMPRESA_CONVENIADA) é o
 * responsável da empresa pagadora do convênio identificado por :id.
 *
 * Regra: `usuario.cooperadoId === convenio.pagadorCooperadoId`.
 *
 * Como Usuario não tem cooperadoId direto, resolvemos via match por email
 * (mesma estratégia do contexto cooperado em obterContextosUsuario):
 *   1. Carrega Cooperado por email = usuario.email
 *   2. Carrega ContratoConvenio por :id; valida pagadorCooperadoId === cooperado.id
 *
 * SUPER_ADMIN bypass (ADMIN/OPERADOR NÃO bypass — eles usam /convenios admin).
 *
 * Decora handler com @PagadorCooperadoOnly() + extrai :id do path padrão
 * (override via decorator opcional `convenioIdParam`).
 *
 * Sem o decorator → guard passa (não-quebrante).
 *
 * Side-effect: anexa `req.empresa = { cooperadoId, convenio }` para uso
 * downstream nos services (evita query duplicada).
 */

export const PAGADOR_COOPERADO_KEY = 'pagadorCooperadoOnly';

export interface PagadorCooperadoOpts {
  /** Nome do param do path que contém o id do convenio. Default: 'id'. */
  convenioIdParam?: string;
}

/**
 * Decorador que ativa o PagadorCooperadoGuard num handler do controller
 * portal da empresa. Aplicar em todo endpoint `/portal/meus-convenios/:id/*`.
 */
export const PagadorCooperadoOnly = (opts: PagadorCooperadoOpts = {}) =>
  SetMetadata(PAGADOR_COOPERADO_KEY, opts);

@Injectable()
export class PagadorCooperadoGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<PagadorCooperadoOpts>(
      PAGADOR_COOPERADO_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!opts) return true; // não-quebrante: sem decorator passa

    const req = context.switchToHttp().getRequest();
    const user = req?.user;
    if (!user) return false;

    // SUPER_ADMIN pode acessar pra debug/impersonate
    if (user.perfil === PerfilUsuario.SUPER_ADMIN) return true;

    // Opção A (Fatia F-G1 — 05/06/2026): em vez de gate por perfil
    // (EMPRESA_CONVENIADA), validamos posse real via email match +
    // pagadorCooperadoId (já feito mais abaixo). Empresa cooperada PJ tem
    // perfil COOPERADO (decisão COOPERADO-ONLY 04/06), então gate por
    // perfil quebrava o caminho. A própria checagem cooperado.id ===
    // convenio.pagadorCooperadoId garante autorização: cooperado comum
    // sem ser pagador → NotFound (anti-enumeração); empresa cooperada
    // pagadora → passa. PerfilUsuario.EMPRESA_CONVENIADA continua
    // existindo no enum (deprecated) — caso algum Usuario legado tenha
    // sido criado com ele, também passa por aqui (não é rejeitado).

    if (!user.email) {
      throw new ForbiddenException('Usuário sem email no token.');
    }

    // Resolve Cooperado pagador via email match
    const cooperado = await this.prisma.cooperado.findFirst({
      where: { email: user.email },
      select: { id: true, cooperativaId: true },
    });
    if (!cooperado) {
      throw new ForbiddenException(
        'Usuário não vinculado a nenhum cooperado (esperado vínculo por email).',
      );
    }

    const convenioIdParam = opts.convenioIdParam ?? 'id';
    const convenioId = req.params?.[convenioIdParam];
    if (!convenioId) {
      throw new ForbiddenException(
        `Path param :${convenioIdParam} obrigatório neste endpoint.`,
      );
    }

    const convenio = await this.prisma.contratoConvenio.findUnique({
      where: { id: convenioId },
      select: {
        id: true,
        pagadorCooperadoId: true,
        status: true,
        cooperativaId: true,
        empresaNome: true,
      },
    });
    if (!convenio) {
      // 404 propositais — evita enumeração
      throw new NotFoundException('Convênio não encontrado.');
    }

    if (convenio.pagadorCooperadoId !== cooperado.id) {
      // 404 (não 403) — evita confirmar existência do convênio pra quem não é o pagador
      throw new NotFoundException('Convênio não encontrado.');
    }

    // Side-effect: anexa pra evitar refetch no service
    req.empresa = {
      cooperadoId: cooperado.id,
      cooperativaId: convenio.cooperativaId,
      convenio: {
        id: convenio.id,
        empresaNome: convenio.empresaNome,
        status: convenio.status,
      },
    };

    return true;
  }
}
