import { BadRequestException } from '@nestjs/common';
import { BanestesController } from './banestes.controller';
import { BanestesAdapter } from './banestes.adapter';
import { PerfilUsuario } from '../../auth/perfil.enum';

describe('BanestesController (F3 multi-tenant)', () => {
  let controller: BanestesController;
  let adapter: jest.Mocked<BanestesAdapter>;

  const adminReq = (cooperativaId = 'coop-A') => ({
    user: { userId: 'u-admin', perfil: PerfilUsuario.ADMIN, cooperativaId },
  });

  const superAdminReq = () => ({
    user: { userId: 'u-super', perfil: PerfilUsuario.SUPER_ADMIN },
  });

  beforeEach(() => {
    adapter = {
      testarConexao: jest.fn(),
    } as any;
    controller = new BanestesController(adapter);
  });

  describe('POST /gateway-pagamento/banestes/testar-conexao', () => {
    it('ADMIN: delega pro adapter passando cooperativaId do JWT', async () => {
      (adapter.testarConexao as jest.Mock).mockResolvedValueOnce({ ok: true, totalCustomers: 5 });

      const r = await controller.testarConexao(adminReq('coop-A') as any);

      expect(adapter.testarConexao).toHaveBeenCalledWith('coop-A');
      expect(r).toEqual({ ok: true, totalCustomers: 5 });
    });

    it('ADMIN: rejeita query cooperativaId divergente do JWT', async () => {
      await expect(
        controller.testarConexao(adminReq('coop-A') as any, 'coop-B'),
      ).rejects.toThrow(BadRequestException);
      expect(adapter.testarConexao).not.toHaveBeenCalled();
    });

    it('ADMIN: aceita query cooperativaId IGUAL ao JWT (idempotente)', async () => {
      (adapter.testarConexao as jest.Mock).mockResolvedValueOnce({ ok: true });

      await controller.testarConexao(adminReq('coop-A') as any, 'coop-A');

      expect(adapter.testarConexao).toHaveBeenCalledWith('coop-A');
    });

    it('SUPER_ADMIN: usa cooperativaId da query', async () => {
      (adapter.testarConexao as jest.Mock).mockResolvedValueOnce({ ok: true });

      await controller.testarConexao(superAdminReq() as any, 'coop-target');

      expect(adapter.testarConexao).toHaveBeenCalledWith('coop-target');
    });

    it('SUPER_ADMIN sem query nem JWT.cooperativaId: throw BadRequestException', async () => {
      await expect(
        controller.testarConexao(superAdminReq() as any),
      ).rejects.toThrow(BadRequestException);
      expect(adapter.testarConexao).not.toHaveBeenCalled();
    });

    it('ADMIN sem cooperativaId no JWT: throw BadRequestException', async () => {
      const reqSemCoop = { user: { perfil: PerfilUsuario.ADMIN, userId: 'u-1' } };
      await expect(
        controller.testarConexao(reqSemCoop as any),
      ).rejects.toThrow(BadRequestException);
      expect(adapter.testarConexao).not.toHaveBeenCalled();
    });

    it('Erro do adapter propaga (controle de erro fica no adapter)', async () => {
      (adapter.testarConexao as jest.Mock).mockResolvedValueOnce({
        ok: false,
        erro: 'CREDENCIAIS_INVALIDAS: ConfigGateway BANESTES sem .pfx',
      });

      const r = await controller.testarConexao(adminReq('coop-A') as any);

      expect(r.ok).toBe(false);
      expect(r.erro).toMatch(/CREDENCIAIS_INVALIDAS/);
    });
  });
});
