import { useState, useCallback } from 'react';
import Card from '../../components/Card';
import TriangleSvg from './components/TriangleSvg';
import TrigInputs from './components/TrigInputs';
import TrigResults from './components/TrigResults';
import { solveTriangle } from './solver/triangleSolver';

const initial = { a: '', b: '', c: '', A: '', B: '' };

export default function TrigonometriaPage() {
  const [values, setValues] = useState(initial);
  const [result, setResult] = useState(null);

  const handleChange = useCallback((id, val) => {
    setValues(prev => ({ ...prev, [id]: val }));
  }, []);

  const handleCalculate = useCallback(() => {
    const nums = {};
    for (const [k, v] of Object.entries(values)) {
      const n = parseFloat(v);
      nums[k] = (!isNaN(n) && n > 0) ? n : null;
    }
    const res = solveTriangle(nums);
    setResult(res);
  }, [values]);

  const handleClear = useCallback(() => {
    setValues(initial);
    setResult(null);
  }, []);

  return (
    <div className="page">
      <Card title="Triangulo Retangulo">
        <TriangleSvg />
        <TrigInputs
          values={values}
          onChange={handleChange}
          onCalculate={handleCalculate}
          onClear={handleClear}
        />
      </Card>
      <TrigResults result={result} />
    </div>
  );
}
