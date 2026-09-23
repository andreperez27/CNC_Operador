import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <div>
        <div className={styles.logo}>CNC Operador</div>
        <div className={styles.sub}>HEIDENHAIN iTNC 530</div>
      </div>
      <div className={styles.badge}>OFFLINE</div>
    </header>
  );
}
