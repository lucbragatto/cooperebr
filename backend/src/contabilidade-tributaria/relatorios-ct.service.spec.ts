import { NotFoundException, NotImplementedException } from '@nestjs/common';
import { Prisma, StatusApuracao, TipoRegimeContabil } from '@prisma/client';
import { RelatoriosCtService } from './relatorios-ct.service';

/**
 * D-novo-BR-CT CT.6 (31/05/2026) — Specs dos 3 relatórios PDF.
 *
 * Cobre:
 *  - 3 tipos válidos + tipo inválido → 404
 *  - Cooperativa inexistente → 404
 *  - Regime não-coop → NotImplementedException
 *  - Watermark/header PENDENTE VALIDAÇÃO quando validadoContador=false
 *  - Header VALIDADO quando true
 *  - Snapshot vs preview on-the-fly
 *  - Repasses agrupados por formaAquisicao (ALUGUEL/CESSAO/PROPRIA)
 */
describe('RelatoriosCtService — CT.6', () => {
  const findCoop = jest.fn();
  const findApur = jest.fn();
  const findRepasses = jest.fn();
  const apurarMes = jest.fn();
  const gerarPdf = jest.fn();

  const prismaMock = {
    cooperativa: { findUnique: findCoop },
    apuracaoMensalSegregada: { findUnique: findApur },
    repasseProprietario: { findMany: findRepasses },
  } as any;

  const pdfMock = { gerarPdf } as any;
  const apuracaoMock = { apurarMes } as any;

  let service: RelatoriosCtService;
  let htmlGerado = '';

  const coopCooperativo = {
    id: 'coop-A',
    nome: 'Coop Teste',
    cnpj: '12345678000100',
    regimeContabil: TipoRegimeContabil.COOPERATIVO,
  };

  const snapshotPadrao = {
    id: 'apur1',
    status: StatusApuracao.FECHADA,
    receitaPropria: new Prisma.Decimal('1500'),
    receitaAuxiliar: new Prisma.Decimal('300'),
    receitaNaoCoop: new Prisma.Decimal('400'),
    despesaPropria: new Prisma.Decimal('200'),
    despesaAuxiliar: new Prisma.Decimal('300'),
    despesaNaoCoop: new Prisma.Decimal('100'),
    pisDevido: new Prisma.Decimal('2.6'),
    cofinsDevido: new Prisma.Decimal('12'),
    irpjDevido: new Prisma.Decimal('14.4'),
    csllDevido: new Prisma.Decimal('8.64'),
    fundoReserva: new Prisma.Decimal('130'),
    fates: new Prisma.Decimal('327.36'),
    sobrasDistribuiveis: new Prisma.Decimal('1105'),
    fundamentoIsencao: 'STF Tema 536 + STJ Tema 986 + Art. 79 Lei 5.764/71',
    validadoContador: false,
    validadoEm: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    htmlGerado = '';
    service = new RelatoriosCtService(prismaMock, pdfMock, apuracaoMock);
    gerarPdf.mockImplementation((html: string, nome: string) => {
      htmlGerado = html;
      return Promise.resolve(`/tmp/${nome}`);
    });
    findRepasses.mockResolvedValue([]);
  });

  describe('validações', () => {
    it('tipo inválido → 404', async () => {
      findCoop.mockResolvedValue(coopCooperativo);
      await expect(
        service.gerar('coop-A', 2026, 5, 'inexistente' as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('cooperativa inexistente → 404', async () => {
      findCoop.mockResolvedValueOnce(null);
      await expect(
        service.gerar('coop-X', 2026, 5, 'demonstrativo-nao-lucratividade'),
      ).rejects.toThrow(NotFoundException);
    });

    it.each([
      TipoRegimeContabil.CONSORCIO_PROPORCIONAL,
      TipoRegimeContabil.ASSOCIACAO_SEM_FINS_LUCRATIVOS,
      TipoRegimeContabil.CONDOMINIO_EDILICIO,
    ])('regime %s → NotImplementedException', async (regime) => {
      findCoop.mockResolvedValueOnce({ ...coopCooperativo, regimeContabil: regime });
      await expect(
        service.gerar('coop-A', 2026, 5, 'memorial-calculo-fiscal'),
      ).rejects.toThrow(NotImplementedException);
    });
  });

  describe('GATE WALTER — watermark + header', () => {
    beforeEach(() => {
      findCoop.mockResolvedValue(coopCooperativo);
    });

    it('validadoContador=false → watermark + banner PENDENTE', async () => {
      findApur.mockResolvedValueOnce(snapshotPadrao);
      await service.gerar('coop-A', 2026, 5, 'demonstrativo-nao-lucratividade');
      expect(htmlGerado).toMatch(/watermark/);
      expect(htmlGerado).toMatch(/PENDENTE VALIDAÇÃO CONTADOR/);
      expect(htmlGerado).toMatch(/NÃO-VALIDADO/);
    });

    it('validadoContador=true → banner VALIDADO', async () => {
      findApur.mockResolvedValueOnce({
        ...snapshotPadrao,
        validadoContador: true,
        validadoEm: new Date('2026-06-05T10:00:00'),
      });
      await service.gerar('coop-A', 2026, 5, 'demonstrativo-nao-lucratividade');
      expect(htmlGerado).toMatch(/VALIDADO PELO CONTADOR/);
      expect(htmlGerado).not.toMatch(/class="watermark"/);
    });
  });

  describe('Snapshot vs Preview', () => {
    beforeEach(() => {
      findCoop.mockResolvedValue(coopCooperativo);
    });

    it('snapshot FECHADA → usa banco (fonte=SNAPSHOT)', async () => {
      findApur.mockResolvedValueOnce(snapshotPadrao);
      await service.gerar('coop-A', 2026, 5, 'memorial-calculo-fiscal');
      expect(apurarMes).not.toHaveBeenCalled();
      expect(htmlGerado).toMatch(/snapshot imutável/);
    });

    it('sem snapshot → preview on-the-fly (fonte=PREVIEW)', async () => {
      findApur.mockResolvedValueOnce(null);
      apurarMes.mockResolvedValueOnce({
        receitaPropria: new Prisma.Decimal('1500'),
        receitaAuxiliar: new Prisma.Decimal('300'),
        receitaNaoCoop: new Prisma.Decimal('400'),
        despesaPropria: new Prisma.Decimal('200'),
        despesaAuxiliar: new Prisma.Decimal('300'),
        despesaNaoCoop: new Prisma.Decimal('100'),
        pisDevido: new Prisma.Decimal('2.6'),
        cofinsDevido: new Prisma.Decimal('12'),
        irpjDevido: new Prisma.Decimal('14.4'),
        csllDevido: new Prisma.Decimal('8.64'),
        fundoReserva: new Prisma.Decimal('130'),
        fates: new Prisma.Decimal('327.36'),
        sobrasDistribuiveis: new Prisma.Decimal('1105'),
        fundamentoIsencao: 'STF Tema 536',
      });
      await service.gerar('coop-A', 2026, 5, 'memorial-calculo-fiscal');
      expect(apurarMes).toHaveBeenCalledWith('coop-A', 2026, 5);
      expect(htmlGerado).toMatch(/preview on-the-fly/);
    });
  });

  describe('Demonstrativo Não-Lucratividade', () => {
    beforeEach(() => {
      findCoop.mockResolvedValue(coopCooperativo);
      findApur.mockResolvedValue(snapshotPadrao);
    });

    it('cita Art. 79 + STF Tema 536 + RIR/2018 Art. 182', async () => {
      await service.gerar('coop-A', 2026, 5, 'demonstrativo-nao-lucratividade');
      expect(htmlGerado).toMatch(/Art\. 79/);
      expect(htmlGerado).toMatch(/STF Tema 536/);
      expect(htmlGerado).toMatch(/Art\. 182/);
    });

    it('mostra sobras brutas + destinação obrigatória', async () => {
      await service.gerar('coop-A', 2026, 5, 'demonstrativo-nao-lucratividade');
      expect(htmlGerado).toMatch(/Sobras brutas/);
      expect(htmlGerado).toMatch(/Fundo de Reserva/);
    });
  });

  describe('Memorial de Cálculo Fiscal', () => {
    beforeEach(() => {
      findCoop.mockResolvedValue(coopCooperativo);
      findApur.mockResolvedValue(snapshotPadrao);
    });

    it('cita as 4 leis principais (9.249/95, 9.718/98, 7.689/88, 5.764/71)', async () => {
      await service.gerar('coop-A', 2026, 5, 'memorial-calculo-fiscal');
      expect(htmlGerado).toMatch(/9\.249\/95/);
      expect(htmlGerado).toMatch(/9\.718\/98/);
      expect(htmlGerado).toMatch(/7\.689\/88/);
      expect(htmlGerado).toMatch(/5\.764\/71/);
    });

    it('mostra cálculo passo-a-passo de cada tributo', async () => {
      await service.gerar('coop-A', 2026, 5, 'memorial-calculo-fiscal');
      expect(htmlGerado).toMatch(/PIS/);
      expect(htmlGerado).toMatch(/COFINS/);
      expect(htmlGerado).toMatch(/IRPJ/);
      expect(htmlGerado).toMatch(/CSLL/);
      expect(htmlGerado).toMatch(/VALIDAR COM WALTER/);
    });
  });

  describe('Demonstrativo de Repasses', () => {
    beforeEach(() => {
      findCoop.mockResolvedValue(coopCooperativo);
      findApur.mockResolvedValue(snapshotPadrao);
    });

    it('agrupa por formaAquisicao (ALUGUEL/CESSAO/PROPRIA)', async () => {
      findRepasses.mockResolvedValueOnce([
        {
          id: 'r1',
          valorLiquido: new Prisma.Decimal('1000'),
          dataPagamento: new Date('2026-05-10'),
          usina: { nome: 'Usina A', apelidoInterno: 'a', formaAquisicao: 'ALUGUEL' },
        },
        {
          id: 'r2',
          valorLiquido: new Prisma.Decimal('500'),
          dataPagamento: new Date('2026-05-15'),
          usina: { nome: 'Usina B', apelidoInterno: 'b', formaAquisicao: 'CESSAO' },
        },
        {
          id: 'r3',
          valorLiquido: new Prisma.Decimal('200'),
          dataPagamento: new Date('2026-05-20'),
          usina: { nome: 'Usina C', apelidoInterno: 'c', formaAquisicao: 'PROPRIA' },
        },
      ]);
      await service.gerar('coop-A', 2026, 5, 'demonstrativo-repasses');
      expect(htmlGerado).toMatch(/ALUGUEL/);
      expect(htmlGerado).toMatch(/CESSÃO/);
      expect(htmlGerado).toMatch(/PRÓPRIA/);
      expect(htmlGerado).toMatch(/Usina A/);
      expect(htmlGerado).toMatch(/Usina B/);
      expect(htmlGerado).toMatch(/Usina C/);
    });

    it('repasse SEM formaAquisicao → seção "SEM CLASSIFICAÇÃO" alerta', async () => {
      findRepasses.mockResolvedValueOnce([
        {
          id: 'r1',
          valorLiquido: new Prisma.Decimal('100'),
          dataPagamento: null,
          usina: { nome: 'Usina X', apelidoInterno: 'x', formaAquisicao: null },
        },
      ]);
      await service.gerar('coop-A', 2026, 5, 'demonstrativo-repasses');
      expect(htmlGerado).toMatch(/SEM CLASSIFICAÇÃO/);
      expect(htmlGerado).toMatch(/auditoria de cadastro/);
    });

    it('cita Art. 79/86 (segregação por formaAquisicao)', async () => {
      await service.gerar('coop-A', 2026, 5, 'demonstrativo-repasses');
      expect(htmlGerado).toMatch(/Art\. 79\/86/);
    });
  });

  describe('PDF', () => {
    it('retorna pdfPath + nomeArquivo formatado', async () => {
      findCoop.mockResolvedValue(coopCooperativo);
      findApur.mockResolvedValue(snapshotPadrao);
      const r = await service.gerar('coop-A', 2026, 5, 'demonstrativo-nao-lucratividade');
      expect(r.nomeArquivo).toMatch(/^ct-demonstrativo-nao-lucratividade-.*-2026-05\.pdf$/);
      expect(r.pdfPath).toContain(r.nomeArquivo);
    });
  });
});
