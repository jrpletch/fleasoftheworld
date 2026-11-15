<template>
  <section
    aria-label="Database statistics"
    class="relative z-10 -mt-16 lg:-mt-20"
  >
    <div class="container mx-auto px-4">
      <div
        class="rounded-2xl bg-base-foreground shadow-xl shadow-black/5 ring-1 ring-base-border/40 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-base-border/40 overflow-hidden"
      >
        <div
          v-for="item in stats"
          :key="item.key"
          class="wid-stat p-5 sm:p-6 flex flex-col gap-3"
        >
          <span
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-color/10 text-primary-color dark:bg-secondary-color/10 dark:text-secondary-color"
          >
            <HomeIcon
              :name="item.icon"
              class="h-5 w-5"
            />
          </span>
          <div>
            <div
              class="text-2xl xl:text-3xl font-bold tracking-tight tabular-nums text-base-content"
            >
              <span
                v-if="item.count === null"
                class="wid-skeleton inline-block h-8 w-24 rounded align-middle"
              />
              <ClientOnly v-else>
                <AnimateNumber :number="item.count" />
              </ClientOnly>
            </div>
            <div class="mt-1 text-sm text-base-content/60">
              {{ item.label }}
            </div>
            <div
              v-if="item.note"
              class="mt-0.5 text-xs text-base-content/50"
            >
              {{ item.note }}
            </div>
            <div
              v-if="item.fossilNote"
              class="mt-0.5 text-xs text-base-content/50"
            >
              {{ item.fossilNote }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { makeAPIRequest } from '@/utils/request'
import AnimateNumber from '../AnimateNumber.vue'
import HomeIcon from './HomeIcon.vue'

// Counts come live from TaxonWorks; null shows a loading placeholder.
const counts = ref({
  validSpecies: null,
  validExtantSpecies: null,
  validFossilSpecies: null,
  taxonNames: null,
  projectSources: null,
  citations: null,
  images: null,
  collectionObjects: null
})
const SPECIES_COUNTS_CACHE_KEY = 'fow-home-species-counts-v1'

// Keys returned by the /stats endpoint
const STATS_KEYS = {
  taxonNames: 'Taxon names',
  projectSources: 'Project sources',
  citations: 'Citations',
  images: 'Images',
  collectionObjects: 'Collection objects'
}

const stats = computed(() => [
  {
    key: 'validSpecies',
    icon: 'check',
    label: 'Valid species',
    count: counts.value.validSpecies,
    note:
      counts.value.validExtantSpecies === null
        ? ''
        : `${counts.value.validExtantSpecies.toLocaleString('en-US')} extant`,
    fossilNote:
      counts.value.validFossilSpecies === null
        ? ''
        : `${counts.value.validFossilSpecies.toLocaleString('en-US')} fossil`
  },
  { key: 'taxonNames', icon: 'tag', label: 'Scientific names', count: counts.value.taxonNames },
  { key: 'projectSources', icon: 'book', label: 'References', count: counts.value.projectSources },
  { key: 'citations', icon: 'quote', label: 'Citations', count: counts.value.citations },
  { key: 'images', icon: 'photo', label: 'Images', count: counts.value.images },
  { key: 'collectionObjects', icon: 'pin', label: 'Specimen records', count: counts.value.collectionObjects }
])

makeAPIRequest('/stats')
  .then(({ data: { data } }) => {
    for (const [key, apiKey] of Object.entries(STATS_KEYS)) {
      if (Number.isFinite(data?.[apiKey])) counts.value[key] = data[apiKey]
    }
  })
  .catch(() => {})

let validSpeciesCount = null
let fossilSpeciesCount = null

function updateSpeciesBreakdown() {
  if (validSpeciesCount !== null) counts.value.validSpecies = validSpeciesCount
  if (fossilSpeciesCount !== null) counts.value.validFossilSpecies = fossilSpeciesCount
  if (validSpeciesCount !== null && fossilSpeciesCount !== null) {
    counts.value.validExtantSpecies = validSpeciesCount - fossilSpeciesCount
    try {
      localStorage.setItem(SPECIES_COUNTS_CACHE_KEY, JSON.stringify({
        validSpecies: validSpeciesCount,
        validFossilSpecies: fossilSpeciesCount,
        validExtantSpecies: validSpeciesCount - fossilSpeciesCount
      }))
    } catch {
      // Counts still display if browser storage is unavailable.
    }
  }
}

onMounted(() => {
  try {
    const cached = JSON.parse(localStorage.getItem(SPECIES_COUNTS_CACHE_KEY) || 'null')
    if (!cached) return
    if (counts.value.validSpecies === null && Number.isFinite(cached.validSpecies)) {
      counts.value.validSpecies = cached.validSpecies
    }
    if (counts.value.validFossilSpecies === null && Number.isFinite(cached.validFossilSpecies)) {
      counts.value.validFossilSpecies = cached.validFossilSpecies
    }
    if (counts.value.validExtantSpecies === null && Number.isFinite(cached.validExtantSpecies)) {
      counts.value.validExtantSpecies = cached.validExtantSpecies
    }
  } catch {
    // Ignore missing or invalid cached values.
  }
})

function loadSpeciesCount(params, onCount) {
  makeAPIRequest('/taxon_names.json', {
    params: { page: 1, per: 1, validity: true, ...params }
  })
    .then(({ headers }) => {
      const count = Number(headers['pagination-total'])
      if (!Number.isFinite(count)) return
      onCount(count)
      updateSpeciesBreakdown()
    })
    .catch(() => {
      // Leave the loading placeholder if this count is unavailable.
    })
}

// Launch both species queries alongside /stats, and let each result update as soon as it arrives.
loadSpeciesCount(
  { rank: ['NomenclaturalRank::Iczn::SpeciesGroup::Species'] },
  (count) => { validSpeciesCount = count }
)
loadSpeciesCount(
  {
    descendants: true,
    nomenclature_group: ['Species'],
    taxon_name_classification: ['TaxonNameClassification::Iczn::Fossil'],
    rank: ['NomenclaturalRank::Iczn::SpeciesGroup::Species']
  },
  (count) => { fossilSpeciesCount = count }
)
</script>

<style scoped>
/* Hairline dividers between tiles that adapt to the column count */
.wid-stat {
  box-shadow:
    inset -1px 0 0 rgba(var(--color-base-border), 0.35),
    inset 0 -1px 0 rgba(var(--color-base-border), 0.35);
}

.wid-skeleton {
  background: linear-gradient(90deg, rgba(var(--color-base-muted), 0.6), rgba(var(--color-base-muted), 1), rgba(var(--color-base-muted), 0.6));
  background-size: 200% 100%;
  animation: wid-shimmer 1.2s infinite linear;
}

@keyframes wid-shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
</style>
