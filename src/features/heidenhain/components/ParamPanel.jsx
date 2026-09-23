import { TOOL_TYPE_LIST } from '../math/toolTypes';
import styles from './ParamPanel.module.css';

const FIELD_SETS = {
  chamferExternal: [
    { id: 'numeroFerramenta', label: 'Numero da ferramenta', val: 1, step: '1', min: 0, required: true },
    { id: 'C', label: 'Largura do chanfro (mm)', val: 2, step: 'any', min: 0.1 },
    { id: 'A', label: 'Angulo (°)', val: 45, step: 'any', min: 1, max: 89 },
    { id: 'D', label: 'Diametro da ferramenta (mm)', val: 12, step: 'any', min: 1 },
    { id: 'r', label: 'Raio de canto (mm)', val: 2, step: 'any', min: 0 },
    { id: 'L', label: 'Comprimento da peca (mm)', val: 100, step: 'any', min: 1 },
    { id: 'distanciaSeguranca', label: 'Distancia de seguranca (mm)', val: 10, step: 'any', min: 0 },
    { id: 'passeZ', label: 'Incremento desejado (mm)', val: 0.3, step: 'any', min: 0.01 },
    { id: 'sobre', label: 'Sobremetal (mm)', val: 0, step: 'any', min: 0 },
    { id: 'rpm', label: 'RPM', val: 3000, step: '1', min: 1 },
    { id: 'av', label: 'Avanco (mm/min)', val: 600, step: '1', min: 1 },
    { id: 'blocoW', label: 'Bloco: largura X (mm) - opcional', val: '', step: 'any', min: 0 },
    { id: 'blocoL', label: 'Bloco: comprimento Y (mm) - opcional', val: '', step: 'any', min: 0 },
    { id: 'blocoH', label: 'Bloco: altura Z (mm) - opcional', val: '', step: 'any', min: 0 },
  ],
  chamferInternal: [
    { id: 'C', label: 'Largura do chanfro (mm)', val: 2, step: 'any', min: 0.1 },
    { id: 'A', label: 'Angulo (°)', val: 45, step: 'any', min: 1, max: 89 },
    { id: 'D', label: 'Diametro da ferramenta (mm)', val: 12, step: 'any', min: 1 },
    { id: 'r', label: 'Raio de canto (mm)', val: 2, step: 'any', min: 0 },
    { id: 'L', label: 'Comprimento do bolsao (mm)', val: 100, step: 'any', min: 1 },
    { id: 'alojamentoLargura', label: 'Largura do bolsao (mm)', val: 60, step: 'any', min: 1 },
    { id: 'passeZ', label: 'Incremento desejado (mm)', val: 0.3, step: 'any', min: 0.01 },
    { id: 'sobre', label: 'Sobremetal (mm)', val: 0, step: 'any', min: 0 },
    { id: 'rpm', label: 'RPM', val: 3000, step: '1', min: 1 },
    { id: 'av', label: 'Avanco (mm/min)', val: 600, step: '1', min: 1 },
  ],
};

export default function ParamPanel({ values, onChange, onFocus, model, operationId }) {
  const fields = FIELD_SETS[operationId] || FIELD_SETS.chamferExternal;
  const handleChange = (id, raw) => {
    const v = raw === '' ? '' : Number(raw);
    onChange(id, v);
  };

  const handleToolType = (e) => {
    onChange('toolType', e.target.value);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.title}>Parametros</div>

      {/* Tool type selector */}
      <div className={`${styles.field} ${styles.fullWidth}`} style={{ marginBottom: 10 }}>
        <span className={styles.label}>Tipo de ferramenta</span>
        <select className={styles.select} value={values?.toolType || 'toroidal'} onChange={handleToolType}>
          {TOOL_TYPE_LIST.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className={styles.grid}>
        {fields.map((f) => {
          const val = values?.[f.id] ?? f.val;
          return (
            <label key={f.id} className={styles.field}>
              <span className={styles.label}>
                {f.label}
                {f.required ? ' *' : ''}
              </span>
              <input
                className={styles.input}
                type="number"
                value={val}
                min={f.min}
                max={f.max}
                step={f.step === 'any' ? 'any' : f.step}
                required={f.required}
                onChange={(e) => handleChange(f.id, e.target.value)}
                onFocus={() => onFocus?.(f.id)}
                onBlur={() => onFocus?.(null)}
              />
            </label>
          );
        })}
      </div>

      {/* Computed info */}
      {model && (
        <div className={styles.info}>
          <div className={styles.infoTitle}>Resultado</div>
          <div className={styles.infoGrid}>
            <span className={styles.infoLabel}>Reff:</span>
            <span className={styles.infoValue}>{model.Reff?.toFixed(3)} mm</span>
            <span className={styles.infoLabel}>Passes:</span>
            <span className={styles.infoValue}>{model.nPasses}</span>
            <span className={styles.infoLabel}>Inc real:</span>
            <span className={styles.infoValue}>{model.incReal?.toFixed(3)} mm</span>
            <span className={styles.infoLabel}>X centro:</span>
            <span className={styles.infoValue}>{model.xCentro?.toFixed(3)} mm</span>
          </div>
        </div>
      )}
    </div>
  );
}

export { FIELD_SETS };
