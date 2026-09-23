import { describe, it, expect } from 'vitest';
import { solveChamfer } from '../src/core/machining/chamfer';
import { buildChamferExternalPreviewModel } from '../src/features/heidenhain/preview/chamferExternalPreviewModel';
import { buildChamferInternalPreviewModel } from '../src/features/heidenhain/preview/chamferInternalPreviewModel';

const BASE = {
  tool: { type: 'toroidal', diameter: 16, radius: 0.8 },
  strategy: { passDepth: 0.3 },
  plane: 'XZ',
  origin: 'vertex',
  length: 100,
  feed: 600,
  rpm: 3000,
  safety: 10,
  toolNumber: 1,
  sobre: 0,
};

function solve(type, extra = {}) {
  return solveChamfer({ type, width: 5, angle: 45, ...extra, ...BASE });
}

function assertNoNaN(obj, path = 'root') {
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object') {
      assertNoNaN(value, `${path}.${key}`);
      continue;
    }
    if (typeof value === 'number') {
      expect(Number.isFinite(value), `${path}.${key} deve ser finito`).toBe(true);
    }
  }
}

describe('contrato modelo canônico → previews Heidenhain (mesma trajetória)', () => {
  it('preview externo consuma o modelo canônico sem NaN e com tangência OK', () => {
    const { valid, model } = solve('external');
    expect(valid).toBe(true);

    const m = buildChamferExternalPreviewModel(model);
    assertNoNaN(m);
    expect(m.validation.valid).toBe(true);
    expect(m.nPasses).toBe(12);
    expect(m.dims.incReal).toBeCloseTo(0.2946278255, 9);
    expect(Number.isFinite(m.contactGeo.toolCenter.x)).toBe(true);
    expect(m.contactGeo.toolCenter.x).toBeGreaterThan(0);
  });

  it('preview interno consuma o modelo canônico sem NaN e com tangência OK', () => {
    const { valid, model } = solve('internal', { clearance: { pocketWidth: 50 } });
    expect(valid).toBe(true);

    const m = buildChamferInternalPreviewModel(model);
    assertNoNaN(m);
    expect(m.validation.valid).toBe(true);
    expect(m.nPasses).toBe(12);
    expect(m.dims.incReal).toBeCloseTo(0.2946278255, 9);
  });

  it('preview externo com ballNose e profundidade override (contrato depth)', () => {
    const { valid, model } = solve('external', {
      depth: 4,
      tool: { type: 'ballNose', diameter: 16 },
    });
    expect(valid).toBe(true);
    expect(model.profZ).toBe(4);

    const m = buildChamferExternalPreviewModel(model);
    assertNoNaN(m);
    expect(m.validation.valid).toBe(true);
    expect(m.dims.profZ).toBe(4);
  });

  it('modelo inválido nunca chega ao preview (model=null)', () => {
    const badInputs = [
      { ...BASE, type: 'external', width: 5, angle: 0 },
      { ...BASE, type: 'external', width: 5, angle: 90 },
      { ...BASE, type: 'external', width: 0, angle: 45 },
      { ...BASE, type: 'external', width: 5, angle: 45, strategy: { passDepth: 0 } },
      { ...BASE, type: 'internal', width: 5, angle: 45, clearance: { pocketWidth: 5 } },
    ];
    for (const input of badInputs) {
      const r = solveChamfer(input);
      expect(r.valid, JSON.stringify(input.validation?.errors)).toBe(false);
      expect(r.model).toBeNull();
      expect(r.validation.errors.length).toBeGreaterThan(0);
    }
  });
});