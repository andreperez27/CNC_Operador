// Helpers puros da página G-Code Rápido (mobile): linha de resumo da aba
// Dados e formatação dos cards de resultado.
//
// FONTE ÚNICA: todos os valores vêm do modelo canônico (solveChamfer /
// solveRadius) — inclusive `incReal`, que o core já calcula como
// `profZ / nPasses` (o mesmo valor que o template usa no Q4). A página
// nunca recalcula geometria aqui.

const ORIGIN_LABEL = {
  external: 'Vértice da região (aresta X0 / topo Z0)',
  internal: 'Canto do bolsão (parede X0 / fundo Z0)',
};

export function originLabel(tipo) {
  return ORIGIN_LABEL[tipo] || ORIGIN_LABEL.external;
}

// Número formatado pt-BR; valor ausente/inválido vira traço (nunca "NaN").
export function formatResultNumber(value, digits = 3) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Number(n.toFixed(digits)).toLocaleString('pt-BR');
}

// Linha de resumo fixa da aba Dados: passes, profundidade total e contato.
// Vale para chanfro e raio (contato sempre no formato {x, z}).
export function summarizeModel(model) {
  if (!model) return { passes: '—', profZ: '—', contato: '—' };
  const cp = model.contact?.contactPoint;
  return {
    passes: model.nPasses ?? '—',
    profZ: formatResultNumber(model.profZ),
    contato:
      cp && Number.isFinite(cp.x) && Number.isFinite(cp.z)
        ? `(${formatResultNumber(cp.x)}, ${formatResultNumber(cp.z)})`
        : '—',
  };
}
