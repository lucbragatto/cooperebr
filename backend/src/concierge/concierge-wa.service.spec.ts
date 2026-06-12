/**
 * Stub do @prisma/client antes de qualquer import que dependa dele.
 *
 * Justificativa: o cliente Prisma gerado em `node_modules/.prisma/client/`
 * pode ficar dessincronizado com o schema (ex.: esqueleto C8 adicionou
 * model LeadConcierge mas `prisma generate` nao foi rodado ainda neste
 * sandbox). Como esses specs sao puramente unitarios e mockam `prisma`
 * via Jest, o cliente gerado nao precisa estar saudavel para os testes
 * exercitarem a logica do service. O stub abaixo evita que ts-jest tente
 * carregar o arquivo gerado.
 */
jest.mock('@prisma/client', () => {
  class PrismaClient {
    $extends() {
      return this;
    }
    $connect() {
      return Promise.resolve();
    }
    $disconnect() {
      return Promise.resolve();
    }
  }
  return {
    PrismaClient,
    Prisma: {
      defineExtension: <T>(arg: T) => arg,
    },
  };
});

import { NotFoundException } from '@nestjs/common';
import {
  ConciergeWaService,
  LeadConcierge,
  StatusLeadConcierge,
} from './concierge-wa.service';
import {
  MSG_BOAS_VINDAS,
  renderizarTemplate,
} from './templates/concierge-wa-mensagens';

/**
 * Specs do ConciergeWaService (Sprint C8 - 12/06/2026).
 *
 * Cobre os 8 metodos publicos do esqueleto + isolamento multi-tenant +
 * helper renderizarTemplate.
 */
describe('ConciergeWaService', () => {
  function buildLead(overrides: Partial<LeadConcierge> = {}): LeadConcierge {
    return {
      id: 'lead-1',
      cooperativaId: 'coop-1',
      telefone: '+5527981341348',
      nome: null,
      email: null,
      cpfCnpj: null,
      cidade: null,
      uf: null,
      concessionaria: null,
      faturaPdfPath: null,
      statusLead: StatusLeadConcierge.RECEBIDO,
      diagnosticoIndebitoId: null,
      cooperadoId: null,
      motivoAbandono: null,
      procuracaoAssinadaEm: null,
      pagamentoConfirmadoEm: null,
      createdAt: new Date('2026-06-12'),
      updatedAt: new Date('2026-06-12'),
      ...overrides,
    };
  }

  function buildService() {
    const prisma = {
      cooperativa: {
        findUnique: jest.fn(),
      },
      leadConcierge: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    const conciergeService = {
      verificarModuloAtivo: jest.fn(),
      previewDiagnostico: jest.fn(),
    };
    // Casts narrow: o service so usa as propriedades acima.
    const service = new ConciergeWaService(
      prisma as never,
      conciergeService as never,
    );
    return { service, prisma, conciergeService };
  }

  // === 1. iniciarFluxoLead ===
  describe('iniciarFluxoLead', () => {
    it('cria LeadConcierge com status RECEBIDO quando cooperativa existe', async () => {
      const { service, prisma } = buildService();
      prisma.cooperativa.findUnique.mockResolvedValue({ id: 'coop-1' });
      const created = buildLead();
      prisma.leadConcierge.create.mockResolvedValue(created);

      const r = await service.iniciarFluxoLead('+5527981341348', 'coop-1');

      expect(prisma.cooperativa.findUnique).toHaveBeenCalledWith({
        where: { id: 'coop-1' },
        select: { id: true },
      });
      expect(prisma.leadConcierge.create).toHaveBeenCalledWith({
        data: {
          cooperativaId: 'coop-1',
          telefone: '+5527981341348',
          statusLead: StatusLeadConcierge.RECEBIDO,
        },
      });
      expect(r).toBe(created);
    });

    it('throw NotFoundException quando cooperativa nao existe', async () => {
      const { service, prisma } = buildService();
      prisma.cooperativa.findUnique.mockResolvedValue(null);

      await expect(
        service.iniciarFluxoLead('+5527981341348', 'coop-fake'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.leadConcierge.create).not.toHaveBeenCalled();
    });
  });

  // === 2. processarFaturaRecebida ===
  describe('processarFaturaRecebida', () => {
    it('atualiza lead para OCR_PROCESSANDO + salva path', async () => {
      const { service, prisma } = buildService();
      const lead = buildLead();
      prisma.leadConcierge.findFirst.mockResolvedValue(lead);
      prisma.leadConcierge.update.mockResolvedValue(lead);

      await service.processarFaturaRecebida(
        'lead-1',
        'coop-1',
        '/tmp/fatura.pdf',
      );

      expect(prisma.leadConcierge.findFirst).toHaveBeenCalledWith({
        where: { id: 'lead-1', cooperativaId: 'coop-1' },
      });
      expect(prisma.leadConcierge.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: {
          faturaPdfPath: '/tmp/fatura.pdf',
          statusLead: StatusLeadConcierge.OCR_PROCESSANDO,
        },
      });
    });
  });

  // === 3. entregarDiagnostico ===
  describe('entregarDiagnostico', () => {
    it('renderiza mensagem com nome e seta status DIAGNOSTICO_PRONTO', async () => {
      const { service, prisma } = buildService();
      const lead = buildLead({ nome: 'Luciano' });
      prisma.leadConcierge.findFirst.mockResolvedValue(lead);
      prisma.leadConcierge.update.mockResolvedValue(lead);

      const msg = await service.entregarDiagnostico('lead-1', 'coop-1');

      expect(msg).toContain('Luciano');
      expect(prisma.leadConcierge.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: { statusLead: StatusLeadConcierge.DIAGNOSTICO_PRONTO },
      });
    });
  });

  // === 4. coletarDadosBasicos ===
  describe('coletarDadosBasicos', () => {
    it('salva nome/CPF/email e seta status DADOS_COLETADOS', async () => {
      const { service, prisma } = buildService();
      prisma.leadConcierge.findFirst.mockResolvedValue(buildLead());
      prisma.leadConcierge.update.mockResolvedValue(buildLead());

      await service.coletarDadosBasicos('lead-1', 'coop-1', {
        nome: 'Luciano',
        cpfCnpj: '12345678900',
        email: 'lucbragatto@gmail.com',
      });

      expect(prisma.leadConcierge.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: {
          nome: 'Luciano',
          cpfCnpj: '12345678900',
          email: 'lucbragatto@gmail.com',
          statusLead: StatusLeadConcierge.DADOS_COLETADOS,
        },
      });
    });
  });

  // === 5. coletarDocumentos ===
  describe('coletarDocumentos', () => {
    it('seta status DOCUMENTOS_COLETADOS', async () => {
      const { service, prisma } = buildService();
      prisma.leadConcierge.findFirst.mockResolvedValue(buildLead());
      prisma.leadConcierge.update.mockResolvedValue(buildLead());

      await service.coletarDocumentos('lead-1', 'coop-1', '/tmp/rg.jpg');

      expect(prisma.leadConcierge.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: { statusLead: StatusLeadConcierge.DOCUMENTOS_COLETADOS },
      });
    });
  });

  // === 6. registrarAssinatura ===
  describe('registrarAssinatura', () => {
    it('retorna true e seta PROCURACAO_ASSINADA quando OTP tem 6 digitos', async () => {
      const { service, prisma } = buildService();
      prisma.leadConcierge.findFirst.mockResolvedValue(buildLead());
      prisma.leadConcierge.update.mockResolvedValue(buildLead());

      const r = await service.registrarAssinatura('lead-1', 'coop-1', '123456');

      expect(r).toBe(true);
      expect(prisma.leadConcierge.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: {
          statusLead: StatusLeadConcierge.PROCURACAO_ASSINADA,
          procuracaoAssinadaEm: expect.any(Date) as unknown as Date,
        },
      });
    });

    it('retorna false e nao atualiza quando OTP invalido', async () => {
      const { service, prisma } = buildService();
      prisma.leadConcierge.findFirst.mockResolvedValue(buildLead());

      const r = await service.registrarAssinatura('lead-1', 'coop-1', 'abc');

      expect(r).toBe(false);
      expect(prisma.leadConcierge.update).not.toHaveBeenCalled();
    });
  });

  // === 7. confirmarPagamento ===
  describe('confirmarPagamento', () => {
    it('seta PAGAMENTO_CONFIRMADO + pagamentoConfirmadoEm', async () => {
      const { service, prisma } = buildService();
      prisma.leadConcierge.findFirst.mockResolvedValue(buildLead());
      prisma.leadConcierge.update.mockResolvedValue(buildLead());

      await service.confirmarPagamento('lead-1', 'coop-1', 'pay_asaas_abc');

      expect(prisma.leadConcierge.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: {
          statusLead: StatusLeadConcierge.PAGAMENTO_CONFIRMADO,
          pagamentoConfirmadoEm: expect.any(Date) as unknown as Date,
        },
      });
    });
  });

  // === 8. marcarFallbackHumano ===
  describe('marcarFallbackHumano', () => {
    it('seta FALLBACK_HUMANO + grava motivo', async () => {
      const { service, prisma } = buildService();
      prisma.leadConcierge.findFirst.mockResolvedValue(buildLead());
      prisma.leadConcierge.update.mockResolvedValue(buildLead());

      await service.marcarFallbackHumano(
        'lead-1',
        'coop-1',
        'OCR falhou 3x consecutivas',
      );

      expect(prisma.leadConcierge.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: {
          statusLead: StatusLeadConcierge.FALLBACK_HUMANO,
          motivoAbandono: 'OCR falhou 3x consecutivas',
        },
      });
    });
  });

  // === 9. Isolamento multi-tenant ===
  describe('isolamento multi-tenant', () => {
    it('lanca NotFoundException quando lead pertence a outra cooperativa', async () => {
      const { service, prisma } = buildService();
      // Prisma findFirst com where:{id, cooperativaId} retorna null quando
      // cooperativaId nao bate.
      prisma.leadConcierge.findFirst.mockResolvedValue(null);

      await expect(
        service.processarFaturaRecebida(
          'lead-de-outra-coop',
          'coop-1',
          '/tmp/x.pdf',
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.leadConcierge.findFirst).toHaveBeenCalledWith({
        where: { id: 'lead-de-outra-coop', cooperativaId: 'coop-1' },
      });
      expect(prisma.leadConcierge.update).not.toHaveBeenCalled();
    });
  });

  // === 10 e 11. renderizarTemplate (helper) ===
  describe('renderizarTemplate (helper)', () => {
    it('substitui variaveis presentes', () => {
      const out = renderizarTemplate(MSG_BOAS_VINDAS, { nome: 'Luciano' });
      expect(out).toContain('Ola Luciano!');
      expect(out).not.toContain('{{nome}}');
    });

    it('deixa placeholder literal quando variavel faltante', () => {
      const out = renderizarTemplate('Ola {{nome}}, faltam {{x}}', {
        nome: 'Luciano',
      });
      expect(out).toBe('Ola Luciano, faltam {{x}}');
    });
  });

  // === 12. Transicao de estado valida ===
  describe('transicao de estado', () => {
    it('RECEBIDO -> OCR_PROCESSANDO via processarFaturaRecebida', async () => {
      const { service, prisma } = buildService();
      const inicial = buildLead({ statusLead: StatusLeadConcierge.RECEBIDO });
      prisma.leadConcierge.findFirst.mockResolvedValue(inicial);
      prisma.leadConcierge.update.mockResolvedValue(
        buildLead({ statusLead: StatusLeadConcierge.OCR_PROCESSANDO }),
      );

      await service.processarFaturaRecebida(
        'lead-1',
        'coop-1',
        '/tmp/fatura.pdf',
      );

      const updateArgs = prisma.leadConcierge.update.mock.calls[0][0] as {
        data: { statusLead: string };
      };
      expect(updateArgs.data.statusLead).toBe(
        StatusLeadConcierge.OCR_PROCESSANDO,
      );
    });
  });
});
