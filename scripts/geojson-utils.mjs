export const polygons = geometry => geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

function ringArea(ring) {
  return Math.abs(ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2);
}

function insideRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
        point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function extent(geometry) {
  const bbox = [180, 90, -180, -90];
  for (const polygon of polygons(geometry)) for (const ring of polygon) for (const [x, y] of ring) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < -180 || x > 180 || y < -90 || y > 90) throw Error('Invalid coordinate');
    bbox[0] = Math.min(bbox[0], x); bbox[1] = Math.min(bbox[1], y);
    bbox[2] = Math.max(bbox[2], x); bbox[3] = Math.max(bbox[3], y);
  }
  return bbox;
}

// Put the label/selection point inside the largest polygon, including holes.
export function labelPoint(geometry) {
  const polygon = [...polygons(geometry)].sort((a, b) => ringArea(b[0]) - ringArea(a[0]))[0];
  const ring = polygon[0];
  const inside = p => insideRing(p, ring) && !polygon.slice(1).some(hole => insideRing(p, hole));
  let area = 0, x = 0, y = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const p = ring[i], q = ring[i + 1], cross = p[0] * q[1] - q[0] * p[1];
    area += cross; x += (p[0] + q[0]) * cross; y += (p[1] + q[1]) * cross;
  }
  const center = [x / (3 * area), y / (3 * area)];
  if (inside(center)) return center;
  const bbox = extent({type: 'Polygon', coordinates: polygon});
  let widest = 0, best;
  for (const fraction of [.5, .4, .6, .3, .7, .2, .8, .1, .9]) {
    const latitude = bbox[1] + (bbox[3] - bbox[1]) * fraction;
    const crossings = [];
    for (const r of polygon) for (let i = 0; i < r.length - 1; i++) {
      const a = r[i], b = r[i + 1];
      if ((a[1] > latitude) !== (b[1] > latitude)) crossings.push(a[0] + (latitude - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i < crossings.length - 1; i++) {
      const point = [(crossings[i] + crossings[i + 1]) / 2, latitude];
      const width = crossings[i + 1] - crossings[i];
      if (width > widest && inside(point)) {widest = width; best = point;}
    }
  }
  if (!best) throw Error('Could not find an interior label point');
  return best;
}
