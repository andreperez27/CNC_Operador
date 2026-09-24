import { useState, useMemo, useCallback, useEffect } from 'react';
import Card from '../../components/Card';
import ResultBox from '../../components/ResultBox';
import CopyButton from '../../components/CopyButton';
import HuronForm from './HuronForm';
import HuronPreview from './HuronPreview';
import { calculateHuronFlanges, applyRingCalibration } from '../../core/machining/huronHead';
import { getCalibracaoAnel, setCalibracaoAnel } from './ringCalibrationStore';
import styles from './HuronPage.module.css';

const FIELD_IDS = ['A', 'B', 'C'];
const MACHINE_ID = 'feller-huron45';

function parseAngle(raw) {
  if (raw === '' || raw === null || raw === undefined) return null;
  // Teclado mobile pt-BR pode entregar vírgula como separador decimal.
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const RING_OPTIONS = [0, 90, 180, 270];

const formatSigned = (v) => (v > 0 ? '+' : '') + String(v);

export default function HuronPage() {
  const [values, setValues] = useState({ A: 0, B: 0, C: 0 });
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [ring, setRing] = useState(() => {
    // Valores fora das 4 posições voltam pra 0 (o anel só trava a cada 90°).
    const saved = getCalibracaoAnel(MACHINE_ID);
    const snap = (v) => (RING_OPTIONS.includes(v) ? v : 0);
    return { b: snap(saved.bRingOffset), c: snap(saved.cRingOffset) };
  });
  const ringActive = ring.b !== 0 || ring.c !== 0;

  useEffect(() => {
    setCalibracaoAnel(MACHINE_ID, { bRingOffset: ring.b, cRingOffset: ring.c });
  }, [ring]);

  const errors = useMemo(
    () => FIELD_IDS
      .filter((id) => parseAngle(values[id]) === null)
      .map((id) => ({ field: id, message: 'Informe um número válido em graus.' })),
    [values]
  );
  const validOverall = errors.length === 0;
  const shownErrors = submitted ? errors : [];

  const handleField = useCallback((id, raw) => {
    setValues((prev) => ({ ...prev, [id]: raw }));
  }, []);

  const handleCalculate = useCallback(() => {
    setSubmitted(true);
    const nums = {};
    for (const id of FIELD_IDS) {
      const n = parseAngle(values[id]);
      if (n === null) {
        setResult(null);
        return;
      }
      nums[id] = n;
    }
    const raw = calculateHuronFlanges(nums);
    // Sempre compensa: o anel físico só lê 0–360°, então um teórico negativo
    // vira seu equivalente (ex.: −45° → 315°) mesmo com desvio zero.
    const dial = applyRingCalibration(raw, { bRingOffset: ring.b, cRingOffset: ring.c });
    setResult({ input: nums, raw, bFlange: dial.bFlangeRing, cFlange: dial.cFlangeRing });
  }, [values, ring]);

  const handleClear = useCallback(() => {
    setValues({ A: 0, B: 0, C: 0 });
    setSubmitted(false);
    setResult(null);
  }, []);

  const handleRing = useCallback((id, value) => {
    setRing((prev) => ({ ...prev, [id]: value }));
  }, []);

  // Sem inclinação real, a direção da flange superior não é definida
  // (vale para o valor teórico; o aviso independe da calibração do anel).
  const isFlat = result !== null && result.raw.bFlange === 0;

  const copyText = useCallback(() => {
    if (!result) return '';
    const { A, B, C } = result.input;
    const lines = [
      `CABECOTE HURON 45 - 3D ROT A=${A} B=${B} C=${C} (graus)`,
      `Flange inferior (45°): ${result.bFlange.toFixed(4)}°`,
      isFlat
        ? 'Flange superior: indefinida (sem inclinacao)'
        : `Flange superior: ${result.cFlange.toFixed(4)}°`,
    ];
    if (ringActive) {
      lines.push(`Anel: inferior ${formatSigned(ring.b)}°, superior ${formatSigned(ring.c)}°`);
    }
    return lines.join('\n');
  }, [result, isFlat, ringActive, ring]);

  return (
    <div className="page">
      <Card title="Cabeçote Huron 45°">
        <HuronForm
          values={values}
          errors={shownErrors}
          validOverall={validOverall}
          onChange={handleField}
          onCalculate={handleCalculate}
          onClear={handleClear}
        />
        {result && (
          <>
            <ResultBox>
              <div className={styles.results}>
                <div className={styles.resultItem}>
                  <span className={styles.resultLabel}>Flange inferior (45°)</span>
                  <span className={styles.resultValue}>{result.bFlange.toFixed(4)}°</span>
                </div>
                <div className={styles.resultItem}>
                  <span className={styles.resultLabel}>Flange superior</span>
                  <span className={styles.resultValue}>{isFlat ? '—' : `${result.cFlange.toFixed(4)}°`}</span>
                </div>
              </div>
            </ResultBox>
            {ringActive && (
              <div className={styles.theoretical}>
                valor teórico: b={result.raw.bFlange.toFixed(4)}° · c={result.raw.cFlange.toFixed(4)}°
              </div>
            )}
            {isFlat && (
              <div className={styles.warn}>
                Sem inclinação (bFlange = 0°): a orientação da flange superior não é definida.
              </div>
            )}
            <CopyButton getText={copyText} label="COPIAR RESULTADO" />
          </>
        )}
        {result ? (
          <HuronPreview bFlange={result.bFlange} cFlange={result.cFlange} />
        ) : (
          <div className={styles.placeholder}>Informe A, B e C e clique em CALCULAR para visualizar</div>
        )}
        <details className={styles.calib}>
          <summary>Calibração do anel</summary>
          <span className={styles.label}>Desvio anel inferior (°)</span>
          <div className={styles.segRow} role="group" aria-label="Desvio anel inferior">
            {RING_OPTIONS.map((v) => (
              <button
                key={v}
                type="button"
                className={`${styles.segBtn} ${ring.b === v ? styles.segBtnActive : ''}`}
                onClick={() => handleRing('b', v)}
              >
                {v}°
              </button>
            ))}
          </div>
          <span className={styles.label}>Desvio anel superior (°)</span>
          <div className={styles.segRow} role="group" aria-label="Desvio anel superior">
            {RING_OPTIONS.map((v) => (
              <button
                key={v}
                type="button"
                className={`${styles.segBtn} ${ring.c === v ? styles.segBtnActive : ''}`}
                onClick={() => handleRing('c', v)}
              >
                {v}°
              </button>
            ))}
          </div>
          <div className={styles.calibHint}>
            O anel físico só trava a cada 90°. Persiste neste navegador. Com zeros, o resultado é o teórico em 0–360°.
          </div>
        </details>
        <div className={styles.calibActive}>
          Máquina: Portal Feller · Anel calibrado: inferior {ring.b}° · superior {ring.c}°
        </div>
      </Card>
    </div>
  );
}
