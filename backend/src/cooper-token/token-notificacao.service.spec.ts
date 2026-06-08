/**
 * Specs TokenNotificacaoService — F2.6 Sprint Token-WA Fase 2.
 *
 * Cobre: notificarPagador (texto + best-effort), notificarRecebedor,
 * enviarOtpAltoValorPorEmail (3 motivos de step-up + sucesso/falha),
 * idempotência de logger em falha.
 */

import { Test } from '@nestjs/testing';
import { TokenNotificacaoService } from './token-notificacao.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { EmailService } from '../email/email.service';

async function buildSut(overrides?: {
  enviarMensagem?: jest.Mock;
  enviarEmail?: jest.Mock;
}) {
  const enviarMensagem = overrides?.enviarMensagem ?? jest.fn(async () => ({ enviado: true }));
  const enviarEmail = overrides?.enviarEmail ?? jest.fn(async () => true);

  const module = await Test.createTestingModule({
    providers: [
      TokenNotificacaoService,
      { provide: WhatsappSenderService, useValue: { enviarMensagem } },
      { provide: EmailService, useValue: { enviarEmail } },
    ],
  }).compile();
  const sut = module.get(TokenNotificacaoService);
  return { sut, enviarMensagem, enviarEmail };
}

describe('TokenNotificacaoService', () => {
  describe('notificarPagador', () => {
    it('chama WhatsappSenderService.enviarMensagem com payload correto', async () => {
      const { sut, enviarMensagem } = await buildSut();
      const confirmadaEm = new Date('2026-06-07T15:30:00-03:00');

      await sut.notificarPagador({
        telefonePagador: '5527981341348',
        nomePagador: 'Luciano',
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
        valorReais: 75,
        quantidadeTokens: 75,
        nomeRecebedor: 'Padaria Sol',
        transacaoId: 'tx-abc123',
        confirmadaEm,
      });

      expect(enviarMensagem).toHaveBeenCalledTimes(1);
      const [telefone, texto, opcoes] = enviarMensagem.mock.calls[0];
      expect(telefone).toBe('5527981341348');
      expect(texto).toContain('Pagamento confirmado');
      expect(texto).toContain('Luciano');
      expect(texto).toContain('R$');
      expect(texto).toContain('Padaria Sol');
      expect(texto).toContain('tx-abc123');
      expect(opcoes).toMatchObject({
        tipoDisparo: 'TOKEN_PAGAMENTO_CONFIRMADO_PAGADOR',
        disparoId: 'tx-abc123',
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
      });
    });

    it('NÃO lança quando WhatsappSenderService falha', async () => {
      const { sut } = await buildSut({
        enviarMensagem: jest.fn(async () => {
          throw new Error('WA service down');
        }),
      });
      await expect(
        sut.notificarPagador({
          telefonePagador: '5527981341348',
          nomePagador: 'Luciano',
          cooperadoId: 'coop1',
          cooperativaId: 'tenantA',
          valorReais: 50,
          quantidadeTokens: 50,
          nomeRecebedor: 'Padaria',
          transacaoId: 'tx-1',
          confirmadaEm: new Date(),
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('notificarRecebedor', () => {
    it('chama enviarMensagem com payload correto', async () => {
      const { sut, enviarMensagem } = await buildSut();

      await sut.notificarRecebedor({
        telefoneRecebedor: '5527999999999',
        nomeRecebedor: 'Padaria Sol',
        cooperadoRecebedorId: 'coop2',
        cooperativaId: 'tenantA',
        valorReais: 75,
        quantidadeTokens: 75,
        nomePagador: 'Luciano',
        transacaoId: 'tx-abc123',
        confirmadaEm: new Date(),
      });

      expect(enviarMensagem).toHaveBeenCalledTimes(1);
      const [telefone, texto, opcoes] = enviarMensagem.mock.calls[0];
      expect(telefone).toBe('5527999999999');
      expect(texto).toContain('Pagamento recebido');
      expect(texto).toContain('Padaria Sol');
      expect(texto).toContain('Luciano');
      expect(opcoes.tipoDisparo).toBe('TOKEN_PAGAMENTO_CONFIRMADO_RECEBEDOR');
    });

    it('NÃO lança quando WhatsappSenderService falha', async () => {
      const { sut } = await buildSut({
        enviarMensagem: jest.fn(async () => {
          throw new Error('WA service down');
        }),
      });
      await expect(
        sut.notificarRecebedor({
          telefoneRecebedor: '5527999999999',
          nomeRecebedor: 'Padaria',
          cooperadoRecebedorId: 'coop2',
          cooperativaId: 'tenantA',
          valorReais: 50,
          quantidadeTokens: 50,
          nomePagador: 'Luciano',
          transacaoId: 'tx-1',
          confirmadaEm: new Date(),
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('enviarOtpAltoValorPorEmail', () => {
    it('envia email com código OTP destacado (motivo VALOR_ALTO)', async () => {
      const { sut, enviarEmail } = await buildSut();
      const ok = await sut.enviarOtpAltoValorPorEmail({
        emailDestino: 'lucbragatto@gmail.com',
        nomeCooperado: 'Luciano',
        cooperativaId: 'tenantA',
        codigoOtp: '654321',
        valorReais: 250,
        nomeRecebedor: 'Padaria Sol',
        expiraEm: new Date(Date.now() + 600_000),
        motivoStepUp: 'VALOR_ALTO',
      });
      expect(ok).toBe(true);
      const [destino, assunto, html, , cooperativaId] = enviarEmail.mock.calls[0];
      expect(destino).toBe('lucbragatto@gmail.com');
      expect(assunto).toContain('Código');
      expect(assunto).toContain('R$');
      expect(html).toContain('654321');
      expect(html).toContain('Luciano');
      expect(html).toContain('Padaria Sol');
      expect(html).toContain('acima do limite');
      expect(cooperativaId).toBe('tenantA');
    });

    it('inclui motivo customizado em PRIMEIRO_USO', async () => {
      const { sut, enviarEmail } = await buildSut();
      await sut.enviarOtpAltoValorPorEmail({
        emailDestino: 'a@b.com',
        nomeCooperado: 'Luciano',
        cooperativaId: 'tenantA',
        codigoOtp: '111111',
        valorReais: 30,
        nomeRecebedor: 'X',
        expiraEm: new Date(),
        motivoStepUp: 'PRIMEIRO_USO',
      });
      const [, , html] = enviarEmail.mock.calls[0];
      expect(html).toContain('primeira transação');
    });

    it('inclui motivo customizado em DESTINATARIO_NOVO', async () => {
      const { sut, enviarEmail } = await buildSut();
      await sut.enviarOtpAltoValorPorEmail({
        emailDestino: 'a@b.com',
        nomeCooperado: 'Luciano',
        cooperativaId: 'tenantA',
        codigoOtp: '222222',
        valorReais: 30,
        nomeRecebedor: 'X',
        expiraEm: new Date(),
        motivoStepUp: 'DESTINATARIO_NOVO',
      });
      const [, , html] = enviarEmail.mock.calls[0];
      expect(html).toContain('ainda não havia pago');
    });

    it('retorna false quando EmailService retorna false', async () => {
      const { sut } = await buildSut({
        enviarEmail: jest.fn(async () => false),
      });
      const ok = await sut.enviarOtpAltoValorPorEmail({
        emailDestino: 'a@b.com',
        nomeCooperado: 'Luciano',
        cooperativaId: 'tenantA',
        codigoOtp: '333333',
        valorReais: 30,
        nomeRecebedor: 'X',
        expiraEm: new Date(),
        motivoStepUp: 'VALOR_ALTO',
      });
      expect(ok).toBe(false);
    });

    it('retorna false e NÃO lança quando EmailService throw', async () => {
      const { sut } = await buildSut({
        enviarEmail: jest.fn(async () => {
          throw new Error('SMTP down');
        }),
      });
      const ok = await sut.enviarOtpAltoValorPorEmail({
        emailDestino: 'a@b.com',
        nomeCooperado: 'Luciano',
        cooperativaId: 'tenantA',
        codigoOtp: '444444',
        valorReais: 30,
        nomeRecebedor: 'X',
        expiraEm: new Date(),
        motivoStepUp: 'VALOR_ALTO',
      });
      expect(ok).toBe(false);
    });
  });
});
