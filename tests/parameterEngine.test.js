import { describe, it, expect } from 'vitest';
import { toQParams, toQText, toQTable } from '../src/core/params/parameterEngine';
import {
  toQParams as toQParamsPublic,
  DEFAULT_MAP,
  EXTERNAL_CHAMFER_MAP,
  EXTERNAL_RADIUS_MAP,
} from '../src/features/heidenhain/params/parameterEngine';
import { solveChamfer } from '../src/core/machining/chamfer/index';

/**
 * parameterEngine — deps Q declarados (contrato), regex só como auditor.
 *
 * O runtime NUNCA lê `formula.toString()`: a ordem/grafo/ciclo vem de
 * `deps: [...]`. O regex `ctx.Q\d+` sobrevive SÓ neste arquivo, como
 * guarda contra deriva dos mapas (todo Q referenciado coberto por deps,
 * nenhum dep órfão).
 */

const REAL_MAPS = { DEFAULT_MAP, EXTERNAL_CHAMFER_MAP, EXTERNAL_RADIUS_MAP };

describe('guarda contra deriva — mapas reais', () => {
  it('toda formula declara deps cobrindo os ctx.Q referenciados, sem dep orfao', () => {
    for (const [name, map] of Object.entries(REAL_MAPS)) {
      for (const [q, def] of Object.entries(map)) {
        if (typeof def.formula !== 'function') continue;
        expect(Array.isArray(def.deps), `${name}.${q} sem deps`).toBe(true);
        const refs = [...def.formula.toString().matchAll(/ctx\.Q(\d+)/g)]
          .map((m) => 'Q' + m[1]);
        for (const ref of refs) {
          expect(def.deps, `${name}.${q} nao cobre ${ref}`).toContain(ref);
        }
        for (const dep of def.deps) {
          expect(dep, `${name}.${q} dep fora do padrao`).toMatch(/^Q\d+$/);
          expect(map, `${name}.${q} dep orfao ${dep}`).toHaveProperty(dep);
        }
      }
    }
  });
});

describe('motor — caminho de formulas com deps declarados', () => {
  const CHAIN = {
    // Q21 declarado ANTES de Q20 de propósito: a ordem vem do grafo.
    Q21: {
      formula: (ctx) => ctx.Q20 + ctx.Q10, deps: ['Q20', 'Q10'],
      label: 'soma', decimals: 3,
    },
    Q20: {
      formula: (ctx) => ctx.Q10 * 2, deps: ['Q10'],
      label: 'dobro', decimals: 3,
    },
    Q10: { key: 'x', label: 'X', decimals: 3 },
  };

  it('avalia em ordem topologica independente da ordem de declaracao', () => {
    const r = toQParams({ params: { x: 5 } }, CHAIN);
    expect(r.obj.Q10.value).toBe(5);
    expect(r.obj.Q20.value).toBe(10);
    expect(r.obj.Q21.value).toBe(15);
  });

  it('desestruturacao funciona (deps mandam, fonte nao e lida)', () => {
    const map = {
      Q10: { key: 'x', label: 'X', decimals: 3 },
      // eslint-disable-next-line no-unused-vars
      Q20: { formula: (ctx) => { const { Q10 } = ctx; return Q10 + 1; }, deps: ['Q10'], label: 'mais um', decimals: 3 },
    };
    expect(toQParams({ params: { x: 5 } }, map).obj.Q20.value).toBe(6);
  });

  it('Q em comentario nao vira dependencia fantasma', () => {
    const map = {
      Q10: { key: 'x', label: 'X', decimals: 3 },
      Q40: {
        // ctx.Q99 nao existe — o regex antigo lancaria "nao definido".
        formula: (ctx) => ctx.Q10 + 1, deps: ['Q10'],
        label: 'mais um', decimals: 3,
      },
    };
    expect(toQParams({ params: { x: 5 } }, map).obj.Q40.value).toBe(6);
  });

  it('circular lanca em pt-BR', () => {
    const map = {
      Q30: { formula: (ctx) => ctx.Q31, deps: ['Q31'], label: 'a', decimals: 0 },
      Q31: { formula: (ctx) => ctx.Q30, deps: ['Q30'], label: 'b', decimals: 0 },
    };
    expect(() => toQParams({ params: {} }, map))
      .toThrowError(/Dependencia circular detectada entre: /);
  });

  it('dep nao definido lanca em pt-BR', () => {
    const map = {
      Q30: { formula: (ctx) => ctx.Q99, deps: ['Q99'], label: 'a', decimals: 0 },
    };
    expect(() => toQParams({ params: {} }, map))
      .toThrowError(/Q30 depende de Q99 que nao esta definido no mapa de parametros/);
  });

  it('formula sem deps lanca falha fechada em pt-BR', () => {
    const map = {
      Q30: { formula: () => 1, label: 'a', decimals: 0 },
    };
    expect(() => toQParams({ params: {} }, map))
      .toThrowError(/Q30 define formula sem deps declarados/);
  });

  it('toQText/toQTable preservados (formato atual, byte-identico)', () => {
    const r = toQParams({ params: { x: 5 } }, CHAIN);
    // `q` já carrega o prefixo ('Q21') e toQText prefixa de novo — wart
    // histórico preservado aqui como trava de comportamento, não corrigido.
    expect(toQText(r)).toBe('QQ21=15\nQQ20=10\nQQ10=5');
    expect(toQTable(r)).toEqual([
      { q: 'Q21', label: 'soma', value: 15 },
      { q: 'Q20', label: 'dobro', value: 10 },
      { q: 'Q10', label: 'X', value: 5 },
    ]);
  });
});

describe('regressao — caminho vivo (mapas so com key)', () => {
  it('EXTERNAL_CHAMFER_MAP via API publica: Q1 = angulo', () => {
    const solved = solveChamfer({
      type: 'external',
      width: 5, angle: 45,
      tool: { type: 'toroidal', diameter: 16, radius: 0.8 },
      strategy: { passDepth: 0.3 },
      length: 100, feed: 600, rpm: 3000,
    });
    expect(solved.valid).toBe(true);
    const q = toQParamsPublic(solved.model, EXTERNAL_CHAMFER_MAP);
    expect(q.obj.Q1.value).toBe(45);
    expect(q.obj.Q2.value).toBe(5);
  });
});
