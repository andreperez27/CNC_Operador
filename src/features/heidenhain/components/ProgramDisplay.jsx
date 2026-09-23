import { useRef, useCallback } from 'react';
import { downloadAsFile } from '../../../core/export/downloadProgram';
import { fileExtension } from '../../../core/postprocessors/heidenhain';
import { buildProgramName } from '../../../core/postprocessors/programName';
import styles from './ProgramDisplay.module.css';

export default function ProgramDisplay({ program, operationId }) {
  const textRef = useRef(null);

  const handleCopy = useCallback(() => {
    if (!textRef.current) return;
    navigator.clipboard.writeText(textRef.current.textContent);
  }, []);

  const handleExport = useCallback(() => {
    if (!textRef.current) return;
    const baseName = buildProgramName(operationId);
    downloadAsFile(textRef.current.textContent, baseName, fileExtension);
  }, [operationId]);

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
          <button className={styles.actionBtn} onClick={handleExport}>Exportar .H</button>
          <button className={styles.actionBtn} onClick={handleCopy}>Copiar</button>
        </div>
      </div>
      <pre ref={textRef} className={styles.code}>{program}</pre>
    </div>
  );
}
