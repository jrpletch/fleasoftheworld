<template>
  <main class="min-h-screen bg-base-background text-base-content">
    <header class="border-b border-base-border/40 bg-base-foreground">
      <div class="container mx-auto box-border px-4 py-4">
        <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <RouterLink
              to="/resources/tw/filter/bibliography"
              class="text-sm text-primary-color hover:underline dark:text-secondary-color"
            >
              ← Bibliography
            </RouterLink>
            <h1 class="mt-2 text-2xl font-bold">Publication record</h1>
          </div>
          <GlobalSearch
            class="w-full md:max-w-sm"
            variant="page"
            placeholder="Search taxa, references or authors…"
          />
        </div>
        <p class="mt-1 max-w-4xl text-sm text-base-content/70">
          Taxa, nomenclatural acts, specimens, and asserted distributions linked to this source in TaxonWorks.
        </p>
      </div>
    </header>

    <div class="container mx-auto box-border min-w-0 space-y-6 px-4 py-5">
      <VCard>
        <VCardContent>
          <VSpinner v-if="loading" />
          <p v-else-if="error" class="text-sm text-red-700" role="alert">
            This publication record could not be loaded.
          </p>
          <template v-else-if="profile">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0 max-w-5xl text-base leading-relaxed [&_i]:italic [&_a]:break-all">
                <div v-html="citationWithAuthorLinks" />
              </div>
              <a
                v-if="profile.source.doi"
                :href="`https://doi.org/${profile.source.doi}`"
                target="_blank"
                rel="noopener noreferrer"
                class="shrink-0 text-sm font-semibold text-primary-color hover:underline dark:text-secondary-color"
              >
                DOI
              </a>
            </div>
            <div class="mt-4 flex flex-wrap gap-2 text-xs text-base-content/70">
              <span class="rounded-full border border-base-border px-2.5 py-1">{{ profile.taxa.length }} taxa linked</span>
              <span class="rounded-full border border-base-border px-2.5 py-1">{{ profile.citationCount }} TaxonWorks links</span>
              <span class="rounded-full border border-base-border px-2.5 py-1">{{ profile.nomenclaturalActs.length }} nomenclatural acts</span>
              <span class="rounded-full border border-base-border px-2.5 py-1">{{ profile.specimens.length }} specimen records</span>
              <span class="rounded-full border border-base-border px-2.5 py-1">{{ profile.distributionCount }} asserted distributions</span>
            </div>
          </template>
        </VCardContent>
      </VCard>

      <div v-if="profile" class="grid min-w-0 gap-6 lg:grid-cols-2">
        <VCard>
          <VCardHeader>Taxa linked to this source ({{ profile.taxa.length }})</VCardHeader>
          <VCardContent>
            <ul v-if="profile.taxa.length" class="max-h-96 space-y-2 overflow-y-auto">
              <li v-for="taxon in profile.taxa" :key="taxon.key" class="text-sm">
                <RouterLink
                  :to="`/otus/${taxon.otuId}/overview`"
                  class="text-primary-color hover:underline dark:text-secondary-color [&_i]:italic"
                  v-html="sanitizeAndLinkifyHtml(taxon.html)"
                />
              </li>
            </ul>
            <p v-else class="text-sm text-base-content/60">No taxa are linked to this source.</p>
          </VCardContent>
        </VCard>

        <VCard>
          <VCardHeader>Nomenclatural acts</VCardHeader>
          <VCardContent class="max-h-[38rem] space-y-5 overflow-y-auto">
            <section>
              <h3 class="text-sm font-semibold">New genera described ({{ profile.newGenera.length }})</h3>
              <ul v-if="profile.newGenera.length" class="mt-2 space-y-2 text-sm">
                <li v-for="act in profile.newGenera" :key="`genus-${act.id}`">
                  <RouterLink
                    v-if="act.otuId"
                    :to="`/otus/${act.otuId}/overview`"
                    class="font-medium text-primary-color hover:underline dark:text-secondary-color [&_i]:italic"
                    v-html="sanitizeAndLinkifyHtml(act.html)"
                  />
                  <span v-else class="font-medium [&_i]:italic" v-html="sanitizeAndLinkifyHtml(act.html)" />
                  <span v-if="act.pages" class="ml-1 text-xs text-base-content/60">p. {{ act.pages }}</span>
                </li>
              </ul>
              <p v-else class="mt-1 text-xs text-base-content/60">No genera are recorded as described in this source.</p>
            </section>

            <section>
              <h3 class="text-sm font-semibold">New species described ({{ profile.newSpecies.length }})</h3>
              <ul v-if="profile.newSpecies.length" class="mt-2 space-y-2 text-sm">
                <li v-for="act in profile.newSpecies" :key="`species-${act.id}`">
                  <RouterLink
                    v-if="act.otuId"
                    :to="`/otus/${act.otuId}/overview`"
                    class="font-medium text-primary-color hover:underline dark:text-secondary-color [&_i]:italic"
                    v-html="sanitizeAndLinkifyHtml(act.html)"
                  />
                  <span v-else class="font-medium [&_i]:italic" v-html="sanitizeAndLinkifyHtml(act.html)" />
                  <span v-if="act.pages" class="ml-1 text-xs text-base-content/60">p. {{ act.pages }}</span>
                </li>
              </ul>
              <p v-else class="mt-1 text-xs text-base-content/60">No species are recorded as described in this source.</p>
            </section>

            <section>
              <h3 class="text-sm font-semibold">Taxa synonymized ({{ profile.synonymizations.length }})</h3>
              <ul v-if="profile.synonymizations.length" class="mt-2 space-y-2 text-sm">
                <li v-for="act in profile.synonymizations" :key="`synonym-${act.id}`">
                  <span class="italic">{{ act.subject }}</span>
                  <span class="text-base-content/70"> — {{ act.subjectStatus || 'synonymized with' }} — </span>
                  <span class="italic">{{ act.object }}</span>
                  <span v-if="act.pages" class="ml-1 text-xs text-base-content/60">p. {{ act.pages }}</span>
                </li>
              </ul>
              <p v-else class="mt-1 text-xs text-base-content/60">No synonymies are linked to this source.</p>
            </section>

            <section>
              <h3 class="text-sm font-semibold">Higher-rank taxa promoted or demoted ({{ profile.rankChanges.length }})</h3>
              <ul v-if="profile.rankChanges.length" class="mt-2 space-y-2 text-sm">
                <li v-for="act in profile.rankChanges" :key="`rank-${act.id}`">
                  <strong>{{ act.direction }}:</strong>
                  <span class="italic">{{ act.subject }}</span> ({{ act.subjectRank }})
                  <span class="text-base-content/70"> → </span>
                  <span class="italic">{{ act.object }}</span> ({{ act.objectRank }})
                  <span v-if="act.pages" class="ml-1 text-xs text-base-content/60">p. {{ act.pages }}</span>
                </li>
              </ul>
              <p v-else class="mt-1 text-xs text-base-content/60">No higher-rank changes are linked to this source.</p>
            </section>

            <section v-if="profile.otherNomenclaturalActs.length || profile.otherRelationships.length">
              <h3 class="text-sm font-semibold">Other linked nomenclatural acts</h3>
              <ul class="mt-2 space-y-2 text-sm">
                <li v-for="act in profile.otherNomenclaturalActs" :key="`other-name-${act.id}`">
                  <RouterLink
                    v-if="act.otuId"
                    :to="`/otus/${act.otuId}/overview`"
                    class="font-medium text-primary-color hover:underline dark:text-secondary-color [&_i]:italic"
                    v-html="sanitizeAndLinkifyHtml(act.html)"
                  />
                  <span v-else class="font-medium [&_i]:italic" v-html="sanitizeAndLinkifyHtml(act.html)" />
                  <span v-if="act.pages" class="ml-1 text-xs text-base-content/60">p. {{ act.pages }}</span>
                </li>
                <li v-for="act in profile.otherRelationships" :key="`other-rel-${act.id}`">
                  <span class="italic">{{ act.subject }}</span>
                  <span class="text-base-content/70"> {{ act.subjectStatus || act.kind }} </span>
                  <span class="italic">{{ act.object }}</span>
                  <span v-if="act.pages" class="ml-1 text-xs text-base-content/60">p. {{ act.pages }}</span>
                </li>
              </ul>
            </section>
          </VCardContent>
        </VCard>
      </div>

      <SourceImageGallery v-if="profile" :images="profile.images" />

      <VCard v-if="profile">
        <VCardHeader>Specimens and asserted distributions</VCardHeader>
        <VCardContent>
          <h2 class="mb-3 text-sm font-semibold">
            {{ profile.specimenPoints.length }} georeferenced specimens · {{ profile.distributionAreaCount }} distribution areas
          </h2>
          <SourceActivityMap
            :points="profile.specimenPoints"
            :distributions="profile.distributionFeatures"
            class="h-[32rem] w-full rounded-md border border-base-border"
          />
          <div class="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-base-content/70">
            <span class="flex items-center gap-2">
              <span class="h-3 w-3 rotate-45 border border-white" style="background:var(--tp-map-type-material)" />
              Primary type
            </span>
            <span class="flex items-center gap-2">
              <span class="h-3 w-3 rounded-full border border-white" style="background:var(--tp-map-collection-object)" />
              Other specimen
            </span>
            <span class="flex items-center gap-2">
              <span class="h-3 w-3 rounded-sm border" style="background:color-mix(in srgb, var(--tp-map-asserted) 35%, transparent);border-color:var(--tp-map-asserted)" />
              Asserted distribution
            </span>
          </div>
          <p class="mt-2 text-xs text-base-content/55">
            Click a specimen marker for its taxon and collection details, or a shaded area to see all taxa with source-linked asserted distributions there. {{ profile.distributionCount }} assertions are cited in TaxonWorks.
          </p>
          <p class="mt-5 border-t border-base-border/50 pt-3 text-xs text-base-content/55">
            These are records linked to this source in TaxonWorks; they may not include every taxon or specimen mentioned in the publication.
          </p>
        </VCardContent>
      </VCard>
    </div>
  </main>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { sanitizeAndLinkifyHtml } from '@/utils'
import GlobalSearch from '../components/Search/GlobalSearch.vue'
import SourceImageGallery from '../components/SourceImageGallery.vue'
import SourceActivityMap from '../components/SourceActivityMap.vue'
import { findSiphonapteristAuthors } from '../data/personApi.js'
import { fetchSourceProfile } from '../data/sourceProfile.js'

const route = useRoute()
const loading = ref(false)
const error = ref(false)
const profile = ref(null)
const siphonapteristAuthors = ref([])
const citationWithAuthorLinks = computed(() => {
  const citation = sanitizeAndLinkifyHtml(profile.value?.source?.cached || '')
  const authors = siphonapteristAuthors.value
  const year = String(profile.value?.source?.year || profile.value?.source?.stated_year || '')
  if (!citation || !authors.length || !year) return citation

  const yearMatch = new RegExp(`\\(?\\s*${year}\\s*\\)?`).exec(citation)
  if (!yearMatch) return citation

  const bySurname = new Map()
  for (const author of authors) {
    const [surname, givenNames = ''] = author.label.split(',').map((part) => part.trim())
    const key = surname.toLocaleLowerCase()
    if (!bySurname.has(key)) bySurname.set(key, [])
    const tokens = givenNames.match(/[a-z]+/gi) || []
    const initials = tokens.length && tokens.every((token) => token.length === 1)
      ? tokens.join('').toLocaleLowerCase()
      : tokens.map((token) => token[0].toLocaleLowerCase()).join('')
    bySurname.get(key).push({ ...author, surname, initials })
  }

  const surnames = [...bySurname.keys()].sort((a, b) => b.length - a.length)
  const specialRegexCharacters = new Set(['.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\'])
  const escapeRegExp = (value) => [...value].map((character) =>
    specialRegexCharacters.has(character) ? `\\${character}` : character
  ).join('')
  const authorPattern = new RegExp(
    `\\b(${surnames.map(escapeRegExp).join('|')})(?:\\s*,\\s*((?:[A-Z]\\.(?:\\s*|-\\s*)?)+))?`,
    'gi'
  )
  const prefix = citation.slice(0, yearMatch.index).replace(authorPattern, (match, surname, initials = '') => {
    const candidates = bySurname.get(surname.toLocaleLowerCase()) || []
    const requestedInitials = initials.match(/[a-z]/gi)?.join('').toLocaleLowerCase() || ''
    const author = requestedInitials
      ? candidates.find((candidate) => candidate.initials === requestedInitials)
      : candidates.length === 1 ? candidates[0] : null
    if (!author) return match

    const href = `#/siphonapterists?person=${author.id}`
    return `<a href="${href}" class="font-medium text-primary-color hover:underline dark:text-secondary-color">${match}</a>`
  })
  return prefix + citation.slice(yearMatch.index)
})

async function loadSource(id) {
  profile.value = null
  siphonapteristAuthors.value = []
  error.value = false
  if (!/^\d+$/.test(String(id || ''))) {
    error.value = true
    return
  }

  loading.value = true
  try {
    const sourceId = String(id)
    profile.value = await fetchSourceProfile(sourceId)
    findSiphonapteristAuthors(profile.value.source.author).then((authors) => {
      if (String(route.params.id) === sourceId) siphonapteristAuthors.value = authors
    })
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

watch(() => route.params.id, loadSource, { immediate: true })
</script>
