import * as geo from '../geometry';

function extractDeps(formulaFn) {
  const src = formulaFn.toString();
  const matches = new Set();
  const re = /ctx\.Q(\d+)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    matches.add('Q' + m[1]);
  }
  return [...matches];
}

function topologicalSort(depMap) {
  const inDegree = {};
  const adj = {};
  const formulaNodes = new Set(Object.keys(depMap));

  for (const node of formulaNodes) {
    inDegree[node] = 0;
    adj[node] = [];
  }

  for (const [node, deps] of Object.entries(depMap)) {
    for (const dep of deps) {
      if (formulaNodes.has(dep)) {
        if (!adj[dep]) adj[dep] = [];
        adj[dep].push(node);
        inDegree[node] = (inDegree[node] || 0) + 1;
      }
    }
  }

  const queue = Object.keys(inDegree).filter((n) => inDegree[n] === 0);
  const order = [];

  while (queue.length) {
    const node = queue.shift();
    order.push(node);
    for (const neighbor of adj[node] || []) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    }
  }

  if (order.length !== Object.keys(depMap).length) {
    const allNodes = Object.keys(depMap);
    const resolved = new Set(order);
    const cycle = allNodes.filter((n) => !resolved.has(n));
    throw new Error(
      'Dependencia circular detectada entre: ' + cycle.join(', ')
    );
  }

  return order;
}

function resolveFormulas(formulas, ctx) {
  const depMap = {};
  for (const [q, entry] of Object.entries(formulas)) {
    depMap[q] = extractDeps(entry.formula);
  }

  for (const [q, deps] of Object.entries(depMap)) {
    for (const dep of deps) {
      if (!(dep in ctx) && !(dep in formulas)) {
        throw new Error(
          q + ' depende de ' + dep + ' que nao esta definido no mapa de parametros'
        );
      }
    }
  }

  const order = topologicalSort(depMap);

  for (const qNum of order) {
    const entry = formulas[qNum];
    const raw = entry.formula(ctx, geo);
    ctx[qNum] = typeof raw === 'number' ? Number(raw.toFixed(entry.decimals)) : raw;
  }

  return ctx;
}

export function toQParams(model, paramMap) {
  const ctx = {};
  const formulas = {};

  for (const [qNum, def] of Object.entries(paramMap)) {
    if (def.formula) {
      formulas[qNum] = def;
      continue;
    }
    const raw = model.params?.[def.key] ?? model[def.key];
    if (raw === undefined || raw === null) continue;
    ctx[qNum] = typeof raw === 'number' ? Number(raw.toFixed(def.decimals)) : raw;
  }

  if (Object.keys(formulas).length > 0) {
    resolveFormulas(formulas, ctx);
  }

  const qObj = {};
  const qList = [];

  for (const [qNum, def] of Object.entries(paramMap)) {
    if (ctx[qNum] === undefined || ctx[qNum] === null) continue;
    const value = ctx[qNum];
    qObj[qNum] = { q: qNum, value, label: def.label };
    qList.push(qObj[qNum]);
  }

  return { list: qList, obj: qObj };
}

export function toQText(qParams) {
  return qParams.list
    .map(({ q, value }) => 'Q' + q + '=' + value)
    .join('\n');
}

export function toQTable(qParams) {
  return qParams.list.map(({ q, label, value }) => ({ q, label, value }));
}
