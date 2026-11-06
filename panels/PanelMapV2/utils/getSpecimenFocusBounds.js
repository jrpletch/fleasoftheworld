const FOCUS_TYPES = [
  'TypeMaterial',
  'CollectionObject',
  'FieldOccurrence',
  'Georeference',
  'AssertedDistribution'
]
const MIN_SAMPLES = 5
const TRIM = 0.03

function percentile(sorted, p) {
  const i = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round(p * (sorted.length - 1)))
  )
  return sorted[i]
}

function ringBounds(ring) {
  let south = Infinity
  let north = -Infinity
  let west = Infinity
  let east = -Infinity

  ring.forEach(([lng, lat]) => {
    south = Math.min(south, lat)
    north = Math.max(north, lat)
    west = Math.min(west, lng)
    east = Math.max(east, lng)
  })

  return [
    [west, south],
    [east, north]
  ]
}

// Points contribute their position; each polygon contributes its bounding-box
// corners, so shapes split by the antimeridian are measured piece by piece.
function sampleGeometry(geometry) {
  if (!geometry?.coordinates) return []
  if (geometry.type === 'Point') return [geometry.coordinates]

  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates

  return polygons.flatMap((polygon) =>
    polygon[0]?.length ? ringBounds(polygon[0]) : []
  )
}

// Longitudes are circular: rotate the list to start after the largest empty
// gap, so a range across 180° becomes one window (e.g. 155 to 230) instead of
// the whole world. Returns null when that window cannot be drawn.
function unwrapLongitudes(samples) {
  const sorted = samples
    .map((s) => ({ ...s, lng: ((((s.lng + 180) % 360) + 360) % 360) - 180 }))
    .sort((a, b) => a.lng - b.lng)

  let gap = -1
  let start = 0
  sorted.forEach((s, i) => {
    const next = sorted[(i + 1) % sorted.length]
    const size = next.lng - s.lng + (i === sorted.length - 1 ? 360 : 0)
    if (size > gap) {
      gap = size
      start = (i + 1) % sorted.length
    }
  })

  const rotated = [...sorted.slice(start), ...sorted.slice(0, start)]
  const origin = rotated[0].lng
  // Only boundaries with repeated world copies exist beyond 180°. Shift the
  // western part east, or failing that the eastern part west.
  const east = rotated.map((s) =>
    s.lng < origin ? { ...s, lng: s.lng + 360 } : s
  )
  if (east.every((s, i) => s.lng === rotated[i].lng || s.wrapped)) return east

  const west = rotated.map((s) =>
    s.lng >= origin ? { ...s, lng: s.lng - 360 } : s
  )
  return west.every((s, i) => s.lng === rotated[i].lng || s.wrapped)
    ? west
    : null
}

// Bounds covering the central bulk of specimen points and asserted
// distributions, ignoring outliers. Returns [[south, west], [north, east]]
// (east may exceed 180 for ranges crossing the antimeridian) or null when
// there is too little data.
export function getSpecimenFocusBounds(
  geojson,
  { trim = TRIM, minSamples = MIN_SAMPLES } = {}
) {
  const samples = []

  ;(geojson?.features || []).forEach((f) => {
    const base = f.properties?.base || []
    if (!base.some((b) => FOCUS_TYPES.includes(b.type) && !b.is_absent)) return

    const wrapped = !!f.checklistFocusGeometry
    sampleGeometry(f.checklistFocusGeometry || f.geometry).forEach(
      ([lng, lat]) => samples.push({ lng, lat, wrapped })
    )
  })

  if (samples.length < minSamples) return null

  const ordered =
    unwrapLongitudes(samples) || samples.toSorted((a, b) => a.lng - b.lng)
  const lngs = ordered.map((s) => s.lng)
  const lats = samples.map((s) => s.lat).sort((a, b) => a - b)

  return [
    [percentile(lats, trim), percentile(lngs, trim)],
    [percentile(lats, 1 - trim), percentile(lngs, 1 - trim)]
  ]
}
