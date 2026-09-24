import { describe, it, expect } from 'vitest';
import { applyRingCalibration } from '../src/core/machining/huronHead';

describe('applyRingCalibration — compensação do anel de graduação', () => {
  it('desvio zero com valores positivos — idêntico ao bruto', () => {
    expect(
      applyRingCalibration({ bFlange: 20, cFlange: 30 }, { bRingOffset: 0, cRingOffset: 0 })
    ).toEqual({ bFlangeRing: 20, cFlangeRing: 30 });
  });

  it('sem objeto de calibração — defaults zero, idêntico ao bruto', () => {
    expect(applyRingCalibration({ bFlange: 20, cFlange: 30 }))
      .toEqual({ bFlangeRing: 20, cFlangeRing: 30 });
  });

  it('desvio positivo soma nos dois anéis', () => {
    const out = applyRingCalibration(
      { bFlange: 28.4317, cFlange: 170 },
      { bRingOffset: 1.5, cRingOffset: 15 }
    );
    expect(out.bFlangeRing).toBeCloseTo(29.9317, 9);
    expect(out.cFlangeRing).toBeCloseTo(185, 9);
  });

  it('desvio negativo subtrai e normaliza pra 0–360°', () => {
    const out = applyRingCalibration(
      { bFlange: 10, cFlange: 20 },
      { bRingOffset: -2.5, cRingOffset: -30 }
    );
    expect(out.bFlangeRing).toBeCloseTo(7.5, 9);
    expect(out.cFlangeRing).toBeCloseTo(350, 9); // 20 − 30 = −10 → 350
  });

  it('wrap-around cruzando 0°/360° nos dois sentidos', () => {
    const down = applyRingCalibration(
      { bFlange: 0.5, cFlange: 5 },
      { bRingOffset: -1, cRingOffset: -10 }
    );
    expect(down.bFlangeRing).toBeCloseTo(359.5, 9);
    expect(down.cFlangeRing).toBeCloseTo(355, 9);

    const up = applyRingCalibration(
      { bFlange: 359.5, cFlange: 358 },
      { bRingOffset: 1, cRingOffset: 5 }
    );
    expect(up.bFlangeRing).toBeCloseTo(0.5, 9);
    expect(up.cFlangeRing).toBeCloseTo(3, 9);
  });
});
