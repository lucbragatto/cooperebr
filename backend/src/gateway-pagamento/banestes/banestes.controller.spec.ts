import { BanestesController } from './banestes.controller';
import { BanestesAdapter } from './banestes.adapter';

describe('BanestesController', () => {
  let controller: BanestesController;
  let adapter: jest.Mocked<BanestesAdapter>;

  beforeEach(() => {
    adapter = {
      testarConexao: jest.fn(),
    } as any;
    controller = new BanestesController(adapter);
  });

  describe('POST /gateway-pagamento/banestes/testar-conexao', () => {
    it('Delega pro adapter passando cooperativaId do JWT', async () => {
      (adapter.testarConexao as jest.Mock).mockResolvedValueOnce({ ok: true, totalCustomers: 5 });

      const req = { user: { cooperativaId: 'coop-A', userId: 'u-1' } };
      const r = await controller.testarConexao(req);

      expect(adapter.testarConexao).toHaveBeenCalledWith('coop-A');
      expect(r).toEqual({ ok: true, totalCustomers: 5 });
    });

    it('Sem cooperativaId no JWT: usa "plataforma" (SUPER_ADMIN smoke global)', async () => {
      (adapter.testarConexao as jest.Mock).mockResolvedValueOnce({ ok: true });

      const req = { user: { userId: 'super-admin-1' } };
      await controller.testarConexao(req);

      expect(adapter.testarConexao).toHaveBeenCalledWith('plataforma');
    });

    it('Erro do adapter propaga (controle de erro fica no adapter)', async () => {
      (adapter.testarConexao as jest.Mock).mockResolvedValueOnce({
        ok: false,
        erro: 'CREDENCIAIS_INVALIDAS: senha .pfx invalida',
      });

      const r = await controller.testarConexao({ user: { cooperativaId: 'coop-A' } });
      expect(r.ok).toBe(false);
      expect(r.erro).toMatch(/CREDENCIAIS_INVALIDAS/);
    });
  });
});
