import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CooperadosService } from './cooperados.service';

/**
 * Spec da transição AGUARDANDO_CONCESSIONARIA → APROVADO (etapa 11).
 *
 * D-J-1 reformulada em 05/05 tarde + executada em 11/05.
 * 5 cenários mínimos obrigatórios (Reforço 2 do plano da sessão):
 *   1. Happy path
 *   2. Status errado
 *   3. Protocolo vazio/curto (validado pelo DTO @MinLength — não roda no service)
 *   4. Cross-tenant 403
 *   5. SUPER_ADMIN bypass
 */
describe('CooperadosService — aprovarConcessionaria (etapa 11)', () => {
  let service: CooperadosService;
  let prisma: any;
  let notificacoes: any;
  let emailService: any;

  const COOP_A = 'coop-a';
  const COOP_B = 'coop-b';

  beforeEach(() => {
    prisma = {
      cooperado: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({
            id: where.id,
            nomeCompleto: 'Cooperado Teste',
            email: 'teste@example.com',
            cooperativaId: COOP_A,
            status: data.status,
            protocoloConcessionaria: data.protocoloConcessionaria,
          }),
        ),
      },
      historicoStatusCooperado: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    notificacoes = { criar: jest.fn().mockResolvedValue({}) };
    emailService = { enviarCadastroAprovado: jest.fn().mockResolvedValue(true) };

    service = Object.create(CooperadosService.prototype);
    (service as any).prisma = prisma;
    (service as any).notificacoes = notificacoes;
    (service as any).emailService = emailService;
  });

  it('1. happy path — AGUARDANDO_CONCESSIONARIA → APROVADO com protocolo, registra histórico, dispara email', async () => {
    prisma.cooperado.findUnique.mockResolvedValue({
      id: 'coop-1',
      nomeCompleto: 'Cooperado X',
      email: 'x@example.com',
      status: 'AGUARDANDO_CONCESSIONARIA',
      cooperativaId: COOP_A,
      ambienteTeste: false,
    });

    const result = await service.aprovarConcessionaria(
      'coop-1',
      { protocoloConcessionaria: 'PROT-12345' },
      { perfil: 'ADMIN', cooperativaId: COOP_A },
    );

    expect(result.status).toBe('APROVADO');
    expect(result.protocoloConcessionaria).toBe('PROT-12345');
    expect(prisma.cooperado.update).toHaveBeenCalledWith({
      where: { id: 'coop-1' },
      data: { status: 'APROVADO', protocoloConcessionaria: 'PROT-12345' },
    });
    expect(prisma.historicoStatusCooperado.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cooperadoId: 'coop-1',
        cooperativaId: COOP_A,
        statusAnterior: 'AGUARDANDO_CONCESSIONARIA',
        statusNovo: 'APROVADO',
      }),
    });
    expect(notificacoes.criar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'COOPERADO_APROVADO', cooperadoId: 'coop-1' }),
    );
    expect(emailService.enviarCadastroAprovado).toHaveBeenCalled();
  });

  it('2. status errado — cooperado em APROVADO já não pode re-aprovar (ConflictException)', async () => {
    prisma.cooperado.findUnique.mockResolvedValue({
      id: 'coop-1',
      status: 'APROVADO',
      cooperativaId: COOP_A,
    });

    await expect(
      service.aprovarConcessionaria(
        'coop-1',
        { protocoloConcessionaria: 'PROT-99' },
        { perfil: 'ADMIN', cooperativaId: COOP_A },
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.cooperado.update).not.toHaveBeenCalled();
  });

  it('2b. status ATIVO também recusa', async () => {
    prisma.cooperado.findUnique.mockResolvedValue({
      id: 'coop-1',
      status: 'ATIVO',
      cooperativaId: COOP_A,
    });

    await expect(
      service.aprovarConcessionaria(
        'coop-1',
        { protocoloConcessionaria: 'PROT-99' },
        { perfil: 'ADMIN', cooperativaId: COOP_A },
      ),
    ).rejects.toThrow(/AGUARDANDO_CONCESSIONARIA/);
  });

  it('3. cooperado não encontrado → NotFoundException', async () => {
    prisma.cooperado.findUnique.mockResolvedValue(null);

    await expect(
      service.aprovarConcessionaria(
        'coop-inexistente',
        { protocoloConcessionaria: 'PROT-1' },
        { perfil: 'ADMIN', cooperativaId: COOP_A },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('4. cross-tenant — ADMIN da Cooperativa A tenta aprovar cooperado da Cooperativa B → 403', async () => {
    prisma.cooperado.findUnique.mockResolvedValue({
      id: 'coop-x',
      status: 'AGUARDANDO_CONCESSIONARIA',
      cooperativaId: COOP_B,
    });

    await expect(
      service.aprovarConcessionaria(
        'coop-x',
        { protocoloConcessionaria: 'PROT-99' },
        { perfil: 'ADMIN', cooperativaId: COOP_A },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.cooperado.update).not.toHaveBeenCalled();
  });

  it('5. SUPER_ADMIN bypass — aprova cooperado de qualquer cooperativa', async () => {
    prisma.cooperado.findUnique.mockResolvedValue({
      id: 'coop-x',
      nomeCompleto: 'X',
      email: 'x@example.com',
      status: 'AGUARDANDO_CONCESSIONARIA',
      cooperativaId: COOP_B, // Cooperativa diferente do requester
      ambienteTeste: false,
    });

    const result = await service.aprovarConcessionaria(
      'coop-x',
      { protocoloConcessionaria: 'PROT-SA' },
      { perfil: 'SUPER_ADMIN', cooperativaId: COOP_A }, // SUPER_ADMIN logado em A
    );

    expect(result.status).toBe('APROVADO');
    expect(prisma.cooperado.update).toHaveBeenCalled();
  });
});
