import { ref, computed, watch } from 'vue'
import { makeAPIRequest } from '@/utils'
import {
  useGbifMatch,
  deriveScientificName,
  CHECKLIST_KEY
} from '../../_gbifShared/useGbifMatch'
import { assignBiomes } from '../utils/biomes.js'

const GBIF_SEARCH = 'https://api.gbif.org/v1/occurrence/search'
const BAND_SIZE = 500
const BAND_COUNT = 13 // 0-500 m ... 6000+ m
const SAMPLE_PAGES = 5
const SAMPLE_PAGE_SIZE = 200
const ELEVATION_API = 'https://api.open-meteo.com/v1/elevation'
const ELEVATION_BATCH = 100

const emptyMonths = () => Array(12).fill(0)

export function bandLabel(i) {
  const lo = i * BAND_SIZE
  return i === BAND_COUNT - 1 ? `${lo}+` : `${lo}–${lo + BAND_SIZE}`
}

function toNumber(value) {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : null
}

function normalizeTaxonWorks(record) {
  const min = toNumber(record.minimumElevationInMeters)
  const max = toNumber(record.maximumElevationInMeters)
  const month = toNumber(record.month)
  const elevation = min != null && max != null ? (min + max) / 2 : (min ?? max)

  const lat = toNumber(record.decimalLatitude)
  const lng = toNumber(record.decimalLongitude)

  return {
    month: month >= 1 && month <= 12 ? month : null,
    year: toNumber(record.year),
    country: record.country || null,
    institution: record.institutionCode || null,
    elevation,
    lat,
    lng
  }
}

async function gbifQuery(gbifKey, { params = {}, facets = [] }) {
  const search = new URLSearchParams({
    checklistKey: CHECKLIST_KEY,
    taxonKey: gbifKey,
    basisOfRecord: 'PRESERVED_SPECIMEN',
    limit: 0,
    ...params
  })
  facets.forEach((f) => search.append('facet', f))

  const res = await fetch(`${GBIF_SEARCH}?${search}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function facetCounts(data, field) {
  return (
    data.facets
      ?.find((f) => f.field === field)
      ?.counts.map((c) => [c.name, c.count]) || []
  )
}

async function fetchGbif(gbifKey) {
  // One request per elevation band, each faceted by month
  const bandQueries = Array.from({ length: BAND_COUNT }, (_, i) => {
    const lo = i * BAND_SIZE
    const hi = i === BAND_COUNT - 1 ? 10000 : lo + BAND_SIZE - 0.01
    return gbifQuery(gbifKey, {
      params: { elevation: `${lo},${hi}`, facetLimit: 12 },
      facets: ['MONTH']
    })
  })

  const [overall, ...bandResults] = await Promise.all([
    gbifQuery(gbifKey, {
      params: { facetLimit: 400 },
      facets: ['MONTH', 'YEAR', 'COUNTRY', 'INSTITUTION_CODE']
    }),
    ...bandQueries
  ])

  const months = emptyMonths()
  facetCounts(overall, 'MONTH').forEach(([m, c]) => (months[m - 1] = c))

  const years = new Map(
    facetCounts(overall, 'YEAR').map(([y, c]) => [Number(y), c])
  )

  const names = new Intl.DisplayNames(['en'], { type: 'region' })
  const countries = new Map()
  facetCounts(overall, 'COUNTRY').forEach(([code, c]) => {
    let name = code
    try {
      name = names.of(code)
    } catch {
      // keep the raw code
    }
    countries.set(name, (countries.get(name) || 0) + c)
  })

  const bands = bandResults.map((data) => {
    const bandMonths = emptyMonths()
    facetCounts(data, 'MONTH').forEach(([m, c]) => (bandMonths[m - 1] = c))
    const dated = bandMonths.reduce((a, b) => a + b, 0)
    return { months: bandMonths, undated: Math.max(0, data.count - dated) }
  })

  return {
    total: overall.count,
    months,
    years,
    countries,
    institutions: new Map(facetCounts(overall, 'INSTITUTION_CODE')),
    bands
  }
}

// GBIF records with coordinates, sampled at evenly spaced offsets. Used for the
// rough elevation and biome estimates, which extrapolate from the sample.
async function fetchGbifCoordinateSample(gbifKey) {
  const base = { hasCoordinate: true, hasGeospatialIssue: false }
  const [withCoords, withElevation] = await Promise.all([
    gbifQuery(gbifKey, { params: base }),
    gbifQuery(gbifKey, { params: { ...base, elevation: '-500,10000' } })
  ])

  const lacking = withCoords.count - withElevation.count
  if (withCoords.count <= 0) return { total: 0, lacking: 0, records: [] }

  const pages = Math.min(SAMPLE_PAGES, Math.ceil(withCoords.count / SAMPLE_PAGE_SIZE))
  const stride = Math.max(SAMPLE_PAGE_SIZE, Math.floor(withCoords.count / pages))

  const responses = await Promise.all(
    Array.from({ length: pages }, async (_, i) => {
      const search = new URLSearchParams({
        checklistKey: CHECKLIST_KEY,
        taxonKey: gbifKey,
        basisOfRecord: 'PRESERVED_SPECIMEN',
        hasCoordinate: true,
        hasGeospatialIssue: false,
        limit: SAMPLE_PAGE_SIZE,
        offset: Math.min(i * stride, Math.max(0, withCoords.count - SAMPLE_PAGE_SIZE))
      })
      const res = await fetch(`${GBIF_SEARCH}?${search}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()).results
    })
  )

  const records = responses
    .flat()
    .filter((r) => r.decimalLatitude != null && r.decimalLongitude != null)
    .map((r) => ({
      lat: r.decimalLatitude,
      lng: r.decimalLongitude,
      month: r.month >= 1 && r.month <= 12 ? r.month : null,
      hasElevation: r.elevation != null
    }))

  return { total: withCoords.count, lacking, records }
}

// Each sampled record without an elevation is weighted up to the number of
// records that lack one
function elevationSample({ lacking, records }) {
  const sample = records.filter((r) => !r.hasElevation)
  if (lacking <= 0 || !sample.length) return []
  return sample.map((r) => ({ ...r, weight: lacking / sample.length }))
}

// Each sampled record stands in for total / sample size records
function biomeSample({ total, records }) {
  if (!records.length) return []
  return records.map((r) => ({ ...r, weight: total / records.length }))
}

const coordKey = ({ lat, lng }) => `${lat.toFixed(2)},${lng.toFixed(2)}`

async function lookupElevations(points) {
  const unique = [...new Map(points.map((p) => [coordKey(p), p])).values()]
  const elevations = new Map()

  for (let i = 0; i < unique.length; i += ELEVATION_BATCH) {
    const batch = unique.slice(i, i + ELEVATION_BATCH)
    const url = new URL(ELEVATION_API)
    url.searchParams.set('latitude', batch.map((p) => p.lat.toFixed(2)).join(','))
    url.searchParams.set('longitude', batch.map((p) => p.lng.toFixed(2)).join(','))

    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { elevation } = await res.json()
    batch.forEach((p, j) => elevations.set(coordKey(p), elevation[j]))
  }

  return points
    .map((p) => ({ ...p, elevation: elevations.get(coordKey(p)) }))
    .filter((p) => Number.isFinite(p.elevation))
}

export function useSpecimenSummary({ otuId, taxon, otu }) {
  const scientificName = computed(() => deriveScientificName(taxon, otu))
  const { gbifKey, loading: matching } = useGbifMatch(scientificName)

  const loadingTaxonWorks = ref(true)
  const loadingGbif = ref(false)
  const taxonWorks = ref([])
  const gbif = ref(null)
  const gbifError = ref(false)
  const estimating = ref(false)
  const gbifPoints = ref([])
  const estimatedTaxonWorks = ref([])
  const biomeRecords = ref([])
  const loadingBiomes = ref(false)

  makeAPIRequest
    .get(`/otus/${otuId}/inventory/dwc.json`)
    .then((response) => {
      taxonWorks.value = response.data
        .filter((r) => r.dwc_occurrence_object_type === 'CollectionObject')
        .map(normalizeTaxonWorks)
    })
    .catch(() => {})
    .finally(() => (loadingTaxonWorks.value = false))

  // Estimates arrive after the main data so the other charts aren't held up
  async function estimateElevations(key, coordinates) {
    estimating.value = true
    try {
      const twPoints = taxonWorks.value
        .filter((r) => r.elevation == null && r.lat != null)
        .map((r) => ({ lat: r.lat, lng: r.lng, month: r.month, weight: 1 }))
      const [tw, gb] = await Promise.all([
        lookupElevations(twPoints),
        lookupElevations(elevationSample(coordinates))
      ])
      if (key === gbifKey.value || !key) {
        estimatedTaxonWorks.value = tw
        gbifPoints.value = gb
      }
    } catch {
      // estimates are optional
    } finally {
      estimating.value = false
    }
  }

  async function classifyBiomes(key, coordinates) {
    loadingBiomes.value = true
    try {
      const tw = taxonWorks.value
        .filter((r) => r.lat != null && r.lng != null)
        .map((r) => ({ lat: r.lat, lng: r.lng, month: r.month, weight: 1 }))
      const gb = coordinates ? biomeSample(coordinates) : []

      const classify = async (points, source) =>
        (await assignBiomes(points)).map((p) => ({ ...p, source }))
      const [twBiomes, gbBiomes] = await Promise.all([
        classify(tw, 'tw'),
        classify(gb, 'gbif')
      ])
      if (key === gbifKey.value || !key) {
        biomeRecords.value = [...twBiomes, ...gbBiomes]
      }
    } catch {
      // biomes are optional
    } finally {
      loadingBiomes.value = false
    }
  }

  async function estimateFromCoordinates(key) {
    let coordinates = null
    try {
      if (key) coordinates = await fetchGbifCoordinateSample(key)
    } catch {
      // GBIF sample is optional
    }
    await Promise.all([
      estimateElevations(key, coordinates || { total: 0, lacking: 0, records: [] }),
      classifyBiomes(key, coordinates)
    ])
  }

  watch(
    gbifKey,
    async (key) => {
      gbif.value = null
      gbifError.value = false
      gbifPoints.value = []
      if (!key) return

      loadingGbif.value = true
      try {
        const result = await fetchGbif(key)
        if (gbifKey.value === key) gbif.value = result
      } catch {
        gbifError.value = true
      } finally {
        loadingGbif.value = false
      }
    },
    { immediate: true }
  )

  const loading = computed(
    () => loadingTaxonWorks.value || loadingGbif.value || matching.value
  )

  // Runs once everything it depends on has loaded
  watch(
    loading,
    (isLoading) => {
      if (!isLoading) estimateFromCoordinates(gbifKey.value)
    },
    { immediate: true }
  )

  const months = computed(() => {
    const tw = emptyMonths()
    taxonWorks.value.forEach((r) => r.month && tw[r.month - 1]++)
    return { tw, gbif: gbif.value?.months || emptyMonths() }
  })

  const years = computed(() => {
    const tw = new Map()
    taxonWorks.value.forEach((r) => {
      if (r.year) tw.set(r.year, (tw.get(r.year) || 0) + 1)
    })
    return { tw, gbif: gbif.value?.years || new Map() }
  })

  const countries = computed(() => {
    const merged = new Map()
    const add = (name, key, n) => {
      const row = merged.get(name) || { name, tw: 0, gbif: 0 }
      row[key] += n
      merged.set(name, row)
    }
    taxonWorks.value.forEach((r) => r.country && add(r.country, 'tw', 1))
    gbif.value?.countries.forEach((n, name) => add(name, 'gbif', n))

    return [...merged.values()].sort((a, b) => b.tw + b.gbif - (a.tw + a.gbif))
  })

  // Institution codes differ in case between sources (e.g. "USNM" vs "usnm")
  const institutions = computed(() => {
    const merged = new Map()
    const add = (code, key, n) => {
      const name = code.trim().toUpperCase()
      const row = merged.get(name) || { name, tw: 0, gbif: 0 }
      row[key] += n
      merged.set(name, row)
    }
    taxonWorks.value.forEach((r) => r.institution && add(r.institution, 'tw', 1))
    gbif.value?.institutions.forEach((n, code) => add(code, 'gbif', n))

    return [...merged.values()].sort((a, b) => b.tw + b.gbif - (a.tw + a.gbif))
  })

  // Month counts per 500 m elevation band, TaxonWorks + GBIF combined
  const elevationBands = computed(() => {
    const rows = Array.from({ length: BAND_COUNT }, (_, i) => ({
      index: i,
      label: bandLabel(i),
      months: emptyMonths(),
      estimated: emptyMonths(),
      // Records without a collection month count only toward "All months"
      undated: 0,
      estimatedUndated: 0
    }))

    const bandOf = (elevation) =>
      Math.min(BAND_COUNT - 1, Math.floor(Math.max(0, elevation) / BAND_SIZE))

    taxonWorks.value.forEach((r) => {
      if (r.elevation == null || r.elevation < 0) return
      const row = rows[bandOf(r.elevation)]
      if (r.month) row.months[r.month - 1]++
      else row.undated++
    })

    gbif.value?.bands.forEach(({ months, undated }, i) => {
      months.forEach((c, m) => (rows[i].months[m] += c))
      rows[i].undated += undated
    })

    ;[...estimatedTaxonWorks.value, ...gbifPoints.value].forEach((p) => {
      const row = rows[bandOf(p.elevation)]
      if (p.month) row.estimated[p.month - 1] += p.weight
      else row.estimatedUndated += p.weight
    })

    return rows.map((row) => ({
      ...row,
      total: row.months.reduce((a, b) => a + b, 0) + row.undated,
      estimatedTotal:
        row.estimated.reduce((a, b) => a + b, 0) + row.estimatedUndated
    }))
  })

  const totals = computed(() => ({
    tw: taxonWorks.value.length,
    gbif: gbif.value?.total || 0
  }))

  return {
    loading,
    gbifError,
    hasGbif: computed(() => !!gbifKey.value),
    totals,
    months,
    years,
    countries,
    institutions,
    elevationBands,
    estimating,
    biomeRecords,
    loadingBiomes
  }
}
