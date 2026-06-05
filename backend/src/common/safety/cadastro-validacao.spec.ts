/**
 * Convergência convite custeio Fatia 1 (04/06/2026) — Specs do validador
 * unificado de cadastro. Cobre os 2 modos:
 *  - STRICT (isAmbienteReal()=true): todos os campos obrigatórios validados.
 *  - RELAXED (DEV/teste): aceita vazios, aplica placeholders previsíveis.
 *
 * Foco em fechar D-novo-CAD-UC-FALSA + D-novo-CAD-CONSUMO-ZERO.
 */
import { BadRequestException } from '@nestjs/common';
import { validarENormalizarCadastro } from './cadastro-validacao';

describe('validarENormalizarCadastro — Fatia 1', () => {
  // Helper pra alternar AMBIENTE_REAL preservando o original.
  const originalEnv = process.env.AMBIENTE_REAL;
  afterAll(() => {
    if (originalEnv === undefined) delete process.env.AMBIENTE_REAL;
    else process.env.AMBIENTE_REAL = originalEnv;
  });

  describe('STRICT (isAmbienteReal=true)', () => {
    beforeEach(() => {
      process.env.AMBIENTE_REAL = 'true';
    });

    it('happy path COM_UC: payload completo válido → normaliza tudo', () => {
      const r = validarENormalizarCadastro({
        nome: '  Dra. Marina  ',
        cpf: '123.456.789-09',
        email: 'marina@clinica.com',
        telefone: '(27) 98134-1348',
        instalacao: { numeroUC: '0400702214', consumoMedioKwh: 350 },
      });
      expect(r).toMatchObject({
        nome: 'Dra. Marina',
        cpfLimpo: '12345678909',
        email: 'marina@clinica.com',
        telefoneLimpo: '27981341348',
        numeroUC: '0400702214',
        consumoMedioKwh: 350,
        strict: true,
      });
    });

    it('nome vazio → BadRequest', () => {
      expect(() =>
        validarENormalizarCadastro({
          cpf: '12345678909',
          email: 'a@b.com',
          telefone: '27981341348',
          instalacao: { numeroUC: '0400702214', consumoMedioKwh: 300 },
        }),
      ).toThrow(BadRequestException);
    });

    it('cpf inválido (10 dígitos) → BadRequest', () => {
      expect(() =>
        validarENormalizarCadastro({
          nome: 'Ok',
          cpf: '1234567890',
          email: 'a@b.com',
          telefone: '27981341348',
          instalacao: { numeroUC: '0400702214', consumoMedioKwh: 300 },
        }),
      ).toThrow(BadRequestException);
    });

    it('email vazio → BadRequest (não auto-placeholder em strict)', () => {
      expect(() =>
        validarENormalizarCadastro({
          nome: 'Marina',
          cpf: '12345678909',
          telefone: '27981341348',
          instalacao: { numeroUC: '0400702214', consumoMedioKwh: 300 },
        }),
      ).toThrow(BadRequestException);
    });

    it('email formato inválido → BadRequest', () => {
      expect(() =>
        validarENormalizarCadastro({
          nome: 'Marina',
          cpf: '12345678909',
          email: 'naotemarroba',
          telefone: '27981341348',
          instalacao: { numeroUC: '0400702214', consumoMedioKwh: 300 },
        }),
      ).toThrow(BadRequestException);
    });

    it('telefone curto (9 dígitos) → BadRequest', () => {
      expect(() =>
        validarENormalizarCadastro({
          nome: 'Marina',
          cpf: '12345678909',
          email: 'a@b.com',
          telefone: '987654321',
          instalacao: { numeroUC: '0400702214', consumoMedioKwh: 300 },
        }),
      ).toThrow(BadRequestException);
    });

    it('numeroUC vazio + permiteSemUc=false → BadRequest (fecha D-novo-CAD-UC-FALSA)', () => {
      expect(() =>
        validarENormalizarCadastro({
          nome: 'Marina',
          cpf: '12345678909',
          email: 'a@b.com',
          telefone: '27981341348',
          instalacao: { numeroUC: '', consumoMedioKwh: 300 },
        }),
      ).toThrow(BadRequestException);
    });

    it('numeroUC vazio + permiteSemUc=true → retorna null (caller cria SINTETICA)', () => {
      const r = validarENormalizarCadastro(
        {
          nome: 'Marina',
          cpf: '12345678909',
          email: 'a@b.com',
          telefone: '27981341348',
          instalacao: { numeroUC: '', consumoMedioKwh: 300 },
        },
        { permiteSemUc: true },
      );
      expect(r.numeroUC).toBeNull();
    });

    it('numeroUC formato curto (3 dígitos) → BadRequest', () => {
      expect(() =>
        validarENormalizarCadastro({
          nome: 'Marina',
          cpf: '12345678909',
          email: 'a@b.com',
          telefone: '27981341348',
          instalacao: { numeroUC: '123', consumoMedioKwh: 300 },
        }),
      ).toThrow(BadRequestException);
    });

    // D-novo-OCR-UC-CANON (05/06/2026) — formato EDP-ES atual 15 díg.
    it('numeroUC formato EDP-ES atual 15 díg (com pontuação) → aceita e normaliza pro canônico interno (slice 3,13)', () => {
      // Caso real Luciano: fatura Clínica `0.000.374.127.054-59`
      // → 15 díg `000037412705459` → slice(3, 13) = `0374127054` (10 díg).
      const r = validarENormalizarCadastro({
        nome: 'Marina',
        cpf: '12345678909',
        email: 'a@b.com',
        telefone: '27981341348',
        instalacao: { numeroUC: '0.000.374.127.054-59', consumoMedioKwh: 300 },
      });
      expect(r.numeroUC).toBe('0374127054');
    });

    it('numeroUC 15 díg sem pontuação (formato EDP-ES) → normaliza igual', () => {
      const r = validarENormalizarCadastro({
        nome: 'Marina',
        cpf: '12345678909',
        email: 'a@b.com',
        telefone: '27981341348',
        instalacao: { numeroUC: '000037412705459', consumoMedioKwh: 300 },
      });
      expect(r.numeroUC).toBe('0374127054');
    });

    it('numeroUC 15 díg outro caso EDP-ES (banco real) → bate com canônico do banco', () => {
      // Caso amostra banco: `0.001.334.421.054-40` → canônico esperado `1334421054`.
      const r = validarENormalizarCadastro({
        nome: 'Marina',
        cpf: '12345678909',
        email: 'a@b.com',
        telefone: '27981341348',
        instalacao: { numeroUC: '0.001.334.421.054-40', consumoMedioKwh: 300 },
      });
      expect(r.numeroUC).toBe('1334421054');
    });

    it('numeroUC formato canônico 10 díg (admin/legado) → continua passando intacto', () => {
      const r = validarENormalizarCadastro({
        nome: 'Marina',
        cpf: '12345678909',
        email: 'a@b.com',
        telefone: '27981341348',
        instalacao: { numeroUC: '0400702214', consumoMedioKwh: 300 },
      });
      expect(r.numeroUC).toBe('0400702214');
    });

    it('numeroUC 12-14 díg (sem padrão conhecido) → BadRequest com mensagem clara', () => {
      expect(() =>
        validarENormalizarCadastro({
          nome: 'Marina',
          cpf: '12345678909',
          email: 'a@b.com',
          telefone: '27981341348',
          instalacao: { numeroUC: '123456789012', consumoMedioKwh: 300 }, // 12 díg = limbo
        }),
      ).toThrow(/6-11 dígitos.*15 dígitos/);
    });

    it('numeroUC > 15 díg → BadRequest', () => {
      expect(() =>
        validarENormalizarCadastro({
          nome: 'Marina',
          cpf: '12345678909',
          email: 'a@b.com',
          telefone: '27981341348',
          instalacao: { numeroUC: '12345678901234567', consumoMedioKwh: 300 }, // 17 díg
        }),
      ).toThrow(BadRequestException);
    });

    it('INVARIANTE SCEE: validador NUNCA produz o "antigo EDP" (numeroUC 9 díg) automaticamente', () => {
      // Validador normaliza `numero` interno SISGD. NÃO derive numeroUC GD/SCEE.
      // Caller (controller/service) é responsável por receber `body.instalacao.numeroUCLegado`
      // se cooperado preencher, e gravar em `Uc.numeroUC` separadamente.
      // Esta spec garante que o output do validador NÃO contém esse campo.
      const r = validarENormalizarCadastro({
        nome: 'Marina',
        cpf: '12345678909',
        email: 'a@b.com',
        telefone: '27981341348',
        instalacao: { numeroUC: '0.000.374.127.054-59', consumoMedioKwh: 300 },
      });
      const keys = Object.keys(r);
      // Output schema NÃO tem numeroUCLegado nem nenhum campo "antigo".
      expect(keys).not.toContain('numeroUCLegado');
      expect(keys).not.toContain('numeroAntigo');
      // numeroUC do output é o ID interno SISGD (10 díg), NÃO o antigo de 9 díg.
      expect(r.numeroUC?.length).toBe(10);
      // E NÃO bate por acaso com o "antigo" esperado pro caso Luciano (160085263).
      expect(r.numeroUC).not.toBe('160085263');
      expect(r.numeroUC).not.toBe('037412705'); // 9 primeiros do canônico — tampouco
    });

    it('consumo < 20 → BadRequest (fecha D-novo-CAD-CONSUMO-ZERO)', () => {
      expect(() =>
        validarENormalizarCadastro({
          nome: 'Marina',
          cpf: '12345678909',
          email: 'a@b.com',
          telefone: '27981341348',
          instalacao: { numeroUC: '0400702214', consumoMedioKwh: 5 },
        }),
      ).toThrow(BadRequestException);
    });

    it('consumo > 50000 → BadRequest', () => {
      expect(() =>
        validarENormalizarCadastro({
          nome: 'Marina',
          cpf: '12345678909',
          email: 'a@b.com',
          telefone: '27981341348',
          instalacao: { numeroUC: '0400702214', consumoMedioKwh: 99999 },
        }),
      ).toThrow(BadRequestException);
    });

    it('consumo NaN/undefined → BadRequest', () => {
      expect(() =>
        validarENormalizarCadastro({
          nome: 'Marina',
          cpf: '12345678909',
          email: 'a@b.com',
          telefone: '27981341348',
          instalacao: { numeroUC: '0400702214' },
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('RELAXED (isAmbienteReal=false, modo teste)', () => {
    beforeEach(() => {
      process.env.AMBIENTE_REAL = 'false';
    });

    it('tudo vazio + permiteSemUc=true → aceita + auto-placeholders', () => {
      const r = validarENormalizarCadastro({}, { permiteSemUc: true });
      expect(r.strict).toBe(false);
      expect(r.numeroUC).toBeNull(); // SINTETICA
      expect(r.consumoMedioKwh).toBe(0); // saneado
      expect(r.email).toMatch(/@teste\.invalid$/); // placeholder
      expect(r.cpfLimpo).toBe('');
      expect(r.telefoneLimpo).toBe('');
    });

    it('numeroUC vazio + permiteSemUc=false em teste → AINDA é erro (não permite UC fake)', () => {
      // Garante que a remoção do UC-fake é estrutural, não envar-gated
      expect(() =>
        validarENormalizarCadastro({
          nome: 'teste',
          cpf: '11111111111',
          email: 'teste@teste.invalid',
          telefone: '27981341348',
          instalacao: { numeroUC: '', consumoMedioKwh: 300 },
        }),
      ).toThrow(BadRequestException);
    });

    it('email vazio + cpf válido → placeholder <cpf>@teste.invalid', () => {
      const r = validarENormalizarCadastro(
        { cpf: '12345678909', instalacao: {} },
        { permiteSemUc: true },
      );
      expect(r.email).toBe('12345678909@teste.invalid');
    });

    it('email com formato inválido em teste → BadRequest (decisão D)', () => {
      // Decisão Luciano D (04/06): mesmo em teste, se email vier preenchido,
      // exige formato mínimo. Vazio aceita; mal-formado não.
      expect(() =>
        validarENormalizarCadastro(
          { email: 'lixo-sem-arroba', instalacao: {} },
          { permiteSemUc: true },
        ),
      ).toThrow(BadRequestException);
    });

    it('cpf parcial (5 dígitos) em teste → BadRequest', () => {
      expect(() =>
        validarENormalizarCadastro(
          { cpf: '12345', instalacao: {} },
          { permiteSemUc: true },
        ),
      ).toThrow(BadRequestException);
    });

    it('consumo NaN saneado pra 0 em teste', () => {
      const r = validarENormalizarCadastro(
        { instalacao: { numeroUC: '0400702214', consumoMedioKwh: NaN as any } },
        {},
      );
      expect(r.consumoMedioKwh).toBe(0);
    });

    it('teste com numeroUC válido + consumo zerado aceita (sem range mínimo)', () => {
      const r = validarENormalizarCadastro({
        instalacao: { numeroUC: '0400702214', consumoMedioKwh: 0 },
      });
      expect(r.consumoMedioKwh).toBe(0);
      expect(r.numeroUC).toBe('0400702214');
    });
  });

  describe('Normalizações específicas', () => {
    beforeEach(() => {
      process.env.AMBIENTE_REAL = 'true';
    });

    it('numeroUC com pontos/hifens → limpa só dígitos + padStart 10', () => {
      const r = validarENormalizarCadastro({
        nome: 'Ok',
        cpf: '12345678909',
        email: 'a@b.com',
        telefone: '27981341348',
        instalacao: { numeroUC: '40.070.221-4', consumoMedioKwh: 300 },
      });
      expect(r.numeroUC).toBe('0400702214'); // pad esquerda + slice -10
    });

    it('cpf formatado → limpa só dígitos', () => {
      const r = validarENormalizarCadastro({
        nome: 'Ok',
        cpf: '111.111.111-11',
        email: 'a@b.com',
        telefone: '27981341348',
        instalacao: { numeroUC: '0400702214', consumoMedioKwh: 300 },
      });
      expect(r.cpfLimpo).toBe('11111111111');
    });

    it('telefone formatado → limpa só dígitos', () => {
      const r = validarENormalizarCadastro({
        nome: 'Ok',
        cpf: '12345678909',
        email: 'a@b.com',
        telefone: '(27) 98134-1348',
        instalacao: { numeroUC: '0400702214', consumoMedioKwh: 300 },
      });
      expect(r.telefoneLimpo).toBe('27981341348');
    });
  });
});
