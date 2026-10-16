import { useRef, useCallback } from 'react';
import { downloadAsFile } from '../../../core/export/downloadProgram';
import { fileExtension } from '../../../core/postprocessors/heidenhain';
import { buildProgramName } from '../../../core/postprocessors/programName';
import styles from './ProgramDisplay.module.css';

export default function ProgramDisplay({ program, operationId, fileName = null, exportLocked = false, lockNote = null }) {
  const textRef = useRef(null);

  const handleCopy = useCallback(() => {
    if (!textRef.current) return;
    navigator.clipboard.writeText(textRef.current.textContent);
  }, []);

  const handleExport = useCallback(() => {
    if (!textRef.current) return;
    const baseName = fileName || buildProgramName(operationId);
    downloadAsFile(textRef.current.textContent, baseName, fileExtension);
  }, [operationId, fileName]);

  if (!program) {
    return (
      <div className={styles.panel}>
        <div className={styles.title}>Programa Heidenhain</div>
        <div className={styles.empty}>Preencha os parametros para gerar o programa</div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>Programa Heidenhain</div>
        <div className={styles.buttons}>
          <button className={styles.actionBtn} onClick={handleExport} disabled={exportLocked} title={exportLocked ? lockNote || 'Exportação bloqueada' : undefined}>Exportar .H</button>
          <button className={styles.actionBtn} onClick={handleCopy} disabled={exportLocked} title={exportLocked ? lockNote || 'Exportação bloqueada' : undefined}>Copiar</button>
        </div>
      </div>
      {exportLocked && lockNote && (
        <div role="alert" style={{ color: 'var(--red)', marginBottom: 8 }}>{lockNote}</div>
      )}
      <pre ref={textRef} className={styles.code}>{program}</pre>
    </div>
  );
}
