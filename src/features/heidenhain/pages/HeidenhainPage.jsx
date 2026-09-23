import { useState, useMemo, useCallback } from 'react';
import { solveExternalChamfer } from '../math/chamferExternalMath';
import { solveInternalChamfer } from '../math/chamferInternalMath';
import { buildPassStrategy } from '../strategy/strategyEngine';
import { toQParams, DEFAULT_MAP, EXTERNAL_CHAMFER_MAP } from '../params/parameterEngine';
import { generateProgram } from '../program';
import { buildProgramName } from '../../../core/postprocessors/programName';
import ChamferExternalPreview from '../preview/ChamferExternalPreview';
import ChamferInternalPreview from '../preview/ChamferInternalPreview';
import ParamPanel from '../components/ParamPanel';
import ViewOptions from '../components/ViewOptions';
import QParamsDisplay from '../components/QParamsDisplay';
import ProgramDisplay from '../components/ProgramDisplay';
import styles from './HeidenhainPage.module.css';

const OPERATIONS = [
  { id: 'chamferExternal', label: 'Chanfro Externo' },
  { id: 'chamferInternal', label: 'Chanfro Interno (bolsao)' },
];

const SOLVERS = {
  chamferExternal: solveExternalChamfer,
  chamferInternal: solveInternalChamfer,
};

const DEFAULT_PARAMS = {
  A: 45, C: 2, D: 12, r: 2, L: 100,
  passeZ: 0.3, sobre: 0, rpm: 3000, av: 600,
  numeroFerramenta: 1, distanciaSeguranca: 10,
  blocoW: '', blocoL: '', blocoH: '',
  toolType: 'toroidal',
};

const DEFAULT_VIEW_OPTIONS = {
  tool: true,
  trajectory: true,
  toolCenter: true,
  origin: true,
  startPoint: true,
  endPoint: true,
  passes: true,
  rawProfile: true,
  finProfile: true,
  contactGeo: true,
  safety: false,
};

export default function HeidenhainPage() {
  const [operation, setOperation] = useState('chamferExternal');
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [viewOptions, setViewOptions] = useState(DEFAULT_VIEW_OPTIONS);
  const [_activeParamId, setActiveParamId] = useState(null);

  // MathEngine + StrategyEngine
  const fullModel = useMemo(() => {
    const fn = SOLVERS[operation] || solveExternalChamfer;
    try {
      const geo = fn(params);
      if (!geo) return null;
      const strat = buildPassStrategy(geo, params);
      const halfL = (params.L || 100) / 2;
      const toolD = Number(params.D) || 0;
      const seguranca = Number(params.distanciaSeguranca) || 0;
      return {
        ...geo,
        ...strat,
        seguranca,
        xCorner: seguranca + toolD / 2,
        dMeio: toolD / 2,
        yTotal: (params.L || 100) + seguranca,
        yStart: -halfL,
        yEnd: halfL,
        safeZ: 5,
        retrZ: 0.5,
      };
    } catch {
      return null;
    }
  }, [params, operation]);

  // ParameterEngine
  const qParams = useMemo(() => {
    if (!fullModel) return null;
    try {
      const map = operation === 'chamferExternal' ? EXTERNAL_CHAMFER_MAP : DEFAULT_MAP;
      return toQParams(fullModel, map);
    } catch {
      return null;
    }
  }, [fullModel, operation]);

  // ProgramEngine
  const program = useMemo(() => {
    if (!qParams || !fullModel) return null;
    try {
      return generateProgram(operation, qParams, fullModel, buildProgramName(operation));
    } catch {
      return null;
    }
  }, [qParams, fullModel, operation]);

  // Reset params when operation changes
  const handleOperationChange = useCallback((newOp) => {
    setOperation(newOp);
    setParams({
      ...DEFAULT_PARAMS,
      alojamentoLargura: 60,
    });
  }, []);

  const handleParamChange = useCallback((id, value) => {
    setParams((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleViewChange = useCallback((newOpts) => {
    setViewOptions(newOpts);
  }, []);

  const isInternal = operation === 'chamferInternal';

  return (
    <div className={styles.page}>
      {/* Operation selector */}
      <div className={styles.opSelector}>
        {OPERATIONS.map((op) => (
          <button
            key={op.id}
            className={`${styles.opBtn} ${operation === op.id ? styles.opBtnActive : ''}`}
            onClick={() => handleOperationChange(op.id)}
          >
            {op.label}
          </button>
        ))}
      </div>

      <div className={styles.topSection}>
        <div className={styles.previewCol}>
          {!isInternal ? (
            <ChamferExternalPreview model={fullModel} options={viewOptions} />
          ) : (
            <ChamferInternalPreview model={fullModel} options={viewOptions} />
          )}
          <ViewOptions options={viewOptions} onChange={handleViewChange} />
        </div>
        <div className={styles.sideCol}>
          <ParamPanel
            values={params}
            onChange={handleParamChange}
            onFocus={setActiveParamId}
            model={fullModel}
            operationId={operation}
          />
          <QParamsDisplay qParams={qParams} />
        </div>
      </div>

      <div className={styles.programSection}>
          <ProgramDisplay program={program} operationId={operation} />
      </div>
    </div>
  );
}
