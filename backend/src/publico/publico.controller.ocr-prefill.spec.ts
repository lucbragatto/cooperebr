/**
 * D-novo-OCR-UC-PREFILL (05/06/2026) — specs do payload de
 * POST /publico/processar-fatura-ocr expondo as 3 variantes da UC
 * (numero / numeroUC / numeroConcessionariaOriginal) em vez de só legado.
 *
 * Bug original: handler só retornava `numeroUC` (legado 9 díg). Faturas EDP-ES
 * atuais trazem o número predominantemente como `numeroConcessionariaOriginal`
 * (formato `0.000.XXX.XXX.XXX-XX`), com legado ausente. Resultado: form ficava
 * vazio e quebrava o golden path do convite (POST /cadastro-web rejeitava com
 * 400 "Número da UC vazio sem permiteSemUc" do guard anti-UC-fake).
 *
 * Fix: payload expõe os 3 campos; frontend (mapper puro em web/lib/ocr-mapping.ts)
 * escolhe na ordem de prioridade canônico → legado → dígitos-do-original.
 *
 * Cobertura:
 *  1. payload retorna os 3 campos quando OCR retorna todos
 *  2. payload retorna string vazia (em vez de undefined) quando OCR não retorna
 *  3. compat: callers existentes que só leem `numeroUC` legado continuam OK
 *  4. fatura EDP-ES atual (só `numeroConcessionariaOriginal`) chega completa na UI
 */
import { PublicoController } from './publico.controller';

describe('PublicoController.processarFaturaOcr — payload expõe 3 variantes de UC', () => {
  let controller: PublicoController;
  let faturasServiceMock: { extrairOcr: jest.Mock };

  beforeEach(() => {
    faturasServiceMock = { extrairOcr: jest.fn() };

    controller = Object.create(PublicoController.prototype);
    (controller as any).faturasService = faturasServiceMock;
    (controller as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  });

  // Multer file mínimo (PDF)
  function arquivoPdf(buffer = Buffer.from('%PDF-fake')) {
    return {
      buffer,
      size: buffer.length,
      mimetype: 'application/pdf',
      originalname: 'fatura.pdf',
    } as Express.Multer.File;
  }

  const dadosOcrCompletos = {
    titular: 'JOSÉ DA SILVA',
    documento: '12345678901',
    numero: '0400702214',
    numeroUC: '160085263',
    numeroConcessionariaOriginal: '0.000.512.828.054-91',
    distribuidora: 'EDP_ES',
    consumoAtualKwh: 350,
    historicoConsumo: [],
    enderecoInstalacao: 'Rua Test, 1',
    bairro: 'Centro',
    cidade: 'Vitória',
    estado: 'ES',
    cep: '29100000',
    totalAPagar: 250.5,
    energiaInjetadaKwh: 0,
    energiaFornecidaKwh: 350,
    saldoTotalKwh: 0,
    valorCompensadoReais: 0,
    temCreditosInjetados: false,
    possuiCompensacao: false,
    creditosRecebidosKwh: 0,
  };

  it('1) payload retorna os 3 campos quando OCR retorna todos', async () => {
    faturasServiceMock.extrairOcr.mockResolvedValue(dadosOcrCompletos);

    const r = await controller.processarFaturaOcr(arquivoPdf());

    expect(r.sucesso).toBe(true);
    expect(r.dados.numero).toBe('0400702214');
    expect(r.dados.numeroUC).toBe('160085263');
    expect(r.dados.numeroConcessionariaOriginal).toBe('0.000.512.828.054-91');
  });

  it('2) payload retorna string vazia (NÃO undefined) quando OCR não retorna o campo', async () => {
    faturasServiceMock.extrairOcr.mockResolvedValue({
      ...dadosOcrCompletos,
      numero: undefined,
      numeroUC: '',
      numeroConcessionariaOriginal: undefined,
    });

    const r = await controller.processarFaturaOcr(arquivoPdf());

    expect(r.dados.numero).toBe('');
    expect(r.dados.numeroUC).toBe('');
    expect(r.dados.numeroConcessionariaOriginal).toBe('');
  });

  it('3) compat — callers existentes que leem só numeroUC (legado) continuam OK', async () => {
    faturasServiceMock.extrairOcr.mockResolvedValue({
      ...dadosOcrCompletos,
      numero: '', // canônico ausente
      numeroUC: '160085263', // só legado
      numeroConcessionariaOriginal: '',
    });

    const r = await controller.processarFaturaOcr(arquivoPdf());

    // Caller legado lê data.dados.numeroUC e segue funcionando
    expect(r.dados.numeroUC).toBe('160085263');
    // Novos campos vêm como string vazia (sem regressão)
    expect(r.dados.numero).toBe('');
    expect(r.dados.numeroConcessionariaOriginal).toBe('');
  });

  it('4) golden path do convite — fatura EDP-ES atual (só numeroConcessionariaOriginal)', async () => {
    // Caso real do convite Clínica 05/06: UC só vem em formato com pontos,
    // legado ausente. Backend agora expõe pra UI fazer o mapping correto.
    faturasServiceMock.extrairOcr.mockResolvedValue({
      ...dadosOcrCompletos,
      numero: '',
      numeroUC: '',
      numeroConcessionariaOriginal: '0.000.374.127.054-59',
    });

    const r = await controller.processarFaturaOcr(arquivoPdf());

    expect(r.dados.numeroConcessionariaOriginal).toBe('0.000.374.127.054-59');
    // Antes do fix, payload viria com numeroUC='' e SEM numeroConcessionariaOriginal;
    // frontend não pré-preenchia nada e usuário batia no guard de UC vazia.
    // Agora frontend mapeia via web/lib/ocr-mapping.ts:
    //   numeroUC = '' || '' || '000037412705459' (dígitos do original) → form preenche.
  });

  it('5) campos extras do payload (nome, distribuidora, consumo) preservados', async () => {
    faturasServiceMock.extrairOcr.mockResolvedValue(dadosOcrCompletos);

    const r = await controller.processarFaturaOcr(arquivoPdf());

    expect(r.dados.nome).toBe('JOSÉ DA SILVA');
    expect(r.dados.cpf).toBe('12345678901');
    expect(r.dados.distribuidora).toBe('EDP_ES');
    expect(r.dados.consumoMedioKwh).toBe(350);
    expect(r.dados.totalAPagar).toBe(250.5);
  });
});
