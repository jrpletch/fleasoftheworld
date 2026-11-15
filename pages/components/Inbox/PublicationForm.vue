<template>
  <form class="publication-form rounded-xl border border-base-border bg-base-foreground p-5 sm:p-6" @submit.prevent="submit">
    <div class="publication-fields grid min-w-0 grid-cols-12 gap-x-3 gap-y-3">
      <div class="col-span-12">
        <div class="mb-1 flex items-center justify-between gap-2">
          <label for="publication-doi" class="field-label">DOI <span class="font-normal normal-case tracking-normal text-base-content/50">(searches for matches below)</span></label>
        </div>
        <div class="flex gap-1.5">
          <input id="publication-doi" v-model.trim="form.doi" class="form-field min-w-0 flex-1" placeholder="10.3897/zookeys... or https://doi.org/..." />
          <button type="button" class="clear-button" :disabled="isSubmitting || isLookingUpDoi" @click="clearForm">Clear form</button>
        </div>
        <p class="mt-1.5 text-[11px] leading-4 text-base-content/50">No DOI? Fill in what you know.</p>
      </div>

      <label class="col-span-12 min-w-0">
        <span class="field-label">Author(s)</span>
        <input v-model.trim="form.authors" class="form-field mt-1" placeholder="e.g. Rothschild, N.C." />
      </label>

      <label class="col-span-3 min-w-0 sm:col-span-2">
        <span class="field-label">Year</span>
        <input v-model.trim="form.year" inputmode="numeric" class="form-field mt-1" />
      </label>
      <label class="col-span-9 min-w-0 sm:col-span-10">
        <span class="field-label">Title <span class="font-normal normal-case tracking-normal text-base-content/50">(use quotes for exact phrases)</span></span>
        <input v-model.trim="form.title" required class="form-field mt-1" />
      </label>

      <label class="col-span-12 min-w-0 sm:col-span-8">
        <span class="field-label">Journal or book</span>
        <input v-model.trim="form.journal" class="form-field mt-1" />
      </label>
      <label class="col-span-6 min-w-0 sm:col-span-2">
        <span class="field-label">Volume</span>
        <input v-model.trim="form.volume" class="form-field mt-1" />
      </label>
      <label class="col-span-6 min-w-0 sm:col-span-2">
        <span class="field-label">Pages</span>
        <input v-model.trim="form.pages" class="form-field mt-1" />
      </label>

      <div v-if="isFindingMatches || hasCompletedMatchSearch || matchingPublications.length || matchSearchMessage" class="col-span-12 rounded-xl bg-amber-50 p-3 text-amber-950 ring-1 ring-amber-200 dark:bg-amber-400/10 dark:text-base-content dark:ring-amber-400/20 sm:p-4" role="status">
        <div class="flex items-start gap-2.5">
          <span class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-sm font-bold text-amber-800 dark:text-amber-300" aria-hidden="true">!</span>
          <div class="min-w-0 flex-1">
            <h3 class="text-[14px] font-semibold">{{ isFindingMatches ? 'Checking the project bibliography' : hasCompletedMatchSearch && !matchingPublications.length && !matchSearchMessage ? 'No matching publications found' : 'Possible matching publications in the database' }}</h3>
            <p v-if="isFindingMatches" class="mt-1 text-[13px] leading-relaxed opacity-75">Searching by the publication details you entered…</p>
            <p v-else-if="matchSearchMessage" class="mt-1 text-[13px] leading-relaxed opacity-75">{{ matchSearchMessage }}</p>
            <p v-else-if="hasCompletedMatchSearch && !matchingPublications.length" class="mt-1 text-[13px] leading-relaxed opacity-75">No citations match these details in the project bibliography.</p>
            <div v-if="hasCompletedMatchSearch && !matchingPublications.length && !matchSearchMessage && parseDoi(form.doi) && !hasLookedUpDoi" class="mt-3 flex flex-wrap items-center gap-3">
              <p class="text-[13px] leading-relaxed opacity-75">Use the DOI to fill the citation details.</p>
              <button type="button" class="lookup-button" :disabled="isLookingUpDoi" @click="lookupDoiDetails">
                {{ isLookingUpDoi ? 'Looking up…' : 'Look up DOI details' }}
              </button>
            </div>
            <ol v-if="matchingPublications.length" class="mt-2 max-h-52 list-decimal space-y-2 overflow-y-auto pl-5">
              <li v-for="publication in matchingPublications" :key="publication.key" class="pl-1 text-[13px] leading-[1.45]">
                <RouterLink :to="{ path: '/resources/tw/filter/bibliography', query: { query_term: publication.searchTerm } }" class="font-semibold text-primary-color hover:underline">
                  {{ publication.title || 'Untitled publication' }}
                </RouterLink>
                <p v-if="publication.metadata" class="mt-0.5 text-[12px] opacity-75">{{ publication.metadata }}</p>
              </li>
            </ol>
          </div>
        </div>
      </div>

      <label class="col-span-12 min-w-0">
        <span class="field-label">Taxa treated <span class="font-normal normal-case tracking-normal text-base-content/50">(optional)</span></span>
        <input v-model.trim="form.taxa" class="form-field mt-1" placeholder="e.g. Pulex, new species of Xenopsylla from Namibia" />
      </label>
      <label class="col-span-12 min-w-0">
        <span class="field-label">Link to the PDF <span class="font-normal normal-case tracking-normal text-base-content/50">(optional — e.g. journal page, Zenodo, ResearchGate)</span></span>
        <input v-model.trim="form.url" type="url" class="form-field mt-1" placeholder="https://..." />
      </label>

      <div class="col-span-12 flex flex-wrap items-center gap-x-4 gap-y-1">
        <label class="flex items-center gap-2 text-[13px] text-base-content/75">
          <input v-model="form.isAuthor" type="checkbox" class="site-checkbox h-4 w-4" />
          I am an author of this work
        </label>
        <label class="flex items-center gap-2 text-[13px] text-base-content/75">
          <input v-model="form.hasPdf" type="checkbox" class="site-checkbox h-4 w-4" />
          I have a PDF of this work
        </label>
      </div>

      <label class="col-span-12 min-w-0">
        <span class="field-label">Note <span class="font-normal normal-case tracking-normal text-base-content/50">(optional)</span></span>
        <textarea v-model.trim="form.notes" rows="2" class="form-field mt-1 resize-y" />
      </label>

      <label class="col-span-6 min-w-0">
        <span class="field-label">Your name</span>
        <input v-model.trim="form.name" required autocomplete="name" class="form-field mt-1" />
      </label>
      <label class="col-span-6 min-w-0">
        <span class="field-label">E-mail</span>
        <input v-model.trim="form.email" type="email" required autocomplete="email" class="form-field mt-1" />
      </label>
      <label class="col-span-12 min-w-0">
        <span class="field-label">Institution <span class="font-normal normal-case tracking-normal text-base-content/50">(optional)</span></span>
        <input v-model.trim="form.institution" autocomplete="organization" class="form-field mt-1" />
      </label>
      <div class="col-span-12">
        <TurnstileChallenge ref="turnstileWidget" v-model="turnstileToken" />
      </div>

      <label class="honeypot" aria-hidden="true">
        Leave this field empty
        <input v-model="form.company" tabindex="-1" autocomplete="off" />
      </label>
    </div>

    <div class="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-base-border pt-4">
      <p class="max-w-[380px] text-[12px] leading-[1.5] text-base-content/65">Your contact details are sent privately to the editors.</p>
      <div class="flex items-center gap-2">
        <button type="submit" class="submit-button" :disabled="!isContributionServiceConfigured || isSubmitting || isSubmitted">
          {{ isSubmitted ? 'Submission sent' : isSubmitting ? 'Sending...' : 'Submit publication' }}
        </button>
      </div>
    </div>
    <p v-if="status" class="mt-3 text-[13px] leading-relaxed text-base-content/75" role="status">{{ status }}</p>
  </form>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import TurnstileChallenge from './TurnstileChallenge.vue'
import { isContributionServiceConfigured, submitContribution } from '../../data/contributionSubmission.js'
import { lookupDoi, parseDoi } from './doiLookup.js'
import { findProjectPublicationMatches, hasPublicationSearchCriteria } from '../../data/publicationMatches.js'

const props = defineProps({ doi: { type: String, default: '' } })
const form = reactive({ name: '', email: '', institution: '', isAuthor: false, hasPdf: false, doi: parseDoi(props.doi), title: '', authors: '', year: '', journal: '', volume: '', pages: '', url: '', taxa: '', notes: '', company: '' })
const isFindingMatches = ref(false)
const hasCompletedMatchSearch = ref(false)
const isLookingUpDoi = ref(false)
const hasLookedUpDoi = ref(false)
const isSubmitting = ref(false)
const isSubmitted = ref(false)
const status = ref('')
const matchingPublications = ref([])
const matchSearchMessage = ref('')
const turnstileToken = ref('')
const turnstileWidget = ref(null)
let matchSearchId = 0
let matchSearchTimer

async function lookupDoiDetails() {
  const doi = parseDoi(form.doi)
  if (!doi || isLookingUpDoi.value) return
  isLookingUpDoi.value = true
  status.value = ''
  try {
    const details = await lookupDoi(doi)
    for (const key of ['title', 'authors', 'year', 'journal']) {
      if (details[key]) form[key] = details[key]
    }
    form.volume = [details.volume, details.issue ? `(${details.issue})` : ''].filter(Boolean).join(' ')
    form.pages = details.pages
    if (details.doi) form.doi = details.doi
    hasLookedUpDoi.value = true
    status.value = 'DOI details found. Please review them before submitting.'
  } catch (error) {
    status.value = error.message || 'DOI lookup failed. Enter the publication details manually.'
  } finally {
    isLookingUpDoi.value = false
  }
}

async function findMatchingPublications() {
  if (!hasPublicationSearchCriteria(form)) return
  const requestId = ++matchSearchId
  isFindingMatches.value = true
  hasCompletedMatchSearch.value = false
  matchingPublications.value = []
  matchSearchMessage.value = ''
  try {
    const result = await findProjectPublicationMatches(form)
    if (requestId !== matchSearchId) return
    matchingPublications.value = result.matches
    matchSearchMessage.value = result.message
  } catch {
    if (requestId !== matchSearchId) return
    matchSearchMessage.value = 'The bibliography could not be fully checked right now. Please try again later.'
  } finally {
    if (requestId === matchSearchId) {
      isFindingMatches.value = false
      hasCompletedMatchSearch.value = true
    }
  }
}

watch(() => [form.doi, form.title, form.authors, form.year, form.journal, form.volume], (values, previousValues) => {
  matchSearchId += 1
  clearTimeout(matchSearchTimer)
  matchingPublications.value = []
  matchSearchMessage.value = ''
  isFindingMatches.value = false
  hasCompletedMatchSearch.value = false
  if (previousValues && values[0] !== previousValues[0]) hasLookedUpDoi.value = false
  const hasDoi = Boolean(parseDoi(form.doi))
  if (hasDoi || hasPublicationSearchCriteria(form)) {
    matchSearchTimer = setTimeout(() => { void findMatchingPublications() }, 500)
  }
}, { flush: 'sync', immediate: true })

async function submit() {
  if (form.company) return
  if (isSubmitting.value || isSubmitted.value) return
  isSubmitting.value = true
  status.value = ''
  try {
    await submitContribution('publication', { ...form }, turnstileToken.value)
    isSubmitted.value = true
    turnstileToken.value = ''
    status.value = 'Thank you. Your publication submission was sent to the editors.'
  } catch (error) {
    turnstileWidget.value?.reset()
    status.value = error.message || 'We could not send your submission. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

function clearForm() {
  matchSearchId += 1
  clearTimeout(matchSearchTimer)
  Object.assign(form, {
    name: '', email: '', institution: '', isAuthor: false, hasPdf: false,
    doi: '', title: '', authors: '', year: '', journal: '', volume: '',
    pages: '', url: '', taxa: '', notes: '', company: ''
  })
  isSubmitted.value = false
  status.value = ''
  matchingPublications.value = []
  matchSearchMessage.value = ''
  isFindingMatches.value = false
  hasCompletedMatchSearch.value = false
  hasLookedUpDoi.value = false
  turnstileToken.value = ''
  turnstileWidget.value?.reset()
}
</script>

<style scoped>
.field-label {
  display: block;
  color: color-mix(in srgb, var(--tp-base-content) 68%, transparent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.045em;
  line-height: 1.3;
  text-transform: uppercase;
}
.publication-fields > div,
.publication-fields > label { min-width: 0; }
.form-field {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 38px;
  box-sizing: border-box;
  border: 1px solid var(--tp-base-border);
  border-radius: 5px;
  background: var(--tp-base-background);
  padding: 0.5rem 0.7rem;
  color: var(--tp-base-content);
  font-size: 13px;
  line-height: 1.25;
  font-weight: 400;
}
.form-field::placeholder { color: var(--tp-base-soft); }
.form-field:focus-visible { border-color: var(--tp-secondary); outline: 2px solid color-mix(in srgb, var(--tp-secondary) 18%, transparent); outline-offset: 1px; }
.lookup-button {
  min-height: 38px;
  box-sizing: border-box;
  border: 1px solid var(--tp-base-border);
  border-radius: 6px;
  background: var(--tp-base-foreground);
  padding: 0 0.9rem;
  color: var(--tp-base-content);
  font-size: 12px;
  white-space: nowrap;
}
.lookup-button:hover:not(:disabled) { background: var(--tp-base-background); }
.lookup-button:disabled { cursor: not-allowed; opacity: 0.5; }
.submit-button {
  border-radius: 5px;
  background: var(--tp-primary);
  padding: 0.65rem 1rem;
  color: var(--tp-primary-content);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
}
.submit-button:hover { background: color-mix(in srgb, var(--tp-primary) 88%, black); }
.submit-button:focus-visible { outline: 2px solid var(--tp-secondary); outline-offset: 2px; }
.clear-button {
  border: 1px solid var(--tp-base-border);
  border-radius: 5px;
  background: var(--tp-base-foreground);
  padding: 0.65rem 1rem;
  color: var(--tp-base-content);
  font-size: 12px;
  line-height: 1.3;
}
.clear-button:hover:not(:disabled) { background: var(--tp-base-background); }
.clear-button:disabled { cursor: not-allowed; opacity: 0.5; }
.publication-form { box-shadow: 0 5px 16px color-mix(in srgb, var(--tp-primary) 12%, transparent); }
.site-checkbox { accent-color: var(--tp-secondary); }
.honeypot { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
</style>
