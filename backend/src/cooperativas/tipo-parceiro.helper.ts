export const TIPOS_PARCEIRO = ['COOPERATIVA', 'CONSORCIO', 'ASSOCIACAO', 'CONDOMINIO'] as const;
export type TipoParceiro = (typeof TIPOS_PARCEIRO)[number];

const LABELS: Record<TipoParceiro, { singular: string; plural: string; icone: string }> = {
  COOPERATIVA: { singular: 'Cooperado', plural: 'Cooperados', icone: '🏢' },
  CONSORCIO: { singular: 'Consorciado', plural: 'Consorciados', icone: '🤝' },
  ASSOCIACAO: { singular: 'Associado', plural: 'Associados', icone: '🏛️' },
  CONDOMINIO: { singular: 'Condômino', plural: 'Condôminos', icone: '🏘️' },
};

export function getLabelMembro(tipo?: string | null): { singular: string; plural: string; icone: string } {
  if (tipo && tipo in LABELS) return LABELS[tipo as TipoParceiro];
  return { singular: 'Membro', plural: 'Membros', icone: '👤' };
}

export function getTiposDisponiveis() {
  return TIPOS_PARCEIRO.map((tipo) => ({
    valor: tipo,
    label: tipo.charAt(0) + tipo.slice(1).toLowerCase(),
    ...LABELS[tipo],
  }));
}
