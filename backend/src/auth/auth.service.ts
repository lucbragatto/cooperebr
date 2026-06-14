import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { PerfilUsuario } from './perfil.enum';
import { randomUUID } from 'crypto';
import { STATUS_COOPERADO_ATIVOS } from '../cooperados/cooperado-matcher.helper';

@Injectable()
export class AuthService {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private whatsappSender: WhatsappSenderService,
  ) {}

  async register(data: {
    nome: string;
    email: string;
    cpf?: string;
    telefone?: string;
    senha: string;
    perfil?: PerfilUsuario;
  }) {
    const orConditions: any[] = [{ email: data.email }];
    if (data.cpf) orConditions.push({ cpf: data.cpf });
    if (data.telefone) orConditions.push({ telefone: data.telefone });

    const existente = await this.prisma.usuario.findFirst({
      where: { OR: orConditions },
    });

    if (existente) {
      throw new ConflictException(
        'Já existe um usuário com esse email, CPF ou telefone',
      );
    }

    const { data: supabaseData, error } = await this.supabase.auth.signUp({
      email: data.email,
      password: data.senha,
    });

    if (error || !supabaseData.user) {
      throw new ConflictException(
        error?.message ?? 'Erro ao criar usuário no Supabase',
      );
    }

    const usuario = await (this.prisma.usuario.create as any)({
      data: {
        nome: data.nome,
        email: data.email,
        cpf: data.cpf,
        telefone: data.telefone,
        supabaseId: supabaseData.user.id,
        perfil: data.perfil ?? PerfilUsuario.COOPERADO,
      },
    });

    const token = this.assinarToken(usuario.id, usuario.email, usuario.perfil);
    return { token, usuario: this.formatarUsuario(usuario) };
  }

  async login(identificador: string, senha: string) {
    if (!identificador || !senha) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    let email = identificador;

    if (!identificador.includes('@')) {
      const usuario = await this.prisma.usuario.findFirst({
        where: {
          OR: [{ cpf: identificador }, { telefone: identificador }],
        },
      });

      if (!usuario) {
        throw new UnauthorizedException('Credenciais inválidas');
      }

      email = usuario.email;
    }

    const { data: supabaseData, error } =
      await this.supabase.auth.signInWithPassword({ email, password: senha });

    if (error || !supabaseData.user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const usuario: any = await this.prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      throw new InternalServerErrorException(
        'Usuário não encontrado na base local',
      );
    }

    // Buscar cooperadoId vinculado ao usuário (match por email ou CPF)
    const cooperadoWhere: any[] = [{ email: usuario.email }];
    if (usuario.cpf) cooperadoWhere.push({ cpf: usuario.cpf });
    const cooperado = await (this.prisma.cooperado as any).findFirst({
      where: { OR: cooperadoWhere },
      select: { id: true, cooperativaId: true },
    });

    const token = this.assinarToken(usuario.id, usuario.email, usuario.perfil, {
      cooperadoId: cooperado?.id ?? undefined,
      cooperativaId: cooperado?.cooperativaId ?? usuario.cooperativaId ?? undefined,
      administradoraId: usuario.administradoraId ?? undefined,
    });
    return { token, usuario: this.formatarUsuario(usuario) };
  }

  async esqueciSenha(emailOuIdentificador: string) {
    let email = emailOuIdentificador;

    // Se não for email, buscar o email do usuário
    if (!emailOuIdentificador.includes('@')) {
      const usuario = await this.buscarPorIdentificador(emailOuIdentificador);
      if (!usuario) {
        return { ok: true, mensagem: 'Se o email existir, você receberá um link de redefinição.' };
      }
      email = usuario.email;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://cooperebr.com.br';
    await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${frontendUrl}/redefinir-senha`,
    });
    return { ok: true, mensagem: 'Se o email existir, você receberá um link de redefinição.' };
  }

  async redefinirSenha(accessToken: string, novaSenha: string, resetToken?: string) {
    // Fluxo via token WhatsApp (resetToken próprio)
    if (resetToken) {
      const usuario: any = await this.prisma.usuario.findFirst({
        where: { resetToken },
      });
      if (!usuario || !usuario.resetTokenExpiry || new Date() > usuario.resetTokenExpiry) {
        throw new UnauthorizedException('Token inválido ou expirado');
      }
      if (!usuario.supabaseId) {
        throw new BadRequestException('Usuário sem vinculação Supabase');
      }
      const { error } = await this.supabase.auth.admin.updateUserById(usuario.supabaseId, {
        password: novaSenha,
      });
      if (error) {
        throw new BadRequestException(error.message);
      }
      await (this.prisma.usuario.update as any)({
        where: { id: usuario.id },
        data: { resetToken: null, resetTokenExpiry: null },
      });
      return { ok: true };
    }

    // Fluxo via Supabase access_token (email)
    const { data: { user }, error: sessionError } = await this.supabase.auth.getUser(accessToken);
    if (sessionError || !user) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
    const { error } = await this.supabase.auth.admin.updateUserById(user.id, {
      password: novaSenha,
    });
    if (error) {
      throw new BadRequestException(error.message);
    }
    return { ok: true };
  }

  async alterarSenha(usuarioId: string, senhaAtual: string, novaSenha: string) {
    const usuario: any = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const { error: loginError } = await this.supabase.auth.signInWithPassword({
      email: usuario.email,
      password: senhaAtual,
    });
    if (loginError) {
      throw new UnauthorizedException('Senha atual incorreta');
    }

    const { error } = await this.supabase.auth.admin.updateUserById(usuario.supabaseId, {
      password: novaSenha,
    });
    if (error) {
      throw new BadRequestException(error.message);
    }
    return { ok: true };
  }

  async criarUsuario(
    data: { email: string; senha: string; perfil: string; nome: string; cooperativaId?: string },
    adminUser: any,
  ) {
    if (adminUser.perfil === PerfilUsuario.ADMIN) {
      if (!adminUser.cooperativaId) {
        throw new ForbiddenException('Admin sem cooperativa associada');
      }
      if (data.cooperativaId && data.cooperativaId !== adminUser.cooperativaId) {
        throw new ForbiddenException('Você só pode criar usuários na sua cooperativa');
      }
      data.cooperativaId = adminUser.cooperativaId;
    }

    const existente = await this.prisma.usuario.findFirst({
      where: { email: data.email },
    });
    if (existente) {
      throw new ConflictException('Já existe um usuário com esse email');
    }

    const { data: supabaseData, error } = await this.supabase.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
    });
    if (error || !supabaseData.user) {
      throw new ConflictException(error?.message ?? 'Erro ao criar usuário no Supabase');
    }

    const usuario = await (this.prisma.usuario.create as any)({
      data: {
        nome: data.nome,
        email: data.email,
        supabaseId: supabaseData.user.id,
        perfil: data.perfil,
        cooperativaId: data.cooperativaId || null,
      },
      select: {
        id: true, nome: true, email: true, perfil: true,
        cooperativaId: true, ativo: true, createdAt: true,
      },
    });
    return usuario;
  }

  async criarUsuarioAgregador(
    data: { email: string; senha: string; nome: string; administradoraId: string },
    adminUser: any,
  ) {
    if (!adminUser.cooperativaId) {
      throw new ForbiddenException('Admin sem cooperativa associada');
    }

    const administradora = await this.prisma.administradora.findUnique({
      where: { id: data.administradoraId },
      select: { id: true, cooperativaId: true },
    });
    if (!administradora || administradora.cooperativaId !== adminUser.cooperativaId) {
      throw new ForbiddenException('Agregador não pertence à sua cooperativa');
    }

    const existente = await this.prisma.usuario.findFirst({
      where: { email: data.email },
    });
    if (existente) {
      throw new ConflictException('Já existe um usuário com esse email');
    }

    const { data: supabaseData, error } = await this.supabase.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
    });
    if (error || !supabaseData.user) {
      throw new ConflictException(error?.message ?? 'Erro ao criar usuário no Supabase');
    }

    const usuario = await (this.prisma.usuario.create as any)({
      data: {
        nome: data.nome,
        email: data.email,
        supabaseId: supabaseData.user.id,
        perfil: PerfilUsuario.AGREGADOR,
        cooperativaId: adminUser.cooperativaId,
        administradoraId: data.administradoraId,
      },
      select: {
        id: true, nome: true, email: true, perfil: true,
        cooperativaId: true, administradoraId: true, ativo: true, createdAt: true,
      },
    });
    return usuario;
  }

  async atualizarUsuario(
    id: string,
    data: { email?: string; nome?: string; perfil?: string; ativo?: boolean },
    adminUser: any,
  ) {
    const usuario: any = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const coopaUsuario = usuario.cooperativaId ?? null;
    const coopaAdmin = adminUser.cooperativaId ?? null;
    if (adminUser.perfil === PerfilUsuario.ADMIN && coopaUsuario !== coopaAdmin) {
      throw new ForbiddenException('Sem permissão para editar este usuário');
    }

    if (data.email && data.email !== usuario.email && usuario.supabaseId) {
      const { error } = await this.supabase.auth.admin.updateUserById(usuario.supabaseId, {
        email: data.email,
      });
      if (error) throw new BadRequestException(error.message);
    }

    const atualizado = await (this.prisma.usuario.update as any)({
      where: { id },
      data: {
        ...(data.email !== undefined && { email: data.email }),
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.perfil !== undefined && { perfil: data.perfil }),
        ...(data.ativo !== undefined && { ativo: data.ativo }),
      },
      select: {
        id: true, nome: true, email: true, perfil: true,
        cooperativaId: true, ativo: true, createdAt: true,
      },
    });
    return atualizado;
  }

  async listarUsuarios(adminUser: any) {
    const where: any = {};
    if (adminUser.perfil === PerfilUsuario.ADMIN) {
      where.cooperativaId = adminUser.cooperativaId;
    }

    return this.prisma.usuario.findMany({
      where,
      select: {
        id: true, email: true, perfil: true, nome: true,
        cooperativaId: true, administradoraId: true, ativo: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deletarUsuario(id: string) {
    const usuario: any = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    if (usuario.supabaseId) {
      await this.supabase.auth.admin.deleteUser(usuario.supabaseId);
    }
    await this.prisma.usuario.delete({ where: { id } });
    return { ok: true };
  }

  async enviarResetSenhaPorAdmin(id: string, adminUser: any) {
    const usuario: any = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const coopaUsuarioReset = usuario.cooperativaId ?? null;
    const coopaAdminReset = adminUser.cooperativaId ?? null;
    if (adminUser.perfil === PerfilUsuario.ADMIN && coopaUsuarioReset !== coopaAdminReset) {
      throw new ForbiddenException('Sem permissão para resetar senha deste usuário');
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://cooperebr.com.br';
    await this.supabase.auth.resetPasswordForEmail(usuario.email, {
      redirectTo: `${frontendUrl}/redefinir-senha`,
    });
    return { ok: true };
  }

  async verificarCanal(identificador: string) {
    const usuario = await this.buscarPorIdentificador(identificador);
    if (!usuario) {
      return { temWhatsapp: false, temEmail: false };
    }
    return {
      temWhatsapp: !!usuario.telefone,
      temEmail: !!usuario.email,
      telefone: usuario.telefone ? this.mascararTelefone(usuario.telefone) : undefined,
      email: usuario.email ? this.mascararEmail(usuario.email) : undefined,
    };
  }

  async esqueciSenhaWhatsapp(identificador: string) {
    const usuario: any = await this.buscarPorIdentificador(identificador);
    if (!usuario) {
      return { ok: true, mensagem: 'Se o usuário existir, receberá um link.' };
    }

    if (!usuario.telefone) {
      throw new BadRequestException('Usuário não possui telefone cadastrado');
    }

    const token = randomUUID();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await (this.prisma.usuario.update as any)({
      where: { id: usuario.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'https://cooperebr.com.br';
    const link = `${frontendUrl}/redefinir-senha?token=${token}`;

    const texto = `Olá, ${usuario.nome}! 👋\n\nVocê solicitou redefinição de senha no CoopereBR.\n\nClique no link abaixo para criar uma nova senha (válido por 1 hora):\n\n${link}\n\nSe não foi você, ignore esta mensagem.`;

    await this.whatsappSender.enviarMensagem(usuario.telefone, texto, {
      tipoDisparo: 'RESET_SENHA',
      cooperadoId: usuario.id,
      cooperativaId: usuario.cooperativaId ?? undefined,
    });

    return {
      canal: 'whatsapp',
      telefone: this.mascararTelefone(usuario.telefone),
    };
  }

  async obterContextosUsuario(usuario: any) {
    const contextos: Array<{
      tipo: string;
      label: string;
      id?: string;
      cooperativaId?: string;
      cooperativaNome?: string;
      modulosAtivos?: string[];
      modalidadesAtivas?: Record<string, string>;
    }> = [];

    // 1. Perfil principal do sistema (SUPER_ADMIN, ADMIN, OPERADOR)
    if (usuario.perfil === 'SUPER_ADMIN') {
      contextos.push({ tipo: 'super_admin', label: 'Super Administrador' });
    }

    // 2. Se é ADMIN ou OPERADOR de uma cooperativa
    if (
      (usuario.perfil === 'ADMIN' || usuario.perfil === 'OPERADOR') &&
      usuario.cooperativaId
    ) {
      const coop = await this.prisma.cooperativa.findUnique({
        where: { id: usuario.cooperativaId },
        select: { id: true, nome: true, tipoParceiro: true, modulosAtivos: true, modalidadesAtivas: true },
      });
      if (coop) {
        contextos.push({
          tipo: 'admin_parceiro',
          label: `Admin — ${coop.nome}`,
          id: coop.id,
          cooperativaId: coop.id,
          cooperativaNome: coop.nome,
          modulosAtivos: coop.modulosAtivos ?? [],
          modalidadesAtivas: (coop.modalidadesAtivas as Record<string, string>) ?? {},
        });
      }
    }

    // 2b. Se é AGREGADOR, montar contexto do agregador
    if (usuario.perfil === 'AGREGADOR' && usuario.administradoraId) {
      const agregador = await this.prisma.administradora.findUnique({
        where: { id: usuario.administradoraId },
        select: { id: true, razaoSocial: true, cooperativaId: true, cooperativa: { select: { nome: true } } },
      });
      if (agregador) {
        contextos.push({
          tipo: 'admin_agregador',
          label: `Agregador — ${agregador.razaoSocial}`,
          id: agregador.id,
          cooperativaId: agregador.cooperativaId,
          cooperativaNome: agregador.cooperativa?.nome,
        });
      }
    }

    // 3. Verificar se o usuário também é cooperado (match por CPF ou email).
    // Sprint "Qual cadastro?" Fix 3 (08/06/2026): findMany (era findFirst).
    // Mesmo Usuario pode ter cadastros PF + PJ(s) → 1 contexto cooperado por
    // cadastro com `id` diferente (cooperadoId). Front lista no ContextoSwitcher.
    const cooperadoWhere: any[] = [{ email: usuario.email }];
    if (usuario.cpf) cooperadoWhere.push({ cpf: usuario.cpf });

    const cooperados = await this.prisma.cooperado.findMany({
      where: {
        OR: cooperadoWhere,
        status: { in: STATUS_COOPERADO_ATIVOS as unknown as any[] },
      },
      select: {
        id: true,
        nomeCompleto: true,
        razaoSocial: true,
        tipoPessoa: true,
        cooperativaId: true,
        cooperativa: { select: { id: true, nome: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const cooperado of cooperados) {
      const tipo = (cooperado.tipoPessoa ?? 'PF').toUpperCase();
      const nomeExibir =
        tipo === 'PJ' && cooperado.razaoSocial ? cooperado.razaoSocial : cooperado.nomeCompleto;
      const label =
        cooperados.length === 1
          ? `Cooperado — ${cooperado.cooperativa?.nome ?? 'Sem parceiro'}`
          : `Cooperado ${tipo} — ${nomeExibir}`;
      contextos.push({
        tipo: 'cooperado',
        label,
        id: cooperado.id,
        cooperativaId: cooperado.cooperativaId ?? undefined,
        cooperativaNome: cooperado.cooperativa?.nome ?? undefined,
      });
    }

    // Compat retro com o resto da função: variável `cooperado` (singular)
    // continua referenciando o 1º — usada por seções subsequentes
    // (empresa_conveniada + proprietario_usina). Quando 2º cooperado entrar
    // como pagador/proprietario, fixar essas seções pra iterar também.
    const cooperado = cooperados[0] ?? null;

    // Sprint Portal Empresa 9.0 (04/06/2026) — contexto EMPRESA_CONVENIADA:
    // o Usuario é o responsável de uma empresa pagadora de algum convênio.
    // O vínculo Usuario → Cooperado(PJ pagador) é o mesmo do COOPERADO
    // (match por email). Se esse cooperado é pagadorCooperadoId de pelo
    // menos um convênio ATIVO, exibe o contexto.
    if (cooperado) {
      const conveniosOndeEhPagador = await this.prisma.contratoConvenio.findMany({
        where: {
          pagadorCooperadoId: cooperado.id,
          status: 'ATIVO',
        },
        select: {
          id: true,
          empresaNome: true,
          cooperativaId: true,
        },
        orderBy: { empresaNome: 'asc' },
      });

      if (conveniosOndeEhPagador.length > 0) {
        const label =
          conveniosOndeEhPagador.length === 1
            ? `Empresa — ${conveniosOndeEhPagador[0].empresaNome}`
            : `Empresa — ${conveniosOndeEhPagador.length} convênios`;
        // Cooperativa relation precisa ser buscada à parte (ContratoConvenio
        // não tem @relation pra Cooperativa no schema)
        const primCoopId = conveniosOndeEhPagador[0].cooperativaId;
        const primCoop = primCoopId
          ? await this.prisma.cooperativa.findUnique({
              where: { id: primCoopId },
              select: { nome: true },
            })
          : null;
        contextos.push({
          tipo: 'empresa_conveniada',
          label,
          id: cooperado.id, // cooperadoId do pagador (identifica a empresa no portal)
          cooperativaId: primCoopId ?? undefined,
          cooperativaNome: primCoop?.nome ?? undefined,
        });
      }
    }

    // 4. Verificar se o usuário é proprietário de usina (via cooperado ou por email)
    let usinasProprietario: any[] = [];
    if (cooperado) {
      usinasProprietario = await this.prisma.usina.findMany({
        where: { proprietarioCooperadoId: cooperado.id },
        select: { id: true, nome: true, cooperativaId: true },
      });
    }
    if (usinasProprietario.length === 0 && usuario.email) {
      usinasProprietario = await this.prisma.usina.findMany({
        where: { proprietarioEmail: usuario.email },
        select: { id: true, nome: true, cooperativaId: true },
      });
    }

    if (usinasProprietario.length > 0) {
      contextos.push({
        tipo: 'proprietario_usina',
        label: `Proprietário — ${usinasProprietario.map((u) => u.nome).join(', ')}`,
      });
    }

    // SUPER_ADMIN pode impersonar qualquer contexto — buscar todas cooperativas
    let parceirosDisponiveis: any[] = [];
    if (usuario.perfil === 'SUPER_ADMIN') {
      parceirosDisponiveis = await this.prisma.cooperativa.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, tipoParceiro: true },
        orderBy: { nome: 'asc' },
      });
    }

    return {
      usuario: this.formatarUsuario(usuario),
      cooperativaId: usuario.cooperativaId ?? null,
      contextos,
      cooperadoId: cooperado?.id ?? null,
      usinasProprietario: usinasProprietario.map((u) => ({
        id: u.id,
        nome: u.nome,
      })),
      parceirosDisponiveis,
    };
  }

  /**
   * Sprint "Qual cadastro?" Fix 3+4 (08/06/2026) — `cooperadoIdEscolhido`
   * é opcional, usado quando Usuario tem múltiplos contextos `cooperado`
   * (PF + PJs) e precisa especificar qual ativar.
   *
   * ANTI-IDOR (Fix 4): SEMPRE re-busca contextos pelo `usuario.id` e
   * valida que o `cooperadoIdEscolhido` está na lista permitida. Payload
   * do usuário NÃO é fonte de verdade — só seleciona dentre opções já
   * comprovadas como dele.
   */
  async trocarContexto(
    usuario: any,
    contexto: string,
    cooperativaId?: string,
    cooperadoIdEscolhido?: string,
  ) {
    const contextos = await this.obterContextosUsuario(usuario);

    // Pra contextos sem `id` distintivo (1 entrada por tipo) basta achar
    // por tipo. Pra `cooperado` (que agora pode ter múltiplos), se
    // cooperadoIdEscolhido vier, validar que está na lista DESSE usuário.
    let contextoValido = contextos.contextos.find((c) => c.tipo === contexto);

    if (contexto === 'cooperado') {
      const cooperadosDoUsuario = contextos.contextos.filter((c) => c.tipo === 'cooperado');
      if (cooperadosDoUsuario.length === 0) {
        throw new ForbiddenException('Contexto cooperado não disponível para este usuário');
      }
      if (cooperadoIdEscolhido) {
        const escolhido = cooperadosDoUsuario.find((c) => c.id === cooperadoIdEscolhido);
        if (!escolhido) {
          // anti-IDOR: tentativa de trocar pra cadastro de terceiro
          throw new ForbiddenException(
            'Cadastro cooperado não pertence a este usuário',
          );
        }
        contextoValido = escolhido;
      } else if (cooperadosDoUsuario.length > 1) {
        // Múltiplos sem escolha explícita → erro instrutivo (front deve
        // passar cooperadoId). Mantém fallback no primeiro pra compat
        // com chamadores antigos seria silenciar bug — preferimos exigir.
        throw new ForbiddenException(
          'Múltiplos cadastros cooperado — informe cooperadoId no body',
        );
      } else {
        contextoValido = cooperadosDoUsuario[0];
      }
    }

    if (!contextoValido) {
      throw new ForbiddenException('Contexto não disponível para este usuário');
    }

    let cooperadoId: string | undefined;
    let coopId: string | undefined;

    if (contexto === 'super_admin' && cooperativaId) {
      // SUPER_ADMIN impersonando uma cooperativa
      const coop = await this.prisma.cooperativa.findUnique({
        where: { id: cooperativaId },
        select: { id: true },
      });
      if (!coop) throw new NotFoundException('Cooperativa não encontrada');
      coopId = cooperativaId;
    } else if (contexto === 'cooperado') {
      cooperadoId = contextoValido.id;
      coopId = contextoValido.cooperativaId;
    } else if (contexto === 'empresa_conveniada') {
      // BUG CRÍTICO (blocker Santi, 14/06/2026) — sem esta branch, JWT
      // saía com cooperadoId+cooperativaId undefined, quebrando todas
      // as rotas /empresa/* (resgatar, distribuir, meus-resgates) que
      // dependem de req.user.cooperadoId.
      //
      // Anti-spoofing: `contextoValido` veio de obterContextosUsuario,
      // que monta a entrada empresa_conveniada SÓ se o usuário tem
      // Cooperado pagador de convênio ATIVO (auth.service.ts:572-577).
      // Não é possível trocar pra empresa de outro user.
      //
      // Mesma forma do caso 'cooperado': contextoValido.id é o
      // Cooperado.id pagador (que identifica a empresa no portal) +
      // contextoValido.cooperativaId é a cooperativa do convênio.
      cooperadoId = contextoValido.id;
      coopId = contextoValido.cooperativaId;
    } else if (contexto === 'admin_parceiro') {
      coopId = contextoValido.cooperativaId;
    } else if (contexto === 'admin_agregador') {
      coopId = contextoValido.cooperativaId;
    } else if (contexto === 'super_admin') {
      // sem cooperativaId — contexto puro super_admin
    } else if (contexto === 'proprietario_usina') {
      coopId = contextoValido.cooperativaId;
    }

    const token = this.assinarToken(usuario.id, usuario.email, usuario.perfil, {
      cooperadoId,
      cooperativaId: coopId,
      administradoraId: contexto === 'admin_agregador' ? usuario.administradoraId : undefined,
    });

    return { token, contexto, cooperativaId: coopId ?? null, cooperadoId: cooperadoId ?? null };
  }

  private async buscarPorIdentificador(identificador: string) {
    const trimmed = identificador.trim();
    return this.prisma.usuario.findFirst({
      where: {
        OR: [
          { email: trimmed },
          { cpf: trimmed },
          { telefone: trimmed },
        ],
      },
    });
  }

  private mascararTelefone(telefone: string): string {
    const digits = telefone.replace(/\D/g, '');
    if (digits.length >= 8) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)}****-${digits.slice(-4)}`;
    }
    return '****' + telefone.slice(-4);
  }

  private mascararEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const masked = local.slice(0, 1) + '***';
    return `${masked}@${domain}`;
  }

  private assinarToken(sub: string, email: string, perfil: PerfilUsuario, extra?: { cooperadoId?: string; cooperativaId?: string; administradoraId?: string }) {
    return this.jwtService.sign({ sub, email, perfil, ...extra });
  }

  /**
   * D-novo-BM (29/05/2026) — Helper público usado APENAS pelo AuthDevController.
   * Gera JWT pra impersonate de um usuário-alvo. NÃO usar em código de produção.
   * O controller protege com guard `isAmbienteReal()` + role SUPER_ADMIN.
   */
  async assinarTokenImpersonate(target: {
    id: string;
    email: string;
    perfil: PerfilUsuario;
    cooperativaId: string | null;
    administradoraId: string | null;
    cpf: string | null;
  }) {
    // Busca cooperadoId vinculado (match por email/cpf) — espelha lógica do login()
    const cooperadoWhere: any[] = [{ email: target.email }];
    if (target.cpf) cooperadoWhere.push({ cpf: target.cpf });
    const cooperado = await (this.prisma.cooperado as any).findFirst({
      where: {
        OR: cooperadoWhere,
        status: { in: STATUS_COOPERADO_ATIVOS as unknown as any[] },
      },
      select: { id: true, cooperativaId: true },
    });

    const payload = {
      sub: target.id,
      email: target.email,
      perfil: target.perfil,
      cooperadoId: cooperado?.id ?? undefined,
      cooperativaId: cooperado?.cooperativaId ?? target.cooperativaId ?? undefined,
      administradoraId: target.administradoraId ?? undefined,
    };
    // AN.3.1 (M42, 30/05/2026) — TTL aumentado de 1h pra 8h pra reduzir fricção
    // operacional do Luciano usando o painel dev de credenciais. Continua dev-only
    // (endpoint gated por isAmbienteReal()=false). Em produção AMBIENTE_REAL=true
    // o endpoint nem responde, então o TTL aqui é irrelevante.
    return this.jwtService.sign(payload, { expiresIn: '8h' });
  }

  private formatarUsuario(usuario: {
    id: string;
    nome: string;
    email: string;
    cpf: string | null;
    telefone: string | null;
    perfil: PerfilUsuario;
    cooperativaId?: string | null;
    fotoFacialUrl?: string | null;
  }) {
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      cpf: usuario.cpf,
      telefone: usuario.telefone,
      perfil: usuario.perfil,
      cooperativaId: usuario.cooperativaId ?? null,
      fotoFacialUrl: usuario.fotoFacialUrl ?? null,
    };
  }
}
