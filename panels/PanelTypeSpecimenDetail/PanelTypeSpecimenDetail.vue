<template>
  <VCard v-if="isLoading || specimens.length || legacyLabels.length">
    <VSpinner
      v-if="isLoading"
      logo-class="w-8 h-8"
      legend=""
    />
    <VCardHeader class="flex items-center justify-between gap-2">
      <h2 class="text-md">
        Type specimens<template v-if="specimens.length || legacyLabels.length">
          ({{ specimens.length || legacyLabels.length }})</template
        >
      </h2>
      <div
        v-if="specimens.length > 1"
        class="flex items-center gap-1 text-sm"
      >
        <button
          type="button"
          class="rounded px-2 py-0.5 hover:bg-base-muted"
          aria-label="Previous specimen"
          @click="step(-1)"
        >
          ‹
        </button>
        <span aria-live="polite">{{ specimenIndex + 1 }} / {{ specimens.length }}</span>
        <button
          type="button"
          class="rounded px-2 py-0.5 hover:bg-base-muted"
          aria-label="Next specimen"
          @click="step(1)"
        >
          ›
        </button>
      </div>
    </VCardHeader>
    <ul
      class="max-h-[32rem] overflow-y-auto text-sm"
      aria-label="Type specimens"
    >
      <li
        v-for="specimen in visibleSpecimens"
        :key="specimen.id"
        class="space-y-2 px-5 py-3"
      >
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p
            v-if="specimen.name"
            class="mr-2 text-base"
            data-testid="specimen-name"
          >
            <span class="text-base-content/60"
              >{{ specimen.name.label }}:</span
            >&#32;<span v-html="sanitizeAndLinkifyHtml(specimen.name.html)" />
          </p>
          <VBadge
            v-for="type in specimen.types"
            :key="type.label"
            color="blue"
            shape="pill"
            size="sm"
            weight="normal"
            class="mr-1"
            :title="type.taxon ? `of ${type.taxon}` : undefined"
            >{{ type.label }}</VBadge
          >
          <VBadge
            v-for="badge in specimen.badges"
            :key="badge"
            color="yellow"
            shape="pill"
            size="sm"
            weight="normal"
            class="mr-1"
            >{{ badge }}</VBadge
          >
        </div>
        <dl class="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1">
          <template
            v-for="row in specimen.rows"
            :key="row.label"
          >
            <dt class="text-base-content/60">{{ row.label }}</dt>
            <dd>
              <a
                v-if="row.href"
                :href="row.href"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline"
                >{{ row.value }}</a
              >
              <RouterLink
                v-else-if="row.otuId"
                :to="{ name: 'otus-id', params: { id: row.otuId } }"
                class="text-primary hover:underline"
                v-html="sanitizeAndLinkifyHtml(row.html)"
              />
              <span
                v-else-if="row.html"
                v-html="sanitizeAndLinkifyHtml(row.html)"
              />
              <span v-else>{{ row.value }}</span>
              <span
                v-if="row.suffix"
                class="ml-1 text-base-content/60"
                >({{ row.suffix }})</span
              >
            </dd>
          </template>
        </dl>
      </li>
      <li
        v-for="(label, index) in legacyLabels"
        :key="`legacy-${index}`"
        class="px-5 py-3"
      >
        {{ label }}
      </li>
    </ul>
  </VCard>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { makeAPIRequest, sanitizeAndLinkifyHtml } from '@/utils'
import { useOtuStore } from '@/modules/otus/store/store'
import { SPECIMEN_TYPES } from '@/modules/otus/constants'
import { useOtuPageRequest } from '@/modules/otus/helpers/useOtuPageRequest'
import TaxonWorks from '@/modules/otus/services/TaxonWorks'

const props = defineProps({
  otuId: {
    type: [String, Number],
    required: true
  },
  taxonId: {
    type: [String, Number],
    default: undefined
  }
})

const MAX_SPECIMENS = 100
const GNFINDER_URL = 'https://finder.globalnames.org/api/v1/find'

const store = useOtuStore()
const isLoading = ref(false)
const specimens = ref([])
const legacyLabels = ref([])
const specimenIndex = ref(0)

const visibleSpecimens = computed(() =>
  specimens.value[specimenIndex.value] ? [specimens.value[specimenIndex.value]] : []
)

function step(direction) {
  const total = specimens.value.length
  specimenIndex.value = (specimenIndex.value + direction + total) % total
}
const taxonNameId = computed(() => props.taxonId || store.otu?.taxon_name_id)

function typeOrder(type) {
  const index = SPECIMEN_TYPES.indexOf(type?.name)
  return index === -1 ? SPECIMEN_TYPES.length : index
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

// Coordinates are often typed with "d" for the degree sign, e.g. 37d06'N.
function degreeSigns(text) {
  return text?.replace(/(\d)\s?d(?=\s?\d|\s*['′"″]|\s*[NSEW]\b)/g, '$1°')
}

// DwC typeStatus is "<type> of <name>", with several entries separated by " | ".
function typeStatuses(typeStatus) {
  return String(typeStatus || '')
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, ...rest] = entry.split(/\s+of\s+/)
      return { name: name.toLowerCase(), label: capitalize(name), taxon: rest.join(' of ') }
    })
    .sort((a, b) => typeOrder(a) - typeOrder(b))
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Capitalized genus followed by one or two lowercase epithets, e.g. "Ochotona schisticeps albatrus".
// Words that commonly follow a capitalized place word are skipped to avoid italicizing locality text.
const NOT_EPITHETS = new Set([
  'from', 'near', 'along', 'above', 'below', 'east', 'west', 'north', 'south', 'side', 'creek',
  'lake', 'lakes', 'river', 'road', 'trail', 'camp', 'mountain', 'mountains', 'valley', 'pass',
  'and', 'the', 'with', 'about', 'between', 'around', 'collected', 'ft', 'miles', 'mile', 'days'
])
const SCIENTIFIC_NAME = /\b([A-Z][a-z]{2,})((?:\s[a-z]{3,}){1,2})\b/g

function italicizeScientificNames(text) {
  return escapeHtml(text || '').replace(SCIENTIFIC_NAME, (match, genus, epithets) => {
    const words = epithets.trim().split(/\s+/)
    if (NOT_EPITHETS.has(words[0])) return match
    const kept = []
    for (const word of words) {
      if (NOT_EPITHETS.has(word)) break
      kept.push(word)
    }
    const name = `${genus} ${kept.join(' ')}`
    return `<i>${name}</i>${match.slice(name.length)}`
  })
}

// gnfinder returns character offsets (not UTF-16 units), so the text is split into code points.
function italicizeFoundNames(text, names) {
  const chars = Array.from(text)
  let html = ''
  let cursor = 0

  for (const { start, end } of [...names].sort((a, b) => a.start - b.start)) {
    if (start < cursor || end > chars.length) continue
    html += escapeHtml(chars.slice(cursor, start).join(''))
    html += `<i>${escapeHtml(chars.slice(start, end).join(''))}</i>`
    cursor = end
  }

  return html + escapeHtml(chars.slice(cursor).join(''))
}

// Global Names finder; on any failure the pattern-based italics above are used instead.
async function findScientificNames(text) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(GNFINDER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, verification: false, language: 'eng' }),
      signal: controller.signal
    })
    if (!response.ok) return null

    const { names } = await response.json()
    return (names || []).map(({ start, end }) => ({ start, end }))
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function labelHtml(label, names) {
  return names ? italicizeFoundNames(label, names) : italicizeScientificNames(label)
}

function elevationText(dwc) {
  if (dwc.verbatimElevation) return dwc.verbatimElevation
  const min = dwc.minimumElevationInMeters
  const max = dwc.maximumElevationInMeters
  if (!min && !max) return ''
  return `${[min, max].filter(Boolean).join('–')} m`
}

function buildSpecimen(id, dwc, host, labelNames, name, citations) {
  const rows = []
  const add = (label, value, extra = {}) => value && rows.push({ label, value, ...extra })

  add('Repository', dwc.institutionCode, {
    href: /^https?:\/\//.test(dwc.institutionID || '') ? dwc.institutionID : undefined
  })
  add('Catalog no.', dwc.catalogNumber)
  if (dwc.verbatimLabel) {
    const label = degreeSigns(dwc.verbatimLabel)
    rows.push({ label: 'Verbatim label', value: label, html: labelHtml(label, labelNames) })
  }
  add('Locality', degreeSigns(dwc.verbatimLocality))
  add('Region', [dwc.country, dwc.stateProvince, dwc.county].filter(Boolean).join(', '))
  add('Date', dwc.eventDate || dwc.verbatimEventDate)
  add('Elevation', elevationText(dwc))
  if (dwc.decimalLatitude != null && dwc.decimalLongitude != null) {
    add('Coordinates', `${dwc.decimalLatitude}, ${dwc.decimalLongitude}`)
  }
  add('Collector', dwc.recordedBy)
  if (host) {
    rows.push({
      label: 'Host',
      value: host.text,
      html: host.html,
      otuId: host.otuId,
      suffix: host.fromNest ? 'collected from nest' : undefined
    })
  }

  if (citations?.length) {
    rows.push({ label: 'Citation', value: citations.join(' '), html: citations.join('<br>') })
  }

  const badges = [dwc.sex, dwc.lifeStage, dwc.caste].filter(Boolean).map(capitalize)
  if (dwc.individualCount > 1) badges.push(`${dwc.individualCount} individuals`)

  return { id, name, types: typeStatuses(dwc.typeStatus), badges, rows }
}

function pageLabel(pages) {
  if (!pages) return ''
  return `${/[-–,]/.test(pages) ? 'pp.' : 'p.'} ${escapeHtml(pages)}`
}

// Full source citation, followed by the page(s) where the type is cited.
async function citationsBySpecimen(ids) {
  const params = new URLSearchParams({ per: '500' })
  params.append('citation_object_type[]', 'CollectionObject')
  ids.forEach((id) => params.append('citation_object_id[]', id))
  const { data } = await makeAPIRequest.get(`/citations?${params.toString()}`)

  const sourceIds = [...new Set(data.map((citation) => citation.source_id))]
  const sources = new Map()
  await Promise.all(
    sourceIds.map(async (sourceId) => {
      const { data: source } = await makeAPIRequest.get(`/sources/${sourceId}`)
      sources.set(sourceId, source.cached)
    })
  )

  const result = new Map()
  for (const citation of data) {
    const source = sources.get(citation.source_id) || escapeHtml(citation.citation_source_body || '')
    if (!source) continue
    const pages = pageLabel(citation.pages)
    const html = pages ? `${pages} in ${source}` : source
    result.set(citation.citation_object_id, [...(result.get(citation.citation_object_id) || []), html])
  }
  return result
}

const NEST_RELATIONSHIP_ID = 115 // collected_from_nest

async function hostsBySpecimen(ids) {
  const params = new URLSearchParams({ per: '500' })
  ids.forEach((id) => params.append('collection_object_id[]', id))
  const { data: associations } = await makeAPIRequest.get(
    `/biological_associations?${params.toString()}`
  )

  const hostOtuIds = [
    ...new Set(
      associations
        .filter((a) => a.biological_association_object_type === 'Otu')
        .map((a) => a.biological_association_object_id)
    )
  ]
  const tags = new Map()

  await Promise.all(
    hostOtuIds.map(async (otuId) => {
      const { data } = await makeAPIRequest.get(`/otus/${otuId}`)
      tags.set(otuId, data.object_tag)
    })
  )

  const result = new Map()
  for (const association of associations) {
    const html = tags.get(association.biological_association_object_id)
    if (html) {
      result.set(association.biological_association_subject_id, {
        html,
        otuId: association.biological_association_object_id,
        fromNest: association.biological_relationship_id === NEST_RELATIONSHIP_ID,
        text: html.replace(/<[^>]*>/g, '')
      })
    }
  }

  return result
}

// The current name first, followed by its synonyms.
async function loadNames(taxonId) {
  const params = new URLSearchParams({ synonymify: 'true', per: '100' })
  params.append('taxon_name_id[]', taxonId)
  const { data } = await makeAPIRequest.get(`/taxon_names?${params.toString()}`)

  return data
    .map((name) => ({
      id: name.id,
      isCurrent: String(name.id) === String(taxonId),
      label: String(name.id) === String(taxonId)
        ? name.cached_original_combination_html ? 'Original name' : 'Current name'
        : 'Synonym',
      html: `${name.cached_original_combination_html || name.cached_html} ${escapeHtml(
        name.cached_author_year || ''
      )}`.trim()
    }))
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
}

async function loadNameSpecimens(name) {
  const params = new URLSearchParams({ per: String(MAX_SPECIMENS) })
  params.append('type_specimen_taxon_name_id', name.id)
  const { data: collectionObjects } = await makeAPIRequest.get(
    `/collection_objects?${params.toString()}`
  )
  if (!collectionObjects.length) return []

  const ids = collectionObjects.map((co) => co.id)
  const [dwcRecords, hosts, citations] = await Promise.all([
    Promise.all(
      ids.map((id) => makeAPIRequest.get(`/collection_objects/${id}/dwc`).then(({ data }) => data))
    ),
    hostsBySpecimen(ids).catch(() => new Map()),
    citationsBySpecimen(ids).catch(() => new Map())
  ])

  const labelNames = await Promise.all(
    dwcRecords.map((dwc) =>
      dwc.verbatimLabel ? findScientificNames(degreeSigns(dwc.verbatimLabel)) : null
    )
  )

  return ids
    .map((id, index) => buildSpecimen(id, dwcRecords[index], hosts.get(id), labelNames[index], name, citations.get(id)))
    .sort((a, b) => typeOrder(a.types[0]) - typeOrder(b.types[0]))
}

async function loadStructured(taxonId) {
  let names
  try {
    names = await loadNames(taxonId)
  } catch {
    names = []
  }
  if (!names.some((name) => name.isCurrent)) {
    names.unshift({ id: taxonId, isCurrent: true, label: 'Current name', html: '' })
  }

  const results = await Promise.all(names.map((name) => loadNameSpecimens(name).catch(() => [])))
  return results.flat()
}

watch(
  [() => props.otuId, taxonNameId],
  async ([otuId, taxonId]) => {
    if (!otuId) return
    isLoading.value = true
    specimens.value = []
    legacyLabels.value = []
    specimenIndex.value = 0

    try {
      if (taxonId) specimens.value = await loadStructured(taxonId)
    } catch {
      specimens.value = []
    }

    // Types with no specimen record fall back to TaxonWorks' own catalog label, shown unparsed.
    if (!specimens.value.length) {
      try {
        const { data } = await useOtuPageRequest('panel:type-specimen-detail', () =>
          TaxonWorks.getOtuTypeMaterial(otuId)
        )
        legacyLabels.value = data.type_materials_catalog_labels.map((item) => item.label)
      } catch {
        legacyLabels.value = []
      }
    }

    isLoading.value = false
  },
  { immediate: true }
)
</script>
