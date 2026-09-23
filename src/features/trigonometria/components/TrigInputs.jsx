export default function TrigInputs({ values, onChange, onCalculate, onClear }) {
  const fields = [
    { id: 'a', label: 'Cateto a' },
    { id: 'b', label: 'Cateto b' },
    { id: 'c', label: 'Hipotenusa c' },
    { id: 'A', label: 'Ângulo A (°)' },
    { id: 'B', label: 'Ângulo B (°)' },
  ];

  return (
    <>
      <div className="info">Preencha 2 valores. Os demais sao calculados automaticamente.</div>
      <div className="fr2">
        {fields.map(f => (
          <div className="fg" key={f.id}>
            <label className="fl">{f.label}</label>
            <input
              className="fi"
              type="number"
              step="any"
              placeholder="—"
              value={values[f.id] ?? ''}
              onChange={e => onChange(f.id, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="btn-row">
        <button className="btn btn-p" onClick={onCalculate}>CALCULAR</button>
        <button className="btn btn-s" onClick={onClear}>LIMPAR</button>
      </div>
    </>
  );
}
