'use client';

interface Counts {
  homologado: number;
  pendente: number;
  rejeitado: number;
  total: number;
}

export default function ContadorCooperados({ counts }: { counts: Counts }) {
  const { homologado, pendente, rejeitado, total } = counts;
  if (total === 0) return <span className="text-xs text-gray-400">—</span>;

  const allHomologados = homologado === total;
  const noneHomologados = homologado === 0;
  const someRejeitados = rejeitado > 0;
  const color = allHomologados
    ? 'text-green-700'
    : someRejeitados
      ? 'text-red-700'
      : noneHomologados
        ? 'text-amber-700'
        : 'text-yellow-700';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`font-semibold ${color}`}>
        {homologado}/{total} homologados
      </span>
      {pendente > 0 && (
        <span className="text-amber-600">· {pendente} pendente{pendente > 1 ? 's' : ''}</span>
      )}
      {rejeitado > 0 && (
        <span className="text-red-600">· {rejeitado} rejeitado{rejeitado > 1 ? 's' : ''}</span>
      )}
    </div>
  );
}
