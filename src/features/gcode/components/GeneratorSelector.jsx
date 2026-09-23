import styles from './GeneratorSelector.module.css';
import { getGeneratorList } from '../registry/registry';

export default function GeneratorSelector({ value, onChange }) {
  const list = getGeneratorList();

  return (
    <div className="fg">
      <label className="fl">Selecionar Operacao</label>
      <select
        className="fs"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">— Selecionar operacao —</option>
        {list.map(g => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
    </div>
  );
}
