import { getGenerator } from '../../registry/registry';
import ChamferEdgePreview from '../../preview/ChamferEdgePreview';
import RoundingEdgePreview from '../../preview/RoundingEdgePreview';
import InternalChamferPreview from '../../preview/InternalChamferPreview';
import InternalRadiusPreview from '../../preview/InternalRadiusPreview';
import RadiusPreview from '../../preview/RadiusPreview';
import styles from '../../preview/preview.module.css';

const PREVIEW_MAP = {
  chanfro_aresta_reta_torica: ChamferEdgePreview,
  arredondamento_aresta_reta_torica: RoundingEdgePreview,
  raio_aresta_reta_torica: RadiusPreview,
};

const INTERNAL_PREVIEW_MAP = {
  chanfro_aresta_reta_torica: InternalChamferPreview,
  arredondamento_aresta_reta_torica: InternalRadiusPreview,
  raio_aresta_reta_torica: InternalRadiusPreview,
};

export default function GcodePreviewPanel({ generatorId, params, solved, activeParamId }) {
  const gen = getGenerator(generatorId);
  if (!gen || !params) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>Pré-visualização</div>
        <div className={styles.placeholder}>
          Selecione uma operação e ajuste os parâmetros
        </div>
      </div>
    );
  }

  const isInternalRadius = generatorId === 'raio_aresta_reta_torica' && params.tipo === 'internal';
  const previewKind = isInternalRadius ? 'internal' : (gen.previewKind || 'external');
  const PreviewComponent = previewKind === 'internal'
    ? INTERNAL_PREVIEW_MAP[generatorId]
    : PREVIEW_MAP[generatorId];
  if (!PreviewComponent) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>Pré-visualização</div>
        <div className={styles.placeholder}>
          Preview não disponível para este gerador
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Pré-visualização</div>
      <PreviewComponent
        params={params}
        solved={solved}
        activeParamId={activeParamId}
        highlight={activeParamId}
      />
      {activeParamId && (
        <div className={styles.legend}>
          {gen.params.find(p => p.id === activeParamId)?.label || activeParamId}
        </div>
      )}
    </div>
  );
}
