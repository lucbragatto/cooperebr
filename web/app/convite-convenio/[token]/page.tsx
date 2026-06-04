'use client';

/**
 * Sprint Convite-Convênio Fatia 4 (03/06/2026) → Convergência Fatia 2
 * (04/06/2026): slim DEPRECATED.
 *
 * Esta página foi a interface única do convite (5 etapas single-page)
 * antes da convergência. A partir da Fatia 2 da convergência:
 *  - O wizard completo /cadastro suporta ?conv=<token> nativo
 *    (OTP gate + uploads opcionais + LGPD + cooperado COM_UC ou SEM_UC).
 *  - Esta rota agora REDIRECIONA pra /cadastro?conv=<token>, mantendo
 *    compatibilidade dos links já enviados via WhatsApp.
 *
 * Deprecation: 1 sprint. Após confirmação de que nenhum link velho está
 * mais sendo aberto, removeremos esta rota (D-novo-CONVITE-ROTA-CONSOLIDAR
 * será fechado junto).
 */

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ConviteConvenioRedirect() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  useEffect(() => {
    if (!token) return;
    // Mantém eventuais query params adicionais (ex: ?tenant=).
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const sep = search ? `${search}&` : '?';
    router.replace(`/cadastro${sep}conv=${encodeURIComponent(token)}`);
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-orange-600 mx-auto" />
        <p className="text-sm text-slate-700">
          Redirecionando para o novo cadastro unificado...
        </p>
        <p className="text-xs text-slate-500">
          (Se não redirecionar, vá para <a className="underline" href={`/cadastro?conv=${token}`}>/cadastro?conv=...</a>)
        </p>
      </div>
    </div>
  );
}
