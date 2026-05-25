import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CredentialsEncryptor } from './credentials-encryptor.service';
import { GatewayPagamentoService } from '../gateway-pagamento/gateway-pagamento.service';
import {
  TipoGateway,
  getDescriptor,
  isTipoGatewaySuportado,
  getDescriptorPublico,
  TIPOS_GATEWAY_SUPORTADOS,
} from './gateway-registry';
import { CriarGatewayDto } from './dto/criar-gateway.dto';
import { AtualizarGatewayDto } from './dto/atualizar-gateway.dto';

/**
 * Service CRUD do modulo gateways-pagamento-config.
 *
 * Sub-Sprint Gateways de Pagamento — Fatia F1 Etapas D + E (M27, 2026-05-26).
 *
 * Responsabilidades:
 *   - Listar tipos suportados (uso frontend pra renderizar form dinamico)
 *   - CRUD ConfigGateway por tenant (multi-tenant guard em TODAS queries)
 *   - Mascarar campos secretos pra exibir na UI sem decrypt
 *   - Validacao Zod por tipo de gateway antes de encriptar
 *   - testarConexao delegando pro adapter correspondente (Etapa E)
 *
 * IMPORTANTE F1 (Etapa A constraint): trabalha SOMENTE com schema atual
 * de ConfigGateway. `credenciais Json` armazena tanto secrets encriptados
 * quanto metadados em texto puro num shape unificado:
 *   {
 *     "__enc": { apiKey: "iv:cipher:tag", ... }, // valores encriptados (camposSecret)
 *     "webhookToken": "abc", "pfxPath": "/opt/...", ...  // metadados em texto puro
 *   }
 *
 * F2 (sprint proximo) rename `credenciais` -> `credenciaisCriptografadas`
 * + add coluna `metadados Json` separada, migrando o conteudo de __enc
 * pra coluna nova e os outros campos pra metadados.
 */
@Injectable()
export class GatewaysPagamentoConfigService {
  private readonly logger = new Logger(GatewaysPagamentoConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptor: CredentialsEncryptor,
    private readonly gatewayPagamento: GatewayPagamentoService,
  ) {}

  // ─── Catalogo publico ────────────────────────────────────────

  listarTiposSuportados() {
    return TIPOS_GATEWAY_SUPORTADOS.map((tipo) => getDescriptorPublico(tipo));
  }

  // ─── CRUD ────────────────────────────────────────────────────

  async listar(cooperativaId: string) {
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatorio.');
    }
    const rows = await this.prisma.configGateway.findMany({
      where: { cooperativaId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.mascararRow(r));
  }

  async buscarPorId(id: string, cooperativaId: string) {
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatorio.');
    }
    const row = await this.prisma.configGateway.findFirst({
      where: { id, cooperativaId },
    });
    if (!row) {
      throw new NotFoundException(`ConfigGateway ${id} nao encontrada no tenant.`);
    }
    return this.mascararRow(row);
  }

  async buscarAtivoPorTipo(cooperativaId: string, tipo: string) {
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatorio.');
    }
    if (!isTipoGatewaySuportado(tipo)) {
      throw new BadRequestException(`Tipo nao suportado: ${tipo}`);
    }
    const row = await this.prisma.configGateway.findFirst({
      where: { cooperativaId, gateway: tipo, ativo: true },
    });
    if (!row) return null;
    return this.mascararRow(row);
  }

  async criar(dto: CriarGatewayDto, cooperativaIdJwt: string | undefined, ehSuperAdmin: boolean) {
    const cooperativaId = this.resolverCooperativaId(dto.cooperativaId, cooperativaIdJwt, ehSuperAdmin);
    const tipo = this.validarTipo(dto.tipo);
    const descritor = getDescriptor(tipo);

    // Validacao Zod das credenciais (shape varia por tipo)
    const credenciaisValidadas = descritor.schemaCredenciais.safeParse(dto.credenciais);
    if (!credenciaisValidadas.success) {
      throw new BadRequestException({
        message: `Credenciais ${tipo} invalidas`,
        erros: credenciaisValidadas.error.issues.map((i) => ({
          campo: i.path.join('.'),
          mensagem: i.message,
        })),
      });
    }

    const credenciaisPersistencia = this.encriptarSecrets(credenciaisValidadas.data, descritor.camposSecret);

    try {
      const row = await this.prisma.configGateway.create({
        data: {
          cooperativaId,
          gateway: tipo,
          ambiente: dto.ambiente,
          ativo: dto.ativo ?? true,
          webhookToken: dto.webhookToken ?? null,
          credenciais: credenciaisPersistencia as Prisma.InputJsonValue,
        },
      });
      return this.mascararRow(row);
    } catch (err: unknown) {
      if (this.ehErroUniqueConstraint(err)) {
        throw new ConflictException(
          `Ja existe ConfigGateway ${tipo} pra essa cooperativa. Use PATCH pra editar.`,
        );
      }
      throw err;
    }
  }

  async atualizar(id: string, dto: AtualizarGatewayDto, cooperativaId: string) {
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatorio.');
    }
    const atual = await this.prisma.configGateway.findFirst({
      where: { id, cooperativaId },
    });
    if (!atual) {
      throw new NotFoundException(`ConfigGateway ${id} nao encontrada no tenant.`);
    }

    const data: Prisma.ConfigGatewayUpdateInput = {};
    if (dto.ambiente !== undefined) data.ambiente = dto.ambiente;
    if (dto.ativo !== undefined) data.ativo = dto.ativo;
    if (dto.webhookToken !== undefined) data.webhookToken = dto.webhookToken;

    if (dto.credenciais !== undefined) {
      const tipo = this.validarTipo(atual.gateway);
      const descritor = getDescriptor(tipo);
      const credenciaisValidadas = descritor.schemaCredenciais.safeParse(dto.credenciais);
      if (!credenciaisValidadas.success) {
        throw new BadRequestException({
          message: `Credenciais ${tipo} invalidas`,
          erros: credenciaisValidadas.error.issues.map((i) => ({
            campo: i.path.join('.'),
            mensagem: i.message,
          })),
        });
      }
      data.credenciais = this.encriptarSecrets(
        credenciaisValidadas.data,
        descritor.camposSecret,
      ) as Prisma.InputJsonValue;
    }

    const row = await this.prisma.configGateway.update({
      where: { id },
      data,
    });
    return this.mascararRow(row);
  }

  async remover(id: string, cooperativaId: string) {
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatorio.');
    }
    const atual = await this.prisma.configGateway.findFirst({
      where: { id, cooperativaId },
    });
    if (!atual) {
      throw new NotFoundException(`ConfigGateway ${id} nao encontrada no tenant.`);
    }
    await this.prisma.configGateway.delete({ where: { id } });
    return { removido: true, id, gateway: atual.gateway };
  }

  // ─── Encryption interna ──────────────────────────────────────

  /**
   * Recebe shape validado pelo Zod. Encripta cada campo secreto inline,
   * mantem nao-secretos em texto puro. Resultado e o que vai no Json
   * de `ConfigGateway.credenciais`.
   *
   * Ex: { apiKey: "abc123...", webhookToken: "wt-x" }
   *  -> { __enc: { apiKey: "iv:cipher:tag" }, webhookToken: "wt-x" }
   */
  private encriptarSecrets(
    data: Record<string, unknown>,
    camposSecret: ReadonlyArray<string>,
  ): Record<string, unknown> {
    const enc: Record<string, string> = {};
    const naoSecret: Record<string, unknown> = {};

    for (const [campo, valor] of Object.entries(data)) {
      if (camposSecret.includes(campo)) {
        if (typeof valor !== 'string') {
          throw new BadRequestException(`Campo secreto "${campo}" deve ser string.`);
        }
        enc[campo] = this.encryptor.encrypt(valor);
      } else if (valor !== undefined) {
        naoSecret[campo] = valor;
      }
    }

    return { __enc: enc, ...naoSecret };
  }

  /**
   * Decripta secrets pro consumo INTERNO (factory adapter, testarConexao).
   * NUNCA expor o resultado disso em endpoint publico.
   */
  decriptarParaAdapter(rowCredenciais: unknown): Record<string, string> {
    const shape = (rowCredenciais as Record<string, unknown>) ?? {};
    const enc = (shape.__enc as Record<string, string> | undefined) ?? {};
    const resultado: Record<string, string> = {};

    for (const [campo, valor] of Object.entries(shape)) {
      if (campo === '__enc') continue;
      if (typeof valor === 'string') {
        resultado[campo] = valor;
      }
    }

    for (const [campo, cipher] of Object.entries(enc)) {
      resultado[campo] = this.encryptor.decrypt(cipher);
    }

    return resultado;
  }

  // ─── Mascaramento pra UI ─────────────────────────────────────

  private mascararRow(row: {
    id: string;
    cooperativaId: string;
    gateway: string;
    ambiente: string;
    credenciais: unknown;
    ativo: boolean;
    webhookToken: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const shape = (row.credenciais as Record<string, unknown>) ?? {};
    const enc = (shape.__enc as Record<string, string> | undefined) ?? {};

    // Campos secretos viram '****<sufixo>' pra confirmacao visual.
    // Sufixo = ultimos 4 chars do ciphertext (NAO do plaintext — ja e
    // valor suficientemente unico pra confirmar "essa e a chave que
    // cadastrei").
    const credenciaisExibicao: Record<string, unknown> = {};
    for (const [campo, valor] of Object.entries(shape)) {
      if (campo === '__enc') continue;
      credenciaisExibicao[campo] = valor;
    }
    for (const campo of Object.keys(enc)) {
      credenciaisExibicao[campo] = this.encryptor.mask(enc[campo]);
    }

    return {
      id: row.id,
      cooperativaId: row.cooperativaId,
      gateway: row.gateway,
      ambiente: row.ambiente,
      ativo: row.ativo,
      webhookToken: row.webhookToken ? '(definido)' : null,
      credenciais: credenciaisExibicao,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private resolverCooperativaId(
    cooperativaIdBody: string | undefined,
    cooperativaIdJwt: string | undefined,
    ehSuperAdmin: boolean,
  ): string {
    if (ehSuperAdmin) {
      const escolhido = cooperativaIdBody ?? cooperativaIdJwt;
      if (!escolhido) {
        throw new BadRequestException(
          'SUPER_ADMIN deve enviar cooperativaId no body pra criar gateway de um tenant especifico.',
        );
      }
      return escolhido;
    }
    if (!cooperativaIdJwt) {
      throw new BadRequestException('cooperativaId nao identificado no token JWT.');
    }
    if (cooperativaIdBody && cooperativaIdBody !== cooperativaIdJwt) {
      throw new BadRequestException(
        'ADMIN nao pode criar gateway pra outra cooperativa. Use o seu proprio tenant.',
      );
    }
    return cooperativaIdJwt;
  }

  private validarTipo(tipo: string): TipoGateway {
    if (!isTipoGatewaySuportado(tipo)) {
      throw new BadRequestException(
        `Tipo de gateway nao suportado: "${tipo}". Suportados: ${TIPOS_GATEWAY_SUPORTADOS.join(', ')}.`,
      );
    }
    return tipo;
  }

  private ehErroUniqueConstraint(err: unknown): boolean {
    const e = err as { code?: string };
    return e?.code === 'P2002';
  }

  // ─── testarConexao (Etapa E) ─────────────────────────────────

  async testarConexao(id: string, cooperativaId: string) {
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatorio.');
    }
    const row = await this.prisma.configGateway.findFirst({
      where: { id, cooperativaId },
    });
    if (!row) {
      throw new NotFoundException(`ConfigGateway ${id} nao encontrada no tenant.`);
    }
    // Em F1 o teste delega pro adapter via GatewayPagamentoService.testarConexao
    // (que ja resolve o adapter correto via factory em ConfigGateway ativo).
    // F3 fara o adapter ler config direto desta tabela; por enquanto Asaas
    // ainda le de AsaasConfig legado e Banestes le de .env.
    if (!row.ativo) {
      return {
        ok: false,
        erro: 'ConfigGateway inativa — ative com PATCH antes de testar.',
      };
    }
    try {
      return await this.gatewayPagamento.testarConexao(cooperativaId);
    } catch (err) {
      this.logger.warn(
        `testarConexao falhou: gateway=${row.gateway} tenant=${cooperativaId}: ${(err as Error).message}`,
      );
      return {
        ok: false,
        erro: `${(err as Error).message}`,
      };
    }
  }
}
