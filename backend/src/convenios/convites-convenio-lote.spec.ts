/**
 * Sprint Convite-Lote LOTE.1 (07/06/2026) — specs do previewLote.
 *
 * Cobertura:
 *  - parsing: separadores `,` / `;` / `\t`, cabeçalho ignorado, linhas vazias.
 *  - validação: nome curto / vazio, telefone inválido.
 *  - dedup interno (mesmo telefone repetido no CSV).
 *  - dedup externo: já é MEMBRO_ATIVO no convênio.
 *  - dedup externo: já tem convite vivo.
 *  - anti-IDOR: cooperativaId errada → NotFound.
 *  - convênio não ATIVO / pagador != EMPRESA → 400.
 *  - shape do resumo bate com classificação.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConvitesConvenioService } from './convites-convenio.service';

describe('ConvitesConvenioService.previewLote — LOTE.1', () => {
  let service: ConvitesConvenioService;
  let prismaMock: any;

  const TENANT_A = 'coop-A';
  const CONVENIO_ID = 'conv-1';

  const convenioBase = {
    id: CONVENIO_ID,
    status: 'ATIVO',
    pagador: 'EMPRESA',
    empresaNome: 'Clínica X',
  };

  beforeEach(() => {
    prismaMock = {
      contratoConvenio: { findFirst: jest.fn().mockResolvedValue(convenioBase) },
      convenioCooperado: { findMany: jest.fn().mockResolvedValue([]) },
      conviteConvenioMembro: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new ConvitesConvenioService(prismaMock, { enviarMensagem: jest.fn() } as any);
  });

  it('CSV válido com 3 linhas distintas → todas PRONTO', async () => {
    const csv = [
      'Dra. Ana,27999990001',
      'Dr. Bruno,27999990002',
      'Dra. Carla,27999990003',
    ].join('\n');

    const r = await service.previewLote({
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
      csv,
    });

    expect(r.resumo).toEqual({
      total: 3,
      pronto: 3,
      duplicataCsv: 0,
      jaMembro: 0,
      jaConvidado: 0,
      invalido: 0,
    });
    expect(r.linhas.every((l) => l.status === 'PRONTO')).toBe(true);
    expect(r.linhas[0]!.telefoneFmt).toBe('5527999990001');
  });

  it('cabeçalho `nome,telefone` ignorado (não conta no total)', async () => {
    const csv = ['Nome,Telefone', 'Dra. Ana,27999990001'].join('\n');
    const r = await service.previewLote({
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
      csv,
    });
    expect(r.resumo.total).toBe(1);
    expect(r.linhas[0]!.nome).toBe('Dra. Ana');
  });

  it('separadores `;` e `\\t` também funcionam', async () => {
    const csv = ['Dra. Ana;27999990001', 'Dr. Bruno\t27999990002'].join('\n');
    const r = await service.previewLote({
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
      csv,
    });
    expect(r.resumo.pronto).toBe(2);
  });

  it('linhas vazias ignoradas', async () => {
    const csv = ['Dra. Ana,27999990001', '', '   ', 'Dr. Bruno,27999990002'].join('\n');
    const r = await service.previewLote({
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
      csv,
    });
    expect(r.resumo.total).toBe(2);
  });

  it('nome muito curto → INVALIDO', async () => {
    const csv = 'A,27999990001';
    const r = await service.previewLote({
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
      csv,
    });
    expect(r.linhas[0]!.status).toBe('INVALIDO');
    expect(r.linhas[0]!.motivo).toMatch(/[Nn]ome/);
  });

  it('telefone inválido → INVALIDO', async () => {
    const csv = 'Dra. Ana,123';
    const r = await service.previewLote({
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
      csv,
    });
    expect(r.linhas[0]!.status).toBe('INVALIDO');
  });

  it('telefone ausente → INVALIDO', async () => {
    const csv = 'Dra. Ana';
    const r = await service.previewLote({
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
      csv,
    });
    expect(r.linhas[0]!.status).toBe('INVALIDO');
    expect(r.linhas[0]!.motivo).toMatch(/[Tt]elefone/);
  });

  it('mesmo telefone 2x no CSV → 1ª PRONTO, 2ª DUPLICATA_CSV', async () => {
    const csv = ['Dra. Ana,27999990001', 'Outro Nome,27999990001'].join('\n');
    const r = await service.previewLote({
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
      csv,
    });
    expect(r.linhas[0]!.status).toBe('PRONTO');
    expect(r.linhas[1]!.status).toBe('DUPLICATA_CSV');
  });

  it('telefone já é membro ATIVO → JA_MEMBRO', async () => {
    prismaMock.convenioCooperado.findMany.mockResolvedValue([
      { cooperado: { telefone: '5527999990001' } },
    ]);
    const csv = 'Dra. Ana,27999990001';
    const r = await service.previewLote({
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
      csv,
    });
    expect(r.linhas[0]!.status).toBe('JA_MEMBRO');
  });

  it('telefone já tem convite vivo → JA_CONVIDADO', async () => {
    prismaMock.conviteConvenioMembro.findMany.mockResolvedValue([
      { telefone: '5527999990001' },
    ]);
    const csv = 'Dra. Ana,27999990001';
    const r = await service.previewLote({
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
      csv,
    });
    expect(r.linhas[0]!.status).toBe('JA_CONVIDADO');
    expect(r.linhas[0]!.motivo).toMatch(/reenviar/);
  });

  it('anti-IDOR: cooperativaId errada → NotFound (não vaza existência)', async () => {
    prismaMock.contratoConvenio.findFirst.mockResolvedValue(null);
    await expect(
      service.previewLote({
        convenioId: CONVENIO_ID,
        cooperativaId: 'OUTRO-TENANT',
        csv: 'Dra. Ana,27999990001',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    // Confirma filtro cooperativaId no findFirst
    expect(prismaMock.contratoConvenio.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONVENIO_ID, cooperativaId: 'OUTRO-TENANT' },
      }),
    );
  });

  it('convênio não ATIVO → BadRequest', async () => {
    prismaMock.contratoConvenio.findFirst.mockResolvedValue({
      ...convenioBase,
      status: 'SUSPENSO',
    });
    await expect(
      service.previewLote({
        convenioId: CONVENIO_ID,
        cooperativaId: TENANT_A,
        csv: 'Dra. Ana,27999990001',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('pagador != EMPRESA → BadRequest', async () => {
    prismaMock.contratoConvenio.findFirst.mockResolvedValue({
      ...convenioBase,
      pagador: 'COOPERADO',
    });
    await expect(
      service.previewLote({
        convenioId: CONVENIO_ID,
        cooperativaId: TENANT_A,
        csv: 'Dra. Ana,27999990001',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('csv vazio → BadRequest', async () => {
    await expect(
      service.previewLote({
        convenioId: CONVENIO_ID,
        cooperativaId: TENANT_A,
        csv: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('csv só com cabeçalho → total=0', async () => {
    const r = await service.previewLote({
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
      csv: 'Nome,Telefone',
    });
    expect(r.resumo.total).toBe(0);
    expect(r.linhas).toEqual([]);
  });

  // ─── LOTE.2 — enviarLote ─────────────────────────────────────────────
  describe('enviarLote — LOTE.2', () => {
    beforeEach(() => {
      // Mocks adicionais pra criarConvite + update do statusEnvio.
      prismaMock.conviteConvenioMembro.findUnique = jest.fn().mockResolvedValue(null);
      prismaMock.conviteConvenioMembro.delete = jest.fn().mockResolvedValue({});
      prismaMock.conviteConvenioMembro.create = jest.fn();
      prismaMock.conviteConvenioMembro.update = jest.fn().mockResolvedValue({});
      let counter = 0;
      prismaMock.conviteConvenioMembro.create.mockImplementation(async (args: any) => ({
        id: `conv-id-${++counter}`,
        token: 'a'.repeat(64),
        nomeConvidado: args.data.nomeConvidado,
        telefone: args.data.telefone,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      }));
    });

    it('cria N convites + retorna loteId imediato', async () => {
      const r = await service.enviarLote({
        convenioId: CONVENIO_ID,
        cooperativaId: TENANT_A,
        criadoPorUserId: 'admin-1',
        destinatarios: [
          { nome: 'Dra. Ana', telefone: '27999990001' },
          { nome: 'Dr. Bruno', telefone: '27999990002' },
        ],
      });
      expect(r.loteId).toMatch(/^[0-9a-f]+$/);
      expect(r.total).toBe(2);
      expect(prismaMock.conviteConvenioMembro.create).toHaveBeenCalledTimes(2);
      // updates pra setar loteId + statusEnvio=PENDENTE
      expect(prismaMock.conviteConvenioMembro.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ loteEnvioWaStatus: 'PENDENTE' }),
        }),
      );
    });

    it('destinatarios vazio → BadRequest', async () => {
      await expect(
        service.enviarLote({
          convenioId: CONVENIO_ID,
          cooperativaId: TENANT_A,
          criadoPorUserId: 'admin-1',
          destinatarios: [],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cooperativaId errada → NotFound', async () => {
      prismaMock.contratoConvenio.findFirst.mockResolvedValue(null);
      await expect(
        service.enviarLote({
          convenioId: CONVENIO_ID,
          cooperativaId: 'OUTRO',
          criadoPorUserId: 'admin-1',
          destinatarios: [{ nome: 'A', telefone: '27999990001' }],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('todos destinatários inválidos → BadRequest "Nenhum convite criado"', async () => {
      // Força criarConvite a falhar em cada item
      prismaMock.conviteConvenioMembro.create.mockRejectedValue(
        new Error('telefone duplicado'),
      );
      await expect(
        service.enviarLote({
          convenioId: CONVENIO_ID,
          cooperativaId: TENANT_A,
          criadoPorUserId: 'admin-1',
          destinatarios: [
            { nome: 'A', telefone: '27999990001' },
            { nome: 'B', telefone: '27999990002' },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ─── LOTE.3 — statusLote ────────────────────────────────────────────
  describe('statusLote — LOTE.3', () => {
    it('retorna agregado + lista com sufixo do telefone (LGPD)', async () => {
      prismaMock.conviteConvenioMembro.findMany.mockResolvedValue([
        {
          id: 'c1',
          nomeConvidado: 'Dra. Ana',
          telefone: '5527999990001',
          loteEnvioWaStatus: 'ENVIADO',
          loteEnvioWaEm: new Date('2026-06-07'),
          loteEnvioWaErro: null,
        },
        {
          id: 'c2',
          nomeConvidado: 'Dr. Bruno',
          telefone: '5527999990002',
          loteEnvioWaStatus: 'FALHOU',
          loteEnvioWaEm: new Date('2026-06-07'),
          loteEnvioWaErro: 'numero não existe no WA',
        },
        {
          id: 'c3',
          nomeConvidado: 'Dra. Carla',
          telefone: '5527999990003',
          loteEnvioWaStatus: 'PENDENTE',
          loteEnvioWaEm: null,
          loteEnvioWaErro: null,
        },
      ]);

      const r = await service.statusLote({
        loteId: 'lote-abc',
        convenioId: CONVENIO_ID,
        cooperativaId: TENANT_A,
      });

      expect(r.resumo).toEqual({ total: 3, pendente: 1, enviado: 1, falhou: 1 });
      expect(r.itens[0]!.telefoneSufixo).toBe('...0001');
      expect(r.itens[1]!.telefoneSufixo).toBe('...0002');
      expect(r.itens[1]!.erro).toBe('numero não existe no WA');
      // Não vaza telefone integral
      r.itens.forEach((i) => expect(i).not.toHaveProperty('telefone'));
    });

    it('lote inexistente / cross-tenant → NotFound', async () => {
      prismaMock.conviteConvenioMembro.findMany.mockResolvedValue([]);
      await expect(
        service.statusLote({
          loteId: 'lote-xyz',
          convenioId: CONVENIO_ID,
          cooperativaId: 'OUTRO',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('caso composto: 5 linhas variadas → resumo bate', async () => {
    prismaMock.convenioCooperado.findMany.mockResolvedValue([
      { cooperado: { telefone: '5527999990002' } },
    ]);
    prismaMock.conviteConvenioMembro.findMany.mockResolvedValue([
      { telefone: '5527999990003' },
    ]);
    const csv = [
      'Dra. Ana,27999990001', // PRONTO
      'Dr. Bruno,27999990002', // JA_MEMBRO
      'Dra. Carla,27999990003', // JA_CONVIDADO
      'Dr. Diego,27999990001', // DUPLICATA_CSV (mesmo telefone da Ana)
      'X,27999990004', // INVALIDO (nome curto)
    ].join('\n');

    const r = await service.previewLote({
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_A,
      csv,
    });

    expect(r.resumo).toEqual({
      total: 5,
      pronto: 1,
      duplicataCsv: 1,
      jaMembro: 1,
      jaConvidado: 1,
      invalido: 1,
    });
  });
});

// ─── Bug A — enviarLinkPorWhatsapp propaga FALHOU + motivo (10/06/2026) ─────
//
// Antes (até M28) o helper ignorava o retorno de waSender.enviarMensagem e
// retornava { enviado:true } sempre que não-throws — sender retornando
// { enviado:false, motivo:'whitelist-dev' } silenciosamente virava ENVIADO no
// banco. Agora o helper propaga FALHOU + motivo. Cobre individual + lote +
// reenvio (mesmo helper compartilhado).
describe('ConvitesConvenioService.enviarLinkPorWhatsapp — Bug A propaga FALHOU', () => {
  let service: ConvitesConvenioService;
  let waSenderMock: { enviarMensagem: jest.Mock };

  const INPUT = {
    telefone: '5527999990001',
    link: 'https://app.coop/cadastro?conv=abc',
    nomeConvidado: 'Dra. Ana',
    empresaNome: 'Clínica X',
    cooperativaId: 'coop-A',
  };

  beforeEach(() => {
    waSenderMock = { enviarMensagem: jest.fn() };
    service = new ConvitesConvenioService({} as any, waSenderMock as any);
  });

  it('sender retorna {enviado:false, motivo:"whitelist-dev"} SEM throw → helper retorna FALHOU + erro=whitelist-dev', async () => {
    waSenderMock.enviarMensagem.mockResolvedValue({
      enviado: false,
      motivo: 'whitelist-dev',
    });
    const r = await service.enviarLinkPorWhatsapp(INPUT);
    expect(r).toEqual({ enviado: false, erro: 'whitelist-dev' });
  });

  it('sender retorna {enviado:false, motivo:"numero-protegido"} → helper retorna FALHOU + erro=numero-protegido', async () => {
    waSenderMock.enviarMensagem.mockResolvedValue({
      enviado: false,
      motivo: 'numero-protegido',
    });
    const r = await service.enviarLinkPorWhatsapp(INPUT);
    expect(r).toEqual({ enviado: false, erro: 'numero-protegido' });
  });

  it('sender retorna {enviado:false} sem motivo → helper retorna FALHOU + erro="falha desconhecida"', async () => {
    waSenderMock.enviarMensagem.mockResolvedValue({ enviado: false });
    const r = await service.enviarLinkPorWhatsapp(INPUT);
    expect(r).toEqual({ enviado: false, erro: 'falha desconhecida' });
  });

  it('sender throws → helper segue retornando FALHOU + erro=<msg> (compat preservada)', async () => {
    waSenderMock.enviarMensagem.mockRejectedValue(new Error('Erro de rede WA'));
    const r = await service.enviarLinkPorWhatsapp(INPUT);
    expect(r).toEqual({ enviado: false, erro: 'Erro de rede WA' });
  });

  it('sender retorna {enviado:true} → helper retorna ENVIADO sem erro', async () => {
    waSenderMock.enviarMensagem.mockResolvedValue({ enviado: true });
    const r = await service.enviarLinkPorWhatsapp(INPUT);
    expect(r).toEqual({ enviado: true });
  });
});
