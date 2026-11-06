<template>
  <main class="min-h-screen bg-base-background text-base-content">
    <header class="border-b border-base-border/40 bg-base-foreground">
      <div class="container mx-auto box-border px-4 py-3">
        <h1 class="text-2xl font-bold">
          Siphonapterists
        </h1>
        <p class="text-sm text-base-content/70">
          Profiles of people who have studied fleas: their publications, the taxa they named, taxa named for them, and the specimens they collected.
        </p>
      </div>
    </header>

    <div class="container mx-auto box-border min-w-0 px-4 py-4">
      <div class="relative max-w-xl">
        <label
          class="block text-sm font-semibold"
          for="siphonapterist-search"
        >
          Search for a person
        </label>
        <input
          id="siphonapterist-search"
          v-model="term"
          type="search"
          autocomplete="off"
          placeholder="Surname, e.g. Smit"
          class="mt-1 box-border block w-full rounded-md border border-base-border bg-base-foreground px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          role="combobox"
          aria-controls="siphonapterist-results"
          :aria-expanded="showResults"
          @focus="resultsOpen = true"
          @keydown.esc="resultsOpen = false"
        />
        <ul
          v-if="showResults"
          id="siphonapterist-results"
          class="absolute z-[1000] mt-1 max-h-96 w-full overflow-auto rounded-md border border-base-border bg-base-foreground shadow-lg"
          role="listbox"
        >
          <li
            v-for="result in results"
            :key="result.id"
            role="option"
          >
            <button
              type="button"
              class="block w-full px-3 py-2 text-left hover:bg-base-muted/40 focus-visible:bg-base-muted/40 focus-visible:outline-none"
              @click="choose(result.id)"
            >
              <span class="font-medium">{{ result.label }}</span>
              <span class="block text-xs text-base-content/60">
                <template v-if="result.lived && result.lived !== '?-? active: unknown'">{{ result.lived }} · </template>                {{ result.publications }} {{ result.publications === 1 ? 'publication' : 'publications' }} · {{ result.roles }}
              </span>
            </button>
          </li>
          <li
            v-if="!results.length"
            class="px-3 py-2 text-sm text-base-content/60"
          >
            {{ searching ? 'Searching…' : 'No authors or collectors found.' }}
          </li>
        </ul>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span class="text-base-content/60">Featured</span>
        <button
          v-for="person in featuredSiphonapterists"
          :key="person.id"
          type="button"
          class="rounded-full border border-base-border px-3 py-1 hover:bg-base-muted/40"
          :class="{ 'border-primary text-primary': String(person.id) === String(selectedId) }"
          @click="choose(person.id)"
        >
          {{ person.label }}
        </button>
      </div>

      <p
        v-if="!selectedId"
        class="mt-8 text-sm text-base-content/70"
      >
        Search for a person or choose one of the featured siphonapterists.
      </p>

      <p
        v-else-if="error"
        class="mt-8 text-sm text-red-700"
        role="alert"
      >
        This person could not be loaded.
      </p>

      <VSpinner v-else-if="!person" />

      <template v-else>
        <section class="mt-6 grid gap-6 md:grid-cols-[14rem_1fr]">
          <figure class="m-0">
            <img
              v-if="portraitSrc"
              :src="portraitSrc"
              :alt="`Portrait of ${displayName}`"
              class="aspect-[3/4] w-full rounded-md border border-base-border object-cover"
            />
            <div
              v-else
              class="flex aspect-[3/4] w-full items-center justify-center rounded-md border border-dashed border-base-border bg-base-muted/30 text-5xl font-semibold text-base-content/40"
              role="img"
              :aria-label="`No portrait available for ${displayName}`"
            >
              {{ initials }}
            </div>
            <figcaption
              v-if="profile.credit || portrait?.caption"
              class="mt-1 text-xs text-base-content/60"
            >
              {{ profile.credit || portrait.caption }}
            </figcaption>
          </figure>

          <div class="min-w-0">
            <h2 class="text-2xl font-semibold">
              {{ displayName }}
            </h2>
            <p
              v-if="lifespan"
              class="text-sm text-base-content/70"
            >
              {{ lifespan }}
            </p>
            <p class="mt-3 text-sm leading-relaxed">
              {{ summary }}
            </p>
            <div
              v-if="articleParagraphs.length"
              class="mt-4 max-w-prose space-y-3 text-sm leading-relaxed"
            >
              <p
                v-for="(paragraph, i) in articleParagraphs"
                :key="i"
              >
                {{ paragraph }}
              </p>
            </div>
            <p
              v-else
              class="mt-4 text-sm text-base-content/55"
            >
              No biography has been added for this person yet.
            </p>
          </div>
        </section>

        <section class="mt-8">
          <h2 class="text-lg font-semibold">
            Specimens collected
            <span
              v-if="collected"
              class="font-normal text-base-content/60"
            >
              ({{ collected.total }} {{ collected.total === 1 ? 'specimen' : 'specimens' }}, {{ collected.points.length }} georeferenced)
            </span>
          </h2>
          <p
            v-if="loading.collected"
            class="mt-2 text-sm text-base-content/60"
            role="status"
          >
            Loading…
          </p>
          <PersonSpecimenMap
            v-else-if="collected?.points.length"
            :points="collected.points"
            class="mt-2 h-96 w-full rounded-md border border-base-border"
          />
          <p
            v-else
            class="mt-2 text-sm text-base-content/60"
          >
            {{ collected?.total ? 'None of the specimens collected by this person are georeferenced.' : 'No specimens collected by this person are recorded.' }}
          </p>
        </section>

        <div class="mt-8 grid gap-8 lg:grid-cols-2">
          <section>
            <h2 class="text-lg font-semibold">
              Publications
              <span
                v-if="publications"
                class="font-normal text-base-content/60"
              >
                ({{ publications.length }})
              </span>
            </h2>
            <p
              v-if="loading.publications"
              class="mt-2 text-sm text-base-content/60"
              role="status"
            >
              Loading…
            </p>
            <p
              v-else-if="!publications?.length"
              class="mt-2 text-sm text-base-content/60"
            >
              No publications recorded.
            </p>
            <template v-else>
              <template
                v-for="group in publicationGroups"
                :key="group.year"
              >
                <h3 class="mt-4 border-b border-base-border/50 text-sm font-semibold text-base-content/70">
                  {{ group.year }}
                </h3>
                <ul class="mt-1 space-y-2 text-sm">
                  <li
                    v-for="publication in group.items"
                    :key="publication.id"
                    class="leading-snug"
                  >
                    <span v-html="publication.citation" />
                    <a
                      v-if="publication.doi"
                      class="ml-1 text-primary-color hover:underline dark:text-secondary-color"
                      :href="`https://doi.org/${publication.doi}`"
                      target="_blank"
                      rel="noopener noreferrer"
                    >DOI</a>
                  </li>
                </ul>
              </template>
            </template>
          </section>

          <div class="space-y-8">
            <TaxonList
              title="Taxa named by this person"
              :taxa="namedBy"
              :loading="loading.namedBy"
              empty="No taxa are recorded with this person as author."
            />
            <TaxonList
              title="Taxa named for this person"
              :taxa="namedFor"
              :loading="loading.namedFor"
              empty="No taxa with names that appear to honor this person were found."
              note="Matched by the form of the name (the surname plus a typical ending); names are not checked against their etymology, so a few may honor someone else."
            />
          </div>
        </div>
      </template>
    </div>
  </main>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PersonSpecimenMap from './components/PersonSpecimenMap.vue'
import TaxonList from './components/TaxonList.vue'
import {
  fetchBiography,
  fetchCollected,
  fetchNamedBy,
  fetchNamedFor,
  fetchPerson,
  fetchPortrait,
  fetchPublications,
  personName,
  searchPeople
} from './data/personApi.js'
import { featuredSiphonapterists, siphonapteristProfiles } from './data/siphonapterists.js'

const baseUrl = import.meta.env.BASE_URL || '/'
const route = useRoute()
const router = useRouter()

const term = ref('')
const results = ref([])
const searching = ref(false)
const resultsOpen = ref(false)
const showResults = computed(() => resultsOpen.value && term.value.trim().length >= 2)

const selectedId = computed(() => route.query.person || null)
const person = ref(null)
const error = ref(false)
const publications = ref(null)
const namedBy = ref(null)
const namedFor = ref(null)
const collected = ref(null)
const portrait = ref(null)
const biography = ref([])
// A curated article in the profile overrides the TaxonWorks "Biography" data attribute
const articleParagraphs = computed(() =>
  profile.value.article?.length ? profile.value.article : biography.value
)
// A local image set in the curated profile overrides the TaxonWorks depiction
const portraitSrc = computed(() =>
  profile.value.image ? `${baseUrl}${profile.value.image}` : portrait.value?.src
)
const loading = reactive({ publications: false, namedBy: false, namedFor: false, collected: false })

let searchTimer
watch(term, (value) => {
  clearTimeout(searchTimer)
  const text = value.trim()
  if (text.length < 2) {
    results.value = []
    return
  }
  resultsOpen.value = true
  searching.value = true
  searchTimer = setTimeout(async () => {
    try {
      const found = await searchPeople(text)
      if (text === term.value.trim()) results.value = found
    } catch {
      results.value = []
    } finally {
      searching.value = false
    }
  }, 250)
})

function choose(id) {
  resultsOpen.value = false
  term.value = ''
  results.value = []
  router.push({ query: { ...route.query, person: String(id) } })
}

const profile = computed(() => siphonapteristProfiles[selectedId.value] || {})
const personIds = computed(() => [Number(selectedId.value), ...(profile.value.ids || [])])

const displayName = computed(() => (person.value ? personName(person.value) : ''))
const initials = computed(() =>
  [person.value?.first_name, person.value?.last_name]
    .filter(Boolean)
    .map((part) => part.trim()[0])
    .join('')
    .toUpperCase()
)

const lifespan = computed(() => {
  const p = person.value
  if (!p) return ''
  if (p.year_born || p.year_died) return `${p.year_born || '?'}–${p.year_died || '?'}`
  return ''
})

const summary = computed(() => {
  const p = person.value
  if (!p) return ''
  const parts = []
  if (p.year_active_start) {
    parts.push(
      `Active ${p.year_active_start}${p.year_active_end && p.year_active_end !== p.year_active_start ? `–${p.year_active_end}` : ''}.`
    )
  }
  const count = (list, one, many) =>
    list?.length ? `${list.length} ${list.length === 1 ? one : many}` : null
  const facts = [
    count(publications.value, 'publication', 'publications'),
    count(namedBy.value, 'taxon named', 'taxa named'),
    count(namedFor.value, 'taxon named for them', 'taxa named for them'),
    collected.value?.total ? `${collected.value.total} specimens collected` : null
  ].filter(Boolean)
  if (facts.length) parts.push(`In the database: ${facts.join(', ')}.`)
  return parts.join(' ')
})

const publicationGroups = computed(() => {
  const groups = []
  ;(publications.value || []).forEach((publication) => {
    const year = publication.year || 'Undated'
    const last = groups[groups.length - 1]
    if (last?.year === year) last.items.push(publication)
    else groups.push({ year, items: [publication] })
  })
  return groups
})

async function load(id) {
  person.value = null
  error.value = false
  publications.value = namedBy.value = namedFor.value = collected.value = null
  portrait.value = null
  biography.value = []
  if (!id) return

  const ids = [Number(id), ...(siphonapteristProfiles[id]?.ids || [])]
  const guard = (promise, key, target) => {
    loading[key] = true
    return promise
      .then((value) => {
        if (selectedId.value === id) target.value = value
      })
      .catch(() => {
        if (selectedId.value === id) target.value = key === 'collected' ? { total: 0, points: [] } : []
      })
      .finally(() => {
        if (selectedId.value === id) loading[key] = false
      })
  }

  try {
    const found = await fetchPerson(id)
    if (selectedId.value !== id) return
    person.value = found
  } catch {
    if (selectedId.value === id) error.value = true
    return
  }

  guard(fetchPublications(ids, person.value), 'publications', publications)
  guard(fetchNamedBy(ids), 'namedBy', namedBy)
  guard(fetchNamedFor(person.value.last_name), 'namedFor', namedFor)
  guard(fetchCollected(ids), 'collected', collected)
  fetchPortrait(ids)
    .then((value) => {
      if (selectedId.value === id) portrait.value = value
    })
    .catch(() => {})
  fetchBiography(ids)
    .then((value) => {
      if (selectedId.value === id) biography.value = value
    })
    .catch(() => {})
}

watch(selectedId, load, { immediate: true })
</script>
