export function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

export function cot(angleRad) {
  return Math.cos(angleRad) / Math.sin(angleRad);
}

export function normalFromAngle(angleRad) {
  return { x: Math.sin(angleRad), z: -Math.cos(angleRad) };
}

export function tangentFromAngle(angleRad) {
  return { x: Math.cos(angleRad), z: Math.sin(angleRad) };
}
