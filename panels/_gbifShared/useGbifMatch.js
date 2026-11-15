import { ref, computed, watch } from 'vue'

export const CHECKLIST_KEY = '7ddf754f-d193-4cc9-b351-99906754a03b'
export const GBIF_TAXON_BASE = 'https://demo.gbif-staging.org/taxon'
export const GBIF_OCCURRENCE_BASE = 'https://demo.gbif-staging.org/occurrence/search'
export const GBIF_OCCURRENCE_DETAIL = 'https://demo.gbif-staging.org/occurrence'

const MATCH_ENDPOINT = 'https://api.gbif.org/v2/species/match'
const MIN_CONFIDENCE = 80
const ACCEPTED_MATCH_TYPES = ['EXACT', 'FUZZY', 'HIGHERRANK']

const cache = new Map()

function isConfidentMatch(data) {
  const matchType = data?.diagnostics?.matchType
  const confidence = data?.diagnostics?.confidence ?? 0

  return (
    !!data?.usage?.key &&
    ACCEPTED_MATCH_TYPES.includes(matchType) &&
    confidence >= MIN_CONFIDENCE
  )
}

async function fetchMatch(name) {
  const url = new URL(MATCH_ENDPOINT)
  url.searchParams.set('scientificName', name)
  url.searchParams.set('verbose', 'true')
  url.searchParams.set('checklistKey', CHECKLIST_KEY)
  const requestUrl = url.toString()

  try {
    const res = await fetch(requestUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    return {
      match: isConfidentMatch(data) ? data : null,
      error: false,
      raw: data,
      url: requestUrl
    }
  } catch (e) {
    return { match: null, error: true, raw: null, url: requestUrl }
  }
}

function getOrFetch(name) {
  if (!cache.has(name)) {
    cache.set(name, fetchMatch(name))
  }
  return cache.get(name)
}

export function useGbifMatch(scientificName, expectedRank) {
  const loading = ref(false)
  const error = ref(false)
  const match = ref(null)
  const rawMatch = ref(null)
  const matchUrl = ref(null)

  watch(
    () => scientificName.value,
    async (name) => {
      if (!name) {
        match.value = null
        rawMatch.value = null
        matchUrl.value = null
        error.value = false
        loading.value = false
        return
      }

      loading.value = true
      error.value = false
      const result = await getOrFetch(name)

      if (scientificName.value !== name) return

      match.value = result.match
      rawMatch.value = result.raw
      matchUrl.value = result.url
      error.value = result.error
      loading.value = false
    },
    { immediate: true }
  )

  const isSynonym = computed(
    () =>
      !!(match.value?.usage?.status === 'SYNONYM' && match.value.acceptedUsage)
  )

  const targetUsage = computed(() =>
    isSynonym.value ? match.value.acceptedUsage : match.value?.usage
  )

  const normalizedExpectedRank = computed(() =>
    rankName(typeof expectedRank === 'function' ? expectedRank() : expectedRank?.value ?? expectedRank)
  )
  const isHigherRankMatch = computed(() => {
    const matchedRank = rankName(targetUsage.value?.rank)
    const pageRank = normalizedExpectedRank.value
    return (
      RANK_ORDER[matchedRank] !== undefined &&
      RANK_ORDER[pageRank] !== undefined &&
      RANK_ORDER[matchedRank] < RANK_ORDER[pageRank]
    )
  })
  const gbifKey = computed(() =>
    isHigherRankMatch.value ? null : targetUsage.value?.key
  )

  const classification = computed(() => match.value?.classification || [])

  return {
    loading,
    error,
    match,
    rawMatch,
    matchUrl,
    isSynonym,
    targetUsage,
    gbifKey,
    classification
  }
}

export function recordRequest(store, panelKey, { url, data }) {
  if (!url) return
  store.setRequest(panelKey, {
    data,
    request: { responseURL: url }
  })
}

export const GBIF_TECHDOCS_URL = 'https://techdocs.gbif.org/en/'

export const gbifMenuOptions = [
  {
    label: 'GBIF tech docs',
    action: () => window.open(GBIF_TECHDOCS_URL, '_blank', 'noopener')
  }
]

// "Genus (Subgenus) epithet epithet Author" where both epithets match
const NOMINATE_SUBSPECIES = /^([A-Z][a-z-]+)(?:\s+\([^)]*\))?\s+([a-z-]+)\s+\2\b/
const RANK_ORDER = {
  KINGDOM: 1,
  PHYLUM: 2,
  CLASS: 3,
  ORDER: 4,
  FAMILY: 5,
  SUBFAMILY: 6,
  TRIBE: 7,
  GENUS: 8,
  SUBGENUS: 9,
  SPECIES: 10,
  SUBSPECIES: 11,
  VARIETY: 12,
  FORM: 13
}

const rankName = (rank) => String(rank || '').split('::').at(-1).trim().toUpperCase()

// Our nominate subspecies stand in for their species, so GBIF records of the
// species are matched to them (GBIF holds those records at species level).
export function deriveScientificName(taxon, otu) {
  const name = taxon?.full_name || taxon?.name || otu?.object_label || ''
  const nominate = name.match(NOMINATE_SUBSPECIES)

  return nominate ? `${nominate[1]} ${nominate[2]}` : name
}

export function deriveTaxonRank(taxon, otu) {
  const name = taxon?.full_name || taxon?.name || otu?.object_label || ''
  if (name.match(NOMINATE_SUBSPECIES)) return 'SPECIES'
  return rankName(taxon?.rank_string || taxon?.rank)
}
