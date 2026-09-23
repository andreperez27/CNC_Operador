import styles from './Card.module.css';

export default function Card({ title, info, children, className = '' }) {
  return (
    <div className={`${styles.card} ${className}`}>
      {title && <div className={styles.title}>{title}</div>}
      {info && <div className={styles.info}>{info}</div>}
      {children}
    </div>
  );
}
