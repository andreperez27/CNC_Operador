import { useCopyToClipboard } from '../shared/hooks/useCopyToClipboard';
import styles from './CopyButton.module.css';

export default function CopyButton({ getText, label = 'COPIAR G-CODE' }) {
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = () => {
    const text = typeof getText === 'function' ? getText() : getText;
    copy(text);
  };

  return (
    <button
      className={`${styles.btn} ${styles.block}`}
      onClick={handleCopy}
      style={{ marginTop: 10 }}
    >
      {copied ? 'COPIADO!' : label}
    </button>
  );
}
