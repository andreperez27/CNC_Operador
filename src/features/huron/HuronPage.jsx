import { useMemo, useCallback, useEffect, useReducer } from 'react';
import Card from '../../components/Card';
import ResultBox from '../../components/ResultBox';
import CopyButton from '../../components/CopyButton';
import HuronForm from './HuronForm';
import HuronPreview from './HuronPreview';
import { validateHuronInput } from '../../core/machining/huronValidation';
import { setCalibracaoAnel } from './ringCalibrationStore';
import {
  RING_OPTIONS,
  parseAngles,
  formatResultEcho,
  formatRingNote,
  buildCopyText,
  initHuronPageState,
  huronPageReducer,
} from './huronPageState';
import styles from './HuronPage.module.css';

const MACHINE_ID = 'feller-huron45';

export default function HuronPage() {
  // Transições em huronPageState.js (puras e testadas): editar campo ou anel
  // invalida o resultado; CALCULAR só calcula com entrada válida.
  const [state, dispatch] = useReducer(huronPageReducer, MACHINE_ID, initHuronPageState);
  const { values, submitted, result, ring } = state;
  const ringActive = ring.b !== 0 || ring.c !== 0;

  useEffect(() => {
    setCalibracaoAnel(MACHINE_ID, { bRingOffset: ring.b, cRingOffset: ring.c });
  }, [ring]);

  // Adapter canônico: parse local (texto→número) + validação estruturada.
  // Erros de campo alimentam os badges; 'orientacao' alimenta a caixa global.
  const nums = useMemo(() => parseAngles(values), [values]);
  const validation = useMemo(() => validateHuronInput(nums), [nums]);
  const errors = validation.errors;
  const validOverall = validation.valid;
  const shownErrors = submitted ? errors : [];
  const orientationError = errors.find((e) => e.field === 'orientacao');

  const handleField = useCallback((id, raw) => {
    dispatch({ type: 'FIELD_EDIT', id, raw });
  }, []);

  const handleCalculate = useCallback(() => {
    dispatch({ type: 'CALCULATE' });
  }, []);

  const handleClear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  const handleRing = useCallback((id, value) => {
    dispatch({ type: 'RING_CHANGE', id, value });
  }, []);

  // Sem inclinação real, a direção da flange superior não é definida
  // (vale para o valor teórico; o aviso independe da calibração do anel).
  const isFlat = result !== null && result.raw.bFlange === 0;

  const copyText = useCallback(() => {
    return buildCopyText(result, { ring, ringActive });
  }, [result, ringActive, ring]);

  // Legendas congeladas no cálculo (nunca do seletor atual): com offset 0
  // formatRingNote devolve '' e a tela fica idêntica à anterior.
  const noteB = result ? formatRingNote(result.ringOffsets.b) : '';
  const noteC = result ? formatRingNote(result.ringOffsets.c) : '';
  const hasCalib = Boolean(noteB || noteC);

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
                  {noteB && <span className={styles.ringNote}>{noteB}</span>}
                </div>
                <div className={styles.resultItem}>
                  <span className={styles.resultLabel}>Flange superior</span>
                  <span className={styles.resultValue}>{isFlat ? '—' : `${result.cFlange.toFixed(4)}°`}</span>
                  {!isFlat && noteC && <span className={styles.ringNote}>{noteC}</span>}
                </div>
              </div>
              <div className={styles.theoretical}>{formatResultEcho(result.input)}</div>
              {hasCalib && <div className={styles.theoretical}>valores já com calibração</div>}
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
        {submitted && !validOverall && orientationError && (
          <div className={styles.errorBox} role="alert">{orientationError.message}</div>
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
