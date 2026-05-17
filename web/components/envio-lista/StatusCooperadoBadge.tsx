'use client';

export type StatusCooperado = 'PENDENTE' | 'HOMOLOGADO' | 'REJEITADO';

const CONFIG: Record<StatusCooperado, { label: string; cls: string }> = {
  PENDENTE: { label: 'Pendente', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  HOMOLOGADO: { label: 'Homologado', cls: 'bg-green-50 text-green-700 border border-green-200' },
  REJEITADO: { label: 'Rejeitado', cls: 'bg-red-50 text-red-700 border border-red-200' },
};

export default function StatusCooperadoBadge({ status }: { status: StatusCooperado }) {
  const cfg = CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full text-[11px] font-medium px-2 py-0.5 whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
