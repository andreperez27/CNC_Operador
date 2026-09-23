import { fmtN } from '../../../shared/utils/formatters';

export default function TrigResults({ result }) {
  if (!result) return null;

  if (result.error) {
    return (
      <div className="card" style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 14 }}>
        <p style={{ color: 'var(--red)', fontFamily: 'var(--mono)', fontSize: '.82rem' }}>{result.error}</p>
      </div>
    );
  }

  const cells = [
    ['a', result.a, 'CATETO A'],
    ['b', result.b, 'CATETO B'],
    ['c', result.c, 'HIPOTENUSA c'],
    ['A', result.A, 'ÂNGULO A (°)'],
    ['B', result.B, 'ÂNGULO B (°)'],
    ['C', result.C, 'ÂNGULO C (°)'],
  ];

  return (
    <div className="card" style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 14 }}>
      <div className="res-grid rg-3">
        {cells.map(([k, v, label]) => (
          <div key={k} className="res-cell hi">
            <div className="res-val">{fmtN(v)}</div>
            <div className="res-lbl">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
