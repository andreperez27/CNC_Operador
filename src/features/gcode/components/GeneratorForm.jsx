import { useState, useEffect } from 'react';
import { getGenerator } from '../registry/registry';

export default function GeneratorForm({ generatorId, onParamsChange, onParamFocus }) {
  const [params, setParams] = useState({});

  const gen = getGenerator(generatorId);
  const paramDefs = gen ? gen.params : [];

  useEffect(() => {
    if (gen) {
      const initial = {};
      gen.params.forEach(p => { initial[p.id] = p.val; });
      setParams(initial);
      if (onParamsChange) onParamsChange(initial);
    }
  }, [generatorId]);

  const handleChange = (id, value, kind) => {
    const next = { ...params };
    if (kind === 'select') {
      next[id] = value;
    } else {
      const num = parseFloat(value);
      next[id] = isNaN(num) ? 0 : num;
    }
    setParams(next);
    if (onParamsChange) onParamsChange(next);
  };

  if (!gen) return null;

  const visible = paramDefs.filter((p) => {
    if (!p.showWhen) return true;
    return Object.entries(p.showWhen).every(([k, v]) => params[k] === v);
  });

  const renderControl = (p) =>
    p.kind === 'select' ? (
      <select
        className="fs"
        value={params[p.id] ?? ''}
        onChange={e => handleChange(p.id, e.target.value, 'select')}
        onFocus={() => onParamFocus?.(p.id)}
        onBlur={() => onParamFocus?.(null)}
      >
        {(p.options || []).map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    ) : (
      <input
        className="fi"
        type="number"
        value={params[p.id] ?? ''}
        step={p.step || 'any'}
        onChange={e => handleChange(p.id, e.target.value)}
        onFocus={() => onParamFocus?.(p.id)}
        onBlur={() => onParamFocus?.(null)}
      />
    );

  const rows = [];
  for (let i = 0; i < visible.length; i += 2) {
    const p1 = visible[i];
    const p2 = visible[i + 1];
    rows.push(
      <div className="fr2" key={p1.id}>
        <div className="fg">
          <label className="fl">{p1.label}</label>
          {renderControl(p1)}
        </div>
        {p2 ? (
          <div className="fg">
            <label className="fl">{p2.label}</label>
            {renderControl(p2)}
          </div>
        ) : <div />}
      </div>
    );
  }

  return <>{rows}</>;
}