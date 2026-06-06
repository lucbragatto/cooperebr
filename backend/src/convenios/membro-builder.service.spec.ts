/**
 * Sprint Onboarding Bloco 1 Fatia 1.3 (06/06/2026) — specs do MembroBuilderService.
 *
 * Cobertura:
 *  - (a) caminho feliz com cota → flip status + motor.aceitar chamado +
 *        clube matriculado + pendência limpa
 *  - (b) sem cota → flip status + motor PULADO + clube matriculado +
 *        pendência informativa gravada (mas NÃO falha aprovação)
 *  - (c) motor estoura → flip status mantido + pendência gravada +
 *        clube matriculado (degradação graciosa)
 *  - (d) idempotência — chamar 2× com Cooperado já ATIVO não duplica
 *        ProgressaoClube (helper criarOuObterProgressao é idempotente)
 *  - (e) anti-spoof — cooperativaId divergente do Cooperado → ForbiddenException
 *  - (f) anti-spoof — cooperativaId divergente do Convênio → ForbiddenException
 *  - (g) já tem contrato vigente → pula motor + pendência limpa
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MembroBuilderService } from './membro-builder.service';

describe('MembroBuilderService — Fatia 1.3', () => {
  let service: MembroBuilderService;
  let prismaMock: any;
  let motorMock: any;
  let clubeMock: any;

  const TENANT_A = 'coop-a';
  const TENANT_B = 'coop-b';
  const COOPERADO_ID = 'coop-id-1';
  const CONVENIO_ID = 'conv-id-1';
  const PLANO_ID = 'plano-id-1';

  beforeEach(() => {
    prismaMock = {
      cooperado: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      contratoConvenio: { findUnique: jest.fn() },
      // Helper busca plano CUSTEADO global (cooperativaId=null) — default mock.
      plano: {
        findFirst: jest.fn().mockResolvedValue({ id: PLANO_ID }),
      },
      // Fatia 1.4: matrícula clube config-dependente. Default = ativa.
      configClubeVantagens: {
        findUnique: jest.fn().mockResolvedValue({ ativo: true }),
      },
      $transaction: jest.fn(async (fn: any) => fn(prismaMock)),
    };
    motorMock = { calcular: jest.fn(), aceitar: jest.fn() };
    clubeMock = { criarOuObterProgressao: jest.fn() };

    service = Object.create(MembroBuilderService.prototype);
    (service as any).prisma = prismaMock;
    (service as any).motorProposta = motorMock;
    (service as any).clubeVantagens = clubeMock;
    (service as any).logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  // ─── (a) caminho feliz ──────────────────────────────────────────────
  it('(a) caminho feliz: cota > 0 + sem contrato → motor.aceitar + clube + pendência limpa', async () => {
    prismaMock.cooperado.findUnique.mockResolvedValue({
      id: COOPERADO_ID,
      cooperativaId: TENANT_A,
      status: 'PENDENTE',
      cotaKwhMensal: 350,
      consumoStashOcr: {
        historicoConsumo: [
          { mesAno: '01/2026', consumoKwh: 300, valorRS: 250 },
        ],
        valorUltimaFatura: 280,
        consumoMedioKwh: 350,
      },
      contratos: [],
    });
    prismaMock.contratoConvenio.findUnique.mockResolvedValue({
      id: CONVENIO_ID,
      cooperativaId: TENANT_A,
      status: 'ATIVO',
      pagador: 'EMPRESA',
      empresaNome: 'Clínica X',
    });
    prismaMock.plano.findFirst.mockResolvedValue({ id: PLANO_ID });
    motorMock.calcular.mockResolvedValue({
      outlierDetectado: false,
      resultado: {
        base: 'MES_RECENTE',
        kwhContrato: 350,
        descontoPercentual: 20,
        mesReferencia: '01/2026',
      },
    });
    motorMock.aceitar.mockResolvedValue({
      proposta: { id: 'prop-1' },
      contrato: { id: 'ctr-1' },
      emListaEspera: false,
    });
    clubeMock.criarOuObterProgressao.mockResolvedValue({
      cooperadoId: COOPERADO_ID,
      nivelAtual: 'BRONZE',
    });

    const r = await service.construirMembroCompleto({
      cooperadoId: COOPERADO_ID,
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
    });

    expect(motorMock.calcular).toHaveBeenCalledTimes(1);
    // Helper passa planoId direto (plano custeado global) e NÃO `convenioCusteioId`
    // — evita motor.aceitar chamar adicionarMembro (membro JÁ está MEMBRO_ATIVO).
    expect(motorMock.aceitar).toHaveBeenCalledWith(
      expect.objectContaining({
        cooperadoId: COOPERADO_ID,
        planoId: PLANO_ID,
      }),
    );
    expect(motorMock.aceitar).toHaveBeenCalledWith(
      expect.not.objectContaining({ convenioCusteioId: expect.anything() }),
    );
    expect(clubeMock.criarOuObterProgressao).toHaveBeenCalledWith(COOPERADO_ID);
    expect(r).toEqual({
      cooperadoAtivado: true,
      contratoCriado: true,
      contratoId: 'ctr-1',
      clubeMatriculado: true,
      pendenciaMotor: null,
    });
    // Pendência limpa (não gravada como erro)
    expect(prismaMock.cooperado.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { pendenciaMotorMsg: null, pendenciaMotorEm: null },
      }),
    );
  });

  // ─── (b) sem cota (LEONARDO-like) ───────────────────────────────────
  it('(b) sem cota → motor PULADO + clube matriculado + pendência informativa', async () => {
    prismaMock.cooperado.findUnique.mockResolvedValue({
      id: COOPERADO_ID,
      cooperativaId: TENANT_A,
      status: 'PENDENTE',
      cotaKwhMensal: null,
      consumoStashOcr: null,
      contratos: [],
    });
    prismaMock.contratoConvenio.findUnique.mockResolvedValue({
      id: CONVENIO_ID,
      cooperativaId: TENANT_A,
      status: 'ATIVO',
      pagador: 'EMPRESA',
      empresaNome: 'Clínica X',
    });
    clubeMock.criarOuObterProgressao.mockResolvedValue({
      cooperadoId: COOPERADO_ID,
      nivelAtual: 'BRONZE',
    });

    const r = await service.construirMembroCompleto({
      cooperadoId: COOPERADO_ID,
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
    });

    // Motor NÃO foi chamado
    expect(motorMock.calcular).not.toHaveBeenCalled();
    expect(motorMock.aceitar).not.toHaveBeenCalled();
    // Clube SIM matriculado
    expect(clubeMock.criarOuObterProgressao).toHaveBeenCalledWith(COOPERADO_ID);
    // Resultado: ativado, sem contrato, com pendência
    expect(r.cooperadoAtivado).toBe(true);
    expect(r.contratoCriado).toBe(false);
    expect(r.contratoId).toBeNull();
    expect(r.clubeMatriculado).toBe(true);
    expect(r.pendenciaMotor).toMatch(/Cota mensal não capturada/);
    // Pendência gravada
    expect(prismaMock.cooperado.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pendenciaMotorMsg: expect.stringMatching(/Cota mensal/),
        }),
      }),
    );
  });

  // ─── (c) motor estoura → degradação graciosa ────────────────────────
  it('(c) motor estoura → flip status + pendência gravada + clube matriculado + NÃO propaga', async () => {
    prismaMock.cooperado.findUnique.mockResolvedValue({
      id: COOPERADO_ID,
      cooperativaId: TENANT_A,
      status: 'PENDENTE',
      cotaKwhMensal: 350,
      consumoStashOcr: null,
      contratos: [],
    });
    prismaMock.contratoConvenio.findUnique.mockResolvedValue({
      id: CONVENIO_ID,
      cooperativaId: TENANT_A,
      status: 'ATIVO',
      pagador: 'EMPRESA',
      empresaNome: 'Clínica X',
    });
    prismaMock.plano.findFirst.mockResolvedValue({ id: PLANO_ID });
    motorMock.calcular.mockRejectedValue(
      new Error('valorCooperado não pode ser negativo.'),
    );
    clubeMock.criarOuObterProgressao.mockResolvedValue({
      cooperadoId: COOPERADO_ID,
      nivelAtual: 'BRONZE',
    });

    const r = await service.construirMembroCompleto({
      cooperadoId: COOPERADO_ID,
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
    });

    expect(r.cooperadoAtivado).toBe(true);
    expect(r.contratoCriado).toBe(false);
    expect(r.clubeMatriculado).toBe(true);
    expect(r.pendenciaMotor).toMatch(/valorCooperado/);
    // Pendência gravada (NÃO erro propagado)
    expect(prismaMock.cooperado.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pendenciaMotorMsg: expect.stringMatching(/valorCooperado/),
        }),
      }),
    );
  });

  // ─── (d) idempotência ───────────────────────────────────────────────
  it('(d) idempotência: Cooperado já ATIVO + clube existente → flipCount=0 mas ativado=true, clube reaproveitado', async () => {
    prismaMock.cooperado.findUnique.mockResolvedValue({
      id: COOPERADO_ID,
      cooperativaId: TENANT_A,
      status: 'ATIVO',
      cotaKwhMensal: null,
      consumoStashOcr: null,
      contratos: [{ id: 'ctr-ja-existe' }],
    });
    prismaMock.contratoConvenio.findUnique.mockResolvedValue({
      id: CONVENIO_ID,
      cooperativaId: TENANT_A,
      status: 'ATIVO',
      pagador: 'EMPRESA',
      empresaNome: 'Clínica X',
    });
    // updateMany retorna count=0 (status já é ATIVO — guard pega)
    prismaMock.cooperado.updateMany.mockResolvedValue({ count: 0 });
    // criarOuObterProgressao retorna existente — idempotente
    clubeMock.criarOuObterProgressao.mockResolvedValue({
      cooperadoId: COOPERADO_ID,
      nivelAtual: 'BRONZE',
    });

    const r = await service.construirMembroCompleto({
      cooperadoId: COOPERADO_ID,
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
    });

    // Motor NÃO chamado (já tem contrato)
    expect(motorMock.calcular).not.toHaveBeenCalled();
    // Estado consistente
    expect(r.cooperadoAtivado).toBe(true); // statusInicial=ATIVO
    expect(r.contratoCriado).toBe(false);  // não criou agora — só reaproveitou
    expect(r.contratoId).toBe('ctr-ja-existe');
    expect(r.clubeMatriculado).toBe(true);
    expect(r.pendenciaMotor).toBeNull();
    // Limpa pendência (já tem contrato)
    expect(prismaMock.cooperado.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { pendenciaMotorMsg: null, pendenciaMotorEm: null },
      }),
    );
  });

  // ─── (e) anti-spoof Cooperado ───────────────────────────────────────
  it('(e) anti-spoof: Cooperado de outro tenant → ForbiddenException', async () => {
    prismaMock.cooperado.findUnique.mockResolvedValue({
      id: COOPERADO_ID,
      cooperativaId: TENANT_B,
      status: 'PENDENTE',
      cotaKwhMensal: 350,
      consumoStashOcr: null,
      contratos: [],
    });

    await expect(
      service.construirMembroCompleto({
        cooperadoId: COOPERADO_ID,
        convenioId: CONVENIO_ID,
        cooperativaId: TENANT_A,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(motorMock.calcular).not.toHaveBeenCalled();
    expect(clubeMock.criarOuObterProgressao).not.toHaveBeenCalled();
  });

  // ─── (f) anti-spoof Convenio ────────────────────────────────────────
  it('(f) anti-spoof: Convênio de outro tenant → ForbiddenException', async () => {
    prismaMock.cooperado.findUnique.mockResolvedValue({
      id: COOPERADO_ID,
      cooperativaId: TENANT_A,
      status: 'PENDENTE',
      cotaKwhMensal: 350,
      consumoStashOcr: null,
      contratos: [],
    });
    prismaMock.contratoConvenio.findUnique.mockResolvedValue({
      id: CONVENIO_ID,
      cooperativaId: TENANT_B, // ← outro tenant
      status: 'ATIVO',
      pagador: 'EMPRESA',
      empresaNome: 'Clínica X',
    });

    await expect(
      service.construirMembroCompleto({
        cooperadoId: COOPERADO_ID,
        convenioId: CONVENIO_ID,
        cooperativaId: TENANT_A,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(motorMock.calcular).not.toHaveBeenCalled();
    expect(clubeMock.criarOuObterProgressao).not.toHaveBeenCalled();
  });

  // ─── 404 Cooperado / Convênio ───────────────────────────────────────
  it('404 Cooperado não encontrado', async () => {
    prismaMock.cooperado.findUnique.mockResolvedValue(null);

    await expect(
      service.construirMembroCompleto({
        cooperadoId: COOPERADO_ID,
        convenioId: CONVENIO_ID,
        cooperativaId: TENANT_A,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404 Convênio não encontrado', async () => {
    prismaMock.cooperado.findUnique.mockResolvedValue({
      id: COOPERADO_ID,
      cooperativaId: TENANT_A,
      status: 'PENDENTE',
      cotaKwhMensal: 350,
      consumoStashOcr: null,
      contratos: [],
    });
    prismaMock.contratoConvenio.findUnique.mockResolvedValue(null);

    await expect(
      service.construirMembroCompleto({
        cooperadoId: COOPERADO_ID,
        convenioId: CONVENIO_ID,
        cooperativaId: TENANT_A,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // ─── (g) outlier recalcula com MEDIA_12M ────────────────────────────
  it('(g) outlier detectado → recalcula com MEDIA_12M + segue fluxo', async () => {
    prismaMock.cooperado.findUnique.mockResolvedValue({
      id: COOPERADO_ID,
      cooperativaId: TENANT_A,
      status: 'PENDENTE',
      cotaKwhMensal: 350,
      consumoStashOcr: null,
      contratos: [],
    });
    prismaMock.contratoConvenio.findUnique.mockResolvedValue({
      id: CONVENIO_ID,
      cooperativaId: TENANT_A,
      status: 'ATIVO',
      pagador: 'EMPRESA',
      empresaNome: 'Clínica X',
    });
    prismaMock.plano.findFirst.mockResolvedValue({ id: PLANO_ID });
    motorMock.calcular
      .mockResolvedValueOnce({ outlierDetectado: true, aguardandoEscolha: true })
      .mockResolvedValueOnce({
        outlierDetectado: false,
        resultado: {
          base: 'MEDIA_12M',
          kwhContrato: 320,
          descontoPercentual: 20,
          mesReferencia: '01/2026',
        },
      });
    motorMock.aceitar.mockResolvedValue({
      proposta: { id: 'prop-1' },
      contrato: { id: 'ctr-1' },
      emListaEspera: false,
    });
    clubeMock.criarOuObterProgressao.mockResolvedValue({
      cooperadoId: COOPERADO_ID,
      nivelAtual: 'BRONZE',
    });

    const r = await service.construirMembroCompleto({
      cooperadoId: COOPERADO_ID,
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
    });

    expect(motorMock.calcular).toHaveBeenCalledTimes(2);
    expect(motorMock.calcular).toHaveBeenLastCalledWith(
      expect.objectContaining({ opcaoEscolhida: 'MEDIA_12M' }),
    );
    expect(r.contratoCriado).toBe(true);
  });

  // ─── (h) clube config-dependente (Fatia 1.4) ────────────────────────
  it('(h) ConfigClubeVantagens inexistente → clube pulado (NÃO falha)', async () => {
    prismaMock.cooperado.findUnique.mockResolvedValue({
      id: COOPERADO_ID,
      cooperativaId: TENANT_A,
      status: 'PENDENTE',
      cotaKwhMensal: null,
      consumoStashOcr: null,
      contratos: [],
    });
    prismaMock.contratoConvenio.findUnique.mockResolvedValue({
      id: CONVENIO_ID,
      cooperativaId: TENANT_A,
      status: 'ATIVO',
      pagador: 'EMPRESA',
      empresaNome: 'Clínica X',
    });
    prismaMock.configClubeVantagens.findUnique.mockResolvedValue(null);

    const r = await service.construirMembroCompleto({
      cooperadoId: COOPERADO_ID,
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
    });

    expect(clubeMock.criarOuObterProgressao).not.toHaveBeenCalled();
    expect(r.cooperadoAtivado).toBe(true);
    expect(r.clubeMatriculado).toBe(false);
  });

  it('(h) ConfigClubeVantagens.ativo=false → clube pulado (NÃO falha)', async () => {
    prismaMock.cooperado.findUnique.mockResolvedValue({
      id: COOPERADO_ID,
      cooperativaId: TENANT_A,
      status: 'PENDENTE',
      cotaKwhMensal: null,
      consumoStashOcr: null,
      contratos: [],
    });
    prismaMock.contratoConvenio.findUnique.mockResolvedValue({
      id: CONVENIO_ID,
      cooperativaId: TENANT_A,
      status: 'ATIVO',
      pagador: 'EMPRESA',
      empresaNome: 'Clínica X',
    });
    prismaMock.configClubeVantagens.findUnique.mockResolvedValue({ ativo: false });

    const r = await service.construirMembroCompleto({
      cooperadoId: COOPERADO_ID,
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
    });

    expect(clubeMock.criarOuObterProgressao).not.toHaveBeenCalled();
    expect(r.clubeMatriculado).toBe(false);
  });

  // ─── pagador != EMPRESA → motor pulado ──────────────────────────────
  it('pagador=COOPERADO → motor pulado + cota informa pendência', async () => {
    prismaMock.cooperado.findUnique.mockResolvedValue({
      id: COOPERADO_ID,
      cooperativaId: TENANT_A,
      status: 'PENDENTE',
      cotaKwhMensal: 350,
      consumoStashOcr: null,
      contratos: [],
    });
    prismaMock.contratoConvenio.findUnique.mockResolvedValue({
      id: CONVENIO_ID,
      cooperativaId: TENANT_A,
      status: 'ATIVO',
      pagador: 'COOPERADO', // ← não custeio
      empresaNome: 'Clínica X',
    });
    clubeMock.criarOuObterProgressao.mockResolvedValue({
      cooperadoId: COOPERADO_ID,
      nivelAtual: 'BRONZE',
    });

    const r = await service.construirMembroCompleto({
      cooperadoId: COOPERADO_ID,
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
    });

    expect(motorMock.calcular).not.toHaveBeenCalled();
    expect(r.cooperadoAtivado).toBe(true);
    expect(r.contratoCriado).toBe(false);
    expect(r.clubeMatriculado).toBe(true);
  });
});
