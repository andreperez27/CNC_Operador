import { sub, add, dot, length } from './vector2d';

export function fromPoints(p1, p2) {
  const dir = sub(p2, p1);
  const d = length(dir);
  return {
    point: p1,
    direction: d === 0 ? { x: 0, z: 0 } : { x: dir.x / d, z: dir.z / d },
    length: d,
  };
}

export function fromPointDirection(point, direction) {
  const d = length(direction);
  return {
    point,
    direction: d === 0 ? { x: 0, z: 0 } : { x: direction.x / d, z: direction.z / d },
  };
}

export function footOfPerpendicular(line, pt) {
  const v = sub(pt, line.point);
  const t = dot(v, line.direction);
  return add(line.point, { x: line.direction.x * t, z: line.direction.z * t });
}

export function distanceFromPoint(line, pt) {
  return length(sub(pt, footOfPerpendicular(line, pt)));
}

export function pointAt(line, t) {
  return add(line.point, { x: line.direction.x * t, z: line.direction.z * t });
}

export function projectPoint(line, pt) {
  const v = sub(pt, line.point);
  return dot(v, line.direction);
}
