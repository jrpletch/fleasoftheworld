<template>
  <VCard>
    <VCardHeader>
      Collection metadata
      <span
        v-if="grandTotal"
        class="font-normal"
      >
        ({{ grandTotal }} records)
      </span>
    </VCardHeader>
    <VCardContent class="min-h-[6rem]">
      <VSpinner v-if="loading" />

      <p
        v-else-if="!grandTotal"
        class="text-sm"
      >
        No preserved specimen records available.
      </p>

      <div
        v-else
        class="flex flex-col gap-6"
      >
        <div class="flex flex-wrap items-center gap-4 text-xs">
          <span class="flex items-center gap-1">
            <span
              class="inline-block h-3 w-3"
              :style="{ background: TW_COLOR }"
            />
            TaxonWorks ({{ totals.tw }})
          </span>
          <span
            v-if="hasGbif"
            class="flex items-center gap-1"
          >
            <span
              class="inline-block h-3 w-3"
              :style="{ background: GBIF_COLOR }"
            />
            GBIF preserved specimens ({{ totals.gbif }})
          </span>
          <span v-if="gbifError">GBIF data could not be loaded.</span>
        </div>

        <div
          class="flex flex-wrap gap-1 border-b border-base-border/50"
          role="tablist"
          aria-label="Summary charts"
        >
          <button
            v-for="tab in tabs"
            :id="`specimen-summary-tab-${tab.id}`"
            :key="tab.id"
            type="button"
            role="tab"
            class="border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :class="
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-base-content/60 hover:text-base-content'
            "
            :aria-selected="activeTab === tab.id"
            :aria-controls="`specimen-summary-panel-${tab.id}`"
            @click="selectedTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>

        <section
          :id="`specimen-summary-panel-${activeTab}`"
          role="tabpanel"
          :aria-labelledby="`specimen-summary-tab-${activeTab}`"
          tabindex="0"
        >
          <template v-if="activeTab === 'phenology'">
            <p class="mb-1 text-xs">Records by collection month</p>
            <StackedBars :bars="monthBars" />
          </template>

          <template v-else-if="activeTab === 'elevation'">
            <p class="mb-2 text-xs">{{ elevationSummary }}</p>
            <ElevationMountain
              :rows="elevationBands"
              :estimating="estimating"
            />
          </template>

          <template v-else-if="activeTab === 'biomes'">
            <p class="mb-2 text-xs">
              WWF terrestrial biome at each record's coordinates. Every
              TaxonWorks record with coordinates is counted, but many
              coordinates are best-estimate georeferences, so a record near a
              biome boundary may fall in a neighboring biome. GBIF counts are
              extrapolated from a sample of georeferenced records. Records
              without coordinates are not included.
              <span v-if="loadingBiomes">Loading…</span>
            </p>
            <BiomeBars :records="biomeRecords" />
          </template>

          <template v-else-if="activeTab === 'timeline'">
            <p class="mb-1 text-xs">
              Records by collection year{{
                binSize > 1 ? ` (${binSize}-year bins)` : ''
              }}
            </p>
            <StackedBars
              :bars="yearBars"
              :label-every="yearLabelEvery"
            />
          </template>

          <template v-else-if="activeTab === 'countries'">
            <HorizontalBars :rows="countryRows" />
            <p
              v-if="countries.length > countryRows.length"
              class="mt-1 text-xs"
            >
              Top {{ countryRows.length }} of {{ countries.length }} countries.
            </p>
          </template>

          <template v-else-if="activeTab === 'collections'">
            <p class="mb-2 text-xs">
              Institution codes as recorded by each source.
            </p>
            <HorizontalBars :rows="institutionRows" />
            <p
              v-if="institutions.length > institutionRows.length"
              class="mt-1 text-xs"
            >
              Top {{ institutionRows.length }} of
              {{ institutions.length }} collections.
            </p>
          </template>
        </section>
      </div>
    </VCardContent>
  </VCard>
</template>

<script setup>
import { computed, ref } from 'vue'
import StackedBars from './components/StackedBars.vue'
import HorizontalBars from './components/HorizontalBars.vue'
import ElevationMountain from './components/ElevationMountain.vue'
import BiomeBars from './components/BiomeBars.vue'
import { useSpecimenSummary } from './composables/useSpecimenSummary.js'
import { TW_COLOR, GBIF_COLOR, MONTH_NAMES } from './utils/chart.js'

const MAX_COUNTRIES = 10
const MAX_INSTITUTIONS = 15
const MAX_YEAR_BARS = 60

const props = defineProps({
  otuId: {
    type: [String, Number],
    required: true
  },
  otu: {
    type: Object,
    required: true
  },
  taxon: {
    type: Object,
    required: true
  }
})

const {
  loading,
  gbifError,
  hasGbif,
  totals,
  months,
  years,
  countries,
  institutions,
  elevationBands,
  estimating,
  biomeRecords,
  loadingBiomes
} = useSpecimenSummary({
  otuId: props.otuId,
  taxon: props.taxon,
  otu: props.otu
})

const grandTotal = computed(() => totals.value.tw + totals.value.gbif)

const monthBars = computed(() =>
  MONTH_NAMES.map((label, i) => ({
    label,
    tw: months.value.tw[i],
    gbif: months.value.gbif[i]
  }))
)

const binSize = computed(() => {
  const all = [...years.value.tw.keys(), ...years.value.gbif.keys()]
  if (!all.length) return 1
  const span = Math.max(...all) - Math.min(...all) + 1
  return Math.max(1, Math.ceil(span / MAX_YEAR_BARS / 5) * 5)
})

const yearBars = computed(() => {
  const all = [...years.value.tw.keys(), ...years.value.gbif.keys()]
  if (!all.length) return []

  const size = binSize.value
  const start = Math.floor(Math.min(...all) / size) * size
  const end = Math.max(...all)
  const bars = []

  for (let from = start; from <= end; from += size) {
    const sum = (map) => {
      let total = 0
      for (let y = from; y < from + size; y++) total += map.get(y) || 0
      return total
    }
    bars.push({
      label: size > 1 ? `${from}s` : String(from),
      tw: sum(years.value.tw),
      gbif: sum(years.value.gbif)
    })
  }

  return bars
})

const yearLabelEvery = computed(() => Math.max(1, Math.ceil(yearBars.value.length / 7)))

const institutionRows = computed(() =>
  institutions.value.slice(0, MAX_INSTITUTIONS).map((c) => ({
    label: c.name,
    tw: c.tw,
    gbif: c.gbif
  }))
)

const countryRows = computed(() =>
  countries.value.slice(0, MAX_COUNTRIES).map((c) => ({
    label: c.name,
    tw: c.tw,
    gbif: c.gbif
  }))
)

const tabs = computed(() =>
  [
    {
      id: 'phenology',
      label: 'Phenology',
      show: monthBars.value.some((b) => b.tw + b.gbif)
    },
    { id: 'elevation', label: 'Elevation', show: !!elevationSummary.value },
    {
      id: 'biomes',
      label: 'Biomes',
      show: biomeRecords.value.length > 0
    },
    { id: 'timeline', label: 'Timeline', show: yearBars.value.length > 0 },
    { id: 'countries', label: 'Countries', show: countryRows.value.length > 0 },
    {
      id: 'collections',
      label: 'Collections',
      show: institutionRows.value.length > 0
    }
  ].filter((t) => t.show)
)

const selectedTab = ref(null)
const activeTab = computed(() =>
  tabs.value.some((t) => t.id === selectedTab.value)
    ? selectedTab.value
    : tabs.value[0]?.id
)

const elevationSummary = computed(() => {
  const used = elevationBands.value.filter((b) => b.total)
  if (!used.length) {
    return elevationBands.value.some((b) => b.estimatedTotal)
      ? 'No recorded elevations; showing rough estimates from coordinates.'
      : ''
  }

  const n = used.reduce((sum, b) => sum + b.total, 0)
  const lo = used[0]
  const hi = used[used.length - 1]
  const peak = used.reduce((a, b) => (b.total > a.total ? b : a))

  return `${n} records with a recorded elevation, from the ${lo.label} m band to ${hi.label} m; most from ${peak.label} m. Records without a collection month appear only under All months.`
})
</script>
