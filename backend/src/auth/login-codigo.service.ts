import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { PerfilUsuario } from './perfil.enum';

/**
 * Login por código (OTP) usando a base de beneficiários da CoopereBR.
 *
 * O código é enviado e conferido pela Azure Function `func-cadastro-benef`
 * (rotas /login/solicitar-codigo e /login/validar-codigo — as mesmas do app
 * app.cooperebr.com.br). Quando o código confere, o clube encontra o cooperado
 * pelo CPF/CNPJ ou cria Usuario + Cooperado na hora e emite a sessão local
 * (mesmo JWT do login por senha). Para o usuário o acesso é único.
 *
 * Configuração (backend/.env):
 *   CADASTRO_BENEF_API_URL   ex.: https://func-cadastro-benef.azurewebsites.net/api
 *   CADASTRO_BENEF_API_KEY   chave da Function com escopo "Login"
 *   CLUBE_COOPERATIVA_ID     cooperativa onde os beneficiários entram (fallback: nome "CoopereBR")
 *   CLUBE_SISTEMAS_PERMITIDOS  ids de sistema SISGDSOLAR aceitos (padrão "2" = COOPERE-BR)
 */

type Alvo = { telefone: string } | { email: string };

interface ContaBeneficiario {
  id_usuario: number | null;
  id_beneficiario: number | null;
  nome_beneficiario: string | null;
  cpf_cnpj_beneficiario: string | null;
  login_email: string | null;
  telefone: string | null;
  id_sistema_compensacao: number | null;
  sistema_nome: string | null;
}

const TIMEOUT_MS = 45_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class LoginCodigoService {
  private readonly logger = new Logger(LoginCodigoService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async solicitar(identificador: string, ipCliente: string) {
    const alvo = this.montarAlvo(identificador);
    const resp = await this.chamarFunction('/login/solicitar-codigo', alvo, ipCliente);
    // Resposta neutra: não revela se a conta existe.
    return {
      ok: true,
      canal: 'telefone' in alvo ? 'telefone' : 'email',
      telefoneMascarado: resp?.telefone_mascarado ?? null,
      emailMascarado: resp?.email_mascarado ?? null,
      expiraEmSegundos: resp?.expira_em_segundos ?? 600,
    };
  }

  async validar(identificador: string, codigo: string, ipCliente: string) {
    const alvo = this.montarAlvo(identificador);
    const cod = (codigo || '').replace(/\D/g, '');
    if (cod.length !== 6) throw new BadRequestException('O código tem 6 dígitos.');

    const resp = await this.chamarFunction('/login/validar-codigo', { ...alvo, codigo: cod }, ipCliente);
    const contas: ContaBeneficiario[] = Array.isArray(resp?.contas) ? resp.contas : [];

    const permitidos = (process.env.CLUBE_SISTEMAS_PERMITIDOS || '2')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    const conta = contas.find(
      (c) => c.id_sistema_compensacao != null && permitidos.includes(Number(c.id_sistema_compensacao)),
    );
    if (!conta) {
      throw new ForbiddenException({
        codigo: 'NAO_BENEFICIARIO_COOPEREBR',
        message: 'Não encontramos um cadastro da CoopereBR para este acesso. Faça seu cadastro no clube.',
      });
    }

    const cooperativaId = await this.resolverCooperativaId();
    const { usuario, cooperado } = await this.garantirCadastro(conta, alvo, cooperativaId);

    const token = this.jwtService.sign({
      sub: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
      cooperadoId: cooperado.id,
      cooperativaId: cooperado.cooperativaId ?? cooperativaId,
    });
    return {
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        cpf: usuario.cpf,
        telefone: usuario.telefone,
        perfil: usuario.perfil,
        cooperativaId: usuario.cooperativaId ?? null,
        fotoFacialUrl: usuario.fotoFacialUrl ?? null,
      },
      novoCadastro: cooperado.novo,
    };
  }

  // ── Provisionamento ──────────────────────────────────────────────────────

  private async garantirCadastro(conta: ContaBeneficiario, alvo: Alvo, cooperativaId: string) {
    const documento = (conta.cpf_cnpj_beneficiario || '').replace(/\D/g, '');
    if (documento.length !== 11 && documento.length !== 14) {
      throw new UnprocessableCadastro('Cadastro da CoopereBR sem CPF/CNPJ válido. Fale com o atendimento.');
    }
    const nome = (conta.nome_beneficiario || '').trim() || 'Cooperado CoopereBR';
    const telefone = this.soDigitos(conta.telefone) || ('telefone' in alvo ? alvo.telefone : null);
    const emailInformado = this.emailValido(conta.login_email) || ('email' in alvo ? alvo.email : null);

    const prisma: any = this.prisma;

    // 1. Cooperado (pelo CPF/CNPJ — único no banco)
    let novo = false;
    let cooperado = await prisma.cooperado.findFirst({
      where: { cpf: { in: [documento, conta.cpf_cnpj_beneficiario!.trim()] } },
      select: { id: true, email: true, cooperativaId: true },
    });
    if (!cooperado) {
      let email = emailInformado;
      if (email && (await prisma.cooperado.findFirst({ where: { email }, select: { id: true } }))) {
        email = null; // e-mail já usado por outro cooperado
      }
      email = email || this.emailTecnico(documento);
      cooperado = await prisma.cooperado.create({
        data: {
          nomeCompleto: nome,
          cpf: documento,
          email,
          telefone,
          cooperativaId,
          status: 'ATIVO',
          tipoCooperado: 'SEM_UC',
          tipoPessoa: documento.length === 14 ? 'PJ' : 'PF',
          modoRemuneracao: 'CLUBE',
        },
        select: { id: true, email: true, cooperativaId: true },
      });
      novo = true;
      this.logger.log(`Cooperado criado via login CoopereBR (benef ${conta.id_beneficiario})`);
    }

    // 2. Usuario (casado com o cooperado por CPF ou e-mail — mesma regra do login por senha)
    let usuario = await prisma.usuario.findFirst({
      where: { OR: [{ cpf: documento }, { email: cooperado.email }] },
    });
    if (!usuario) {
      const telefoneLivre =
        telefone && !(await prisma.usuario.findFirst({ where: { telefone }, select: { id: true } }))
          ? telefone
          : null;
      usuario = await prisma.usuario.create({
        data: {
          nome,
          email: cooperado.email,
          cpf: documento,
          telefone: telefoneLivre,
          perfil: PerfilUsuario.COOPERADO,
          cooperativaId: cooperado.cooperativaId ?? cooperativaId,
        },
      });
    } else if (!usuario.cpf) {
      const cpfLivre = !(await prisma.usuario.findFirst({ where: { cpf: documento }, select: { id: true } }));
      if (cpfLivre) {
        usuario = await prisma.usuario.update({ where: { id: usuario.id }, data: { cpf: documento } });
      }
    }

    return { usuario, cooperado: { ...cooperado, novo } };
  }

  private async resolverCooperativaId(): Promise<string> {
    const prisma: any = this.prisma;
    const configurado = (process.env.CLUBE_COOPERATIVA_ID || '').trim();
    if (configurado) {
      const c = await prisma.cooperativa.findUnique({ where: { id: configurado }, select: { id: true } });
      if (c) return c.id;
      this.logger.error('CLUBE_COOPERATIVA_ID aponta para cooperativa inexistente');
    }
    const candidatas = await prisma.cooperativa.findMany({
      where: { ativo: true, nome: { equals: 'CoopereBR', mode: 'insensitive' } },
      select: { id: true },
      take: 2,
    });
    if (candidatas.length === 1) return candidatas[0].id;
    throw new ServiceUnavailableException('Login indisponível: cooperativa do clube não configurada.');
  }

  // ── Function ─────────────────────────────────────────────────────────────

  private async chamarFunction(rota: string, body: Record<string, unknown>, ipCliente: string) {
    const base = (process.env.CADASTRO_BENEF_API_URL || '').replace(/\/+$/, '');
    const chave = process.env.CADASTRO_BENEF_API_KEY || '';
    if (!base || !chave) {
      throw new ServiceUnavailableException('Login por código indisponível no momento.');
    }

    let res: Response;
    try {
      res = await fetch(`${base}${rota}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': chave,
          'X-Cliente-IP': ipCliente || '',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      this.logger.error(`Function ${rota} indisponível: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Serviço de login indisponível. Tente em instantes.');
    }

    const dados: any = await res.json().catch(() => ({}));
    if (res.ok) return dados;

    const mensagem = dados?.mensagem || 'Não foi possível concluir o login.';
    if (res.status === 429) throw new HttpException(mensagem, HttpStatus.TOO_MANY_REQUESTS);
    if (res.status === 422 || res.status === 400) throw new BadRequestException(mensagem);
    if (res.status === 401 && dados?.codigo !== 'AUTH_INVALID') {
      throw new UnauthorizedException({ codigo: dados?.codigo, message: mensagem });
    }
    // AUTH_INVALID = chave do clube recusada; 5xx = Function fora
    this.logger.error(`Function ${rota} respondeu ${res.status} ${dados?.codigo ?? ''}`);
    throw new ServiceUnavailableException('Serviço de login indisponível. Tente em instantes.');
  }

  // ── Utilidades ───────────────────────────────────────────────────────────

  private montarAlvo(identificador: string): Alvo {
    const valor = (identificador || '').trim();
    if (valor.includes('@')) {
      const email = this.emailValido(valor);
      if (!email) throw new BadRequestException('E-mail inválido.');
      return { email };
    }
    let tel = this.soDigitos(valor);
    if (tel.length === 13 && tel.startsWith('55')) tel = tel.slice(2);
    if (tel.length < 10 || tel.length > 11) {
      throw new BadRequestException('Informe o celular com DDD ou o e-mail.');
    }
    return { telefone: tel };
  }

  private soDigitos(v: string | null | undefined): string {
    return (v || '').replace(/\D/g, '');
  }

  private emailValido(v: string | null | undefined): string | null {
    const e = (v || '').trim().toLowerCase();
    return EMAIL_RE.test(e) ? e : null;
  }

  /** Para beneficiário sem e-mail: endereço interno, único pelo CPF/CNPJ (não recebe mensagens). */
  private emailTecnico(documento: string): string {
    return `sem-email+${documento}@clube.cooperebr.com.br`;
  }
}

class UnprocessableCadastro extends HttpException {
  constructor(msg: string) {
    super(msg, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
