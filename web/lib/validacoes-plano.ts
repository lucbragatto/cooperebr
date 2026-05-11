/**
 * Validações visuais em tempo real do formulário de Plano (Fase C.2).
 *
 * Não substitui validações do DTO backend (`@IsIn`, `@Min`, `IsPromoMaiorQueBase`),
 * só dá feedback inline ao admin enquanto digita.
 */

export type TipoMensagem = 'erro' | 'aviso' | 'ok';

export interface ResultadoValidacao {
  /** false bloqueia salvar. true permite (mesmo com aviso). */
  ok: boolean;
  tipo: TipoMensagem;
  mensagem?: string;
}

const OK: ResultadoValidacao = { ok: true, tipo: 'ok' };

export function validarPromo(
  temPromocao: boolean,
  descontoBase: number,
  descontoPromocional: number,
  mesesPromocao: number,
): ResultadoValidacao {
  if (!temPromocao) return OK;
  if (!Number.isFinite(descontoPromocional) || descontoPromocional <= 0) {
    return { ok: false, tipo: 'erro', mensagem: 'Desconto promocional precisa ser maior que zero.' };
  }
  if (descontoPromocional <= descontoBase) {
    return {
      ok: false,
      tipo: 'erro',
      mensagem: `Promoção (${descontoPromocional}%) precisa ser maior que desconto base (${descontoBase}%) — caso contrário não há promoção real.`,
    };
  }
  if (!Number.isFinite(mesesPromocao) || mesesPromocao <= 0) {
    return { ok: false, tipo: 'erro', mensagem: 'Duração da promoção deve ser maior que zero meses.' };
  }
  return {
    ok: true,
    tipo: 'ok',
    mensagem: `Promoção válida: ${descontoPromocional}% por ${mesesPromocao} ${mesesPromocao === 1 ? 'mês' : 'meses'}.`,
  };
}

export function validarVigencia(
  tipoCampanha: 'PADRAO' | 'CAMPANHA',
  dataInicioVigencia: string,
  dataFimVigencia: string,
): ResultadoValidacao {
  if (tipoCampanha !== 'CAMPANHA') return OK;
  if (!dataInicioVigencia || !dataFimVigencia) {
    return { ok: false, tipo: 'erro', mensagem: 'Campanha exige data de início e fim.' };
  }
  const ini = new Date(dataInicioVigencia).getTime();
  const fim = new Date(dataFimVigencia).getTime();
  if (Number.isNaN(ini) || Number.isNaN(fim)) {
    return { ok: false, tipo: 'erro', mensagem: 'Datas inválidas.' };
  }
  if (fim <= ini) {
    return { ok: false, tipo: 'erro', mensagem: 'Data de fim precisa ser depois da data de início.' };
  }
  const diasVigencia = Math.round((fim - ini) / (1000 * 60 * 60 * 24));
  if (diasVigencia < 30) {
    return {
      ok: true,
      tipo: 'aviso',
      mensagem: `Vigência curta (${diasVigencia} ${diasVigencia === 1 ? 'dia' : 'dias'}) — confirme se é intencional.`,
    };
  }
  return {
    ok: true,
    tipo: 'ok',
    mensagem: `Vigência de ${diasVigencia} dias.`,
  };
}

/**
 * Defaults sugeridos ao ativar `temPromocao` (Item 1 da Fase C.2).
 * Só sugere se o valor atual está em zero (não sobrescreve escolhas do admin).
 */
export function sugerirDefaultsPromo(
  descontoBase: number,
  descontoPromocionalAtual: number,
  mesesPromocaoAtual: number,
): { descontoPromocional: number; mesesPromocao: number } {
  const descSugerido = descontoPromocionalAtual > 0
    ? descontoPromocionalAtual
    : Math.min(100, Math.round((descontoBase + 5) * 100) / 100);
  const mesesSugerido = mesesPromocaoAtual > 0 ? mesesPromocaoAtual : 3;
  return {
    descontoPromocional: descSugerido,
    mesesPromocao: mesesSugerido,
  };
}
