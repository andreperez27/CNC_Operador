import { add, scale, distance, length, normalize } from './vector2d';
import { distanceFromPoint, projectPoint, pointAt } from './line2d';

const TOLERANCE = 0.001;

export function tangentCenter(contactPoint, normal, radius) {
  return add(contactPoint, scale(normal, radius));
}

export function validateTangency(center, contactPoint, radius) {
  const d = distance(center, contactPoint);
  const diff = Math.abs(d - radius);
  const valid = diff < TOLERANCE;
  return {
    valid,
    distance: d,
    expected: radius,
    error: diff,
  };
}

export function tangentCenterAtOffset(line, normal, radius, coord, axis) {
  const t = projectPoint(line, coord);
  const contact = pointAt(line, t);
  return {
    contact,
    center: add(contact, scale(normal, radius)),
    parameter: t,
  };
}

export function circleCircleTangent(centerA, radiusA, offsetDistance, direction) {
  const dir = length(direction) === 0 ? { x: 1, z: 0 } : normalize(direction);
  const totalDist = radiusA + offsetDistance;
  return add(centerA, scale(dir, totalDist));
}
