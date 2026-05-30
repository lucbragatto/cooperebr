import { MotorPropostaController } from './motor-proposta.controller';

/**
 * D-novo-BQ.3 A8 (30/05/2026) — uploadModelo controller bloqueia body-injection
 * de cooperativaId (padrão idêntico a C5/C6). ADMIN sempre JWT; SUPER_ADMIN body.
 */
describe('MotorPropostaController.uploadModelo — BQ.3 A8 body-injection', () => {
  const uploadModelo = jest.fn();
  const serviceMock = { uploadModelo } as any;

  let controller: MotorPropostaController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MotorPropostaController(serviceMock, {} as any, {} as any, {} as any);
    uploadModelo.mockResolvedValue({ id: 'mod1', variaveis: [], preview: '' });
  });

  const arquivo: any = { buffer: Buffer.from('{{NOME}}'), originalname: 'm.txt' };

  it('ADMIN tenta body.cooperativaId=B → service recebe coop-A (JWT)', async () => {
    const req = { user: { perfil: 'ADMIN', cooperativaId: 'coop-A' } };
    await controller.uploadModelo(arquivo, 'CONTRATO', 'Nome', 'coop-B', req as any);
    expect(uploadModelo).toHaveBeenCalledWith(arquivo, 'CONTRATO', 'Nome', 'coop-A');
  });

  it('SUPER_ADMIN com body.cooperativaId=B → service recebe B (bypass)', async () => {
    const req = { user: { perfil: 'SUPER_ADMIN', cooperativaId: 'coop-SA' } };
    await controller.uploadModelo(arquivo, 'CONTRATO', 'Nome', 'coop-B', req as any);
    expect(uploadModelo).toHaveBeenCalledWith(arquivo, 'CONTRATO', 'Nome', 'coop-B');
  });

  it('SUPER_ADMIN sem body.cooperativaId → fallback JWT do próprio SA', async () => {
    const req = { user: { perfil: 'SUPER_ADMIN', cooperativaId: 'coop-SA' } };
    await controller.uploadModelo(arquivo, 'CONTRATO', 'Nome', undefined, req as any);
    expect(uploadModelo).toHaveBeenCalledWith(arquivo, 'CONTRATO', 'Nome', 'coop-SA');
  });
});
