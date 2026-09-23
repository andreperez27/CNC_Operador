import { useState, useMemo, useEffect } from 'react';
import { THREAD_FAMILIES, getThread, searchThreads, solveThread, buildThreadProgram, resolveHoleFromInput, DEFAULT_HOLE_RULE, DEFAULT_HOLE_MARGIN } from '../../core/machining/thread';
import ProgramDisplay from '../heidenhain/components/ProgramDisplay';
import ValidationPanel from '../gcoderapido/components/ValidationPanel';
import ThreadSelector from './components/ThreadSelector';
import ThreadDetail from './components/ThreadDetail';
import ThreadForm from './components/ThreadForm';
import ThreadPreview from './components/ThreadPreview';
import styles from './RoscasPage.module.css';

const BASE_VALUES = {
  toolNumber: 1,
  rpm: 300,
  depth: 20,
  safety: 5,
  zStart: 0,
  toolDiameter: 6,
  feed: 120,
  direction: 'cw',
  holeRule: DEFAULT_HOLE_RULE,
  customFactor: 3,
  customReference: 'threadDiameter',
  holeMargin: DEFAULT_HOLE_MARGIN,
  holeDepth: '',
};

function helicalToolDefault(thread) {
  return Math.min(thread.hole * 0.8, thread.nominal * 0.5);
}

export default function RoscasPage() {
  const [familyId, setFamilyId] = useState('metric');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [values, setValues] = useState(BASE_VALUES);
  const [holeTouched, setHoleTouched] = useState(false);

  const families = THREAD_FAMILIES.filter((f) => f.status === 'available');
  const pendingFamilies = THREAD_FAMILIES.filter((f) => f.status === 'pending');

  const matches = useMemo(() => searchThreads(query, familyId), [query, familyId]);
  const selected = useMemo(() => (selectedId ? getThread(selectedId) : null), [selectedId]);

  const holeInput = useMemo(
    () => ({
      depth: values.depth,
      holeRule: values.holeRule,
      customFactor: values.customFactor,
      customReference: values.customReference,
      holeMargin: values.holeMargin,
      holeDepth: values.holeDepth,
    }),
    [values.depth, values.holeRule, values.customFactor, values.customReference, values.holeMargin, values.holeDepth],
  );

  const hole = useMemo(() => (selected ? resolveHoleFromInput(holeInput, selected) : null), [selected, holeInput]);

  // sugere a profundidade do furo quando o operador ainda não editou o campo
  useEffect(() => {
    if (!selected || !hole || holeTouched) return;
    if (hole.suggested == null) return;
    setValues((prev) =>
      prev.holeDepth === hole.suggested ? prev : { ...prev, holeDepth: hole.suggested },
    );
  }, [selected, hole, holeTouched]);

  useEffect(() => {
    if (selected && selected.method === 'helical' && !Number(values.toolDiameter)) {
      setValues((prev) => ({ ...prev, toolDiameter: helicalToolDefault(selected) }));
    }
  }, [selected, values.toolDiameter]);

  const handleFamily = (id) => {
    setFamilyId(id);
    setQuery('');
    setSelectedId(null);
  };

  const handleQuery = (v) => {
    setQuery(v);
    setSelectedId(null);
  };

  const handleSelect = (thread) => {
    setSelectedId(thread.id);
    setQuery('');
    setHoleTouched(false);
    setValues((prev) => ({ ...prev, toolDiameter: helicalToolDefault(thread) }));
  };

  const handleClear = () => {
    setSelectedId(null);
    setQuery('');
    setHoleTouched(false);
  };

  const handleChange = (id, raw) => {
    setValues((prev) => ({ ...prev, [id]: raw }));
    if (id === 'holeDepth') setHoleTouched(true);
    if (id === 'holeRule') setHoleTouched(false);
  };

  const handleUseSuggestion = () => {
    if (!hole || hole.suggested == null) return;
    setHoleTouched(false);
    setValues((prev) => ({ ...prev, holeDepth: hole.suggested }));
  };

  const input = useMemo(() => {
    if (!selected) return null;
    const base = {
      threadId: selected.id,
      toolNumber: values.toolNumber,
      rpm: values.rpm,
      depth: values.depth,
      safety: values.safety,
      zStart: values.zStart,
      holeRule: values.holeRule,
      customFactor: values.customFactor,
      customReference: values.customReference,
      holeMargin: values.holeMargin,
      holeDepth: values.holeDepth,
    };
    if (selected.method === 'helical') {
      return {
        ...base,
        toolDiameter: values.toolDiameter,
        feed: values.feed,
        direction: values.direction,
      };
    }
    return base;
  }, [selected, values]);

  const result = useMemo(() => (input ? solveThread(input) : null), [input]);
  const model = result?.valid ? result.model : null;
  const program = useMemo(() => (model ? buildThreadProgram(model) : null), [model]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Roscas</h1>
        <p className={styles.subtitle}>
          Busque a rosca, confira os dados (furo, passo, estrategia) e gere o programa
          Heidenhain (.H) pelo pipeline canonico — CYCL DEF 207 (rigida) ou interpolacao
          helicoidal.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Selecao da rosca</div>
        <ThreadSelector
          familyId={familyId}
          families={families}
          pendingFamilies={pendingFamilies}
          onFamilyChange={handleFamily}
          query={query}
          onQueryChange={handleQuery}
          matches={matches}
          selected={selected}
          onSelect={handleSelect}
          onClear={handleClear}
        />
      </div>

      {selected && <ThreadDetail thread={selected} />}

      {selected && (
        <div className={styles.workRow}>
          <div className={styles.workFormCol}>
            <ThreadForm
              thread={selected}
              values={values}
              errors={result ? result.validation.errors : []}
              validOverall={result ? result.valid : false}
              onChange={handleChange}
              hole={hole}
              onUseSuggestion={handleUseSuggestion}
            />
            <ValidationPanel result={result} />
          </div>
          <div className={styles.workPreviewCol}>
            <ThreadPreview model={model} />
          </div>
        </div>
      )}

      {model && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Programa Heidenhain (.H)</div>
            <span className={styles.sectionHint}>texto exibido = texto exportado (postprocessor)</span>
          </div>
          <ProgramDisplay program={program} operationId={model.operationId} />
        </div>
      )}
    </div>
  );
}