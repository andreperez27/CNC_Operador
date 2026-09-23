export function add(a, b) {
  return { x: a.x + b.x, z: a.z + b.z };
}

export function sub(a, b) {
  return { x: a.x - b.x, z: a.z - b.z };
}

export function scale(v, s) {
  return { x: v.x * s, z: v.z * s };
}

export function dot(a, b) {
  return a.x * b.x + a.z * b.z;
}

export function cross(a, b) {
  return a.x * b.z - a.z * b.x;
}

export function length(v) {
  return Math.sqrt(v.x * v.x + v.z * v.z);
}

export function normalize(v) {
  const l = length(v) || 1;
  return { x: v.x / l, z: v.z / l };
}

export function distance(a, b) {
  return length(sub(a, b));
}

export function rotate(v, angleRad) {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return { x: v.x * c - v.z * s, z: v.x * s + v.z * c };
}
