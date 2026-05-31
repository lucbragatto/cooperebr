import { AsPlatform, getTenantContext, runAsPlatform, runWithTenant } from './tenant-context';

/**
 * D-novo-BR F1.3 — Specs do AsyncLocalStorage de tenant context.
 */
describe('tenant-context', () => {
  it('getTenantContext() fora de qualquer run → undefined', () => {
    expect(getTenantContext()).toBeUndefined();
  });

  it('runWithTenant injeta cooperativaId + perfil + isPlatform=false', () => {
    runWithTenant({ cooperativaId: 'coop-A', perfil: 'ADMIN' }, () => {
      const ctx = getTenantContext();
      expect(ctx).toEqual({ cooperativaId: 'coop-A', perfil: 'ADMIN', isPlatform: false });
    });
  });

  it('runAsPlatform marca isPlatform=true', () => {
    runAsPlatform(() => {
      const ctx = getTenantContext();
      expect(ctx?.isPlatform).toBe(true);
    });
  });

  it('contextos aninhados: runAsPlatform dentro de runWithTenant ganha', () => {
    runWithTenant({ cooperativaId: 'coop-A', perfil: 'ADMIN' }, () => {
      runAsPlatform(() => {
        expect(getTenantContext()?.isPlatform).toBe(true);
      });
      // depois do bloco aninhado, volta ao contexto externo
      expect(getTenantContext()?.isPlatform).toBe(false);
    });
  });

  it('contexto é assíncrono — sobrevive setTimeout', async () => {
    await new Promise<void>((resolve) => {
      runWithTenant({ cooperativaId: 'coop-X', perfil: 'COOPERADO' }, () => {
        setTimeout(() => {
          expect(getTenantContext()?.cooperativaId).toBe('coop-X');
          resolve();
        }, 10);
      });
    });
  });

  it('@AsPlatform() decorator envolve método em runAsPlatform', async () => {
    class Cron {
      @AsPlatform()
      async meuJob() {
        return getTenantContext()?.isPlatform;
      }
    }
    const c = new Cron();
    expect(await c.meuJob()).toBe(true);
  });

  it('runs paralelos não compartilham contexto', async () => {
    const captured: string[] = [];
    await Promise.all([
      new Promise<void>((resolve) => {
        runWithTenant({ cooperativaId: 'A', perfil: 'ADMIN' }, () => {
          setTimeout(() => {
            captured.push(getTenantContext()?.cooperativaId ?? '');
            resolve();
          }, 5);
        });
      }),
      new Promise<void>((resolve) => {
        runWithTenant({ cooperativaId: 'B', perfil: 'ADMIN' }, () => {
          setTimeout(() => {
            captured.push(getTenantContext()?.cooperativaId ?? '');
            resolve();
          }, 5);
        });
      }),
    ]);
    expect(captured.sort()).toEqual(['A', 'B']);
  });
});
