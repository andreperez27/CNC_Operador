import styles from '../RoscasPage.module.css';

function methodLabel(method) {
  return method === 'rigid' ? 'Rigida' : 'Helicoidal';
}

export default function ThreadSelector({
  familyId,
  families,
  pendingFamilies,
  onFamilyChange,
  query,
  onQueryChange,
  matches,
  selected,
  onSelect,
  onClear,
}) {
  return (
    <div className={styles.selector}>
      <div className={styles.selectorGrid}>
        <label className={styles.field}>
          <span className={styles.label}>Familia</span>
          <select
            className={styles.input}
            value={familyId}
            onChange={(e) => onFamilyChange(e.target.value)}
          >
            {families.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
            {pendingFamilies.map((f) => (
              <option key={f.id} value={f.id} disabled>{f.name} (pendente)</option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Rosca</span>
          <input
            className={styles.input}
            type="text"
            inputMode="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar rosca... ex.: M10, M10 x 1,5, M12x1.25"
          />
        </label>
      </div>

      {selected && (
        <div className={styles.selectedRow}>
          <button
            type="button"
            className={styles.selectedChip}
            onClick={() => {}}
            title="Rosca selecionada"
          >
            {selected.designation}
          </button>
          <span className={styles.selectedHint}>
            {methodLabel(selected.method)} · passo {String(selected.pitch).replace('.', ',')} mm
          </span>
          <button type="button" className={styles.linkBtn} onClick={onClear}>
            Trocar rosca
          </button>
        </div>
      )}

      {!selected && query.trim() !== '' && (
        <div className={styles.matches}>
          {matches.length === 0 ? (
            <div className={styles.noMatch}>Rosca nao encontrada no banco.</div>
          ) : (
            <div className={styles.matchLabel}>
              {matches.length === 1 ? '1 opcao encontrada' : matches.length + ' opcoes encontradas'}
            </div>
          )}
          {matches.map((t) => (
            <button
              key={t.id}
              type="button"
              className={styles.matchBtn}
              onClick={() => onSelect(t)}
            >
              <span className={styles.matchName}>{t.designation}</span>
              <span className={styles.matchMeta}>
                {methodLabel(t.method)} · furo Ø{String(t.hole).replace('.', ',')} mm
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}