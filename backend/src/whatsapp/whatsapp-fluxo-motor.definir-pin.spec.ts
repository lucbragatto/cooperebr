/**
 * F1 (09/06/2026) — Specs do fluxo "Definir PIN" no Bot WA.
 *
 * 4 acoes:
 *  - INICIAR_DEFINIR_PIN: guard status=ATIVO + temPin=false + cria OtpDesafio
 *  - VALIDAR_OTP_PIN_DEFINIR: valida OTP + ultimos 4 do CPF (dado pessoal)
 *  - RECEBER_NOVO_PIN_DEFINICAO: valida 6 digitos + isPinFraco
 *  - CONFIRMAR_PIN_DEFINICAO: confere igualdade + definirPin + zera dadosTemp
 */
import { WhatsappFluxoMotorService } from './whatsapp-fluxo-motor.service';

describe('WhatsappFluxoMotorService - DEFINIR_PIN fluxo (F1)', () => {
  let service: WhatsappFluxoMotorService;

  const cooperadoFindFirst = jest.fn();
  const conversaUpdate = jest.fn();
  const conversaFindUnique = jest.fn();
  const enviarMensagem = jest.fn();

  const pinTemPin = jest.fn();
  const pinDefinir = jest.fn();
  const otpCriar = jest.fn();
  const otpValidar = jest.fn();

  const prismaMock: any = {
    fluxoEtapa: { findFirst: jest.fn() },
    modeloMensagem: { findFirst: jest.fn(), findUnique: jest.fn() },
    conversaWhatsapp: {
      update: conversaUpdate,
      findUnique: conversaFindUnique,
    },
    cooperativa: { findUnique: jest.fn(), findMany: jest.fn() },
    cooperado: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: cooperadoFindFirst,
      findMany: jest.fn(),
    },
  };
  const modeloMensagemMock: any = { incrementarUso: jest.fn() };
  const senderMock: any = { enviarMensagem };
  const cepServiceMock: any = { consultar: jest.fn() };
  const faturasServiceMock: any = { extrairOcr: jest.fn() };
  const notificacoesServiceMock: any = { criar: jest.fn() };
  const cooperTokenServiceMock: any = {};
  const pinCooperadoSvcMock: any = { temPin: pinTemPin, definirPin: pinDefinir };
  const limiteTokenSvcMock: any = {};
  const otpDesafioSvcMock: any = { criarDesafio: otpCriar, validar: otpValidar };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WhatsappFluxoMotorService(
      prismaMock,
      modeloMensagemMock,
      senderMock,
      cepServiceMock,
      faturasServiceMock,
      notificacoesServiceMock,
      cooperTokenServiceMock,
      pinCooperadoSvcMock,
      limiteTokenSvcMock,
      otpDesafioSvcMock,
    );
  });

  const conversa = {
    id: 'conv1',
    telefone: '5527981341348',
    cooperadoId: 'coop-luc',
    cooperativaId: 'coop-A',
  };

  // ─────────────────────────────────────────────────────────────
  // INICIAR_DEFINIR_PIN
  // ─────────────────────────────────────────────────────────────
  describe('INICIAR_DEFINIR_PIN', () => {
    it('Cooperado nao-ATIVO -> volta MENU_COOPERTOKENS + mensagem regularizar', async () => {
      cooperadoFindFirst.mockResolvedValueOnce({
        status: 'PENDENTE_DOCUMENTOS',
        cpf: '89089324704',
      });
      await (service as any).executarIniciarDefinirPin(conversa);

      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { estado: 'MENU_COOPERTOKENS' },
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        '5527981341348',
        expect.stringMatching(/conta não está ATIVA/),
      );
      expect(otpCriar).not.toHaveBeenCalled();
    });

    it('Cooperado ja tem PIN -> volta MENU_COOPERTOKENS + orienta alterar', async () => {
      cooperadoFindFirst.mockResolvedValueOnce({ status: 'ATIVO', cpf: '111' });
      pinTemPin.mockResolvedValueOnce(true);

      await (service as any).executarIniciarDefinirPin(conversa);

      expect(pinDefinir).not.toHaveBeenCalled();
      expect(enviarMensagem).toHaveBeenCalledWith(
        '5527981341348',
        expect.stringMatching(/já tem um PIN/),
      );
      expect(otpCriar).not.toHaveBeenCalled();
    });

    it('Cooperado ATIVO sem PIN -> cria OtpDesafio motivo PIN_DEFINIR + envia codigo + dadosTemp.desafioId', async () => {
      cooperadoFindFirst.mockResolvedValueOnce({
        status: 'ATIVO',
        cpf: '89089324704',
      });
      pinTemPin.mockResolvedValueOnce(false);
      conversaFindUnique.mockResolvedValueOnce({ dadosTemp: {} });
      otpCriar.mockResolvedValueOnce({
        desafioId: 'd1',
        codigo: '123456',
        expiresAt: new Date(),
      });

      await (service as any).executarIniciarDefinirPin(conversa);

      expect(otpCriar).toHaveBeenCalledWith({
        motivo: 'PIN_DEFINIR',
        sujeitoTipo: 'COOPERADO',
        sujeitoId: 'coop-luc',
        telefoneDestino: '5527981341348',
        cooperativaId: 'coop-A',
      });
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { dadosTemp: { definirPinDesafioId: 'd1' } },
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        '5527981341348',
        expect.stringContaining('123456'),
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        '5527981341348',
        expect.stringMatching(/últimos 4 dígitos do CPF/),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // VALIDAR_OTP_PIN_DEFINIR (OTP + dado pessoal)
  // ─────────────────────────────────────────────────────────────
  describe('VALIDAR_OTP_PIN_DEFINIR', () => {
    it('Formato invalido (so OTP, sem CPF) -> mensagem instrucao + nao chama otp/cooperado', async () => {
      await (service as any).executarValidarOtpPinDefinir(conversa, '123456');
      expect(enviarMensagem).toHaveBeenCalledWith(
        '5527981341348',
        expect.stringMatching(/Formato inválido/),
      );
      expect(cooperadoFindFirst).not.toHaveBeenCalled();
      expect(otpValidar).not.toHaveBeenCalled();
    });

    it('Dado pessoal (ultimos 4 CPF) NAO bate -> recusa SEM gastar tentativa OTP', async () => {
      cooperadoFindFirst.mockResolvedValueOnce({ cpf: '89089324704' });
      await (service as any).executarValidarOtpPinDefinir(conversa, '123456 9999');
      expect(enviarMensagem).toHaveBeenCalledWith(
        '5527981341348',
        expect.stringMatching(/não conferem/),
      );
      expect(otpValidar).not.toHaveBeenCalled();
    });

    it('Dado pessoal bate + OTP correto -> transita pra AGUARDANDO_PIN', async () => {
      cooperadoFindFirst.mockResolvedValueOnce({ cpf: '89089324704' });
      // ultimos 4 = 4704
      conversaFindUnique.mockResolvedValueOnce({
        dadosTemp: { definirPinDesafioId: 'd1' },
      });
      otpValidar.mockResolvedValueOnce({ ok: true, desafioId: 'd1' });

      await (service as any).executarValidarOtpPinDefinir(conversa, '123456 4704');

      expect(otpValidar).toHaveBeenCalledWith({
        desafioId: 'd1',
        codigo: '123456',
        cooperativaId: 'coop-A',
      });
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { estado: 'DEFINIR_PIN_AGUARDANDO_PIN' },
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        '5527981341348',
        expect.stringMatching(/escolha seu PIN/),
      );
    });

    it('Dado pessoal bate mas OTP incorreto -> mantem estado + mensagem retry', async () => {
      cooperadoFindFirst.mockResolvedValueOnce({ cpf: '89089324704' });
      conversaFindUnique.mockResolvedValueOnce({
        dadosTemp: { definirPinDesafioId: 'd1' },
      });
      otpValidar.mockResolvedValueOnce({ ok: false, motivo: 'CODIGO_INCORRETO' });

      await (service as any).executarValidarOtpPinDefinir(conversa, '999999 4704');

      // Nao transita pra AGUARDANDO_PIN
      expect(conversaUpdate).not.toHaveBeenCalled();
      expect(enviarMensagem).toHaveBeenCalledWith(
        '5527981341348',
        expect.stringMatching(/Tente novamente|não conferem/i),
      );
    });

    it('Cooperado cancela (digita 0) -> volta MENU_COOPERTOKENS', async () => {
      conversaFindUnique.mockResolvedValueOnce({ dadosTemp: {} });
      await (service as any).executarValidarOtpPinDefinir(conversa, '0');
      expect(conversaUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estado: 'MENU_COOPERTOKENS' }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // RECEBER_NOVO_PIN_DEFINICAO
  // ─────────────────────────────────────────────────────────────
  describe('RECEBER_NOVO_PIN_DEFINICAO', () => {
    it('PIN fraco (sequencia 123456) -> recusa + mantem estado', async () => {
      await (service as any).executarReceberNovoPinDefinicao(conversa, '123456');
      expect(enviarMensagem).toHaveBeenCalledWith(
        '5527981341348',
        expect.stringMatching(/PIN fraco/),
      );
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('PIN forte -> guarda em dadosTemp + transita pra AGUARDANDO_CONFIRMACAO', async () => {
      conversaFindUnique.mockResolvedValueOnce({
        dadosTemp: { definirPinDesafioId: 'd1' },
      });
      await (service as any).executarReceberNovoPinDefinicao(conversa, '482173');
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: {
          estado: 'DEFINIR_PIN_AGUARDANDO_CONFIRMACAO',
          dadosTemp: {
            definirPinDesafioId: 'd1',
            definirPinPropostoTemp: '482173',
          },
        },
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        '5527981341348',
        expect.stringMatching(/mesmo PIN/),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CONFIRMAR_PIN_DEFINICAO
  // ─────────────────────────────────────────────────────────────
  describe('CONFIRMAR_PIN_DEFINICAO', () => {
    it('Confirmacao NAO bate -> recusa + mantem estado', async () => {
      conversaFindUnique.mockResolvedValueOnce({
        dadosTemp: { definirPinPropostoTemp: '482173' },
      });
      await (service as any).executarConfirmarPinDefinicao(conversa, '482174');

      expect(pinDefinir).not.toHaveBeenCalled();
      expect(enviarMensagem).toHaveBeenCalledWith(
        '5527981341348',
        expect.stringMatching(/não conferem/),
      );
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('Confirmacao BATE -> chama definirPin + zera dadosTemp.definirPin* + volta MENU_COOPERTOKENS', async () => {
      conversaFindUnique.mockResolvedValueOnce({
        dadosTemp: {
          definirPinPropostoTemp: '482173',
          definirPinDesafioId: 'd1',
          outroCampo: 'preservar',
        },
      });
      pinDefinir.mockResolvedValueOnce(undefined);

      await (service as any).executarConfirmarPinDefinicao(conversa, '482173');

      expect(pinDefinir).toHaveBeenCalledWith({
        cooperadoId: 'coop-luc',
        pin: '482173',
        cooperativaId: 'coop-A',
      });
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: {
          estado: 'MENU_COOPERTOKENS',
          dadosTemp: { outroCampo: 'preservar' }, // higiene: PIN proposto + desafioId zerados
        },
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        '5527981341348',
        expect.stringMatching(/PIN cadastrado com sucesso/),
      );
    });

    it('Multi-tenant: cooperadoId+cooperativaId passados pra definirPin vem da conversa (JWT-equivalente do bot)', async () => {
      conversaFindUnique.mockResolvedValueOnce({
        dadosTemp: { definirPinPropostoTemp: '273981' },
      });
      pinDefinir.mockResolvedValueOnce(undefined);

      await (service as any).executarConfirmarPinDefinicao(
        { ...conversa, cooperadoId: 'coop-X', cooperativaId: 'tenant-Y' },
        '273981',
      );

      expect(pinDefinir).toHaveBeenCalledWith({
        cooperadoId: 'coop-X',
        pin: '273981',
        cooperativaId: 'tenant-Y',
      });
    });
  });
});
