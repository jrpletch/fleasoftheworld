import { normalizePlace } from '../../../pages/data/subdivisions.js'
import {
  prepareCountryMapData,
  prepareSubdivisionMapData
} from '../../../pages/data/mapWrapping.js'

const AREA_LABEL = /\bin (.+?) \[Geographic Area\]\s*$/
const REFINED_TYPES = ['AssertedDistribution', 'AssertedAbsent']

let indexPromise

function bboxCenter(geometry) {
  let south = Infinity
  let north = -Infinity
  let west = Infinity
  let east = -Infinity

  const walk = (c) => {
    if (typeof c[0] === 'number') {
      south = Math.min(south, c[1])
      north = Math.max(north, c[1])
      west = Math.min(west, c[0])
      east = Math.max(east, c[0])
    } else c.forEach(walk)
  }
  walk(geometry.coordinates)

  return [(west + east) / 2, (south + north) / 2]
}

function baseUrl() {
  return import.meta.env.BASE_URL || '/'
}

async function loadJson(file) {
  const response = await fetch(`${baseUrl()}data/${file}`)
  if (!response.ok) throw new Error(`Could not load ${file}`)
  return response.json()
}

// Local country and subdivision boundaries keyed by every normalized name variant
function loadIndex() {
  indexPromise ||= Promise.all([
    loadJson('countries.geojson'),
    loadJson('subdivisions.geojson')
  ]).then(([countries, subdivisions]) => {
    const index = new Map()
    const add = (name, feature) => {
      const key = normalizePlace(name)
      if (!key) return
      if (!index.has(key)) index.set(key, [])
      if (!index.get(key).includes(feature)) index.get(key).push(feature)
    }

    prepareCountryMapData(countries).features.forEach((f) =>
      add(f.properties.name, f)
    )
    prepareSubdivisionMapData(subdivisions).features.forEach((f) => {
      add(f.properties.name, f)
      ;(f.properties.aliases || []).forEach((alias) => add(alias, f))
    })

    return index
  })

  return indexPromise
}

function pickCandidate(candidates, original) {
  if (candidates.length === 1) return candidates[0]

  // Same name for different places (e.g. Georgia): choose the one nearest the original shape
  const [x, y] = bboxCenter(original)
  const distance = (f) => {
    const [cx, cy] = bboxCenter(f.checklistFocusGeometry || f.geometry)
    return Math.hypot(cx - x, cy - y)
  }
  return candidates.reduce((a, b) => (distance(b) < distance(a) ? b : a))
}

// Swaps asserted distribution geometry for the cleaned boundaries used on the
// checklists map. Shapes with no confident name match keep their original geometry.
export async function refineBoundaries(features) {
  let index
  try {
    index = await loadIndex()
  } catch {
    return features
  }

  return features.map((feature) => {
    const base = feature.properties?.base || []
    const item = base.find((b) => REFINED_TYPES.includes(b.type) && b.label)
    if (
      !item ||
      feature.properties.shape?.type !== 'GeographicArea' ||
      !feature.geometry
    )
      return feature

    const name = AREA_LABEL.exec(item.label)?.[1]
    const candidates = index.get(normalizePlace(name))
    if (!candidates?.length) return feature

    const match = pickCandidate(candidates, feature.geometry)

    return {
      ...feature,
      geometry: match.geometry,
      checklistFocusGeometry: match.checklistFocusGeometry
    }
  })
}
