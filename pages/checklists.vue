<template>
  <main class="min-h-screen bg-base-background text-base-content">
    <header class="border-b border-base-border/40 bg-base-foreground">
      <div class="container mx-auto box-border px-4 py-8 sm:py-10">
        <p class="text-sm font-semibold uppercase text-primary-color dark:text-secondary-color">
          Checklists
        </p>
        <h1 class="mt-2 text-3xl font-bold sm:text-4xl">
          Country checklists
        </h1>
        <p class="mt-3 max-w-3xl text-base leading-relaxed text-base-content/70">
          Browse flea species reported in each country. Counts represent distinct species in the occurrence records.
        </p>
      </div>
    </header>

    <section class="container mx-auto box-border grid min-w-0 gap-6 px-4 py-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,0.85fr)]">
      <section aria-label="Flea species world map" class="min-w-0">
        <div class="relative overflow-hidden rounded-lg bg-base-foreground ring-1 ring-base-border/50">
          <ClientOnly>
            <VMap
              ref="countryMapRef"
              v-if="countryGeoJson"
              class="country-checklist-map h-[28rem] max-h-[28rem] sm:h-[36rem] sm:max-h-[36rem]"
              dragging
              :zoom="2"
              :zoom-bounds="8"
              :center="[15, 0]"
              :geojson="countryGeoJson"
              :geojson-options="geojsonOptions"
              @geojson:ready="onCountryMapReady"
            />
            <VSpinner
              v-if="countsLoading"
              class="absolute left-1/2 top-4 z-[500] -translate-x-1/2"
            />
          </ClientOnly>
          <p
            v-if="mapError"
            class="px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {{ mapError }}
          </p>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-base-content/70">
          <span class="font-semibold">Reported species</span>
          <span
            v-for="step in legend"
            :key="step.label"
            class="inline-flex items-center gap-1.5"
          >
            <span
              class="h-3 w-3 rounded-sm ring-1 ring-black/10"
              :style="{ backgroundColor: step.color }"
            />
            {{ step.label }}
          </span>
          <span class="text-base-content/55">Click a country to view its checklist.</span>
        </div>
        <div
          v-if="recommendedCitation"
          class="mt-4 border-t border-base-border/50 pt-3"
        >
          <p class="text-xs font-semibold text-base-content/65">Recommended citation</p>
          <div class="mt-1 flex items-start justify-between gap-3">
            <p class="min-w-0 text-xs leading-relaxed text-base-content/70">{{ recommendedCitation }}</p>
            <VClipboard :text="recommendedCitation" />
          </div>
        </div>
      </section>

      <aside class="min-w-0">
        <label class="block text-sm font-semibold" for="distribution-country">
          Country
        </label>
        <select
          id="distribution-country"
          class="mt-1.5 box-border block w-full min-w-0 max-w-full rounded-md border border-base-border bg-base-foreground px-3 py-2.5 font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :value="selectedCountry"
          @change="selectCountry($event.target.value)"
        >
          <option value="">Select a country</option>
          <option
            v-for="country in countries"
            :key="country.key"
            :value="country.name"
          >
            {{ country.name }} ({{ country.count }})
          </option>
        </select>

        <p
          v-if="countsLoading"
          class="mt-2 text-xs text-base-content/60"
          role="status"
        >
          Loading country species counts…
        </p>
        <p
          v-else-if="countsError"
          class="mt-2 text-sm text-red-700"
          role="alert"
        >
          {{ countsError }}
          <button
            class="ml-1 font-semibold underline"
            type="button"
            @click="loadCountryCounts"
          >Retry</button>
        </p>

        <div
          v-if="selectedCountry"
          class="mt-5 border-t border-base-border/50 pt-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex min-w-0 items-baseline gap-3">
              <h2 class="flex items-center gap-2 text-xl font-semibold">
                <img
                  v-if="countryCode(selectedCountry)"
                  class="h-4 w-6 shrink-0 rounded-sm object-cover"
                  :src="`https://flagcdn.com/w40/${countryCode(selectedCountry)}.png`"
                  alt=""
                  aria-hidden="true"
                />
                <span>{{ selectedCountry }}</span>
              </h2>
              <span class="shrink-0 text-sm tabular-nums text-base-content/65">
                {{ selectedCountryCount }} species
              </span>
            </div>
            <div
              v-if="!countryLoading && !countryError && species.length"
              class="flex flex-wrap items-center gap-2"
            >
              <span class="text-xs text-base-content/55">Download</span>
              <button
                class="rounded-md border border-base-border px-2.5 py-1.5 text-xs font-medium hover:bg-base-muted/40"
                type="button"
                title="Export the full country checklist as CSV, including taxa, evidence, and citations."
                @click="downloadCountryCSV"
              >CSV</button>
              <button
                class="rounded-md border border-base-border px-2.5 py-1.5 text-xs font-medium hover:bg-base-muted/40"
                type="button"
                title="Export the full country checklist as plain text."
                @click="downloadCountryText"
              >Plain text</button>
              <button
                class="rounded-md border border-base-border px-2.5 py-1.5 text-xs font-medium hover:bg-base-muted/40"
                type="button"
                title="Export a formatted country checklist for Word and other word processors."
                @click="downloadCountryRtf"
              >RTF</button>
            </div>
          </div>

          <div
            class="mt-4 flex border-b border-base-border/60"
            role="tablist"
            aria-label="Country checklist views"
          >
            <button
              id="country-tab-species"
              class="border-b-2 px-3 py-2 text-sm font-medium"
              :class="activeCountryTab === 'species' ? 'border-primary-color text-base-content dark:border-secondary-color' : 'border-transparent text-base-content/60 hover:text-base-content'"
              type="button"
              role="tab"
              :aria-selected="activeCountryTab === 'species'"
              aria-controls="country-panel-species"
              @click="activeCountryTab = 'species'"
            >Species checklist</button>
            <button
              id="country-tab-references"
              class="border-b-2 px-3 py-2 text-sm font-medium"
              :class="activeCountryTab === 'references' ? 'border-primary-color text-base-content dark:border-secondary-color' : 'border-transparent text-base-content/60 hover:text-base-content'"
              type="button"
              role="tab"
              :aria-selected="activeCountryTab === 'references'"
              aria-controls="country-panel-references"
              @click="activeCountryTab = 'references'"
            >References</button>
          </div>

          <p
            v-if="countryLoading"
            class="mt-4 text-sm text-base-content/65"
            role="status"
          >
            Loading checklist and references…
          </p>
          <p
            v-else-if="countryError"
            class="mt-3 text-sm text-red-700"
            role="alert"
          >
            {{ countryError }}
          </p>
              <section
                v-else-if="activeCountryTab === 'species'"
                id="country-panel-species"
                class="pt-3"
                role="tabpanel"
                aria-labelledby="country-tab-species"
              >
                <template v-if="species.length">
                  <label class="block text-sm font-medium" for="species-filter">
                    Species and subspecies checklist
                  </label>
                  <input
                    id="species-filter"
                    v-model="speciesFilter"
                    class="mt-1.5 box-border block w-full min-w-0 max-w-full rounded-md border border-base-border bg-base-foreground px-3 py-2 text-sm placeholder:text-base-content/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    type="search"
                    placeholder="Filter by species name"
                  />
                  <p class="mt-2 text-xs text-base-content/55">
                    {{ filteredSpecies.length }} of {{ species.length }} listed taxa
                  </p>
                  <ul class="mt-2 divide-y divide-base-border/50 border-y border-base-border/50">
                    <li
                      v-for="taxon in filteredSpecies"
                      :key="taxon.key"
                      class="py-2.5 pr-2 text-sm"
                    >
                      <RouterLink
                        v-if="taxon.otuId"
                        :to="{ name: 'otus-id-overview', params: { id: taxon.otuId } }"
                        class="font-medium italic text-primary-color hover:underline dark:text-secondary-color"
                      >{{ taxon.name }}</RouterLink>
                      <span v-else class="font-medium italic">{{ taxon.name }}</span>
                      <span v-if="taxon.authorship" class="ml-1 text-base-content/75">{{ taxon.authorship }}</span>
                      <button
                        :id="`record-count-${taxon.key}`"
                        class="ml-1 text-xs text-primary-color hover:underline dark:text-secondary-color"
                        type="button"
                        :aria-expanded="expandedTaxonKey === taxon.key"
                        :aria-controls="`record-sources-${taxon.key}`"
                        @click="expandedTaxonKey = expandedTaxonKey === taxon.key ? '' : taxon.key"
                      >{{ recordEvidenceByTaxon.get(taxon.key)?.total ?? 0 }} {{ recordEvidenceByTaxon.get(taxon.key)?.total === 1 ? 'record' : 'records' }}</button>
                      <div
                        v-if="expandedTaxonKey === taxon.key"
                        :id="`record-sources-${taxon.key}`"
                        class="mt-2 border-l-2 border-primary-color/50 pl-3 text-xs text-base-content/75 dark:border-secondary-color/50"
                      >
                        <p
                          v-if="recordEvidenceByTaxon.get(taxon.key)"
                          class="mb-1 font-medium"
                        >
                          <span v-if="recordEvidenceByTaxon.get(taxon.key).citations">
                            {{ recordEvidenceByTaxon.get(taxon.key).citations }} {{ recordEvidenceByTaxon.get(taxon.key).citations === 1 ? 'citation' : 'citations' }}
                          </span>
                          <span
                            v-if="recordEvidenceByTaxon.get(taxon.key).citations && recordEvidenceByTaxon.get(taxon.key).specimens"
                            aria-hidden="true"
                          > · </span>
                          <span v-if="recordEvidenceByTaxon.get(taxon.key).specimens">
                            {{ recordEvidenceByTaxon.get(taxon.key).specimens }} {{ recordEvidenceByTaxon.get(taxon.key).specimens === 1 ? 'specimen' : 'specimens' }}
                          </span>
                        </p>
                        <ul
                          v-if="sourcesByTaxon.get(taxon.key)?.length"
                          class="space-y-1.5"
                        >
                          <li
                            v-for="source in sourcesByTaxon.get(taxon.key)"
                            :key="source.key"
                          >
                            <template v-if="source.type === 'reference'">
                              <template v-if="source.place">
                                <span class="font-medium">{{ source.place }}</span>
                                <span aria-hidden="true"> · </span>
                              </template>
                              <template v-if="source.citations.length">
                                <template
                                  v-for="(citation, index) in source.citations"
                                  :key="citation.key"
                                >
                                  <button
                                    class="text-primary-color hover:underline dark:text-secondary-color"
                                    type="button"
                                    :aria-label="`${source.place ? `${source.place}: ` : ''}${citation.short}; show full citation`"
                                    @click="openCitation(citation, source.place)"
                                  >{{ citation.short }}</button>
                                  <span v-if="index < source.citations.length - 1" aria-hidden="true">; </span>
                                </template>
                              </template>
                              <span v-else class="text-base-content/55">No citation recorded</span>
                            </template>
                            <template v-else>
                              <span class="font-medium">Specimen:</span>
                              {{ source.label }}
                            </template>
                          </li>
                        </ul>
                        <p v-else>No citation or specimen details are available for these records.</p>
                      </div>
                    </li>
                  </ul>
                </template>
                <p v-else class="text-sm text-base-content/65">
                  No flea species occurrence records are currently indexed for {{ selectedCountry }}.
                </p>
              </section>

              <section
                v-else
                id="country-panel-references"
                class="pt-3"
                role="tabpanel"
                aria-labelledby="country-tab-references"
              >
                <p
                  v-if="topReferences.length"
                  class="text-xs text-base-content/55"
                >
                  Top cited references, ranked by distinct taxa.
                </p>
                <ol v-if="topReferences.length" class="mt-2 space-y-3">
                  <li
                    v-for="reference in topReferences"
                    :key="reference.full"
                    class="border-l-2 border-primary-color/60 pl-3 text-sm dark:border-secondary-color/60"
                  >
                    <p class="leading-relaxed">{{ reference.full }}</p>
                    <button
                      :id="`${reference.key}-count`"
                      class="mt-1 text-xs text-primary-color hover:underline dark:text-secondary-color"
                      type="button"
                      :aria-expanded="expandedReferenceKey === reference.key"
                      :aria-controls="`${reference.key}-taxa`"
                      @click="expandedReferenceKey = expandedReferenceKey === reference.key ? '' : reference.key"
                    >{{ reference.taxa.length }} taxa</button>
                    <ul
                      v-if="expandedReferenceKey === reference.key"
                      :id="`${reference.key}-taxa`"
                      class="mt-2 space-y-1 border-l-2 border-base-border/70 pl-3"
                    >
                      <li
                        v-for="taxon in reference.taxa"
                        :key="taxon.key"
                        class="text-sm"
                      >
                        <RouterLink
                          v-if="taxon.otuId"
                          :to="{ name: 'otus-id-overview', params: { id: taxon.otuId } }"
                          class="italic text-primary-color hover:underline dark:text-secondary-color"
                        >{{ taxon.name }}</RouterLink>
                        <span v-else class="italic">{{ taxon.name }}</span>
                        <span v-if="taxon.authorship" class="ml-1 text-base-content/65">{{ taxon.authorship }}</span>
                        <span class="ml-2 text-xs text-base-content/55">{{ taxon.evidenceLabel }}</span>
                      </li>
                    </ul>
                  </li>
                </ol>
                <p v-else class="text-sm text-base-content/65">
                  No cited references are currently indexed for {{ selectedCountry }}.
                </p>
              </section>
        </div>
        <p
          v-else
          class="mt-5 border-t border-base-border/50 pt-4 text-sm text-base-content/65"
        >
          Select a country on the map or from the list to see its checklist and references.
        </p>
      </aside>
    </section>
    <Teleport to="body">
      <VModal
        v-if="activeCitation"
        @close="activeCitation = null"
      >
        <template #header>
          <span class="italic">{{ activeCitation.short }}</span>
          <span v-if="activeCitation.place" class="ml-2 text-sm font-normal text-base-content/60">{{ activeCitation.place }}</span>
        </template>
        <div class="px-4 pb-4 text-sm leading-relaxed">
          <p
            v-for="fullReference in activeCitation.fullReferences"
            :key="fullReference"
            class="mb-3 last:mb-0"
          >{{ fullReference }}</p>
        </div>
      </VModal>
    </Teleport>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { makeAPIRequest } from '@/utils/request'

const {
  base_url = '/',
  project_name: projectName = 'Fleas of the World',
  project_authors: projectAuthors = ''
} = __APP_ENV__
const PAGE_SIZE = 500
const PAGE_BATCH_SIZE = 8
const DISTRIBUTION_PLACE_BATCH_SIZE = 100
const INDEX_CACHE_KEY = 'fleas-country-species-counts-v2'
const INDEX_CACHE_AGE = 24 * 60 * 60 * 1000

const legend = [
  { label: '0', max: 0, color: '#edf2f4' },
  { label: '1–4', max: 4, color: '#c9e4de' },
  { label: '5–19', max: 19, color: '#8fc8b5' },
  { label: '20–49', max: 49, color: '#4e9c7d' },
  { label: '50+', max: Infinity, color: '#21684f' }
]

const countryGeoJson = ref(null)
const countryMapRef = ref(null)
const mapLayers = new Map()
const countriesByKey = ref(new Map())
const countryCounts = ref(new Map())
const countsLoading = ref(true)
const countsError = ref('')
const mapError = ref('')
const selectedCountry = ref('')
const countryLoading = ref(false)
const countryError = ref('')
const countryRows = ref([])
const citationsByOccurrence = ref(new Map())
const distributionPlacesByOccurrence = ref(new Map())
const speciesFilter = ref('')
const expandedTaxonKey = ref('')
const activeCountryTab = ref('species')
const expandedReferenceKey = ref('')
const activeCitation = ref(null)
const checklistCitationUrl = ref('')
const citationAccessDate = ref('')
let countryRequestId = 0
let pendingCountryScrollY = null

const countryAliases = {
  'united states of america': 'united states',
  usa: 'united states',
  'russian federation': 'russia',
  'czech republic': 'czechia',
  'korea, republic of': 'south korea',
  'republic of korea': 'south korea',
  'democratic people\'s republic of korea': 'north korea',
  'viet nam': 'vietnam',
  'iran, islamic republic of': 'iran',
  'tanzania, united republic of': 'tanzania',
  'united republic of tanzania': 'tanzania',
  'venezuela, bolivarian republic of': 'venezuela',
  'bolivia, plurinational state of': 'bolivia',
  'moldova, republic of': 'moldova',
  'lao people\'s democratic republic': 'laos',
  'syrian arab republic': 'syria',
  'taiwan, province of china': 'taiwan'
}

function countryKey(name) {
  const normalized = String(name || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
  return countryAliases[normalized] || normalized
}

function countryCode(name) {
  const feature = countryGeoJson.value?.features.find(
    (item) => countryKey(item.properties?.name) === countryKey(name)
  )
  const code = feature?.properties?.['ISO3166-1-Alpha-2']
  return /^[a-z]{2}$/i.test(code || '') ? code.toLowerCase() : ''
}

function isSpeciesRecord(record) {
  return /species/i.test(String(record.taxonRank || '')) && Boolean(record.scientificName)
}

function speciesKey(record) {
  if (record.otu_id != null && record.otu_id !== '') return String(record.otu_id)
  return `${String(record.scientificName || '').trim()} ${String(record.scientificNameAuthorship || '').trim()}`.trim().toLocaleLowerCase()
}

function speciesConceptKey(record) {
  return speciesConceptName(record).toLocaleLowerCase()
}

function speciesConceptName(record) {
  const name = bareName(record)
  const parts = name.split(/\s+/).filter(Boolean)
  if (/subspecies/i.test(String(record.taxonRank || '')) && parts.length >= 3) parts.pop()
  return parts.join(' ')
}

async function forEachOccurrencePage(params, onPage) {
  const first = await makeAPIRequest.get('/dwc_occurrences', {
    params: { ...params, per: PAGE_SIZE, page: 1 }
  })
  onPage(first.data || [])

  const total = Number(first.headers?.['pagination-total'] || 0)
  const pageCount = Math.ceil(total / PAGE_SIZE)
  for (let page = 2; page <= pageCount; page += PAGE_BATCH_SIZE) {
    const pages = Array.from(
      { length: Math.min(PAGE_BATCH_SIZE, pageCount - page + 1) },
      (_, index) => page + index
    )
    const responses = await Promise.all(
      pages.map((currentPage) => makeAPIRequest.get('/dwc_occurrences', {
        params: { ...params, per: PAGE_SIZE, page: currentPage }
      }))
    )
    responses.forEach((response) => onPage(response.data || []))
  }
}

async function loadCountryShapes() {
  try {
    const response = await fetch(`${base_url}data/countries.geojson`)
    if (!response.ok) throw new Error('Could not load country boundaries.')
    const data = await response.json()
    countryGeoJson.value = data
  } catch {
    mapError.value = 'The world map could not be loaded. Use the country list to browse records.'
  }
}

function cacheCountryCounts(namesByKey, countsByKey) {
  try {
    localStorage.setItem(INDEX_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      countries: [...namesByKey.entries()].map(([key, names]) => [key, [...names]]),
      counts: [...countsByKey.entries()]
    }))
  } catch {
    // The explorer can still run without browser storage.
  }
}

async function loadCountryCounts() {
  countsLoading.value = true
  countsError.value = ''
  try {
    const cached = JSON.parse(localStorage.getItem(INDEX_CACHE_KEY) || 'null')
    if (cached?.savedAt && Date.now() - cached.savedAt < INDEX_CACHE_AGE) {
      countriesByKey.value = new Map(cached.countries || [])
      countryCounts.value = new Map(cached.counts || [])
      countsLoading.value = false
      refreshMapStyles()
      return
    }
  } catch {
    // Ignore invalid or unavailable browser storage and rebuild the index.
  }

  const namesByKey = new Map()
  const speciesByCountry = new Map()
  try {
    await forEachOccurrencePage({}, (records) => {
      for (const record of records) {
        if (!record.country || !isSpeciesRecord(record)) continue
        const key = countryKey(record.country)
        if (!namesByKey.has(key)) namesByKey.set(key, new Set())
        namesByKey.get(key).add(String(record.country).trim())
        if (!speciesByCountry.has(key)) speciesByCountry.set(key, new Set())
        speciesByCountry.get(key).add(speciesConceptKey(record))
      }
    })
    countriesByKey.value = new Map(
      [...namesByKey.entries()].map(([key, names]) => [key, [...names]])
    )
    countryCounts.value = new Map(
      [...speciesByCountry.entries()].map(([key, species]) => [key, species.size])
    )
    cacheCountryCounts(namesByKey, countryCounts.value)
    refreshMapStyles()
  } catch {
    countsError.value = 'Could not load flea occurrence counts. Please try again.'
  } finally {
    countsLoading.value = false
  }
}

const countries = computed(() => {
  const options = new Map()
  for (const feature of countryGeoJson.value?.features || []) {
    const name = feature.properties?.name
    if (!name) continue
    const key = countryKey(name)
    const count = countryCounts.value.get(key) || 0
    if (!count && key !== countryKey(selectedCountry.value)) continue
    options.set(key, { key, name, count })
  }
  for (const [key, aliases] of countriesByKey.value) {
    if (!options.has(key)) {
      const name = [...aliases].sort((a, b) => a.localeCompare(b))[0]
      options.set(key, { key, name, count: countryCounts.value.get(key) || 0 })
    }
  }
  if (selectedCountry.value && !options.has(countryKey(selectedCountry.value))) {
    options.set(countryKey(selectedCountry.value), {
      key: countryKey(selectedCountry.value),
      name: selectedCountry.value,
      count: selectedCountryCount.value
    })
  }
  return [...options.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const selectedCountryCount = computed(() => countryCounts.value.get(countryKey(selectedCountry.value)) || 0)

function colorForCount(count) {
  return legend.find((step) => count <= step.max)?.color || legend[legend.length - 1].color
}

function countryStyle(feature) {
  const name = feature.properties?.name || ''
  const count = countryCounts.value.get(countryKey(name)) || 0
  const selected = countryKey(name) === countryKey(selectedCountry.value)
  return {
    color: selected ? '#f3b637' : '#ffffff',
    weight: selected ? 3.5 : 0.6,
    fillColor: colorForCount(count),
    fillOpacity: count ? 0.88 : 0.48
  }
}

function refreshMapStyles() {
  for (const [name, layer] of mapLayers) {
    layer.setStyle(countryStyle({ properties: { name } }))
  }
}

function focusMapOnCountry() {
  const map = countryMapRef.value?.getMapObject()
  if (!map) return
  if (!selectedCountry.value) {
    map.fitWorld({ padding: [20, 20] })
    return
  }

  const layer = [...mapLayers.entries()]
    .find(([name]) => countryKey(name) === countryKey(selectedCountry.value))?.[1]
  const bounds = layer?.getBounds?.()
  if (bounds?.isValid()) {
    layer.bringToFront()
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 5 })
  }
}

function onCountryMapReady() {
  focusMapOnCountry()
}

const geojsonOptions = () => ({
  style: countryStyle,
  onEachFeature: (feature, layer) => {
    const name = feature.properties?.name
    if (!name) return
    mapLayers.set(name, layer)
    const count = countryCounts.value.get(countryKey(name)) || 0
    layer.bindTooltip(`${name}: ${count} reported species`)
    layer.on('click', () => {
      const option = countries.value.find((country) => country.key === countryKey(name))
      selectCountry(option?.name || name)
    })
    layer.on('mouseover', (event) => event.target.setStyle({
      weight: countryKey(name) === countryKey(selectedCountry.value) ? 3.5 : 1.5,
      fillOpacity: 1
    }))
    layer.on('mouseout', () => layer.setStyle(countryStyle(feature)))
  }
})

function selectCountry(name) {
  const query = name ? `?country=${encodeURIComponent(name)}` : ''
  pendingCountryScrollY = window.scrollY
  window.location.hash = `/checklists${query}`
}

function syncCountryFromHash() {
  const [path, query = ''] = window.location.hash.slice(1).split('?')
  if (path !== '/checklists') return
  selectedCountry.value = new URLSearchParams(query).get('country') || ''
  checklistCitationUrl.value = window.location.href
  citationAccessDate.value = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  loadCountry(selectedCountry.value)
  if (pendingCountryScrollY !== null) {
    const scrollY = pendingCountryScrollY
    pendingCountryScrollY = null
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'auto' })))
  }
}

const recommendedCitation = computed(() => {
  if (!selectedCountry.value || !checklistCitationUrl.value || !citationAccessDate.value) return ''
  const authors = projectAuthors || projectName
  return `${authors} (${new Date().getFullYear()}). ${projectName}: ${selectedCountry.value} checklist. Accessed ${citationAccessDate.value}. ${checklistCitationUrl.value}`
})

function bareName(record) {
  const name = String(record.scientificName || '').trim()
  const authorship = String(record.scientificNameAuthorship || '').trim()
  return authorship && name.endsWith(authorship)
    ? name.slice(0, -authorship.length).trim()
    : name
}

const species = computed(() => {
  const byTaxon = new Map()
  for (const record of countryRows.value) {
    if (!isSpeciesRecord(record)) continue
    const key = speciesKey(record)
    if (!key) continue
    if (!byTaxon.has(key)) {
      byTaxon.set(key, {
        key,
        name: bareName(record),
        authorship: String(record.scientificNameAuthorship || '').trim(),
        rank: String(record.taxonRank || '').trim(),
        otuId: Number(record.otu_id) || null
      })
    }
  }
  return [...byTaxon.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const filteredSpecies = computed(() => {
  const query = speciesFilter.value.trim().toLocaleLowerCase()
  if (!query) return species.value
  return species.value.filter((taxon) => `${taxon.name} ${taxon.authorship}`.toLocaleLowerCase().includes(query))
})

function splitReferences(value) {
  return String(value || '').split(/\s*\|\s*/).map((reference) => reference.trim()).filter(Boolean)
}

function plainText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim()
}

function compactAuthorList(value) {
  const authors = String(value || '')
    .split(/\s*&\s*|\s+and\s+/i)
    .map((author) => author.split(',')[0].trim())
    .filter(Boolean)
  if (authors.length > 2) return `${authors[0]} et al.`
  return authors.join(' & ')
}

function compactCitation(citationBody, fullReference) {
  const body = plainText(citationBody)
  const shortMatch = body.match(/^(.*?),\s*(\d{4}[a-z]?)(?::\s*(.*))?$/i)
  if (shortMatch) {
    const authors = compactAuthorList(shortMatch[1])
    const pages = shortMatch[3]?.trim()
    return `${authors}, ${shortMatch[2]}${pages ? `:${pages}` : ''}`
  }

  const full = plainText(fullReference || citationBody)
  const fullMatch = full.match(/^(.+?)\s*\((\d{4}[a-z]?)\)/)
  if (!fullMatch) return full
  return `${compactAuthorList(fullMatch[1])}, ${fullMatch[2]}`
}

function distributionPlace(record) {
  const country = String(record.country || selectedCountry.value).trim()
  const assertedDistributionId = String(record.dwc_occurrence_object_id || '')
  const shapeName = plainText(distributionPlacesByOccurrence.value.get(assertedDistributionId) || '')
  if (shapeName && countryKey(shapeName) !== countryKey(country)) return shapeName

  const details = [...new Set(
    [record.stateProvince, record.county, record.municipality, record.verbatimLocality]
      .map((place) => plainText(place))
      .filter((place) => place && countryKey(place) !== countryKey(country))
  )]
  return details.join(', ')
}

function specimenSourceLabel(record) {
  const selectedCountryKey = countryKey(selectedCountry.value)
  const locality = [record.verbatimLocality, record.county, record.stateProvince, record.country]
    .map((value) => plainText(value))
    .filter((value) => value && countryKey(value) !== selectedCountryKey)
    .join(', ')
  return [
    record.institutionCode ? `Repository ${record.institutionCode}` : '',
    record.catalogNumber ? `Catalog ${record.catalogNumber}` : '',
    locality
  ].filter(Boolean).join(' · ') || 'Specimen record'
}

function openCitation(citation, place) {
  activeCitation.value = {
    ...citation,
    place
  }
}

function citationsForRecord(record) {
  if (record.dwc_occurrence_object_type !== 'AssertedDistribution') return []
  const occurrenceId = String(record.dwc_occurrence_object_id || record.id || '')
  const linkedCitations = citationsByOccurrence.value.get(occurrenceId)
  if (linkedCitations?.length) return linkedCitations
  return splitReferences(record.associatedReferences).map((full) => ({
    short: compactCitation('', full),
    full: plainText(full)
  }))
}

function countryExportRows() {
  const rows = []
  for (const record of countryRows.value) {
    if (!isSpeciesRecord(record)) continue
    const isDistribution = record.dwc_occurrence_object_type === 'AssertedDistribution'
    const isSpecimen = record.dwc_occurrence_object_type === 'CollectionObject' || record.basisOfRecord === 'PreservedSpecimen'
    if (!isDistribution && !isSpecimen) continue

    const citations = citationsForRecord(record)
    const citationRows = isDistribution && citations.length ? citations : [{ short: '', full: '' }]
    for (const citation of citationRows) {
      rows.push({
        scientificName: bareName(record),
        scientificNameAuthorship: String(record.scientificNameAuthorship || '').trim(),
        taxonRank: record.taxonRank || '',
        country: record.country || selectedCountry.value,
        stateProvince: record.stateProvince || '',
        county: record.county || '',
        municipality: record.municipality || '',
        verbatimLocality: record.verbatimLocality || '',
        evidenceType: isDistribution ? 'Asserted distribution' : 'Specimen',
        institutionCode: record.institutionCode || '',
        catalogNumber: record.catalogNumber || '',
        recordedBy: record.recordedBy || '',
        eventDate: record.eventDate || record.verbatimEventDate || '',
        citation: citation.short || '',
        fullReference: citation.full || '',
        otuId: record.otu_id || '',
        occurrenceId: record.occurrenceID || record.dwc_occurrence_object_id || '',
        recommendedCitation: recommendedCitation.value
      })
    }
  }
  return rows
}

function csvCell(value) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function exportSlug(value) {
  return String(value || 'country').toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function downloadCountryCSV() {
  const columns = [
    'scientificName', 'scientificNameAuthorship', 'taxonRank', 'country', 'stateProvince',
    'county', 'municipality', 'verbatimLocality', 'evidenceType', 'institutionCode',
    'catalogNumber', 'recordedBy', 'eventDate', 'citation', 'fullReference', 'otuId', 'occurrenceId', 'recommendedCitation'
  ]
  const rows = countryExportRows()
  const csv = [columns, ...rows.map((row) => columns.map((column) => row[column]))]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n')
  const date = new Date().toISOString().slice(0, 10)
  downloadFile(`FleasOfTheWorld_${exportSlug(selectedCountry.value)}_checklist_${date}.csv`, `\ufeff${csv}`, 'text/csv;charset=utf-8')
}

function checklistExportContent() {
  const taxa = []
  const references = new Set()
  for (const taxon of species.value) {
    const distributions = []
    const specimens = []
    for (const source of sourcesByTaxon.value.get(taxon.key) || []) {
      if (source.type === 'reference') {
        const citations = source.citations.map((citation) => citation.short).filter(Boolean)
        distributions.push({ place: source.place || selectedCountry.value, citations })
        source.citations.forEach((citation) => citation.fullReferences.forEach((reference) => references.add(reference)))
      } else {
        specimens.push(source.label)
      }
    }
    taxa.push({ taxon, distributions, specimens })
  }
  return { taxa, references: [...references].sort((a, b) => a.localeCompare(b)) }
}

function downloadCountryText() {
  const { taxa, references } = checklistExportContent()
  const lines = [
    `Fleas of the World: ${selectedCountry.value} checklist`,
    `Generated ${new Date().toISOString().slice(0, 10)}.`,
    `Recommended citation: ${recommendedCitation.value}`,
    `${taxa.length} species and subspecies with indexed records.`,
    '',
    'CHECKLIST',
    ''
  ]

  for (const entry of taxa) {
    const { taxon } = entry
    lines.push(`${taxon.name}${taxon.authorship ? ` ${taxon.authorship}` : ''}`)
    for (const distribution of entry.distributions) {
      lines.push(`  Distribution: ${distribution.place}${distribution.citations.length ? ` (${distribution.citations.join('; ')})` : ''}`)
    }
    entry.specimens.forEach((specimen) => lines.push(`  Specimen: ${specimen}`))
    lines.push('')
  }

  lines.push('REFERENCES', '', ...references)
  const date = new Date().toISOString().slice(0, 10)
  downloadFile(`FleasOfTheWorld_${exportSlug(selectedCountry.value)}_checklist_${date}.txt`, lines.join('\r\n'), 'text/plain;charset=utf-8')
}

function escapeRtf(value) {
  let output = ''
  const appendUnicode = (unit) => {
    output += `\\u${unit > 32767 ? unit - 65536 : unit}?`
  }
  for (const character of String(value ?? '')) {
    const codePoint = character.codePointAt(0)
    if (character === '\\' || character === '{' || character === '}') {
      output += `\\${character}`
    } else if (codePoint >= 32 && codePoint <= 126) {
      output += character
    } else if (codePoint <= 0xffff) {
      appendUnicode(codePoint)
    } else {
      const adjusted = codePoint - 0x10000
      appendUnicode(0xd800 + (adjusted >> 10))
      appendUnicode(0xdc00 + (adjusted & 0x3ff))
    }
  }
  return output
}

function downloadCountryRtf() {
  const { taxa, references } = checklistExportContent()
  const date = new Date().toISOString().slice(0, 10)
  const lines = [
    '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}}\\viewkind4\\uc1',
    `\\pard\\qc\\sa240\\fs32\\b ${escapeRtf(`Fleas of the World: ${selectedCountry.value} checklist`)}\\b0\\fs24\\par`,
    `\\pard\\qc\\sa200\\fs20 Generated ${date}. ${taxa.length} species and subspecies with indexed records.\\fs24\\par`,
    `\\pard\\qc\\sa120\\fs18 Recommended citation: ${escapeRtf(recommendedCitation.value)}\\fs20\\par`,
    '\\pard\\sb240\\sa100\\b CHECKLIST\\b0\\par'
  ]

  for (const entry of taxa) {
    const { taxon } = entry
    lines.push(`\\pard\\sa60\\i ${escapeRtf(taxon.name)}\\i0${taxon.authorship ? `\\~${escapeRtf(taxon.authorship)}` : ''}\\par`)
    for (const distribution of entry.distributions) {
      const citations = distribution.citations.length ? ` (${distribution.citations.join('; ')})` : ''
      lines.push(`\\pard\\li360\\sa40 Distribution: ${escapeRtf(distribution.place + citations)}\\par`)
    }
    for (const specimen of entry.specimens) {
      lines.push(`\\pard\\li360\\sa40 Specimen: ${escapeRtf(specimen)}\\par`)
    }
    lines.push('\\pard\\sa80\\par')
  }

  lines.push('\\pard\\sb240\\sa100\\b REFERENCES\\b0\\par')
  references.forEach((reference) => lines.push(`\\pard\\sa80 ${escapeRtf(reference)}\\par`))
  lines.push('}')

  downloadFile(
    `FleasOfTheWorld_${exportSlug(selectedCountry.value)}_checklist_${date}.rtf`,
    lines.join('\r\n'),
    'application/rtf'
  )
}

const sourcesByTaxon = computed(() => {
  const groups = new Map()
  for (const record of countryRows.value) {
    if (!isSpeciesRecord(record)) continue
    const taxonKey = speciesKey(record)
    if (!groups.has(taxonKey)) groups.set(taxonKey, { references: new Map(), specimens: [] })
    const group = groups.get(taxonKey)

    if (record.dwc_occurrence_object_type === 'AssertedDistribution') {
      const occurrenceId = String(record.dwc_occurrence_object_id || record.id || '')
      const references = citationsForRecord(record)
      const place = distributionPlace(record)
      if (!group.references.has(place)) {
        group.references.set(place, { place, citations: new Map() })
      }
      const placeGroup = group.references.get(place)
      for (const reference of references) {
        const full = plainText(reference.full)
        const short = plainText(reference.short) || compactCitation('', full)
        if (!full && !short) continue
        const citationKey = short || full
        if (!placeGroup.citations.has(citationKey)) {
          placeGroup.citations.set(citationKey, {
            key: citationKey,
            short,
            fullReferences: new Set()
          })
        }
        const citation = placeGroup.citations.get(citationKey)
        if (full) citation.fullReferences.add(full)
      }
    } else if (record.dwc_occurrence_object_type === 'CollectionObject' || record.basisOfRecord === 'PreservedSpecimen') {
      group.specimens.push({
        type: 'specimen',
        key: `specimen-${record.dwc_occurrence_object_id || record.id || group.specimens.length}`,
        label: specimenSourceLabel(record)
      })
    }
  }

  return new Map([...groups.entries()].map(([taxonKey, group]) => [
    taxonKey,
    [
      ...[...group.references.entries()]
        .map(([key, reference]) => ({
          type: 'reference',
          key: `reference-${taxonKey}-${key}`,
          place: reference.place,
          citations: [...reference.citations.values()]
            .map((citation) => ({
              ...citation,
              fullReferences: [...citation.fullReferences]
            }))
            .sort((a, b) => a.short.localeCompare(b.short))
        }))
        .sort((a, b) => a.place.localeCompare(b.place) || a.short.localeCompare(b.short)),
      ...group.specimens
    ]
  ]))
})

const recordEvidenceByTaxon = computed(() => {
  const evidence = new Map()
  for (const record of countryRows.value) {
    if (!isSpeciesRecord(record)) continue
    const taxonKey = speciesKey(record)
    if (!evidence.has(taxonKey)) evidence.set(taxonKey, { citations: new Set(), specimens: new Set() })
    const taxonEvidence = evidence.get(taxonKey)

    if (record.dwc_occurrence_object_type === 'AssertedDistribution') {
      const occurrenceId = String(record.dwc_occurrence_object_id || record.id || '')
      const linkedCitations = citationsByOccurrence.value.get(occurrenceId)
      if (linkedCitations?.length) {
        for (const citation of linkedCitations) {
          const citationId = citation.id || citation.short || citation.full
          if (citationId) taxonEvidence.citations.add(`${occurrenceId}:${citationId}`)
        }
      } else {
        for (const reference of splitReferences(record.associatedReferences)) {
          const citation = compactCitation('', plainText(reference))
          if (citation) taxonEvidence.citations.add(`${occurrenceId}:${citation.toLocaleLowerCase()}`)
        }
      }
    } else if (record.dwc_occurrence_object_type === 'CollectionObject' || record.basisOfRecord === 'PreservedSpecimen') {
      const recordId = `${record.dwc_occurrence_object_type || record.basisOfRecord}:${record.dwc_occurrence_object_id || record.id || taxonKey}`
      taxonEvidence.specimens.add(recordId)
    }
  }
  return new Map([...evidence.entries()].map(([taxonKey, counts]) => [taxonKey, {
    citations: counts.citations.size,
    specimens: counts.specimens.size,
    total: counts.citations.size + counts.specimens.size
  }]))
})

async function loadCitations(rows, requestId) {
  const occurrenceIds = [...new Set(rows
    .filter((record) => record.dwc_occurrence_object_type === 'AssertedDistribution')
    .map((record) => record.dwc_occurrence_object_id)
    .filter(Boolean))]
  const citations = new Map()
  for (let index = 0; index < occurrenceIds.length; index += 150) {
    const params = new URLSearchParams()
    params.append('citation_object_type', 'AssertedDistribution')
    params.append('extend[]', 'source')
    params.append('per', '1000')
    occurrenceIds.slice(index, index + 150).forEach((id) => params.append('citation_object_id[]', id))
    try {
      const { data } = await makeAPIRequest.get(`/citations?${params.toString()}`)
      for (const citation of data || []) {
        const full = plainText(citation.source?.cached || citation.citation_source_body || '')
        const short = compactCitation(citation.citation_source_body, full)
        if (!full && !short) continue
        const id = String(citation.citation_object_id)
        if (!citations.has(id)) citations.set(id, [])
        citations.get(id).push({ id: String(citation.id || ''), short, full })
      }
    } catch {
      break
    }
    if (requestId !== countryRequestId) return citations
  }
  return citations
}

async function loadDistributionPlaces(rows, requestId) {
  const distributionIds = [...new Set(rows
    .filter((record) => record.dwc_occurrence_object_type === 'AssertedDistribution')
    .map((record) => record.dwc_occurrence_object_id)
    .filter(Boolean))]
  const places = new Map()

  for (let index = 0; index < distributionIds.length; index += DISTRIBUTION_PLACE_BATCH_SIZE) {
    const params = new URLSearchParams()
    params.append('per', '500')
    distributionIds.slice(index, index + DISTRIBUTION_PLACE_BATCH_SIZE).forEach((id) => params.append('asserted_distribution_id[]', id))
    try {
      const { data } = await makeAPIRequest.get(`/asserted_distributions?${params.toString()}`)
      for (const distribution of data || []) {
        const place = distribution.asserted_distribution_shape?.name
        if (place) places.set(String(distribution.id), place)
      }
    } catch {
      break
    }
    if (requestId !== countryRequestId) return places
  }

  return places
}

const topReferences = computed(() => {
  const references = new Map()
  for (const record of countryRows.value) {
    const isDistribution = record.dwc_occurrence_object_type === 'AssertedDistribution'
    const isSpecimen = record.dwc_occurrence_object_type === 'CollectionObject' || record.basisOfRecord === 'PreservedSpecimen'
    if (!isDistribution && !isSpecimen) continue

    const citationRefs = isDistribution
      ? citationsByOccurrence.value.get(String(record.dwc_occurrence_object_id))
      : null
    const fullReferences = citationRefs?.length
      ? citationRefs.map((citation) => citation.full)
      : splitReferences(record.associatedReferences)
    for (const rawReference of fullReferences) {
      const full = plainText(rawReference)
      if (!full) continue
      if (!references.has(full)) references.set(full, { full, taxa: new Map() })
      const entry = references.get(full)
      const taxonKey = speciesKey(record)
      if (!entry.taxa.has(taxonKey)) {
        entry.taxa.set(taxonKey, {
          key: taxonKey,
          name: bareName(record),
          authorship: String(record.scientificNameAuthorship || '').trim(),
          otuId: Number(record.otu_id) || null
        })
      }
    }
  }
  return [...references.values()]
    .map((reference, index) => {
      const taxa = [...reference.taxa.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
      return { ...reference, key: `reference-${index}`, taxa }
    })
    .sort((a, b) => b.taxa.length - a.taxa.length || a.full.localeCompare(b.full))
    .slice(0, 10)
})

async function loadCountry(name) {
  const requestId = ++countryRequestId
  countryLoading.value = Boolean(name)
  countryError.value = ''
  countryRows.value = []
  citationsByOccurrence.value = new Map()
  distributionPlacesByOccurrence.value = new Map()
  speciesFilter.value = ''
  expandedTaxonKey.value = ''
  expandedReferenceKey.value = ''
  activeCountryTab.value = 'species'
  if (!name) return

  const aliases = countriesByKey.value.get(countryKey(name)) || [name]
  const recordsById = new Map()
  try {
    for (const alias of aliases) {
      await forEachOccurrencePage({ country: alias }, (records) => {
        for (const record of records) {
          const id = `${record.dwc_occurrence_object_type || ''}:${record.dwc_occurrence_object_id || record.id || speciesKey(record)}`
          recordsById.set(id, record)
        }
      })
      if (requestId !== countryRequestId) return
    }
    countryRows.value = [...recordsById.values()]
    const [places, citations] = await Promise.all([
      loadDistributionPlaces(countryRows.value, requestId),
      loadCitations(countryRows.value, requestId)
    ])
    if (requestId !== countryRequestId) return
    distributionPlacesByOccurrence.value = places
    citationsByOccurrence.value = citations
  } catch {
    countryError.value = 'Could not load this country’s records. Please try again.'
  } finally {
    if (requestId === countryRequestId) countryLoading.value = false
  }
}

onMounted(() => {
  window.addEventListener('hashchange', syncCountryFromHash)
  syncCountryFromHash()
  loadCountryShapes()
  loadCountryCounts()
})

onBeforeUnmount(() => window.removeEventListener('hashchange', syncCountryFromHash))

watch(selectedCountry, () => {
  refreshMapStyles()
  focusMapOnCountry()
})
</script>