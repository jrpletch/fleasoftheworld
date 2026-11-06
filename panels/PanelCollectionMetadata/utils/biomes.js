// WWF terrestrial biomes (Dinerstein et al. 2017, RESOLVE Ecoregions 2017,
// CC BY 4.0), dissolved to 14 biomes and simplified in public/data/biomes.geojson
let biomesPromise

function ringBounds(ring) {
  let west = Infinity
  let east = -Infinity
  let south = Infinity
  let north = -Infinity
  for (const [x, y] of ring) {
    if (x < west) west = x
    if (x > east) east = x
    if (y < south) south = y
    if (y > north) north = y
  }
  return { west, east, south, north }
}

function inRing(ring, x, y) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function loadBiomes() {
  biomesPromise ||= fetch(`${import.meta.env.BASE_URL || '/'}data/biomes.geojson`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
    .then((geojson) =>
      geojson.features.map((feature) => {
        const { geometry, properties } = feature
        const polygons =
          geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
        return {
          name: properties.BIOME_NAME,
          polygons: polygons.map((rings) => ({
            rings,
            bounds: ringBounds(rings[0])
          }))
        }
      })
    )

  return biomesPromise
}

function contains(polygon, x, y) {
  const { bounds, rings } = polygon
  if (x < bounds.west || x > bounds.east || y < bounds.south || y > bounds.north) {
    return false
  }
  return inRing(rings[0], x, y) && !rings.slice(1).some((hole) => inRing(hole, x, y))
}

// Simplified coastlines can leave coastal points just outside every polygon,
// so fall back to the biome with the nearest vertex
function nearest(biomes, x, y) {
  let best = null
  let bestDistance = Infinity
  for (const biome of biomes) {
    for (const { rings } of biome.polygons) {
      for (const [px, py] of rings[0]) {
        const dx = (px - x) * Math.cos((y * Math.PI) / 180)
        const dy = py - y
        const d = dx * dx + dy * dy
        if (d < bestDistance) {
          bestDistance = d
          best = biome
        }
      }
    }
  }
  // About 3 degrees
  return bestDistance < 9 ? best : null
}

// Adds a `biome` name to each point that falls in (or just off) a biome
export async function assignBiomes(points) {
  if (!points.length) return []
  const biomes = await loadBiomes()
  const cache = new Map()

  return points
    .map((point) => {
      const key = `${point.lat.toFixed(2)},${point.lng.toFixed(2)}`
      if (!cache.has(key)) {
        const biome =
          biomes.find((b) => b.polygons.some((p) => contains(p, point.lng, point.lat))) ||
          nearest(biomes, point.lng, point.lat)
        cache.set(key, biome?.name || null)
      }
      return { ...point, biome: cache.get(key) }
    })
    .filter((p) => p.biome)
}
