'use client';

const NIVEL_CONFIG: Record<string, { emoji: string; label: string; bg: string; text: string }> = {
  BRONZE: { emoji: '🥉', label: 'Bronze', bg: 'bg-amber-700/10', text: 'text-amber-700' },
  PRATA: { emoji: '🥈', label: 'Prata', bg: 'bg-gray-400/10', text: 'text-gray-500' },
  OURO: { emoji: '🥇', label: 'Ouro', bg: 'bg-yellow-500/10', text: 'text-yellow-600' },
  DIAMANTE: { emoji: '💎', label: 'Diamante', bg: 'bg-blue-500/10', text: 'text-blue-600' },
};

interface BadgeNivelClubeProps {
  nivel: string;
  beneficioAtivo?: boolean;
  indicados?: number;
  compact?: boolean;
}

export default function BadgeNivelClube({ nivel, beneficioAtivo, indicados, compact }: BadgeNivelClubeProps) {
  const config = NIVEL_CONFIG[nivel] || NIVEL_CONFIG.BRONZE;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <span>{config.emoji}</span>
        <span>{config.label}</span>
        {beneficioAtivo && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.bg}`}>
      <span className="text-lg">{config.emoji}</span>
      <div className="flex flex-col">
        <span className={`text-sm font-semibold ${config.text}`}>{config.label}</span>
        {indicados !== undefined && (
          <span className="text-xs text-gray-500">{indicados} indicado{indicados !== 1 ? 's' : ''}</span>
        )}
      </div>
      {beneficioAtivo && (
        <span className="w-2 h-2 rounded-full bg-green-500" title="Benefício ativo" />
      )}
    </div>
  );
}
