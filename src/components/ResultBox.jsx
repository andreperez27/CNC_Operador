import styles from './ResultBox.module.css';

export default function ResultBox({ children }) {
  return (
    <div className={styles.box}>
      {children}
    </div>
  );
}
