import { useState, useCallback, useMemo } from 'react';
import Card from '../../components/Card';
import GeneratorSelector from './components/GeneratorSelector';
import GeneratorForm from './components/GeneratorForm';
import GcodeOutput from './components/GcodeOutput';
import GcodePreviewPanel from './components/preview/GcodePreviewPanel';
import { getGenerator } from './registry/registry';

export default function GCodePage() {
  const [selectedGen, setSelectedGen] = useState('');
  const [params, setParams] = useState(null);
  const [activeParamId, setActiveParamId] = useState(null);

  const gen = getGenerator(selectedGen);

  const solved = useMemo(() => {
    if (!gen || !params) return null;
    const errors = gen.validate ? gen.validate(params) : null;
    if (errors) return null;
    return gen.solve(params);
  }, [gen, params]);

  const handleGenChange = useCallback((id) => {
    setSelectedGen(id);
    setParams(null);
    setActiveParamId(null);
  }, []);

  const handleParamsChange = useCallback((p) => {
    setParams({ ...p });
  }, []);

  const handleParamFocus = useCallback((id) => {
    setActiveParamId(id);
  }, []);

  return (
    <div className="page">
      <GcodePreviewPanel
        generatorId={selectedGen}
        params={params}
        solved={solved}
        activeParamId={activeParamId}
      />
      <Card title="Gerador G-Code — iTNC 530">
        <GeneratorSelector value={selectedGen} onChange={handleGenChange} />
        {selectedGen && (
          <GeneratorForm generatorId={selectedGen} onParamsChange={handleParamsChange} onParamFocus={handleParamFocus} />
        )}
      </Card>
      <GcodeOutput generatorId={selectedGen} params={params} />
    </div>
  );
}
