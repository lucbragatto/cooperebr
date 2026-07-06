/**
 * Sprint Máscara de e-mail por convênio (06/07/2026) — specs do
 * FaturasCampanhaService.
 *
 * Cobertura:
 *  - Guard 15MB (rejeita anexo grande sem chamar OCR).
 *  - Dedupe semântica por (convenioId, numeroUC): mesma UC reenviada = UPDATE.
 *  - OCR OK grava campos sanitizados.
 *  - OCR FALHOU grava status=OCR_FALHOU + anexoPath pra revisão manual.
 *  - Multi-tenant no atualizarStatus (M45).
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  FaturasCampanhaService,
  CAMPANHA_ANEXO_MAX_BYTES,
} from './faturas-campanha.service';

function setup() {
  const findFirstConvenio = jest.fn();
  const findFirstFatura = jest.fn();
  const findFirstCoop = jest.fn();
  const create = jest.fn().mockResolvedValue({ id: 'fatura-new' });
  const update = jest.fn().mockResolvedValue({ id: 'fatura-upd' });

  const prismaMock: any = {
    contratoConvenio: { findFirst: findFirstConvenio },
    faturaCampanhaConvenio: {
      findFirst: findFirstFatura,
      create,
      update,
      findMany: jest.fn().mockResolvedValue([]),
    },
    cooperado: { findFirst: findFirstCoop },
    configTenant: { findFirst: jest.fn().mockResolvedValue(null) },
  };

  const extrairOcr = jest.fn();
  const faturasMock: any = { extrairOcr };

  const service = new FaturasCampanhaService(prismaMock, faturasMock);
  return { service, prismaMock, faturasMock, findFirstFatura, findFirstCoop, create, update, findFirstConvenio };
}

// Redireciona uploads pra um tmpdir por teste (evita poluir uploads/campanha/).
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'faturas-campanha-'));
const origCwd = process.cwd();
beforeAll(() => {
  process.chdir(TMP);
});
afterAll(() => {
  process.chdir(origCwd);
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('FaturasCampanhaService.processarFaturaCampanha', () => {
  it('anexo > 15MB → BadRequest (nunca chama OCR)', async () => {
    const { service, faturasMock } = setup();
    const bigBuffer = Buffer.alloc(CAMPANHA_ANEXO_MAX_BYTES + 1);

    await expect(
      service.processarFaturaCampanha({
        convenioId: 'conv1',
        cooperativaId: 'coop1',
        emailRemetente: 'x@y.com',
        anexo: { filename: 'big.pdf', content: bigBuffer },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(faturasMock.extrairOcr).not.toHaveBeenCalled();
  });

  it('OCR OK + primeira UC → cria FaturaCampanhaConvenio com campos sanitizados', async () => {
    const { service, faturasMock, create, findFirstFatura } = setup();
    findFirstFatura.mockResolvedValue(null);
    faturasMock.extrairOcr.mockResolvedValue({
      titular: '  João  da  Silva  ',
      documento: '12345678900',
      numeroUC: '00.001.234.567',
      distribuidora: 'EDP_ES',
      consumoAtualKwh: 320,
      totalAPagar: 245.5,
    });

    const r = await service.processarFaturaCampanha({
      convenioId: 'conv1',
      cooperativaId: 'coop1',
      emailRemetente: 'x@y.com',
      emailAssunto: 'Minha fatura',
      anexo: { filename: 'ok.pdf', content: Buffer.from('%PDF-fake') },
    });

    expect(r.upserted).toBe('CREATED');
    expect(r.status).toBe('OCR_OK');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          convenioId: 'conv1',
          cooperativaId: 'coop1',
          nomeExtraido: 'João da Silva', // sanitize colapsou espaços
          numeroUC: '00001234567', // pontos/hifens removidos por sanitizarNumeroUc
          distribuidora: 'EDP_ES',
          consumoMedioKwh: 320,
          valorFatura: 245.5,
          status: 'OCR_OK',
        }),
      }),
    );
  });

  it('OCR OK + mesma UC já existe → UPDATE (dedupe semântica)', async () => {
    const { service, faturasMock, findFirstFatura, update, create } = setup();
    findFirstFatura.mockResolvedValue({ id: 'fatura-ja-existe' });
    faturasMock.extrairOcr.mockResolvedValue({
      titular: 'Maria',
      numeroUC: '00012345670',
      consumoAtualKwh: 400,
    });

    const r = await service.processarFaturaCampanha({
      convenioId: 'conv1',
      cooperativaId: 'coop1',
      emailRemetente: 'x@y.com',
      anexo: { filename: 'dup.pdf', content: Buffer.from('%PDF-fake2') },
    });

    expect(r.upserted).toBe('UPDATED');
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'fatura-ja-existe' },
        data: expect.objectContaining({
          nomeExtraido: 'Maria',
          consumoMedioKwh: 400,
          status: 'OCR_OK',
        }),
      }),
    );
  });

  it('OCR FALHOU → status OCR_FALHOU + registro criado (revisão manual)', async () => {
    const { service, faturasMock, create } = setup();
    faturasMock.extrairOcr.mockRejectedValue(new Error('anthropic 500'));

    const r = await service.processarFaturaCampanha({
      convenioId: 'conv1',
      cooperativaId: 'coop1',
      emailRemetente: 'x@y.com',
      anexo: { filename: 'ruim.pdf', content: Buffer.from('%PDF-broken') },
    });

    expect(r.status).toBe('OCR_FALHOU');
    expect(r.upserted).toBe('CREATED');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'OCR_FALHOU',
          anexoPath: expect.stringContaining('uploads/campanha/conv1/'),
        }),
      }),
    );
  });
});

describe('FaturasCampanhaService.atualizarStatus — multi-tenant (M45)', () => {
  it('registro em outro tenant → NotFound', async () => {
    const { service, findFirstFatura } = setup();
    findFirstFatura.mockResolvedValue(null);

    await expect(
      service.atualizarStatus({
        convenioId: 'conv1',
        faturaId: 'fatura-outro-tenant',
        cooperativaId: 'coop1',
        status: 'DESCARTADA',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('VINCULADA sem cooperadoId → BadRequest', async () => {
    const { service, findFirstFatura } = setup();
    findFirstFatura.mockResolvedValue({ id: 'f1', status: 'OCR_OK' });

    await expect(
      service.atualizarStatus({
        convenioId: 'conv1',
        faturaId: 'f1',
        cooperativaId: 'coop1',
        status: 'VINCULADA',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('VINCULADA + cooperado de outro tenant → BadRequest', async () => {
    const { service, findFirstFatura, findFirstCoop } = setup();
    findFirstFatura.mockResolvedValue({ id: 'f1', status: 'OCR_OK' });
    findFirstCoop.mockResolvedValue(null);

    await expect(
      service.atualizarStatus({
        convenioId: 'conv1',
        faturaId: 'f1',
        cooperativaId: 'coop1',
        status: 'VINCULADA',
        cooperadoId: 'coop-outro-tenant',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fatura já finalizada (DESCARTADA) → BadRequest', async () => {
    const { service, findFirstFatura } = setup();
    findFirstFatura.mockResolvedValue({ id: 'f1', status: 'DESCARTADA' });

    await expect(
      service.atualizarStatus({
        convenioId: 'conv1',
        faturaId: 'f1',
        cooperativaId: 'coop1',
        status: 'DESCARTADA',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
