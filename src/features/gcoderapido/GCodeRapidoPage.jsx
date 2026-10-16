import { useState, useMemo, useCallback } from 'react';
import { solveChamfer, buildChamferProgram } from '../../core/machining/chamfer';
import { solveRadius, buildRadiusProgram } from '../../core/machining/radius';
import { toQParams, DEFAULT_MAP, EXTERNAL_CHAMFER_MAP, EXTERNAL_RADIUS_MAP } from '../heidenhain/params/parameterEngine';
import { fileExtension } from '../../core/postprocessors/heidenhain';
import { buildProgramName } from '../../core/postprocessors/programName';
import { downloadAsFile } from '../../core/export/downloadProgram';
import { formatResultNumber, summarizeModel, originLabel } from './resultSummary';
import ChamferForm from './components/ChamferForm';
import RadiusForm from './components/RadiusForm';
import ValidationPanel from './components/ValidationPanel';
import ViewOptions from '../heidenhain/components/ViewOptions';
import QParamsDisplay from '../heidenhain/components/QParamsDisplay';
import ChamferExternalPreview from '../heidenhain/preview/ChamferExternalPreview';
import ChamferInternalPreview from '../heidenhain/preview/ChamferInternalPreview';
import RadiusPreview from '../gcode/preview/RadiusPreview';
import InternalRadiusPreview from '../gcode/preview/InternalRadiusPreview';
import styles from './GCodeRapidoPage.module.css';

const DEFAULT_VALUES = {
  operacao: 'chanfro',
  formato: 'reta',
  tipo: 'external',
  L: 100,
  C: 2,
  A: 45,
  profundidade: '',
  passeZ: 0.3,
  toolType: 'toroidal',
  D: 12,
  r: 2,
  alojamentoLargura: 60,
  rpm: 3000,
  av: 600,
};

const RADIUS_DEFAULT_VALUES = {
  formato: 'reta',
  tipo: 'external',
  R: 20,
  D: 25,
  r: 0.8,
  incrZ: 20,
  L: 100,
  alojamentoLargura: 60,
  rpm: 3000,
  av: 600,
};

const OPERATION_TITLES = {
  chanfro: 'G-Code Rapido — Chanfro',
  raio: 'G-Code Rapido — Raio (canonico)',
};

// Camadas essenciais ligadas por padrão (mobile): trajetória, ferramenta e
// perfil final. As demais ficam atrás do botão "Camadas". O ViewOptions
// trata `!== false` como ligado, por isso as não-essenciais vêm false.
const DEFAULT_VIEW_OPTIONS = {
  tool: true,
  trajectory: true,
  finProfile: true,
  origin: false,
  startPoint: false,
  endPoint: false,
  passes: false,
  safety: false,
  rawProfile: false,
  toolCenter: false,
};

const ABAS = [
  { id: 'dados', label: 'Dados' },
  { id: 'previa', label: 'Prévia' },
  { id: 'programa', label: 'Programa' },
];

export default function GCodeRapidoPage() {
  const [values, setValues] = useState(DEFAULT_VALUES);
  const [radiusValues, setRadiusValues] = useState(RADIUS_DEFAULT_VALUES);
  const [viewOptions, setViewOptions] = useState(DEFAULT_VIEW_OPTIONS);
  const [aba, setAba] = useState('dados');

  const isRaio = values.operacao === 'raio';

  const handleField = useCallback((id, value) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleRadiusField = useCallback((id, value) => {
    setRadiusValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleOperation = useCallback((op) => {
    setValues((prev) => ({ ...prev, operacao: op }));
  }, []);

  // ── Chanfro ────────────────────────────────────────────────────────
  const input = useMemo(() => {
    const isInternal = values.tipo === 'internal';
    const depthRaw = values.profundidade;
    return {
      type: values.tipo,
      width: values.C,
      angle: values.A,
      depth: depthRaw === '' ? undefined : depthRaw,
      tool: {
        type: values.toolType,
        diameter: values.D,
        radius: values.toolType === 'toroidal' ? values.r : undefined,
      },
      strategy: { passDepth: values.passeZ },
      plane: 'XZ',
      origin: isInternal ? 'corner' : 'vertex',
      length: values.L,
      feed: values.av,
      rpm: values.rpm,
      safety: LEGACY_DEFAULTS.safety,
      toolNumber: 1,
      sobre: 0,
      clearance: isInternal ? { pocketWidth: values.alojamentoLargura } : undefined,
    };
  }, [values]);

  const result = useMemo(() => solveChamfer(input), [input]);
  const model = result.valid ? result.model : null;

  const chamferQParams = useMemo(
    () => (model ? toQParams(model, model.type === 'internal' ? DEFAULT_MAP : EXTERNAL_CHAMFER_MAP) : null),
    [model]
  );

  const chamferProgram = useMemo(() => (model ? buildChamferProgram(model) : null), [model]);

  // ── Raio ───────────────────────────────────────────────────────────
  const radiusInput = useMemo(() => {
    if (!isRaio) return null;
    const isInternal = radiusValues.tipo === 'internal';
    return {
      type: isInternal ? 'internal' : 'external',
      radius: radiusValues.R,
      tool: { type: 'toroidal', diameter: radiusValues.D, radius: radiusValues.r },
      strategy: { passDepth: radiusValues.incrZ },
      plane: 'XZ',
      origin: isInternal ? 'corner' : 'vertex',
      length: radiusValues.L,
      feed: radiusValues.av,
      rpm: radiusValues.rpm,
      safety: LEGACY_DEFAULTS.safety,
      toolNumber: 1,
      sobre: 0,
      clearance: isInternal ? { pocketWidth: radiusValues.alojamentoLargura } : undefined,
    };
  }, [isRaio, radiusValues]);

  const radiusResult = useMemo(
    () => (radiusInput ? solveRadius(radiusInput) : null),
    [radiusInput]
  );
  const radiusModel = radiusResult && radiusResult.valid ? radiusResult.model : null;
  const radiusQParams = useMemo(
    () => (radiusModel ? toQParams(radiusModel, EXTERNAL_RADIUS_MAP) : null),
    [radiusModel]
  );
  const radiusProgram = useMemo(
    () => (radiusModel ? buildRadiusProgram(radiusModel) : null),
    [radiusModel]
  );

  const activeModel = isRaio ? radiusModel : model;
  const activeProgram = isRaio ? radiusProgram : chamferProgram;
  const activeQParams = isRaio ? radiusQParams : chamferQParams;

  const handleExport = useCallback(() => {
    if (!activeProgram || !activeModel) return;
    downloadAsFile(activeProgram, buildProgramName(activeModel.operationId), fileExtension);
  }, [activeProgram, activeModel]);

  const handleCopy = useCallback(() => {
    if (!activeProgram) return;
    navigator.clipboard.writeText(activeProgram);
  }, [activeProgram]);

  const ChamferPreview = model?.type === 'internal' ? ChamferInternalPreview : ChamferExternalPreview;

  // Linha de resumo fixa da aba Dados (passes, profundidade total, contato)
  // + rodapé Plano/Origem. Vêm do modelo canônico; sem modelo, traços.
  const resumo = summarizeModel(activeModel);
  const tipoAtivo = isRaio ? radiusValues.tipo : values.tipo;
  const rodape = isRaio
    ? `Fresa tórica · Plano XZ · Origem (zero peça): ${originLabel(tipoAtivo)}`
    : `Plano XZ · Origem (zero peça): ${originLabel(tipoAtivo)}`;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.tipoRow}>
          <button
            type="button"
            className={`${styles.opBtn} ${!isRaio ? styles.opBtnActive : ''}`}
            onClick={() => handleOperation('chanfro')}
          >
            Chanfro
          </button>
          <button
            type="button"
            className={`${styles.opBtn} ${isRaio ? styles.opBtnActive : ''}`}
            onClick={() => handleOperation('raio')}
          >
            Raio
          </button>
        </div>
        <h1 className={styles.title}>{OPERATION_TITLES[values.operacao]}</h1>
      </div>

      <div className={styles.tipoRow} role="tablist" aria-label="Seções da página">
        {ABAS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            className={`${styles.opBtn} ${aba === id ? styles.opBtnActive : ''}`}
            onClick={() => setAba(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === 'dados' && (
        <div className={styles.panel}>
          {isRaio
            ? <RadiusForm
                values={radiusValues}
                errors={radiusResult ? radiusResult.validation.errors : []}
                validOverall={radiusResult ? radiusResult.valid : false}
                onChange={handleRadiusField}
              />
            : <ChamferForm
                values={values}
                errors={result ? result.validation.errors : []}
                validOverall={result ? result.valid : false}
                onChange={handleField}
              />}
          {isRaio ? <ValidationPanel result={radiusResult} quiet /> : <ValidationPanel result={result} quiet />}
          <div className={styles.summaryBar}>
            Passes: <b>{resumo.passes}</b>
            {' · '}Prof. total: <b>{resumo.profZ} mm</b>
            {' · '}Contato: <b>{resumo.contato}</b>
          </div>
          <div className={styles.footNote}>{rodape}</div>
        </div>
      )}

      {aba === 'previa' && (
        <div className={styles.previewCol}>
          <div className={styles.previewBox}>
            {isRaio
              ? (radiusModel?.type === 'internal'
                  ? <InternalRadiusPreview params={radiusValues} solved={radiusModel} />
                  : <RadiusPreview model={radiusModel} options={viewOptions} />)
              : <ChamferPreview model={model} options={viewOptions} />}
          </div>
          <details className={styles.collapse}>
            <summary className={styles.collapseSummary}>Camadas</summary>
            <div className={styles.collapseBody}>
              <ViewOptions options={viewOptions} onChange={setViewOptions} />
            </div>
          </details>
        </div>
      )}

      {aba === 'programa' && (
        <div className={styles.section}>
          <div className={styles.buttons}>
            <button className={styles.actionBtn} onClick={handleExport} disabled={!activeProgram}>
              Exportar .H
            </button>
            <button className={styles.actionBtn} onClick={handleCopy} disabled={!activeProgram}>
              Copiar
            </button>
          </div>
          {activeProgram
            ? <pre className={styles.programCode}>{activeProgram}</pre>
            : <div className={styles.programEmpty}>Preencha os parametros para gerar o programa</div>}
          <details className={styles.collapse}>
            <summary className={styles.collapseSummary}>Detalhes técnicos</summary>
            <div className={styles.collapseBody}>
              <QParamsDisplay qParams={activeQParams} />
              {isRaio && radiusModel && (
                <div className={styles.results}>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>Status de contato</span>
                    <span className={styles.resultValue}>{radiusModel.contact.contactPoint ? 'OK' : '—'}</span>
                  </div>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>rho = R + r (raio da trajetoria)</span>
                    <span className={styles.resultValue}>{formatResultNumber(radiusModel.rho, 6)} mm</span>
                  </div>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>Q4 (X do centro da trajetoria)</span>
                    <span className={styles.resultValue}>{formatResultNumber(radiusModel.xCenter)} mm</span>
                  </div>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>Q6 (X no ultimo passe, z=R)</span>
                    <span className={styles.resultValue}>{formatResultNumber(radiusModel.q6, 9)} mm</span>
                  </div>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>Numero de passes</span>
                    <span className={styles.resultValue}>{radiusModel.nPasses}</span>
                  </div>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>Incremento real</span>
                    <span className={styles.resultValue}>{formatResultNumber(radiusModel.incReal, 6)} mm</span>
                  </div>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>Profundidade total</span>
                    <span className={styles.resultValue}>{formatResultNumber(radiusModel.profZ)} mm</span>
                  </div>
                </div>
              )}
              {!isRaio && model && (
                <div className={styles.results}>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>Reff (raio efetivo)</span>
                    <span className={styles.resultValue}>{formatResultNumber(model.toolCornerR)} mm</span>
                  </div>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>Numero de passes</span>
                    <span className={styles.resultValue}>{model.nPasses}</span>
                  </div>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>Incremento real</span>
                    <span className={styles.resultValue}>{formatResultNumber(model.incReal, 6)} mm</span>
                  </div>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>X do centro da ferramenta</span>
                    <span className={styles.resultValue}>{formatResultNumber(model.contact.toolCenter.x)} mm</span>
                  </div>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>Profundidade total</span>
                    <span className={styles.resultValue}>{formatResultNumber(model.profZ)} mm</span>
                  </div>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>Largura horizontal</span>
                    <span className={styles.resultValue}>{formatResultNumber(model.largX)} mm</span>
                  </div>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>cot(A)</span>
                    <span className={styles.resultValue}>{formatResultNumber(model.cotA, 6)}</span>
                  </div>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>Ponto de contato</span>
                    <span className={styles.resultValue}>
                      ({formatResultNumber(model.contact.contactPoint.x)}, {formatResultNumber(model.contact.contactPoint.z)})
                    </span>
                  </div>
                </div>
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

const LEGACY_DEFAULTS = { safety: 10 };
