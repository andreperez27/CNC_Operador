export function validateToolClearance(toolDiameter, availableSpace, margin) {
  const required = toolDiameter + margin;
  if (availableSpace < required) {
    return {
      valid: false,
      message: 'Ferramenta D' + toolDiameter.toFixed(1)
        + ' nao cabe no espaco ' + availableSpace.toFixed(1)
        + ' (necessario ' + required.toFixed(1) + ' com margem ' + margin.toFixed(1) + ')',
      toolDiameter,
      availableSpace,
      margin,
      required,
    };
  }
  return {
    valid: true,
    message: 'Ferramenta D' + toolDiameter.toFixed(1)
      + ' cabe no espaco ' + availableSpace.toFixed(1)
      + ' (folga ' + (availableSpace - required).toFixed(1) + ')',
    toolDiameter,
    availableSpace,
    margin,
    required,
  };
}
