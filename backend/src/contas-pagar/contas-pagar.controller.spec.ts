/**
 * Specs D-novo-BH BH.3.1 (M37, 29/05/2026) — endpoint upload-comprovante.
 *
 * Multer interceptor é testado em isolação via chamada direta ao handler
 * com mock do file. Validação de tipo/tamanho fica delegada ao Multer
 * filter — testamos só o método handler.
 */
import { BadRequestException } from '@nestjs/common';
import { ContasPagarController } from './contas-pagar.controller';

describe('ContasPagarController — upload-comprovante (BH.3.1)', () => {
  let controller: ContasPagarController;

  beforeEach(() => {
    controller = new ContasPagarController({} as any);
  });

  it('upload válido retorna URL + tamanho + mimetype', () => {
    const file: any = {
      filename: '1717000000000-abc12345-foto.jpg',
      size: 102400,
      mimetype: 'image/jpeg',
      originalname: 'foto.jpg',
    };
    const req: any = { user: { cooperativaId: 'coop-x' } };

    const r = controller.uploadComprovante(file, req);

    expect(r.url).toMatch(/\/uploads\/comprovantes\/coop-x\/\d{4}\/\d{2}\/1717000000000-abc12345-foto\.jpg$/);
    expect(r.tamanho).toBe(102400);
    expect(r.mimetype).toBe('image/jpeg');
    expect(r.nomeOriginal).toBe('foto.jpg');
  });

  it('upload sem arquivo lança BadRequestException', () => {
    const req: any = { user: { cooperativaId: 'coop-x' } };
    expect(() => controller.uploadComprovante(undefined as any, req)).toThrow(BadRequestException);
  });

  it('upload sem cooperativaId no req.user usa fallback "sem-coop"', () => {
    const file: any = {
      filename: 'x.pdf', size: 100, mimetype: 'application/pdf', originalname: 'x.pdf',
    };
    const req: any = { user: {} };

    const r = controller.uploadComprovante(file, req);
    expect(r.url).toContain('/uploads/comprovantes/sem-coop/');
  });
});
