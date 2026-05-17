'use client';

export type StatusEnvio =
  | 'RASCUNHO'
  | 'VALIDADA'
  | 'PRONTA_PARA_ENVIO'
  | 'ENVIADA'
  | 'PROTOCOLADA'
  | 'HOMOLOGADO_PARCIAL'
  | 'HOMOLOGADO_TOTAL'
  | 'REJEITADA'
  | 'CANCELADA';

const STATUS_CONFIG: Record<StatusEnvio, { label: string; cls: string }> = {
  RASCUNHO: { label: 'Rascunho', cls: 'bg-gray-100 text-gray-700 border border-gray-200' },
  VALIDADA: { label: 'Validada', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  PRONTA_PARA_ENVIO: { label: 'Pronta p/ envio', cls: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  ENVIADA: { label: 'Enviada', cls: 'bg-purple-50 text-purple-700 border border-purple-200' },
  PROTOCOLADA: { label: 'Protocolada', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  HOMOLOGADO_PARCIAL: { label: 'Homologação parcial', cls: 'bg-yellow-50 text-yellow-800 border border-yellow-300' },
  HOMOLOGADO_TOTAL: { label: 'Homologado', cls: 'bg-green-50 text-green-700 border border-green-200' },
  REJEITADA: { label: 'Rejeitada', cls: 'bg-red-50 text-red-700 border border-red-200' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-500 border border-gray-200' },
};

interface Props {
  status: StatusEnvio;
  size?: 'sm' | 'md' | 'lg';
}

export default function StatusEnvioBadge({ status, size = 'sm' }: Props) {
  const cfg = STATUS_CONFIG[status];
  const sizeCls = size === 'lg' ? 'text-sm px-3 py-1' : size === 'md' ? 'text-xs px-2.5 py-0.5' : 'text-[11px] px-2 py-0.5';
  return (
    <span className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${sizeCls} ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
